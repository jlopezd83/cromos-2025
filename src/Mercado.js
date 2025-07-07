import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function Mercado() {
  const [user, setUser] = useState(null);
  const [colecciones, setColecciones] = useState([]);
  const [coleccionSeleccionada, setColeccionSeleccionada] = useState(null);
  const [usuariosColeccion, setUsuariosColeccion] = useState([]); // [{id, nombre_usuario, avatar_url}]
  const [matchings, setMatchings] = useState([]); // [{usuario, yoPuedoDar, elPuedeDar}]
  const [loading, setLoading] = useState(false);

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
      // 1. Obtener todos los usuarios de la colección (excepto yo)
      supabase
        .from("usuarios_colecciones")
        .select("id_usuario, perfiles(nombre_usuario, avatar_url)")
        .eq("id_coleccion", coleccionSeleccionada)
        .neq("id_usuario", user.id)
        .then(async ({ data }) => {
          if (!data) return;
          const usuarios = data.map(u => ({
            id: u.id_usuario,
            nombre: u.perfiles?.nombre_usuario || "Usuario",
            avatar_url: u.perfiles?.avatar_url || ""
          })).slice(0, 10); // Limitar a 10 usuarios
          setUsuariosColeccion(usuarios);

          // 2. Obtener mis cromos de la colección
          const { data: misCromos } = await supabase
            .from("usuarios_cromos")
            .select("id_cromo, cantidad, pegado")
            .eq("id_usuario", user.id);
          const { data: cromosCol } = await supabase
            .from("cromos")
            .select("id, nombre, imagen_url")
            .eq("id_coleccion", coleccionSeleccionada);
          const idsCromosCol = cromosCol ? cromosCol.map(c => c.id) : [];

          // Mis cromos pegados y repetidos
          const pegados = new Set(misCromos?.filter(c => c.pegado).map(c => c.id_cromo));
          const repetidos = new Set(
            misCromos?.filter(c => !c.pegado && c.cantidad > 0 && pegados.has(c.id_cromo)).map(c => c.id_cromo)
          );
          const faltantes = idsCromosCol.filter(id => !pegados.has(id));

          // 3. Para cada usuario, obtener sus cromos y calcular matching
          const matchingsArr = [];
          for (let u of usuarios) {
            // Sus cromos
            const { data: susCromos } = await supabase
              .from("usuarios_cromos")
              .select("id_cromo, cantidad, pegado")
              .eq("id_usuario", u.id);
            const susPegados = new Set(susCromos?.filter(c => c.pegado).map(c => c.id_cromo));
            const susRepetidos = new Set(
              susCromos?.filter(c => !c.pegado && c.cantidad > 0 && susPegados.has(c.id_cromo)).map(c => c.id_cromo)
            );
            const susFaltantes = idsCromosCol.filter(id => !susPegados.has(id));

            // Yo puedo dar: mis repetidos que le faltan a él
            const yoPuedoDar = cromosCol.filter(c => repetidos.has(c.id) && susFaltantes.includes(c.id));
            // Él puede dar: sus repetidos que me faltan a mí
            const elPuedeDar = cromosCol.filter(c => susRepetidos.has(c.id) && faltantes.includes(c.id));

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
    <div className="main-content" style={{ maxWidth: 800 }}>
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
          {matchings.map(({ usuario, yoPuedoDar, elPuedeDar }) => (
            <div key={usuario.id} style={{ background: '#f4f8fb', border: '2px solid #2563eb22', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px #2563eb11' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                <img src={usuario.avatar_url || 'https://placehold.co/48x48?text=U'} alt={usuario.nombre} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #2563eb' }} />
                <span style={{ fontWeight: 600, color: '#2563eb', fontSize: '1.1em' }}>{usuario.nombre}</span>
              </div>
              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <b style={{ color: '#10b981' }}>Tú puedes dar a {usuario.nombre}:</b>
                  {yoPuedoDar.length === 0 ? <span style={{ color: '#888', marginLeft: 8 }}>Nada</span> : (
                    <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                      {yoPuedoDar.map(cromo => (
                        <div key={cromo.id} style={{ background: '#fff', border: '2px solid #2563eb', borderRadius: 8, padding: 6, textAlign: 'center', width: 70 }}>
                          <img src={cromo.imagen_url || 'https://placehold.co/48x48?text=C'} alt={cromo.nombre} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', marginBottom: 4 }} />
                          <div style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '0.95em' }}>{cromo.nombre}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <b style={{ color: '#f59e42' }}>{usuario.nombre} puede darte a ti:</b>
                  {elPuedeDar.length === 0 ? <span style={{ color: '#888', marginLeft: 8 }}>Nada</span> : (
                    <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                      {elPuedeDar.map(cromo => (
                        <div key={cromo.id} style={{ background: '#fff', border: '2px solid #2563eb', borderRadius: 8, padding: 6, textAlign: 'center', width: 70 }}>
                          <img src={cromo.imagen_url || 'https://placehold.co/48x48?text=C'} alt={cromo.nombre} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', marginBottom: 4 }} />
                          <div style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '0.95em' }}>{cromo.nombre}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 