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
    console.error('Error construyendo el evento Stripe:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Evento recibido:', event.type);

  // Manejar eventos relevantes
  if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.created') {
    const session = event.data.object;
    let userId = null;
    let subscriptionMeta = null;
    // Buscar user_id en metadata de la suscripción o de la sesión
    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      subscriptionMeta = subscription.metadata;
      userId = subscription.metadata?.user_id;
      console.log('session.subscription:', session.subscription);
      console.log('subscription.metadata:', subscriptionMeta);
    } else if (session.metadata) {
      userId = session.metadata.user_id;
      console.log('session.metadata:', session.metadata);
    }
    console.log('userId extraído:', userId);
    if (userId) {
      const { error } = await supabase.from('perfiles').update({ premium: true, trial_used: true }).eq('id', userId);
      if (error) {
        console.error('Error actualizando perfil en Supabase:', error);
      } else {
        console.log('Perfil actualizado correctamente en Supabase:', userId);
      }
    } else {
      console.error('No se encontró userId en metadata. No se actualiza Supabase.');
    }
  }
  // Manejar cancelación de suscripción
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const userId = subscription.metadata?.user_id;
    console.log('Cancelación de suscripción. userId extraído:', userId);
    if (userId) {
      const { error } = await supabase.from('perfiles').update({ premium: false }).eq('id', userId);
      if (error) {
        console.error('Error quitando premium en Supabase:', error);
      } else {
        console.log('Premium quitado correctamente en Supabase:', userId);
      }
    } else {
      console.error('No se encontró userId en metadata al cancelar suscripción.');
    }
  }
  res.status(200).json({ received: true });
}