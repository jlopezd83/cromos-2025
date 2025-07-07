import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { Link } from "react-router-dom";

export default function MisColecciones() {
  const [user, setUser] = useState(null);
  const [misColecciones, setMisColecciones] = useState([]);
  const [sobresInfo, setSobresInfo] = useState({}); // { [id_coleccion]: { puedeReclamar, tiempoRestante } }
  const [mensaje, setMensaje] = useState("");
  const [reclamando, setReclamando] = useState(null); // id_coleccion que está reclamando
  const [cromosObtenidos, setCromosObtenidos] = useState([]); // Para el popup
  const [showModal, setShowModal] = useState(false);
  const [cromosAntes, setCromosAntes] = useState([]); // ids de cromos que tenía antes
  const [porColeccionPorPegar, setPorColeccionPorPegar] = useState({});
  const [repetidosPorColeccion, setRepetidosPorColeccion] = useState({});
  const [ordenAscendente, setOrdenAscendente] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      // Obtener colecciones a las que está unido, incluyendo fecha_union
      const { data: unidas } = await supabase
        .from("usuarios_colecciones")
        .select("id_coleccion, fecha_union")
        .eq("id_usuario", user.id)
        .order("fecha_union", { ascending: true });
      if (!unidas || unidas.length === 0) {
        setMisColecciones([]);
        return;
      }
      // Mapear ids y fechas
      const ids = unidas.map(u => u.id_coleccion);
      const fechasUnion = {};
      unidas.forEach(u => { fechasUnion[u.id_coleccion] = u.fecha_union; });
      // Obtener info de las colecciones
      const { data: colecciones } = await supabase
        .from("colecciones")
        .select("*")
        .in("id", ids);
      // Obtener progreso de cromos pegados
      let coleccionesConProgreso = [];
      for (let col of colecciones) {
        // Total cromos
        const { count: totalCromos } = await supabase
          .from("cromos")
          .select("id", { count: 'exact', head: true })
          .eq("id_coleccion", col.id);
        // Pegados y repetidos
        const { data: misCromos } = await supabase
          .from("usuarios_cromos")
          .select("id_cromo, pegado")
          .eq("id_usuario", user.id)
          .in("id_cromo", (await supabase.from("cromos").select("id").eq("id_coleccion", col.id)).data.map(c => c.id));
        // Contar pegados
        const pegados = misCromos ? misCromos.filter(c => c.pegado).length : 0;
        // Contar repetidos (no pegados y hay al menos uno pegado)
        let totalRepetidos = 0;
        if (misCromos) {
          const idsPegados = new Set(misCromos.filter(c => c.pegado).map(c => c.id_cromo));
          idsPegados.forEach(idCromo => {
            const noPegados = misCromos.filter(c => c.id_cromo === idCromo && !c.pegado).length;
            if (noPegados > 0) totalRepetidos += noPegados;
          });
        }
        coleccionesConProgreso.push({ ...col, totalCromos, pegados, totalRepetidos, fecha_union: fechasUnion[col.id] });
      }
      // Ordenar por fecha_union
      coleccionesConProgreso.sort((a, b) => ordenAscendente ? new Date(a.fecha_union) - new Date(b.fecha_union) : new Date(b.fecha_union) - new Date(a.fecha_union));
      setMisColecciones(coleccionesConProgreso);
      // Obtener info de sobres para cada colección
      let sobres = {};
      for (let col of colecciones) {
        const { data: ultSobre } = await supabase
          .from("sobres")
          .select("fecha_apertura")
          .eq("id_usuario", user.id)
          .eq("id_coleccion", col.id)
          .eq("gratuito", true)
          .order("fecha_apertura", { ascending: false })
          .limit(1);
        let puedeReclamar = true;
        let tiempoRestante = "";
        if (ultSobre && ultSobre.length > 0) {
          const ultima = new Date(ultSobre[0].fecha_apertura);
          const ahora = new Date();
          const diff = ahora - ultima;
          if (diff < 24 * 60 * 60 * 1000) {
            puedeReclamar = false;
            const restante = 24 * 60 * 60 * 1000 - diff;
            const horas = Math.floor(restante / (60 * 60 * 1000));
            const minutos = Math.floor((restante % (60 * 60 * 1000)) / (60 * 1000));
            tiempoRestante = `${horas}h ${minutos}m`;
          }
        }
        sobres[col.id] = { puedeReclamar, tiempoRestante };
      }
      setSobresInfo(sobres);
    }
    fetchData();
  }, [user, reclamando, ordenAscendente]);

  // Calcular cromos por pegar para cada colección (condición robusta)
  useEffect(() => {
    async function fetchPorPegar() {
      if (!user || !misColecciones.length) return;
      let resultado = {};
      for (let col of misColecciones) {
        const { data: cromosCol } = await supabase
          .from("cromos")
          .select("id")
          .eq("id_coleccion", col.id);
        const idsCromosCol = cromosCol ? cromosCol.map(c => c.id) : [];
        const { data: misCromos } = await supabase
          .from("usuarios_cromos")
          .select("id_cromo, pegado")
          .eq("id_usuario", user.id)
          .in("id_cromo", idsCromosCol);
        // Agrupar por id_cromo y aplicar la condición robusta
        const cromosPorPegar = new Set();
        if (misCromos) {
          const pegados = new Set(misCromos.filter(c => c.pegado).map(c => c.id_cromo));
          misCromos.forEach(c => {
            if (!c.pegado && !pegados.has(c.id_cromo)) {
              cromosPorPegar.add(c.id_cromo);
            }
          });
        }
        resultado[col.id] = cromosPorPegar.size;
      }
      setPorColeccionPorPegar(resultado);
    }
    fetchPorPegar();
  }, [user, misColecciones]);

  // Calcular repetidos por colección
  useEffect(() => {
    async function fetchRepetidosPorColeccion() {
      if (!user || !misColecciones.length) return;
      let resultado = {};
      for (let col of misColecciones) {
        const { data: misCromos } = await supabase
          .from("usuarios_cromos")
          .select("id_cromo, pegado")
          .eq("id_usuario", user.id)
          .in("id_cromo", (await supabase.from("cromos").select("id").eq("id_coleccion", col.id)).data.map(c => c.id));
        // Agrupar por id_cromo
        const agrupadosPorCromo = {};
        if (misCromos) {
          misCromos.forEach(c => {
            if (!agrupadosPorCromo[c.id_cromo]) agrupadosPorCromo[c.id_cromo] = [];
            agrupadosPorCromo[c.id_cromo].push(c);
          });
        }
        let totalRepetidos = 0;
        Object.values(agrupadosPorCromo).forEach(cromos => {
          const tienePegado = cromos.some(c => c.pegado);
          const noPegados = cromos.filter(c => !c.pegado);
          if (tienePegado && noPegados.length > 0) {
            totalRepetidos += noPegados.reduce((acc, c) => acc + 1, 0); // Suma 1 por cada repetido
          }
        });
        resultado[col.id] = totalRepetidos;
      }
      setRepetidosPorColeccion(resultado);
    }
    fetchRepetidosPorColeccion();
  }, [user, misColecciones]);

  const handleReclamar = async (id_coleccion) => {
    setReclamando(id_coleccion);
    setMensaje("");
    // Obtener cromos que el usuario ya tenía antes
    const { data: cromosUsuarioAntes } = await supabase
      .from("usuarios_cromos")
      .select("id_cromo")
      .eq("id_usuario", user.id);
    setCromosAntes(cromosUsuarioAntes ? cromosUsuarioAntes.map(c => c.id_cromo) : []);
    // Obtener todos los cromos de esa colección
    const { data: cromos } = await supabase
      .from("cromos")
      .select("id, nombre, imagen_url")
      .eq("id_coleccion", id_coleccion);
    if (!cromos || cromos.length < 5) {
      setMensaje("No hay suficientes cromos en la colección.");
      setReclamando(null);
      return;
    }
    // Elegir 5 cromos aleatorios
    const seleccionados = [];
    const indices = new Set();
    while (indices.size < 5) {
      indices.add(Math.floor(Math.random() * cromos.length));
    }
    for (let idx of indices) {
      seleccionados.push(cromos[idx]);
    }
    // Insertar sobre
    const { data: sobre, error: errorSobre } = await supabase
      .from("sobres")
      .insert({
        id_usuario: user.id,
        id_coleccion,
        fecha_apertura: new Date().toISOString(),
        gratuito: true,
      })
      .select()
      .single();
    if (errorSobre) {
      setMensaje("Error al reclamar el sobre.");
      setReclamando(null);
      return;
    }
    // Insertar cromos obtenidos en sobres_cromos y usuarios_cromos
    for (let cromo of seleccionados) {
      await supabase.from("sobres_cromos").insert({
        id_sobre: sobre.id,
        id_cromo: cromo.id,
      });
      // Añadir cromo al usuario (usuarios_cromos): si ya lo tiene y no pegado, suma cantidad; si no, crea registro
      const { data: userCromo } = await supabase
        .from("usuarios_cromos")
        .select("id, pegado")
        .eq("id_usuario", user.id)
        .eq("id_cromo", cromo.id)
        .eq("pegado", false)
        .single();
      if (userCromo) {
        await supabase
          .from("usuarios_cromos")
          .update({ pegado: true }) // Solo actualiza el campo pegado
          .eq("id", userCromo.id);
      } else {
        await supabase.from("usuarios_cromos").insert({
          id_usuario: user.id,
          id_cromo: cromo.id,
          pegado: false,
        });
      }
    }
    setMensaje("¡Has reclamado tu sobre!");
    setCromosObtenidos(seleccionados);
    setShowModal(true);
    setReclamando(null);
  };

  const handleCerrarModal = () => {
    setShowModal(false);
    setCromosObtenidos([]);
    setCromosAntes([]);
  };

  return (
    <div className="main-content">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          onClick={() => setOrdenAscendente(o => !o)}
          style={{ background: '#f1f5fd', color: '#2563eb', border: '1px solid #2563eb', borderRadius: 8, padding: '0.4em 1.2em', fontWeight: 'bold', fontSize: '1em', cursor: 'pointer' }}
        >
          {ordenAscendente ? 'Más antigua primero' : 'Más reciente primero'}
        </button>
      </div>
      <h2>Mis colecciones</h2>
      {mensaje && <p>{mensaje}</p>}
      {user ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2em' }}>
          {misColecciones.length === 0 && <p>No estás unido a ninguna colección.</p>}
          {misColecciones.map(col => {
            const porcentaje = col.totalCromos > 0 ? Math.round((col.pegados / col.totalCromos) * 100) : 0;
            const porPegar = porColeccionPorPegar[col.id] || 0;
            return (
              <div key={col.id} style={{ display: 'flex', alignItems: 'center', background: '#f1f5fd', borderRadius: 12, boxShadow: '0 2px 8px #2563eb11', padding: '1em', gap: '1.5em' }}>
                <Link to={`/colecciones/${col.id}`} style={{ textDecoration: 'none' }}>
                  <img src={col.imagen_portada_url || 'https://via.placeholder.com/80x80?text=Coleccion'} alt={col.nombre} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', border: '2px solid #2563eb' }} />
                </Link>
                <div style={{ flex: 1 }}>
                  <Link to={`/colecciones/${col.id}`} style={{ textDecoration: 'none' }}>
                    <h3 style={{ margin: 0, color: '#2563eb' }}>{col.nombre}</h3>
                  </Link>
                  <span style={{ color: '#2563eb', fontWeight: 500 }}>
                    {col.pegados}/{col.totalCromos} cromos ({porcentaje}%)
                  </span>
                  {col.totalRepetidos > 0 && (
                    <span style={{ color: '#22c55e', fontWeight: 'bold', marginLeft: 12 }}>
                      {col.totalRepetidos} repetidos
                    </span>
                  )}
                  {porPegar > 0 && (
                    <div style={{ color: '#f59e42', fontWeight: 'bold', marginTop: 4 }}>
                      Tienes {porPegar} cromos por pegar
                    </div>
                  )}
                  <p style={{ margin: '0.3em 0 0.5em 0', color: '#333' }}>{col.descripcion}</p>
                </div>
                <div style={{ minWidth: 180 }}>
                  {sobresInfo[col.id]?.puedeReclamar ? (
                    <button
                      onClick={() => handleReclamar(col.id)}
                      disabled={reclamando === col.id}
                      style={{
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '0.5em 1.2em',
                        fontWeight: 'bold',
                        cursor: reclamando === col.id ? 'not-allowed' : 'pointer',
                        fontSize: '1rem'
                      }}
                    >
                      {reclamando === col.id ? 'Reclamando...' : 'Reclamar sobre gratuito'}
                    </button>
                  ) : (
                    <span style={{ color: '#2563eb', fontWeight: 'bold' }}>
                      Vuelve en {sobresInfo[col.id]?.tiempoRestante} para reclamar tu sobre gratuito
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p>Inicia sesión para ver tus colecciones.</p>
      )}
      {/* Modal de cromos obtenidos */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '2em 2em 1.5em 2em', boxShadow: '0 4px 24px #2563eb33', minWidth: 320, maxWidth: 420, textAlign: 'center' }}>
            <h3 style={{ color: '#2563eb' }}>¡Tus cromos del sobre!</h3>
            <div style={{ display: 'flex', gap: '1.2em', flexWrap: 'wrap', justifyContent: 'center', margin: '1.5em 0' }}>
              {cromosObtenidos.map(cromo => {
                const esNuevo = cromosAntes && !cromosAntes.includes(cromo.id);
                return (
                  <div key={cromo.id} style={{ background: '#f1f5fd', border: '2px solid #2563eb', borderRadius: 10, padding: 10, textAlign: 'center', width: 90, position: 'relative' }}>
                    <img src={cromo.imagen_url || 'https://via.placeholder.com/80x80?text=Cromo'} alt={cromo.nombre} style={{ width: 70, height: 70, borderRadius: 8, objectFit: 'cover', marginBottom: 8 }} />
                    <div style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '0.95em' }}>{cromo.nombre}</div>
                    <div style={{
                      marginTop: 6,
                      display: 'inline-block',
                      background: esNuevo ? '#22c55e' : '#facc15',
                      color: esNuevo ? '#fff' : '#333',
                      borderRadius: 6,
                      padding: '0.2em 0.6em',
                      fontSize: '0.8em',
                      fontWeight: 'bold'
                    }}>
                      {esNuevo ? 'Nuevo' : 'Repetido'}
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={handleCerrarModal} style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '0.7em 2em',
              fontWeight: 'bold',
              fontSize: '1.1em',
              cursor: 'pointer',
              marginTop: 10
            }}>Aceptar</button>
          </div>
        </div>
      )}
      {/* Media query para móvil: solo apila las tarjetas, no cambies tamaño de imagen ni padding */}
      <style>{`
        @media (max-width: 600px) {
          .main-content > div {
            flex-direction: column !important;
            gap: 16px !important;
          }
          .main-content > div > div {
            flex-direction: column !important;
            max-width: 98vw !important;
            min-width: 0 !important;
            gap: 1em !important;
          }
        }
      `}</style>
    </div>
  );
} 