const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const getRawBody = require('raw-body');

// Inicializa Supabase con la clave de servicio (no la pública)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  // Lee el raw body
  const rawBody = await getRawBody(req);

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, type, id_coleccion } = session.metadata;

    if (type === 'premium') {
      // Actualiza el usuario a premium en Supabase
      await supabase
        .from('perfiles')
        .update({ rol: 'premium' })
        .eq('id', userId);
    } else if (type === 'sobres') {
      // Añade sobre comprado al usuario, pendiente de abrir
      await supabase
        .from('sobres')
        .insert([{
          id_usuario: userId,
          id_coleccion: id_coleccion,
          comprado: true,
          gratuito: false,
          abierto: false,
          fecha_apertura: new Date().toISOString()
        }]);
    }
  }

  res.status(200).json({ received: true });
};

// Desactiva el bodyParser de Vercel para Stripe
export const config = {
  api: {
    bodyParser: false,
  },
};