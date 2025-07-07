const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Recibe el userId y el tipo de compra desde el frontend
  const { userId, type } = req.body;

  // CAMBIA ESTOS IDs por los de tu Stripe cuando los tengas
  const priceIds = {
    premium: 'price_XXXXXXXXXXXX', // ID de precio de suscripción
    sobres: 'price_YYYYYYYYYYYY',  // ID de precio de pago único
  };

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: type === 'premium' ? 'subscription' : 'payment',
      line_items: [
        {
          price: priceIds[type],
          quantity: 1,
        },
      ],
      success_url: 'http://localhost:3000/success', // CAMBIA ESTO en producción
      cancel_url: 'http://localhost:3000/cancel',   // CAMBIA ESTO en producción
      metadata: {
        userId,
        type,
      },
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};