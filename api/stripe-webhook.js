const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Inicializa Supabase con la clave de servicio (no la pública)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, type } = session.metadata;

    if (type === 'premium') {
      // Actualiza el usuario a premium en Supabase
      await supabase
        .from('perfiles')
        .update({ rol: 'premium' })
        .eq('id', userId);
    } else if (type === 'sobres') {
      // Añade sobres al usuario (ajusta la lógica según tu modelo)
      await supabase
        .from('sobres')
        .insert([{ user_id: userId, comprado: true, fecha: new Date().toISOString() }]);
    }
  }

  res.status(200).json({ received: true });
};