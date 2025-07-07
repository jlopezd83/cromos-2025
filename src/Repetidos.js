import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { Link } from "react-router-dom";

export default function Repetidos() {
  const [user, setUser] = useState(null);
  const [repetidos, setRepetidos] = useState([]); // [{ coleccion, cromos: [{...}] }]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    async function fetchRepetidos() {
      setLoading(true);
      if (!user) return;
      // Obtener todos los cromos del usuario para poder aplicar la lógica robusta
      const { data: userCromos } = await supabase
        .from("usuarios_cromos")
        .select("id_cromo, cantidad, pegado")
        .eq("id_usuario", user.id);
      if (!userCromos || userCromos.length === 0) {
        setRepetidos([]);
        setLoading(false);
        return;
      }
      // Agrupar por id_cromo
      const agrupadosPorCromo = {};
      userCromos.forEach(c => {
        if (!agrupadosPorCromo[c.id_cromo]) agrupadosPorCromo[c.id_cromo] = [];
        agrupadosPorCromo[c.id_cromo].push(c);
      });
      // Filtrar cromos repetidos según la definición
      const repetidosFiltrados = Object.entries(agrupadosPorCromo).filter(([id_cromo, cromos]) => {
        const tienePegado = cromos.some(c => c.pegado);
        const noPegados = cromos.filter(c => !c.pegado);
        return tienePegado && noPegados.length > 0;
      });
      if (repetidosFiltrados.length === 0) {
        setRepetidos([]);
        setLoading(false);
        return;
      }
      // Obtener info de los cromos y sus colecciones
      const idsCromos = repetidosFiltrados.map(([id_cromo]) => id_cromo);
      const { data: cromosInfo } = await supabase
        .from("cromos")
        .select("id, nombre, imagen_url, id_coleccion")
        .in("id", idsCromos);
      const { data: coleccionesInfo } = await supabase
        .from("colecciones")
        .select("id, nombre, imagen_portada_url");
      // Agrupar por colección
      const agrupados = {};
      repetidosFiltrados.forEach(([id_cromo, cromos]) => {
        const cromo = cromosInfo.find(c => c.id === id_cromo);
        if (!cromo) return;
        if (!agrupados[cromo.id_coleccion]) {
          const col = coleccionesInfo.find(col => col.id === cromo.id_coleccion);
          agrupados[cromo.id_coleccion] = {
            coleccion: col,
            cromos: []
          };
        }
        // Contar el número de no pegados
        const cantidad = cromos.filter(c => !c.pegado).length;
        agrupados[cromo.id_coleccion].cromos.push({ ...cromo, cantidad });
      });
      setRepetidos(Object.values(agrupados));
      setLoading(false);
    }
    fetchRepetidos();
  }, [user]);

  return (
    <div className="main-content">
      <h2>Mis cromos repetidos</h2>
      {loading ? <p>Cargando...</p> : (
        repetidos.length === 0 ? <p>No tienes cromos repetidos.</p> : (
          repetidos.map(grupo => (
            <div key={grupo.coleccion.id} style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1em', marginBottom: 12 }}>
                <img src={grupo.coleccion.imagen_portada_url || 'https://via.placeholder.com/60x60?text=Coleccion'} alt={grupo.coleccion.nombre} style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', border: '2px solid #2563eb' }} />
                <h3 style={{ margin: 0, color: '#2563eb' }}>{grupo.coleccion.nombre}</h3>
              </div>
              <div style={{ display: 'flex', gap: '1.2em', flexWrap: 'wrap' }}>
                {grupo.cromos.map(cromo => (
                  <div key={cromo.id} style={{ background: '#f1f5fd', border: '2px solid #2563eb', borderRadius: 10, padding: 10, textAlign: 'center', width: 100 }}>
                    <img src={cromo.imagen_url || 'https://via.placeholder.com/80x80?text=Cromo'} alt={cromo.nombre} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', marginBottom: 8 }} />
                    <div style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '1em' }}>{cromo.nombre}</div>
                    <div style={{ color: '#333', fontSize: '0.95em', margin: '0.2em 0' }}>x{cromo.cantidad}</div>
                    <button style={{
                      background: '#60a5fa',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '0.3em 0.8em',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '0.95em',
                      marginTop: 6
                    }}
                    // onClick={() => ...}
                    >Proponer intercambio</button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )
      )}
    </div>
  );
} 