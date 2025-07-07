const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const { priceId, userId, id_coleccion } = req.body;

  if (!priceId) {
    return res.status(400).json({ error: 'Falta priceId' });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: 'https://cromos-2025.vercel.app/sobres',
    cancel_url: 'https://cromos-2025.vercel.app/sobres?canceled=1',
    metadata: {
      userId,
      id_coleccion,
    },
  });

  res.status(200).json({ url: session.url });
}