import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const TABS = ["Buscar", "Solicitudes recibidas", "Solicitudes enviadas", "Mis amigos"];

export default function Amigos() {
  const [user, setUser] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(null);
  const [amistades, setAmistades] = useState([]); // Todas las relaciones
  const [tab, setTab] = useState(TABS[0]);
  const [perfiles, setPerfiles] = useState({}); // id -> perfil

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  // Cargar todas las relaciones de amistad y perfiles relacionados
  useEffect(() => {
    if (!user) return;
    async function fetchAmistades() {
      const { data: amigos } = await supabase
        .from("amigos")
        .select("id, id_usuario, id_amigo, estado, fecha_solicitud")
        .or(`id_usuario.eq.${user.id},id_amigo.eq.${user.id}`);
      setAmistades(amigos || []);
      // Cargar perfiles de todos los usuarios relacionados
      const ids = Array.from(new Set((amigos || []).flatMap(a => [a.id_usuario, a.id_amigo]).filter(id => id !== user.id)));
      if (ids.length > 0) {
        const { data: perfilesData } = await supabase
          .from("perfiles")
          .select("id, nombre_usuario, avatar_url")
          .in("id", ids);
        const map = {};
        (perfilesData || []).forEach(p => { map[p.id] = p; });
        setPerfiles(map);
      } else {
        setPerfiles({});
      }
    }
    fetchAmistades();
  }, [user]);

  // --- BUSCAR Y ENVIAR SOLICITUD ---
  const handleBuscar = async (e) => {
    e.preventDefault();
    setMensaje("");
    if (!busqueda.trim()) return;
    const { data: usuarios } = await supabase
      .from("perfiles")
      .select("id, nombre_usuario, avatar_url")
      .ilike("nombre_usuario", `%${busqueda.trim()}%`);
    // Excluirse a sí mismo
    const filtrados = (usuarios || []).filter(u => u.id !== user.id);
    setResultados(filtrados);
  };

  const yaEsAmigoOPendiente = (id) => {
    return amistades.some(a =>
      (a.id_usuario === user.id && a.id_amigo === id || a.id_usuario === id && a.id_amigo === user.id)
      && (a.estado === "aceptado" || a.estado === "pendiente")
    );
  };

  const handleEnviarSolicitud = async (id_amigo) => {
    setEnviando(id_amigo);
    setMensaje("");
    // Comprobar si ya existe relación
    const { data: existentes } = await supabase
      .from("amigos")
      .select("id")
      .or(`and(id_usuario.eq.${user.id},id_amigo.eq.${id_amigo}),and(id_usuario.eq.${id_amigo},id_amigo.eq.${user.id})`)
      .in("estado", ["pendiente", "aceptado"]);
    if (existentes && existentes.length > 0) {
      setMensaje("Ya existe una solicitud o ya sois amigos.");
      setEnviando(null);
      return;
    }
    // Insertar solicitud
    const { error } = await supabase.from("amigos").insert({
      id_usuario: user.id,
      id_amigo,
      estado: "pendiente",
      fecha_solicitud: new Date().toISOString()
    });
    if (error) {
      setMensaje("Error al enviar la solicitud.");
    } else {
      setMensaje("Solicitud enviada.");
      setAmistades([...amistades, { id_usuario: user.id, id_amigo, estado: "pendiente" }]);
    }
    setEnviando(null);
  };

  // --- GESTIÓN DE SOLICITUDES ---
  const handleAceptar = async (id_usuario) => {
    setMensaje("");
    const { error } = await supabase
      .from("amigos")
      .update({ estado: "aceptado" })
      .eq("id_usuario", id_usuario)
      .eq("id_amigo", user.id)
      .eq("estado", "pendiente");
    if (error) {
      setMensaje("Error al aceptar la solicitud.");
    } else {
      setMensaje("Solicitud aceptada.");
      setAmistades(amistades.map(a =>
        a.id_usuario === id_usuario && a.id_amigo === user.id && a.estado === "pendiente"
          ? { ...a, estado: "aceptado" }
          : a
      ));
    }
  };

  const handleRechazar = async (id_usuario) => {
    setMensaje("");
    const { error } = await supabase
      .from("amigos")
      .update({ estado: "rechazado" })
      .eq("id_usuario", id_usuario)
      .eq("id_amigo", user.id)
      .eq("estado", "pendiente");
    if (error) {
      setMensaje("Error al rechazar la solicitud.");
    } else {
      setMensaje("Solicitud rechazada.");
      setAmistades(amistades.map(a =>
        a.id_usuario === id_usuario && a.id_amigo === user.id && a.estado === "pendiente"
          ? { ...a, estado: "rechazado" }
          : a
      ));
    }
  };

  // --- FILTROS ---
  const solicitudesRecibidas = amistades.filter(a => a.id_amigo === user?.id && a.estado === "pendiente");
  const solicitudesEnviadas = amistades.filter(a => a.id_usuario === user?.id && a.estado === "pendiente");
  const amigosAceptados = amistades.filter(a => a.estado === "aceptado" && (a.id_usuario === user?.id || a.id_amigo === user?.id));

  return (
    <div className="main-content" style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2>Amigos</h2>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? '#2563eb' : '#f3f4f6',
              color: tab === t ? '#fff' : '#2563eb',
              border: 'none',
              borderRadius: 8,
              padding: '0.5em 1.2em',
              fontWeight: 'bold',
              fontSize: '1em',
              cursor: 'pointer',
              boxShadow: tab === t ? '0 2px 8px #2563eb22' : 'none',
              transition: 'all 0.2s'
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {mensaje && <div style={{ marginBottom: 16, color: mensaje.includes('enviada') || mensaje.includes('aceptada') ? '#22c55e' : '#dc2626', fontWeight: 'bold' }}>{mensaje}</div>}
      {tab === "Buscar" && (
        <>
          <form onSubmit={handleBuscar} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <input
              type="text"
              placeholder="Buscar por nombre de usuario"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #2563eb', fontSize: '1em' }}
            />
            <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5em 1.2em', fontWeight: 'bold', fontSize: '1em', cursor: 'pointer' }}>
              Buscar
            </button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {resultados.length === 0 && <p style={{ color: '#888' }}>No hay resultados.</p>}
            {resultados.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#f1f5fd', borderRadius: 10, padding: 10 }}>
                <img src={u.avatar_url || 'https://ui-avatars.com/api/?name=U&background=2563eb&color=fff&size=64'} alt={u.nombre_usuario} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #2563eb' }} />
                <span style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '1.1em' }}>{u.nombre_usuario}</span>
                <div style={{ flex: 1 }} />
                {yaEsAmigoOPendiente(u.id) ? (
                  <span style={{ color: '#888', fontWeight: 'bold' }}>Solicitud enviada o ya es tu amigo</span>
                ) : (
                  <button
                    onClick={() => handleEnviarSolicitud(u.id)}
                    disabled={enviando === u.id}
                    style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4em 1em', fontWeight: 'bold', cursor: enviando === u.id ? 'not-allowed' : 'pointer' }}
                  >
                    {enviando === u.id ? 'Enviando...' : 'Enviar solicitud'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "Solicitudes recibidas" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {solicitudesRecibidas.length === 0 && <p style={{ color: '#888' }}>No tienes solicitudes pendientes.</p>}
          {solicitudesRecibidas.map(a => {
            const perfilUsuario = perfiles[a.id_usuario];
            return (
              <div key={a.id_usuario} style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#fef9c3', borderRadius: 10, padding: 10 }}>
                <img src={perfilUsuario?.avatar_url || 'https://ui-avatars.com/api/?name=U&background=2563eb&color=fff&size=64'} alt={perfilUsuario?.nombre_usuario} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #facc15' }} />
                <span style={{ fontWeight: 'bold', color: '#b45309', fontSize: '1.1em' }}>{perfilUsuario?.nombre_usuario || a.id_usuario}</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => handleAceptar(a.id_usuario)} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4em 1em', fontWeight: 'bold', cursor: 'pointer', marginRight: 8 }}>Aceptar</button>
                <button onClick={() => handleRechazar(a.id_usuario)} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4em 1em', fontWeight: 'bold', cursor: 'pointer' }}>Rechazar</button>
              </div>
            );
          })}
        </div>
      )}
      {tab === "Solicitudes enviadas" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {solicitudesEnviadas.length === 0 && <p style={{ color: '#888' }}>No has enviado solicitudes pendientes.</p>}
          {solicitudesEnviadas.map(a => {
            const perfilAmigo = perfiles[a.id_amigo];
            return (
              <div key={a.id_amigo} style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#f1f5fd', borderRadius: 10, padding: 10 }}>
                <img src={perfilAmigo?.avatar_url || 'https://ui-avatars.com/api/?name=U&background=2563eb&color=fff&size=64'} alt={perfilAmigo?.nombre_usuario} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #2563eb' }} />
                <span style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '1.1em' }}>{perfilAmigo?.nombre_usuario || a.id_amigo}</span>
                <div style={{ flex: 1 }} />
                <span style={{ color: '#888', fontWeight: 'bold' }}>Pendiente</span>
              </div>
            );
          })}
        </div>
      )}
      {tab === "Mis amigos" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {amigosAceptados.length === 0 && <p style={{ color: '#888' }}>No tienes amigos aún.</p>}
          {amigosAceptados.map(a => {
            const amigoId = a.id_usuario === user.id ? a.id_amigo : a.id_usuario;
            const perfilAmigo = perfiles[amigoId];
            return (
              <div key={amigoId} style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#dbeafe', borderRadius: 10, padding: 10 }}>
                <img src={perfilAmigo?.avatar_url || 'https://ui-avatars.com/api/?name=U&background=2563eb&color=fff&size=64'} alt={perfilAmigo?.nombre_usuario} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #2563eb' }} />
                <span style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '1.1em' }}>{perfilAmigo?.nombre_usuario || amigoId}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 