const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  const { userId, email, priceId, yaUsoTrial } = req.body;
  if (!userId || !priceId) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }
  
  try {
    // Verificar si el usuario ya tiene un stripe_customer_id
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();
    
    let customerId = null;
    
    if (perfil?.stripe_customer_id) {
      // Usar el customer existente
      customerId = perfil.stripe_customer_id;
      console.log('Usando customer existente:', customerId);
    } else {
      // Crear nuevo customer
      const customer = await stripe.customers.create({
        email: email,
        metadata: {
          user_id: userId,
        },
      });
      customerId = customer.id;
      console.log('Creado nuevo customer:', customerId);
    }
    
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer: customerId, // Usar customer existente o nuevo
      metadata: {
        user_id: userId,
      },
      subscription_data: {
        ...(yaUsoTrial ? {} : { trial_period_days: 15 }),
        metadata: {
          user_id: userId,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/perfil`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/premium?canceled=1`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al crear la sesión de Stripe' });
  }
} 