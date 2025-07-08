const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { id_usuario_envia, id_usuario_recibe, ids_envia, ids_recibe } = req.body;

  if (!id_usuario_envia || !id_usuario_recibe || !Array.isArray(ids_envia) || !Array.isArray(ids_recibe)) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  console.log('Intercambio directo recibido:', {
    id_usuario_envia,
    id_usuario_recibe,
    ids_envia,
    ids_recibe
  });

  // 1. Verificar que los ids recibidos existen y son pegado=false
  async function esRepetido(id) {
    const { data, error } = await supabase
      .from('usuarios_cromos')
      .select('id, id_cromo, pegado')
      .eq('id', id)
      .single();
    if (error || !data || data.pegado !== false) return null;
    return data;
  }

  // Verificar ids_envia
  let cromos_envia = [];
  for (const id of ids_envia) {
    const fila = await esRepetido(id);
    if (!fila) {
      return res.status(400).json({ error: 'No tienes repetidos suficientes para intercambiar' });
    }
    cromos_envia.push(fila);
  }
  // Verificar ids_recibe
  let cromos_recibe = [];
  for (const id of ids_recibe) {
    const fila = await esRepetido(id);
    if (!fila) {
      return res.status(400).json({ error: 'El otro usuario no tiene repetidos suficientes para intercambiar' });
    }
    cromos_recibe.push(fila);
  }

  // 2. Registrar el intercambio
  const { data: intercambio, error: errorIntercambio } = await supabase
    .from('intercambios')
    .insert({
      id_usuario_envia,
      id_usuario_recibe,
      estado: 'aceptado',
      fecha: new Date().toISOString(),
    })
    .select()
    .single();

  if (errorIntercambio || !intercambio) {
    console.error('Error detalle:', errorIntercambio);
    return res.status(500).json({ error: 'Error creando el intercambio', detalle: errorIntercambio?.message || JSON.stringify(errorIntercambio) });
  }

  // 3. Registrar cromos intercambiados
  const registros_cromos = [];
  for (const c of cromos_envia) {
    registros_cromos.push({
      id_intercambio: intercambio.id,
      id_usuario: id_usuario_envia,
      id_cromo: c.id_cromo,
      cantidad: 1,
      id_cromo_unico: c.id // Nuevo campo para trazabilidad
    });
  }
  for (const c of cromos_recibe) {
    registros_cromos.push({
      id_intercambio: intercambio.id,
      id_usuario: id_usuario_recibe,
      id_cromo: c.id_cromo,
      cantidad: 1,
      id_cromo_unico: c.id // Nuevo campo para trazabilidad
    });
  }
  const { error: errorCromos } = await supabase
    .from('intercambios_cromos')
    .insert(registros_cromos);
  if (errorCromos) {
    return res.status(500).json({ error: 'Error registrando cromos del intercambio', detalle: errorCromos?.message || JSON.stringify(errorCromos) });
  }

  // 4. Actualizar los cromos: cambiar el id_usuario de la fila repetida
  const updated_envia = [];
  for (const c of cromos_envia) {
    const { error, data } = await supabase
      .from('usuarios_cromos')
      .update({ id_usuario: id_usuario_recibe })
      .eq('id', c.id)
      .select();
    if (error) {
      console.error('Error update envia:', c.id, error);
    } else {
      updated_envia.push(c.id);
    }
  }
  const updated_recibe = [];
  for (const c of cromos_recibe) {
    const { error, data } = await supabase
      .from('usuarios_cromos')
      .update({ id_usuario: id_usuario_envia })
      .eq('id', c.id)
      .select();
    if (error) {
      console.error('Error update recibe:', c.id, error);
    } else {
      updated_recibe.push(c.id);
    }
  }
  console.log('Actualizados envia:', updated_envia);
  console.log('Actualizados recibe:', updated_recibe);

  return res.status(200).json({
    ok: true,
    intercambio_id: intercambio.id,
    cromos_envia,
    cromos_recibe,
    maximo_intercambio: cromos_envia.length,
  });
} 