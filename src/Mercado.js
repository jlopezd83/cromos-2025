import React from "react";

export default function Mercado() {
  return (
    <div className="main-content" style={{ maxWidth: 700 }}>
      <h2 style={{ color: '#2563eb', marginBottom: 8 }}>Mercado de Cromos</h2>
      <p style={{ color: '#333', fontSize: '1.1em', marginBottom: 24 }}>
        Bienvenido al <b>Mercado</b>. Aquí podrás encontrar usuarios con los que intercambiar cromos:
        <ul style={{ margin: '1em 0 1.5em 1.5em', color: '#2563eb' }}>
          <li><b>Buscar quién tiene lo que te falta:</b> Encuentra usuarios que tienen cromos repetidos que a ti te faltan.</li>
          <li><b>Buscar a quién le falta lo que tú tienes repetido:</b> Descubre usuarios que buscan cromos que tú tienes de sobra.</li>
        </ul>
        ¡Próximamente podrás proponer intercambios y contactar directamente desde aquí!
      </p>
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ background: '#f4f8fb', border: '2px solid #2563eb22', borderRadius: 16, padding: 24, minWidth: 260, maxWidth: 320, boxShadow: '0 2px 12px #2563eb11', marginBottom: 16 }}>
          <h3 style={{ color: '#2563eb', marginTop: 0, fontSize: '1.1em' }}>¿Quién tiene lo que me falta?</h3>
          <p style={{ color: '#333', fontSize: '1em' }}>
            Aquí podrás ver una lista de usuarios que tienen cromos repetidos que a ti te faltan en tus colecciones.
          </p>
        </div>
        <div style={{ background: '#f4f8fb', border: '2px solid #2563eb22', borderRadius: 16, padding: 24, minWidth: 260, maxWidth: 320, boxShadow: '0 2px 12px #2563eb11', marginBottom: 16 }}>
          <h3 style={{ color: '#2563eb', marginTop: 0, fontSize: '1.1em' }}>¿A quién le falta lo que yo tengo repetido?</h3>
          <p style={{ color: '#333', fontSize: '1em' }}>
            Aquí podrás ver usuarios que buscan cromos que tú tienes repetidos, para que podáis intercambiar.
          </p>
        </div>
      </div>
    </div>
  );
} 