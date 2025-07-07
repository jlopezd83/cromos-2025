import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { Link } from "react-router-dom";

export default function Colecciones() {
  const [colecciones, setColecciones] = useState([]);
  const [unidas, setUnidas] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    // Obtener usuario actual
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // Obtener todas las colecciones
      let { data: coleccionesData, error } = await supabase.from("colecciones").select("*");
      if (error) {
        setMensaje("Error al cargar colecciones");
        setLoading(false);
        return;
      }
      setColecciones(coleccionesData || []);
      // Si hay usuario, obtener colecciones unidas
      if (user) {
        let { data: unidasData } = await supabase
          .from("usuarios_colecciones")
          .select("id_coleccion")
          .eq("id_usuario", user.id);
        setUnidas(unidasData ? unidasData.map(u => u.id_coleccion) : []);
      }
      setLoading(false);
    }
    fetchData();
  }, [user]);

  const handleUnirse = async (id_coleccion) => {
    if (!user) {
      setMensaje("Debes iniciar sesión para unirte a una colección.");
      return;
    }
    // Solo enviamos id_usuario e id_coleccion
    const { error } = await supabase.from("usuarios_colecciones").insert({
      id_usuario: user.id,
      id_coleccion: id_coleccion
    });
    if (error) {
      setMensaje("Error al unirse a la colección: " + error.message);
    } else {
      setUnidas([...unidas, id_coleccion]);
      setMensaje("¡Te has unido a la colección!");
    }
  };

  if (loading) return <div className="main-content"><p>Cargando colecciones...</p></div>;

  return (
    <div className="main-content">
      <h2>Explorar Colecciones</h2>
      {mensaje && <p>{mensaje}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5em' }}>
        {colecciones.length === 0 && <p>No hay colecciones disponibles.</p>}
        {colecciones.map(col => (
          <div key={col.id} style={{
            display: 'flex', alignItems: 'center', background: '#f1f5fd', borderRadius: 12, boxShadow: '0 2px 8px #2563eb11', padding: '1em', gap: '1.5em'
          }}>
            <Link to={`/colecciones/${col.id}`} style={{ textDecoration: 'none' }}>
              <img src={col.imagen_portada_url || 'https://via.placeholder.com/80x80?text=Cromo'} alt={col.nombre} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', border: '2px solid #2563eb' }} />
            </Link>
            <div style={{ flex: 1 }}>
              <Link to={`/colecciones/${col.id}`} style={{ textDecoration: 'none' }}>
                <h3 style={{ margin: 0, color: '#2563eb' }}>{col.nombre}</h3>
              </Link>
              <p style={{ margin: '0.3em 0 0.5em 0', color: '#333' }}>{col.descripcion}</p>
              <span style={{ color: '#2563eb', fontWeight: 500 }}>Total cromos: {col.total_cromos}</span>
            </div>
            {unidas.includes(col.id) ? (
              <span style={{ color: '#2563eb', fontWeight: 'bold' }}>¡Unido!</span>
            ) : (
              <button onClick={() => handleUnirse(col.id)} style={{
                background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5em 1.2em', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem'
              }}>
                Unirse
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 