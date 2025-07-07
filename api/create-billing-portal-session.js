const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Falta userId' });

  try {
    // Obtener el stripe_customer_id desde la base de datos
    const { data: perfil, error: fetchError } = await supabase
      .from('perfiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (fetchError || !perfil) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!perfil.stripe_customer_id) {
      return res.status(400).json({ error: 'Usuario no tiene suscripción activa' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: perfil.stripe_customer_id,
      return_url: process.env.NEXT_PUBLIC_BASE_URL + '/perfil',
    });
    
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Error creando sesión de billing portal:', err);
    res.status(500).json({ error: err.message });
  }
}