const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

const buffer = require('micro').buffer;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar eventos relevantes
  if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.created') {
    const session = event.data.object;
    let userId = null;
    // Buscar user_id en metadata de la suscripción o de la sesión
    if (session.subscription) {
      // Obtener la suscripción para leer la metadata
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      userId = subscription.metadata?.user_id;
    } else if (session.metadata) {
      userId = session.metadata.user_id;
    }
    if (userId) {
      // Marcar premium y trial_used en Supabase
      await supabase.from('perfiles').update({ premium: true, trial_used: true }).eq('id', userId);
    }
  }
  // Manejar cancelación de suscripción
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const userId = subscription.metadata?.user_id;
    if (userId) {
      // Quitar premium pero no tocar trial_used
      await supabase.from('perfiles').update({ premium: false }).eq('id', userId);
    }
  }
  res.status(200).json({ received: true });
}