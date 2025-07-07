const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { userId, type, id_coleccion } = req.body;

  const priceIds = {
    premium: 'price_dummy_premium',
    sobres: 'price_1RiHe2GEvd5WBxM8gT7OZNkx',
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
      success_url: 'https://cromos-2025-git-main-jlopezd83s-projects.vercel.app/sobres',
      cancel_url: 'http://localhost:3000/cancel',
      metadata: {
        userId,
        type,
        id_coleccion // <--- aquí va el id de la colección
      },
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};