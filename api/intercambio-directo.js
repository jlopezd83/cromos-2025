const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { id_usuario_envia, id_usuario_recibe, cromos_envia, cromos_recibe } = req.body;

  if (!id_usuario_envia || !id_usuario_recibe || !Array.isArray(cromos_envia) || !Array.isArray(cromos_recibe)) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  // 1. Verificar disponibilidad real de cromos para ambos usuarios (repetidos, pegado=false)
  async function tieneRepetido(id_usuario, id_cromo) {
    const { data, error } = await supabase
      .from('usuarios_cromos')
      .select('id')
      .eq('id_usuario', id_usuario)
      .eq('id_cromo', id_cromo)
      .eq('pegado', false)
      .limit(1)
      .maybeSingle();
    return data ? data.id : null;
  }

  // Verificar que ambos usuarios pueden dar todos los cromos seleccionados
  let ids_envia = [];
  let ids_recibe = [];
  for (const c of cromos_envia) {
    const idFila = await tieneRepetido(id_usuario_envia, c.id_cromo);
    if (!idFila) {
      return res.status(400).json({ error: 'No tienes repetidos suficientes para intercambiar' });
    }
    ids_envia.push({ id: idFila, id_cromo: c.id_cromo });
  }
  for (const c of cromos_recibe) {
    const idFila = await tieneRepetido(id_usuario_recibe, c.id_cromo);
    if (!idFila) {
      return res.status(400).json({ error: 'El otro usuario no tiene repetidos suficientes para intercambiar' });
    }
    ids_recibe.push({ id: idFila, id_cromo: c.id_cromo });
  }

  // 2. Realizar el intercambio de forma atómica
  const { data: intercambio, error: errorIntercambio } = await supabase
    .from('intercambios')
    .insert({
      id_usuario_envia,
      id_usuario_recibe,
      estado: 'completado',
      fecha: new Date().toISOString(),
    })
    .select()
    .single();

  if (errorIntercambio || !intercambio) {
    return res.status(500).json({ error: 'Error creando el intercambio' });
  }

  // Insertar cromos intercambiados en registro
  const registros_cromos = [];
  for (const c of cromos_envia) {
    registros_cromos.push({
      id_intercambio: intercambio.id,
      id_usuario: id_usuario_envia,
      id_cromo: c.id_cromo,
      cantidad: 1,
    });
  }
  for (const c of cromos_recibe) {
    registros_cromos.push({
      id_intercambio: intercambio.id,
      id_usuario: id_usuario_recibe,
      id_cromo: c.id_cromo,
      cantidad: 1,
    });
  }
  const { error: errorCromos } = await supabase
    .from('intercambio_cromos')
    .insert(registros_cromos);
  if (errorCromos) {
    return res.status(500).json({ error: 'Error registrando cromos del intercambio' });
  }

  // 3. Actualizar los cromos: cambiar el id_usuario de la fila repetida
  // El usuario que da, pasa su fila a id_usuario del que recibe
  for (const { id } of ids_envia) {
    await supabase
      .from('usuarios_cromos')
      .update({ id_usuario: id_usuario_recibe })
      .eq('id', id);
  }
  for (const { id } of ids_recibe) {
    await supabase
      .from('usuarios_cromos')
      .update({ id_usuario: id_usuario_envia })
      .eq('id', id);
  }

  return res.status(200).json({
    ok: true,
    intercambio_id: intercambio.id,
    cromos_envia,
    cromos_recibe,
    maximo_intercambio: cromos_envia.length,
  });
} 