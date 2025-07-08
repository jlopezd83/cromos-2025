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

  // 1. Verificar disponibilidad real de cromos para ambos usuarios
  // Helper para obtener cantidades reales
  async function getDisponibles(id_usuario, cromos) {
    const disponibles = [];
    for (const cromo of cromos) {
      const { data, error } = await supabase
        .from('coleccion_cromos')
        .select('cantidad')
        .eq('id_usuario', id_usuario)
        .eq('id_cromo', cromo.id_cromo)
        .single();
      if (error || !data) {
        disponibles.push(0);
      } else {
        disponibles.push(Math.max(0, data.cantidad));
      }
    }
    return disponibles;
  }

  // Obtener cantidades disponibles
  const disponibles_envia = await getDisponibles(id_usuario_envia, cromos_envia);
  const disponibles_recibe = await getDisponibles(id_usuario_recibe, cromos_recibe);

  // Calcular máximo posible a intercambiar por cada cromo
  const max_envia = cromos_envia.map((c, i) => Math.min(c.cantidad, disponibles_envia[i]));
  const max_recibe = cromos_recibe.map((c, i) => Math.min(c.cantidad, disponibles_recibe[i]));

  // Sumar totales
  const total_envia = max_envia.reduce((a, b) => a + b, 0);
  const total_recibe = max_recibe.reduce((a, b) => a + b, 0);

  // El máximo cromos a intercambiar es el mínimo entre ambos lados y 5
  const maximo_intercambio = Math.min(total_envia, total_recibe, 5);

  if (maximo_intercambio < 1) {
    return res.status(400).json({ error: 'No hay cromos suficientes para intercambiar' });
  }

  // Ajustar arrays a la cantidad máxima posible (repartiendo cromos hasta llegar al máximo)
  function ajustarCromos(cromos, maximos, maximo_intercambio) {
    const resultado = [];
    let restantes = maximo_intercambio;
    for (let i = 0; i < cromos.length && restantes > 0; i++) {
      const cantidad = Math.min(maximos[i], restantes);
      if (cantidad > 0) {
        resultado.push({ id_cromo: cromos[i].id_cromo, cantidad });
        restantes -= cantidad;
      }
    }
    return resultado;
  }

  const cromos_envia_final = ajustarCromos(cromos_envia, max_envia, maximo_intercambio);
  const cromos_recibe_final = ajustarCromos(cromos_recibe, max_recibe, maximo_intercambio);

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

  // Insertar cromos intercambiados
  const registros_cromos = [];
  for (const c of cromos_envia_final) {
    registros_cromos.push({
      id_intercambio: intercambio.id,
      id_usuario: id_usuario_envia,
      id_cromo: c.id_cromo,
      cantidad: c.cantidad,
    });
  }
  for (const c of cromos_recibe_final) {
    registros_cromos.push({
      id_intercambio: intercambio.id,
      id_usuario: id_usuario_recibe,
      id_cromo: c.id_cromo,
      cantidad: c.cantidad,
    });
  }
  const { error: errorCromos } = await supabase
    .from('intercambio_cromos')
    .insert(registros_cromos);
  if (errorCromos) {
    return res.status(500).json({ error: 'Error registrando cromos del intercambio' });
  }

  // Actualizar colecciones de ambos usuarios
  async function actualizarColeccion(id_usuario, cromos, signo) {
    for (const c of cromos) {
      // signo: -1 para restar, +1 para sumar
      const { data, error } = await supabase
        .from('coleccion_cromos')
        .select('cantidad')
        .eq('id_usuario', id_usuario)
        .eq('id_cromo', c.id_cromo)
        .single();
      if (data) {
        await supabase
          .from('coleccion_cromos')
          .update({ cantidad: data.cantidad + signo * c.cantidad })
          .eq('id_usuario', id_usuario)
          .eq('id_cromo', c.id_cromo);
      } else if (signo > 0) {
        // Si suma y no existe, crear
        await supabase
          .from('coleccion_cromos')
          .insert({ id_usuario, id_cromo: c.id_cromo, cantidad: c.cantidad });
      }
    }
  }

  // Restar cromos al que envía, sumar al que recibe
  await actualizarColeccion(id_usuario_envia, cromos_envia_final, -1);
  await actualizarColeccion(id_usuario_recibe, cromos_envia_final, +1);
  // Restar cromos al que recibe, sumar al que envía
  await actualizarColeccion(id_usuario_recibe, cromos_recibe_final, -1);
  await actualizarColeccion(id_usuario_envia, cromos_recibe_final, +1);

  return res.status(200).json({
    ok: true,
    intercambio_id: intercambio.id,
    cromos_envia: cromos_envia_final,
    cromos_recibe: cromos_recibe_final,
    maximo_intercambio,
  });
} 