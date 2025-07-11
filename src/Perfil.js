import { useEffect, useState, useRef } from "react";
import { supabase } from "./supabaseClient";
import { useUser } from "./UserContext";

export default function Perfil() {
  const { premiumExpired, setPremiumExpired } = useUser();
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState({ nombre_usuario: "", avatar_url: "", premium: false });
  const [form, setForm] = useState({ nombre_usuario: "", avatar_url: "" });
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [comprobando, setComprobando] = useState(false);
  const [disponible, setDisponible] = useState(null);
  const [editando, setEditando] = useState(false);
  const [gestionandoSuscripcion, setGestionandoSuscripcion] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (user) {
      setCargando(true);
      supabase
        .from("perfiles")
        .select("nombre_usuario, avatar_url, premium")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          setPerfil(data || {});
          setForm({
            nombre_usuario: data?.nombre_usuario || "",
            avatar_url: data?.avatar_url || ""
          });
          setCargando(false);
        });
    }
  }, [user]);

  // Comprobar disponibilidad en tiempo real
  useEffect(() => {
    if (!editando) return;
    if (!form.nombre_usuario || form.nombre_usuario === perfil.nombre_usuario) {
      setDisponible(null);
      return;
    }
    setComprobando(true);
    const timeout = setTimeout(() => {
      supabase
        .from("perfiles")
        .select("id")
        .eq("nombre_usuario", form.nombre_usuario)
        .then(({ data }) => {
          setDisponible(!data || data.length === 0);
          setComprobando(false);
        });
    }, 400);
    return () => clearTimeout(timeout);
  }, [form.nombre_usuario, perfil.nombre_usuario, editando]);

  const handleEditar = () => {
    setEditando(true);
    setMensaje("");
  };

  const handleCancelar = () => {
    setEditando(false);
    setForm({
      nombre_usuario: perfil.nombre_usuario || "",
      avatar_url: perfil.avatar_url || ""
    });
    setMensaje("");
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setMensaje("");
    if (!form.nombre_usuario) {
      setMensaje("El nombre de usuario es obligatorio.");
      return;
    }
    if (form.nombre_usuario !== perfil.nombre_usuario) {
      setComprobando(true);
      // Comprobación final de unicidad
      const { data: existentes } = await supabase
        .from("perfiles")
        .select("id")
        .eq("nombre_usuario", form.nombre_usuario);
      if (existentes && existentes.length > 0) {
        setMensaje("Ese nombre de usuario ya está en uso.");
        setComprobando(false);
        return;
      }
      setComprobando(false);
    }
    // Actualizar
    const { error } = await supabase
      .from("perfiles")
      .update({
        nombre_usuario: form.nombre_usuario,
        avatar_url: form.avatar_url
      })
      .eq("id", user.id);
    if (error) {
      setMensaje("Error al actualizar el perfil.");
    } else {
      setMensaje("¡Perfil actualizado!");
      setPerfil({ ...perfil, ...form });
      setEditando(false);
    }
  };

  const handleInputChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Gestionar suscripción premium
  const handleGestionarSuscripcion = async () => {
    if (!user) return;
    setGestionandoSuscripcion(true);
    try {
      const res = await fetch('/api/create-billing-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location = data.url;
      } else {
        alert('Error: ' + (data.error || 'No se pudo acceder al portal de gestión.'));
      }
    } catch (err) {
      alert('Error al conectar con el portal de gestión.');
    } finally {
      setGestionandoSuscripcion(false);
    }
  };

  // Subida de avatar
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileExt = file.name.split('.').pop();
    const filePath = `avatars/${user.id}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
    if (uploadError) {
      setMensaje("Error al subir el avatar.");
      return;
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    setForm({ ...form, avatar_url: data.publicUrl });
  };

  if (cargando) return <div className="main-content"><p>Cargando perfil...</p></div>;

  return (
    <div className="main-content" style={{ maxWidth: 400, margin: '0 auto' }}>
      <h2>Mi perfil</h2>
      
      {/* Mensaje de expiración de premium */}
      {premiumExpired && (
        <div style={{
          background: '#fef2f2',
          border: '2px solid #fecaca',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#dc2626', marginBottom: 8, fontSize: '1.1em', fontWeight: 'bold' }}>
            ⚠️ Premium Expirado
          </h3>
          <p style={{ color: '#dc2626', marginBottom: 16, fontSize: '0.95em' }}>
            Tu suscripción premium ha expirado. Ya no tienes acceso a las ventajas premium.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => window.location.href = '/premium'}
              style={{
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '0.6em 1.2em',
                fontWeight: 'bold',
                fontSize: '0.9em',
                cursor: 'pointer'
              }}
            >
              Reactivar Premium
            </button>
            <button
              onClick={() => setPremiumExpired(false)}
              style={{
                background: '#f3f4f6',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                padding: '0.6em 1.2em',
                fontWeight: 'bold',
                fontSize: '0.9em',
                cursor: 'pointer'
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
      {perfil.premium && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: '1.5em', color: '#facc15', filter: 'drop-shadow(0 1px 2px #facc1555)' }}>★</span>
          <span style={{ color: '#facc15', fontWeight: 'bold', fontSize: '1.1em', letterSpacing: 1 }}>Premium</span>
        </div>
      )}
      <form onSubmit={handleGuardar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <img
            src={form.avatar_url || 'https://ui-avatars.com/api/?name=Usuario&background=2563eb&color=fff&size=128'}
            alt="avatar"
            style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '2px solid #2563eb' }}
          />
          {editando && (
            <>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleAvatarChange}
              />
              <button type="button" onClick={() => fileInputRef.current.click()} style={{ marginTop: 6, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3em 0.8em', fontWeight: 'bold', cursor: 'pointer' }}>
                Cambiar avatar
              </button>
            </>
          )}
        </div>
        <label style={{ fontWeight: 'bold', color: '#2563eb' }}>Nombre de usuario *</label>
        <input
          type="text"
          name="nombre_usuario"
          value={form.nombre_usuario}
          onChange={handleInputChange}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #2563eb', fontSize: '1.1em' }}
          maxLength={32}
          disabled={!editando}
        />
        {editando && form.nombre_usuario !== perfil.nombre_usuario && disponible === false && (
          <span style={{ color: '#dc2626', fontWeight: 'bold' }}>Ese nombre ya está en uso</span>
        )}
        {editando && form.nombre_usuario !== perfil.nombre_usuario && disponible && (
          <span style={{ color: '#22c55e', fontWeight: 'bold' }}>¡Disponible!</span>
        )}
        {/* Eliminar el campo de rol, no mostrar ni el label ni el input */}
        {!editando ? (
          <button type="button" onClick={handleEditar} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5em 1.2em', fontWeight: 'bold', fontSize: '1em', marginTop: 12, cursor: 'pointer' }}>
            Editar
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button
              type="submit"
              disabled={comprobando || !form.nombre_usuario || form.nombre_usuario !== perfil.nombre_usuario && disponible === false}
              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5em 1.2em', fontWeight: 'bold', fontSize: '1em', cursor: comprobando || !form.nombre_usuario || form.nombre_usuario !== perfil.nombre_usuario && disponible === false ? 'not-allowed' : 'pointer' }}
            >
              Guardar
            </button>
            <button type="button" onClick={handleCancelar} style={{ background: '#f3f4f6', color: '#2563eb', border: '1px solid #2563eb', borderRadius: 6, padding: '0.5em 1.2em', fontWeight: 'bold', fontSize: '1em', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        )}
        {mensaje && <div style={{ marginTop: 12, color: mensaje.includes('actualizado') ? '#22c55e' : '#dc2626', fontWeight: 'bold' }}>{mensaje}</div>}
      </form>
      
      {/* Botón de gestión de suscripción para usuarios premium */}
      {perfil.premium && (
        <div style={{ marginTop: 24, padding: 16, background: '#fef9c3', borderRadius: 12, border: '2px solid #facc15' }}>
          <h3 style={{ color: '#b45309', marginBottom: 12, fontSize: '1.1em', fontWeight: 'bold' }}>
            <span style={{ color: '#facc15', marginRight: 6 }}>★</span>
            Gestión de Suscripción Premium
          </h3>
          <p style={{ color: '#b45309', marginBottom: 16, fontSize: '0.95em' }}>
            Gestiona tu suscripción premium, actualiza métodos de pago o cancela tu plan.
          </p>
          <button
            onClick={handleGestionarSuscripcion}
            disabled={gestionandoSuscripcion}
            style={{
              background: '#facc15',
              color: '#b45309',
              border: 'none',
              borderRadius: 8,
              padding: '0.6em 1.2em',
              fontWeight: 'bold',
              fontSize: '1em',
              cursor: gestionandoSuscripcion ? 'not-allowed' : 'pointer',
              opacity: gestionandoSuscripcion ? 0.7 : 1
            }}
          >
            {gestionandoSuscripcion ? 'Cargando...' : 'Gestiona tu suscripción'}
          </button>
        </div>
      )}
    </div>
  );
} 