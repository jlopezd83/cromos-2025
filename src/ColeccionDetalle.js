import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "./supabaseClient";

export default function ColeccionDetalle() {
  const { id } = useParams();
  const [coleccion, setColeccion] = useState(null);
  const [cromos, setCromos] = useState([]);
  const [misCromos, setMisCromos] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [pegando, setPegando] = useState(null); // id del cromo que se está pegando
  const pegandoRef = useRef(null);
  const [scrollToCromoId, setScrollToCromoId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  const fetchData = async () => {
    setLoading(true);
    let { data: col, error: errCol } = await supabase.from("colecciones").select("*").eq("id", id).single();
    if (errCol) {
      setMensaje("Error al cargar la colección");
      setLoading(false);
      return;
    }
    setColeccion(col);
    let { data: cromosData, error: errCromos } = await supabase.from("cromos").select("*").eq("id_coleccion", id);
    if (errCromos) {
      setMensaje("Error al cargar los cromos");
      setLoading(false);
      return;
    }
    setCromos(cromosData || []);
    if (user) {
      let { data: misCromosData } = await supabase
        .from("usuarios_cromos")
        .select("id_cromo, pegado")
        .eq("id_usuario", user.id);
      setMisCromos(misCromosData || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, [id, user]);

  // Función para saber el estado de un cromo
  const getEstadoCromo = (cromoId) => {
    const pegado = misCromos.find(c => c.id_cromo === cromoId && c.pegado);
    const porPegar = misCromos.find(c => c.id_cromo === cromoId && !c.pegado);
    if (pegado) return "pegado";
    if (porPegar) return "por_pegar";
    return "faltante";
  };

  // Calcular repetidos correctamente según la definición: pegado=false y existe pegado=true para ese id_cromo
  const getRepetidos = () => {
    let count = 0;
    cromos.forEach(cromo => {
      // ¿Hay al menos un registro pegado=true para este cromo?
      const tienePegado = misCromos.some(c => c.id_cromo === cromo.id && c.pegado);
      // ¿Cuántos no pegados hay?
      const noPegados = misCromos.filter(c => c.id_cromo === cromo.id && !c.pegado);
      if (tienePegado && noPegados.length > 0) {
        count += noPegados.length;
      }
    });
    return count;
  };

  // Pegar cromo
  const handlePegar = async (cromoId) => {
    setPegando(cromoId);
    // Buscar un registro sin pegar
    const { data: userCromo } = await supabase
      .from("usuarios_cromos")
      .select("id")
      .eq("id_usuario", user.id)
      .eq("id_cromo", cromoId)
      .eq("pegado", false)
      .limit(1)
      .single();
    if (userCromo) {
      await supabase.from("usuarios_cromos").update({ pegado: true }).eq("id", userCromo.id);
      // Actualizar el estado local sin recargar toda la página
      setMisCromos(prev => {
        // Quitar un no pegado y añadir un pegado
        let quitado = false;
        const nuevos = prev.filter(c => {
          if (!quitado && c.id_cromo === cromoId && !c.pegado) {
            quitado = true;
            return false;
          }
          return true;
        });
        return [...nuevos, { id_cromo: cromoId, pegado: true }];
      });
    }
    setPegando(null);
  };

  // Efecto para hacer scroll tras render
  useEffect(() => {
    if (scrollToCromoId) {
      const el = document.getElementById(`cromo-${scrollToCromoId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setScrollToCromoId(null);
    }
  }, [scrollToCromoId, cromos]);

  if (loading) return <div className="main-content"><p>Cargando colección...</p></div>;
  if (!coleccion) return <div className="main-content"><p>No se encontró la colección.</p></div>;

  // Progreso
  const total = cromos.length;
  const pegados = cromos.filter(c => getEstadoCromo(c.id) === "pegado").length;
  const porPegar = cromos.filter(c => getEstadoCromo(c.id) === "por_pegar").length;
  const repetidos = getRepetidos();
  const faltantes = total - pegados;
  const porcentaje = total > 0 ? Math.round((pegados / total) * 100) : 0;

  return (
    <div className="main-content" style={{ maxWidth: '100%', padding: 0 }}>
      {/* Header de la colección */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2em', marginBottom: 32 }}>
        <img src={coleccion.imagen_portada_url || 'https://via.placeholder.com/120x120?text=Coleccion'} alt={coleccion.nombre} style={{ width: 120, height: 120, borderRadius: 12, objectFit: 'cover', border: '2px solid #2563eb' }} />
        <div>
          <h2 style={{ margin: 0 }}>{coleccion.nombre}</h2>
          <p style={{ margin: '0.5em 0 1em 0', color: '#333' }}>{coleccion.descripcion}</p>
          <div style={{ color: '#2563eb', fontWeight: 'bold', marginBottom: 8 }}>
            {pegados}/{total} cromos ({porcentaje}%) | {repetidos} repetidos
          </div>
          {porPegar > 0 && (
            <div style={{ color: '#f59e42', fontWeight: 'bold', marginBottom: 8 }}>
              Tienes {porPegar} cromos por pegar
            </div>
          )}
          {mensaje && <p>{mensaje}</p>}
        </div>
      </div>
      {/* Grid de cromos */}
      <div className="cromos-grid">
        {cromos.map(cromo => {
          const estado = getEstadoCromo(cromo.id);
          return (
            <div key={cromo.id} id={`cromo-${cromo.id}`} style={{
              background: estado === "pegado" ? '#dbeafe' : estado === "por_pegar" ? '#fef9c3' : '#f3f4f6',
              border: `2px solid ${estado === "pegado" ? '#2563eb' : estado === "por_pegar" ? '#facc15' : '#d1d5db'}`,
              borderRadius: 10,
              padding: 10,
              textAlign: 'center',
              boxShadow: '0 2px 8px #2563eb11',
              position: 'relative',
              minWidth: 0
            }}>
              <img src={cromo.imagen_url || 'https://via.placeholder.com/80x80?text=Cromo'} alt={cromo.nombre} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', marginBottom: 8, opacity: estado === 'faltante' ? 0.12 : estado === 'por_pegar' ? 0.35 : 1 }} />
              <div style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '1.1em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cromo.nombre}</div>
              <div style={{ fontSize: '0.9em', color: '#555', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cromo.descripcion}</div>
              {/* Botón para pegar si el usuario tiene el cromo y no está pegado */}
              {estado === "por_pegar" && (
                <button
                  ref={pegando === cromo.id ? pegandoRef : null}
                  onClick={() => handlePegar(cromo.id)}
                  disabled={pegando === cromo.id}
                  style={{
                    marginTop: 8,
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '0.3em 0.8em',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '0.95em'
                  }}
                >
                  {pegando === cromo.id ? 'Pegando...' : 'Pegar'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
} 