import React from 'react';
import { useUser } from './UserContext';

// Sustituye por tu priceId real de Stripe
const PREMIUM_PRICE_ID = 'price_1RiLzVGEvd5WBxM86CXpnIBz';

export default function Premium() {
  const { perfil, user } = useUser();

  const handlePremiumCheckout = async () => {
    if (!user || !perfil) {
      alert('Debes iniciar sesión para suscribirte.');
      return;
    }
    try {
      const res = await fetch('/api/create-premium-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          priceId: PREMIUM_PRICE_ID,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location = data.url;
      } else {
        alert('Error: ' + (data.error || 'No se pudo iniciar el pago.'));
      }
    } catch (err) {
      alert('Error al conectar con Stripe.');
    }
  };

  return (
    <div className="main-content" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ background: '#2563eb', borderRadius: 18, boxShadow: '0 2px 16px #2563eb22', padding: '2.2em 2em 2em 2em', margin: '0 auto', color: '#fff', maxWidth: 500 }}>
        <h2 style={{ color: '#fff', fontWeight: 'bold', fontSize: '2em', marginBottom: 16 }}>
          <span style={{ fontSize: '1.5em', verticalAlign: 'middle', marginRight: 8, color: '#facc15', filter: 'drop-shadow(0 1px 2px #facc1555)' }}>★</span>
          Premium
        </h2>
        <p style={{ fontSize: '1.15em', color: '#e0e7ef', marginBottom: 24 }}>
          Hazte <b style={{ color: '#facc15' }}>Premium</b> y disfruta de ventajas exclusivas:
        </p>
        <ul style={{ textAlign: 'left', margin: '0 auto 32px auto', maxWidth: 400, color: '#fff', fontSize: '1.08em', lineHeight: 1.7, paddingLeft: 0, listStyle: 'none' }}>
          <li style={{ marginBottom: 10 }}>✔ Acceso a <b style={{ color: '#facc15' }}>sobres gratuitos cada 10 horas</b> (en vez de cada 24h)</li>
          <li style={{ marginBottom: 10 }}>✔ Apoya el desarrollo de la plataforma</li>
          <li style={{ marginBottom: 10 }}>✔ Insignia y reconocimiento premium en tu perfil</li>
          <li>✔ ¡Y más ventajas próximamente!</li>
        </ul>
        <div style={{ margin: '32px 0' }}>
          <div style={{ fontSize: '1.2em', color: '#facc15', fontWeight: 'bold', marginBottom: 8, textShadow: '0 1px 4px #0002' }}>
            Solo <span style={{ color: '#facc15', textShadow: '0 1px 4px #0002', fontWeight: 'bold', margin: '0 4px' }}>4,99€</span> al mes
          </div>
          <button
            onClick={handlePremiumCheckout}
            style={{
              background: '#facc15',
              color: '#2563eb',
              border: 'none',
              borderRadius: 10,
              padding: '1em 2.5em',
              fontWeight: 'bold',
              fontSize: '1.15em',
              boxShadow: '0 2px 12px #facc1533',
              cursor: 'pointer',
              marginTop: 10,
              marginBottom: 8,
              letterSpacing: 1
            }}>
            Probar ahora gratis por 15 días
          </button>
          <div style={{ color: '#e0e7ef', fontSize: '0.98em', marginTop: 8 }}>
            Sin compromiso. Cancela cuando quieras.
          </div>
        </div>
      </div>
    </div>
  );
} 