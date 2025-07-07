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
    let subscription = null;
    
    // Buscar user_id en metadata de la sesión primero
    if (session.metadata && session.metadata.user_id) {
      userId = session.metadata.user_id;
    }
    
    // Si no está en la sesión, buscar en la suscripción
    if (!userId && session.subscription) {
      try {
        subscription = await stripe.subscriptions.retrieve(session.subscription);
        subscriptionMeta = subscription.metadata;
        userId = subscription.metadata?.user_id;
      } catch (error) {
        console.error('Error obteniendo subscription:', error);
      }
    }
    if (userId) {
      // Obtén el customerId de Stripe
      const customerId = session.customer || (subscription && subscription.customer);
      
      // Verificar si el usuario ya usó el trial
      const { data: perfilUsuario } = await supabase
        .from('perfiles')
        .select('trial_used')
        .eq('id', userId)
        .single();
      
      const yaUsoTrial = perfilUsuario?.trial_used;
      console.log('Usuario ya usó trial:', yaUsoTrial);
      
      // Calcular fecha de expiración del premium
      let premiumUntil = null;
      try {
        console.log('=== DEBUG PREMIUM UNTIL ===');
        console.log('subscription:', subscription ? 'existe' : 'no existe');
        console.log('session.subscription:', session.subscription);
        
        if (subscription && subscription.current_period_end) {
          // Si hay suscripción, usar current_period_end
          console.log('subscription.current_period_end:', subscription.current_period_end);
          premiumUntil = new Date(subscription.current_period_end * 1000).toISOString();
          console.log('Usando subscription.current_period_end:', premiumUntil);
        } else if (session.subscription) {
          // Si no tenemos subscription pero hay session.subscription, obtenerlo
          console.log('Obteniendo subscription desde session.subscription...');
          const retrievedSubscription = await stripe.subscriptions.retrieve(session.subscription);
          console.log('retrievedSubscription.current_period_end:', retrievedSubscription.current_period_end);
          console.log('retrievedSubscription.status:', retrievedSubscription.status);
          console.log('retrievedSubscription.current_period_start:', retrievedSubscription.current_period_start);
          
          if (retrievedSubscription.current_period_end) {
            premiumUntil = new Date(retrievedSubscription.current_period_end * 1000).toISOString();
            console.log('Usando retrievedSubscription.current_period_end:', premiumUntil);
          } else if (retrievedSubscription.current_period_start) {
            // Si no hay current_period_end pero sí current_period_start, calcular 30 días desde el inicio
            console.log('Calculando 30 días desde current_period_start...');
            const startDate = new Date(retrievedSubscription.current_period_start * 1000);
            startDate.setDate(startDate.getDate() + 30);
            premiumUntil = startDate.toISOString();
            console.log('Usando 30 días desde start:', premiumUntil);
          } else {
            // Si no hay periodos definidos, usar fallback basado en si ya usó trial
            console.log('No hay periodos definidos, usando fallback...');
            const fallbackDate = new Date();
            
            if (yaUsoTrial) {
              // Para usuarios que ya usaron trial: 1 mes completo
              fallbackDate.setMonth(fallbackDate.getMonth() + 1);
              console.log('Fallback 1 mes completo:', fallbackDate.toISOString());
            } else {
              // Para primera vez con trial: 15 días
              fallbackDate.setDate(fallbackDate.getDate() + 15);
              console.log('Fallback 15 días (trial):', fallbackDate.toISOString());
            }
            
            premiumUntil = fallbackDate.toISOString();
          }
        } else {
          // Para pagos únicos, usar 30 días desde ahora
          console.log('No hay subscription, usando 30 días...');
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
          premiumUntil = thirtyDaysFromNow.toISOString();
          console.log('Usando 30 días:', premiumUntil);
        }
      } catch (error) {
        console.error('Error calculando premiumUntil:', error);
        // Fallback: usar 15 días si no usó trial, 1 mes si ya lo usó
        const fallbackDate = new Date();
        
        if (yaUsoTrial) {
          // Para usuarios que ya usaron trial: 1 mes completo
          fallbackDate.setMonth(fallbackDate.getMonth() + 1);
          console.log('Fallback 1 mes completo:', fallbackDate.toISOString());
        } else {
          // Para primera vez con trial: 15 días
          fallbackDate.setDate(fallbackDate.getDate() + 15);
          console.log('Fallback 15 días (trial):', fallbackDate.toISOString());
        }
        
        premiumUntil = fallbackDate.toISOString();
      }
      
      const { error } = await supabase
        .from('perfiles')
        .update({ 
          premium: true, 
          trial_used: true, 
          stripe_customer_id: customerId,
          premium_until: premiumUntil
        })
        .eq('id', userId);
      if (error) {
        console.error('Error actualizando perfil en Supabase:', error);
      }
    } else {
      console.error('No se encontró userId en metadata. No se actualiza Supabase.');
    }
  }
  // Manejar renovación de suscripción (cuando se paga el siguiente mes)
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object;
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const customerId = subscription.customer;
      
      if (customerId) {
        // Buscar usuario por stripe_customer_id
        const { data: perfil, error: fetchError } = await supabase
          .from('perfiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();
        
        if (perfil) {
          // Actualizar fecha de expiración del premium
          const premiumUntil = new Date(subscription.current_period_end * 1000).toISOString();
          const { error } = await supabase
            .from('perfiles')
            .update({ premium_until: premiumUntil })
            .eq('id', perfil.id);
          
          if (error) {
            console.error('Error actualizando premium_until en Supabase:', error);
          }
        }
      }
    }
  }
  res.status(200).json({ received: true });
}