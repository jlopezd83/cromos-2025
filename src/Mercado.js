import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function CromoSelector({ cromos, seleccionados, setSeleccionados, maxTotal, color }) {
  // cromos: array de {id, id_cromo, imagen_url}
  // seleccionados: array de {id}
  // setSeleccionados: setter
  // maxTotal: máximo cromos seleccionables
  // color: para el borde

  const handleToggle = (id) => {
    const idx = seleccionados.findIndex(s => s.id === id);
    if (idx !== -1) {
      // Si ya está, quitar
      const nuevos = [...seleccionados];
      nuevos.splice(idx, 1);
      setSeleccionados(nuevos);
    } else {
      if (seleccionados.length < maxTotal) {
        setSeleccionados([...seleccionados, { id }]);
      }
    }
  };

  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
      {cromos.map(cromo => {
        const sel = seleccionados.find(s => s.id === cromo.id);
        return (
          <div key={cromo.id} style={{ background: '#fff', border: `2px solid ${sel ? color : '#2563eb'}`, borderRadius: 10, width: 100, height: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 0, boxSizing: 'border-box', cursor: 'pointer', position: 'relative' }} onClick={() => handleToggle(cromo.id)}>
            <img src={cromo.imagen_url || 'https://placehold.co/80x80?text=C'} alt={cromo.id_cromo} style={{ width: 84, height: 84, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
            {sel && <span style={{ position: 'absolute', top: 4, right: 8, color: color, fontWeight: 700 }}>✔</span>}
          </div>
        );
      })}
    </div>
  );
}

function PopupIntercambio({ abierto, onClose, usuario1, usuario2, cromos1, cromos2 }) {
  if (!abierto) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 36, minWidth: 340, boxShadow: '0 4px 32px #2563eb33', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {/* Usuario 1 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 120 }}>
            <img src={usuario1.avatar_url || 'https://placehold.co/48x48?text=U'} alt={usuario1.nombre} style={{ width: 64, height: 64, borderRadius: '50%', border: '2px solid #2563eb', objectFit: 'cover', marginBottom: 6 }} />
            <span style={{ fontWeight: 600, color: '#2563eb', fontSize: '1.1em', display: 'flex', alignItems: 'center', gap: 4 }}>{usuario1.nombre}{usuario1.premium && <span title="Usuario premium" style={{ color: '#facc15', fontSize: '1.2em', marginLeft: 2, verticalAlign: 'middle', filter: 'drop-shadow(0 1px 2px #facc1555)' }}>★</span>}</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {cromos1.map(c => <img key={c.id} src={c.imagen_url || 'https://placehold.co/40x40?text=C'} alt={c.id_cromo} style={{ width: 40, height: 40, borderRadius: 8, border: '2px solid #2563eb' }} />)}
            </div>
          </div>
          {/* Flechas */}
          <div style={{ fontSize: 36, color: '#2563eb', fontWeight: 700, margin: '0 12px' }}>⇄</div>
          {/* Usuario 2 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 120 }}>
            <img src={usuario2.avatar_url || 'https://placehold.co/48x48?text=U'} alt={usuario2.nombre} style={{ width: 64, height: 64, borderRadius: '50%', border: '2px solid #f59e42', objectFit: 'cover', marginBottom: 6 }} />
            <span style={{ fontWeight: 600, color: '#f59e42', fontSize: '1.1em', display: 'flex', alignItems: 'center', gap: 4 }}>{usuario2.nombre}{usuario2.premium && <span title="Usuario premium" style={{ color: '#facc15', fontSize: '1.2em', marginLeft: 2, verticalAlign: 'middle', filter: 'drop-shadow(0 1px 2px #facc1555)' }}>★</span>}</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {cromos2.map(c => <img key={c.id} src={c.imagen_url || 'https://placehold.co/40x40?text=C'} alt={c.id_cromo} style={{ width: 40, height: 40, borderRadius: 8, border: '2px solid #f59e42' }} />)}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ marginTop: 18, padding: '10px 28px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '1.1em', cursor: 'pointer' }}>Aceptar</button>
      </div>
    </div>
  );
}

export default function Mercado() {
  const [user, setUser] = useState(null);
  const [colecciones, setColecciones] = useState([]);
  const [coleccionSeleccionada, setColeccionSeleccionada] = useState(null);
  const [usuariosColeccion, setUsuariosColeccion] = useState([]); // [{id, nombre_usuario, avatar_url}]
  const [matchings, setMatchings] = useState([]); // [{usuario, yoPuedoDar, elPuedeDar}]
  const [loading, setLoading] = useState(false);
  const [seleccionadosPorUsuario, setSeleccionadosPorUsuario] = useState({}); // {usuarioId: {envia: [], recibe: [], mensaje: '', loading: false}}
  const [popup, setPopup] = useState({ abierto: false, usuario1: null, usuario2: null, cromos1: [], cromos2: [] });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (user) {
      // Obtener colecciones a las que pertenece el usuario
      supabase
        .from("usuarios_colecciones")
        .select("id_coleccion, colecciones(nombre)")
        .eq("id_usuario", user.id)
        .then(({ data }) => {
          if (data) {
            setColecciones(data.map(c => ({ id: c.id_coleccion, nombre: c.colecciones?.nombre || "Colección" })));
          }
        });
    }
  }, [user]);

  useEffect(() => {
    if (user && coleccionSeleccionada) {
      setLoading(true);
      supabase
        .from("usuarios_colecciones")
        .select("id_usuario, perfiles(nombre_usuario, avatar_url, premium)")
        .eq("id_coleccion", coleccionSeleccionada)
        .neq("id_usuario", user.id)
        .then(async ({ data }) => {
          if (!data) return;
          const usuarios = data.map(u => ({
            id: u.id_usuario,
            nombre: u.perfiles?.nombre_usuario || "Usuario",
            avatar_url: u.perfiles?.avatar_url || "",
            premium: u.perfiles?.premium || false
          })).slice(0, 10);
          setUsuariosColeccion(usuarios);

          // 2. Obtener mis cromos de la colección (con id único y pegado)
          const { data: misCromos } = await supabase
            .from("usuarios_cromos")
            .select("id, id_cromo, pegado")
            .eq("id_usuario", user.id);
          const { data: cromosCol } = await supabase
            .from("cromos")
            .select("id, nombre, imagen_url")
            .eq("id_coleccion", coleccionSeleccionada);
          const idsCromosCol = cromosCol ? cromosCol.map(c => c.id) : [];

          // Mis pegados y repetidos reales (con id único)
          const pegados = new Set(misCromos?.filter(c => c.pegado).map(c => c.id_cromo));
          // Todos mis cromos (pegados o no)
          const todosMisCromos = new Set(misCromos?.map(c => c.id_cromo));
          // Repetidos: registros con pegado=false y el usuario ya tiene ese cromo pegado
          const misRepetidos = misCromos?.filter(c => !c.pegado && pegados.has(c.id_cromo));
          const misRepetidosInfo = misRepetidos?.map(rep => ({
            id: rep.id,
            id_cromo: rep.id_cromo,
            imagen_url: cromosCol.find(c => c.id === rep.id_cromo)?.imagen_url || ''
          })) || [];

          // 3. Para cada usuario, obtener sus cromos y calcular matching
          const matchingsArr = [];
          for (let u of usuarios) {
            // Sus cromos (con id único y pegado)
            const { data: susCromos } = await supabase
              .from("usuarios_cromos")
              .select("id, id_cromo, pegado")
              .eq("id_usuario", u.id);
            const susPegados = new Set(susCromos?.filter(c => c.pegado).map(c => c.id_cromo));
            const todosSusCromos = new Set(susCromos?.map(c => c.id_cromo));
            // Sus repetidos reales
            const susRepetidos = susCromos?.filter(c => !c.pegado && susPegados.has(c.id_cromo));
            const susRepetidosInfo = susRepetidos?.map(rep => ({
              id: rep.id,
              id_cromo: rep.id_cromo,
              imagen_url: cromosCol.find(c => c.id === rep.id_cromo)?.imagen_url || ''
            })) || [];

            // Yo puedo dar: mis repetidos que el otro NO tiene (ni pegados ni sin pegar)
            const yoPuedoDar = misRepetidosInfo.filter(rep => !todosSusCromos.has(rep.id_cromo));
            // Él puede dar: sus repetidos que yo NO tengo (ni pegados ni sin pegar)
            const elPuedeDar = susRepetidosInfo.filter(rep => !todosMisCromos.has(rep.id_cromo));

            if (yoPuedoDar.length > 0 || elPuedeDar.length > 0) {
              matchingsArr.push({ usuario: u, yoPuedoDar, elPuedeDar });
            }
          }
          setMatchings(matchingsArr);
          setLoading(false);
        });
    } else {
      setMatchings([]);
    }
  }, [user, coleccionSeleccionada]);

  return (
    <div className="main-content">
      <PopupIntercambio
        abierto={popup.abierto}
        onClose={() => { setPopup({ abierto: false, usuario1: null, usuario2: null, cromos1: [], cromos2: [] }); window.location.reload(); }}
        usuario1={popup.usuario1}
        usuario2={popup.usuario2}
        cromos1={popup.cromos1}
        cromos2={popup.cromos2}
      />
      <h2 style={{ color: '#2563eb', marginBottom: 8 }}>Mercado de Cromos</h2>
      <p style={{ color: '#333', fontSize: '1.1em', marginBottom: 24 }}>
        Busca posibles intercambios con otros usuarios de tus colecciones. Selecciona una colección para ver con quién puedes intercambiar cromos.
      </p>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 500, color: '#2563eb', marginRight: 12 }}>Colección:</label>
        <select value={coleccionSeleccionada || ""} onChange={e => setColeccionSeleccionada(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #2563eb', fontSize: '1em' }}>
          <option value="">Selecciona una colección</option>
          {colecciones.map(col => (
            <option key={col.id} value={col.id}>{col.nombre}</option>
          ))}
        </select>
      </div>
      {loading && <p style={{ color: '#2563eb' }}>Buscando posibles intercambios...</p>}
      {!loading && coleccionSeleccionada && matchings.length === 0 && (
        <p style={{ color: '#888' }}>No hay posibles intercambios con otros usuarios en esta colección.</p>
      )}
      {!loading && matchings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {matchings.map(({ usuario, yoPuedoDar, elPuedeDar }) => {
            const seleccionados = seleccionadosPorUsuario[usuario.id] || { envia: [], recibe: [], mensaje: '', loading: false };
            return (
              <div key={usuario.id} style={{ background: '#f4f8fb', border: '2px solid #2563eb22', borderRadius: 16, padding: 28, boxShadow: '0 2px 12px #2563eb11', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100, margin: '0 auto', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                  <img src={usuario.avatar_url || 'https://placehold.co/48x48?text=U'} alt={usuario.nombre} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #2563eb' }} />
                  <span style={{ fontWeight: 600, color: '#2563eb', fontSize: '1.1em', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {usuario.nombre}
                    {usuario.premium && (
                      <span title="Usuario premium" style={{ color: '#facc15', fontSize: '1.2em', marginLeft: 2, verticalAlign: 'middle', filter: 'drop-shadow(0 1px 2px #facc1555)' }}>★</span>
                    )}
                  </span>
                  <span style={{ color: '#10b981', fontWeight: 500, fontSize: '1em', marginLeft: 8 }} title={`Tú puedes dar: ${yoPuedoDar.length}, él puede darte: ${elPuedeDar.length}`}>
                    <span style={{ marginRight: 8 }}>↔️</span>
                    <span style={{ color: '#10b981' }}>{yoPuedoDar.length}</span>
                    <span style={{ color: '#888', margin: '0 4px' }}>/</span>
                    <span style={{ color: '#f59e42' }}>{elPuedeDar.length}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', flexDirection: 'row', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ color: '#10b981' }}>Tú puedes dar a {usuario.nombre}:</b>
                    <CromoSelector cromos={yoPuedoDar} seleccionados={seleccionados.envia} setSeleccionados={envia => setSeleccionadosPorUsuario(s => ({ ...s, [usuario.id]: { ...seleccionados, envia } }))} maxTotal={5} color="#10b981" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ color: '#f59e42' }}>{usuario.nombre} puede darte a ti:</b>
                    <CromoSelector cromos={elPuedeDar} seleccionados={seleccionados.recibe} setSeleccionados={recibe => setSeleccionadosPorUsuario(s => ({ ...s, [usuario.id]: { ...seleccionados, recibe } }))} maxTotal={5} color="#f59e42" />
                  </div>
                </div>
                <button
                  disabled={
                    seleccionados.loading ||
                    seleccionados.envia.length === 0 ||
                    seleccionados.recibe.length === 0 ||
                    seleccionados.envia.length !== seleccionados.recibe.length
                  }
                  style={{
                    marginTop: 18,
                    padding: '10px 28px',
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: '1.1em',
                    cursor: seleccionados.loading ? 'wait' : 'pointer',
                    opacity:
                      (seleccionados.envia.length === 0 ||
                        seleccionados.recibe.length === 0 ||
                        seleccionados.envia.length !== seleccionados.recibe.length)
                        ? 0.5
                        : 1
                  }}
                  onClick={async () => {
                    setSeleccionadosPorUsuario(s => ({ ...s, [usuario.id]: { ...seleccionados, loading: true, mensaje: '' } }));
                    try {
                      const res = await fetch('/api/intercambio-directo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          id_usuario_envia: user.id,
                          id_usuario_recibe: usuario.id,
                          ids_envia: seleccionados.envia.map(c => c.id),
                          ids_recibe: seleccionados.recibe.map(c => c.id)
                        })
                      });
                      const data = await res.json();
                      if (data.ok) {
                        setPopup({
                          abierto: true,
                          usuario1: { ...user, ...usuariosColeccion.find(u => u.id === user.id) },
                          usuario2: usuario,
                          cromos1: yoPuedoDar.filter(c => seleccionados.envia.map(s => s.id).includes(c.id)),
                          cromos2: elPuedeDar.filter(c => seleccionados.recibe.map(s => s.id).includes(c.id))
                        });
                        setSeleccionadosPorUsuario(s => ({ ...s, [usuario.id]: { ...seleccionados, loading: false, mensaje: '' } }));
                      } else {
                        setSeleccionadosPorUsuario(s => ({ ...s, [usuario.id]: { ...seleccionados, loading: false, mensaje: data.error || 'Error en el intercambio' } }));
                      }
                    } catch (e) {
                      setSeleccionadosPorUsuario(s => ({ ...s, [usuario.id]: { ...seleccionados, loading: false, mensaje: 'Error de red o servidor' } }));
                    }
                  }}
                >
                  Proponer cambio
                </button>
                {seleccionados.mensaje && <div style={{ marginTop: 10, color: seleccionados.mensaje.startsWith('¡Intercambio') ? '#10b981' : '#e11d48', fontWeight: 500 }}>{seleccionados.mensaje}</div>}
              </div>
            );
          })}
        </div>
      )}
      {/* Media query para móvil */}
      <style>{`
        @media (max-width: 600px) {
          .main-content h2 {
            font-size: 1.2em !important;
          }
          .main-content > div > div {
            max-width: 98vw !important;
            padding: 12px !important;
          }
          .main-content > div > div > div {
            flex-direction: column !important;
            gap: 12px !important;
          }
          .main-content img {
            width: 40px !important;
            height: 40px !important;
          }
          .main-content b {
            font-size: 1em !important;
          }
        }
      `}</style>
    </div>
  );
} 