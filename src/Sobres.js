import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function Sobres() {
  const [user, setUser] = useState(null);
  const [colecciones, setColecciones] = useState([]); // [{id, nombre, ...}]
  const [estadoColecciones, setEstadoColecciones] = useState({}); // {id_coleccion: {ultimaApertura, puedeReclamar, abriendo, cromosObtenidos, mensaje}}

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (user) {
      // Obtener colecciones a las que está unido el usuario
      supabase
        .from("usuarios_colecciones")
        .select("id_coleccion, colecciones(nombre, descripcion, imagen_portada_url)")
        .eq("id_usuario", user.id)
        .then(async ({ data }) => {
          if (data && data.length > 0) {
            const colls = data.map(c => ({
              id: c.id_coleccion,
              nombre: c.colecciones?.nombre || 'Colección',
              descripcion: c.colecciones?.descripcion || '',
              imagen_portada_url: c.colecciones?.imagen_portada_url || '',
            }));
            setColecciones(colls);
            // Para cada colección, obtener el estado de sobres gratuitos
            const estados = {};
            for (let col of colls) {
              // Buscar la última apertura de sobre gratuito para esta colección
              const { data: sobres } = await supabase
                .from("sobres")
                .select("fecha_apertura")
                .eq("id_usuario", user.id)
                .eq("id_coleccion", col.id)
                .eq("gratuito", true)
                .order("fecha_apertura", { ascending: false })
                .limit(1);
              let ultimaApertura = sobres && sobres.length > 0 ? new Date(sobres[0].fecha_apertura) : null;
              let puedeReclamar = true;
              if (ultimaApertura) {
                const ahora = new Date();
                const diff = ahora - ultimaApertura;
                puedeReclamar = diff > 24 * 60 * 60 * 1000;
              }
              estados[col.id] = {
                ultimaApertura,
                puedeReclamar,
                abriendo: false,
                cromosObtenidos: [],
                mensaje: ""
              };
            }
            setEstadoColecciones(estados);
          } else {
            setColecciones([]);
          }
        });
    }
  }, [user]);

  // Reclamar sobre gratuito para una colección
  const handleReclamar = async (id_coleccion) => {
    setEstadoColecciones(prev => ({
      ...prev,
      [id_coleccion]: { ...prev[id_coleccion], abriendo: true, mensaje: "" }
    }));
    // Obtener todos los cromos de esa colección
    const { data: cromos } = await supabase
      .from("cromos")
      .select("id")
      .eq("id_coleccion", id_coleccion);
    if (!cromos || cromos.length < 5) {
      setEstadoColecciones(prev => ({
        ...prev,
        [id_coleccion]: { ...prev[id_coleccion], mensaje: "No hay suficientes cromos en la colección.", abriendo: false }
      }));
      return;
    }
    // Elegir 5 cromos aleatorios
    const seleccionados = [];
    const indices = new Set();
    while (indices.size < 5) {
      indices.add(Math.floor(Math.random() * cromos.length));
    }
    for (let idx of indices) {
      seleccionados.push(cromos[idx].id);
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
      setEstadoColecciones(prev => ({
        ...prev,
        [id_coleccion]: { ...prev[id_coleccion], mensaje: "Error al reclamar el sobre.", abriendo: false }
      }));
      return;
    }
    // Insertar cromos obtenidos en sobres_cromos y usuarios_cromos
    for (let id_cromo of seleccionados) {
      await supabase.from("sobres_cromos").insert({
        id_sobre: sobre.id,
        id_cromo,
      });
      const { data: userCromo } = await supabase
        .from("usuarios_cromos")
        .select("id, cantidad")
        .eq("id_usuario", user.id)
        .eq("id_cromo", id_cromo)
        .eq("pegado", false)
        .single();
      if (userCromo) {
        await supabase
          .from("usuarios_cromos")
          .update({ cantidad: userCromo.cantidad + 1 })
          .eq("id", userCromo.id);
      } else {
        await supabase.from("usuarios_cromos").insert({
          id_usuario: user.id,
          id_cromo,
          cantidad: 1,
          pegado: false,
        });
      }
    }
    // Obtener info de los cromos para mostrar
    const { data: cromosInfo } = await supabase
      .from("cromos")
      .select("id, nombre, imagen_url")
      .in("id", seleccionados);
    setEstadoColecciones(prev => ({
      ...prev,
      [id_coleccion]: {
        ...prev[id_coleccion],
        cromosObtenidos: cromosInfo,
        mensaje: "¡Has abierto un sobre!",
        abriendo: false,
        puedeReclamar: false,
        ultimaApertura: new Date()
      }
    }));
  };

  // Comprar sobre para una colección
  async function handleCheckoutSobres(id_coleccion) {
    if (!user) {
      alert('Debes iniciar sesión para comprar sobres.');
      return;
    }
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'sobres', userId: user.id, id_coleccion }),
    });
    const data = await res.json();
    if (data.url) {
      window.location = data.url;
    } else {
      alert('Error: ' + data.error);
    }
  }

  if (!user) {
    return <div className="main-content" style={{ maxWidth: 500 }}><p>Inicia sesión para reclamar o comprar sobres.</p></div>;
  }

  return (
    <div className="main-content" style={{ maxWidth: 700 }}>
      <h2>Sobres por colección</h2>
      {colecciones.length === 0 ? (
        <p>Únete a una colección para reclamar o comprar sobres.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center' }}>
          {colecciones.map(col => {
            const estado = estadoColecciones[col.id] || {};
            // Calcular tiempo restante
            let tiempoRestante = "";
            if (estado.ultimaApertura && !estado.puedeReclamar) {
              const ahora = new Date();
              const diff = 24 * 60 * 60 * 1000 - (ahora - estado.ultimaApertura);
              if (diff > 0) {
                const horas = Math.floor(diff / (60 * 60 * 1000));
                const minutos = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
                tiempoRestante = `${horas}h ${minutos}m`;
              }
            }
            return (
              <div key={col.id} style={{
                background: '#fff',
                border: '2px solid #2563eb22',
                borderRadius: 18,
                padding: 0,
                minWidth: 290,
                maxWidth: 350,
                boxShadow: '0 4px 18px #2563eb13',
                marginBottom: 20,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, background: '#f4f8fb', padding: '18px 18px 10px 18px' }}>
                  <img src={col.imagen_portada_url || 'https://via.placeholder.com/80x80?text=Coleccion'} alt={col.nombre} style={{ width: 70, height: 70, borderRadius: 12, objectFit: 'cover', border: '2px solid #2563eb' }} />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ color: '#2563eb', margin: 0, fontSize: '1.2em', fontWeight: 700 }}>{col.nombre}</h3>
                    <p style={{ margin: '0.3em 0 0.5em 0', color: '#333', fontSize: '0.98em' }}>{col.descripcion}</p>
                  </div>
                </div>
                <div style={{ padding: '0 18px 18px 18px', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                  {estado.mensaje && <p style={{ margin: '0.5em 0', color: '#2563eb', fontWeight: 500 }}>{estado.mensaje}</p>}
                  {estado.puedeReclamar ? (
                    <button
                      onClick={() => handleReclamar(col.id)}
                      disabled={estado.abriendo}
                      style={{
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '0.7em 1.5em',
                        fontWeight: 'bold',
                        fontSize: '1em',
                        marginBottom: 10,
                        cursor: estado.abriendo ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 8px #2563eb22',
                        transition: 'background 0.2s',
                        marginRight: 8
                      }}
                    >
                      {estado.abriendo ? 'Abriendo...' : 'Reclamar sobre gratuito'}
                    </button>
                  ) : (
                    <p style={{ margin: '8px 0', color: '#555' }}>Próximo sobre gratuito en: <b>{tiempoRestante}</b></p>
                  )}
                  <button
                    onClick={() => handleCheckoutSobres(col.id)}
                    style={{
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '0.7em 1.5em',
                      fontWeight: 'bold',
                      fontSize: '1em',
                      marginBottom: 10,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px #10b98122',
                      transition: 'background 0.2s',
                    }}
                  >
                    Comprar sobre
                  </button>
                  {estado.cromosObtenidos && estado.cromosObtenidos.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <h4 style={{ color: '#2563eb', fontSize: '1em', margin: 0 }}>¡Tus cromos obtenidos!</h4>
                      <div style={{ display: 'flex', gap: '1em', flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
                        {estado.cromosObtenidos.map(cromo => (
                          <div key={cromo.id} style={{
                            background: '#f1f5fd',
                            border: '2px solid #2563eb',
                            borderRadius: 10,
                            padding: 10,
                            textAlign: 'center',
                            width: 80
                          }}>
                            <img src={cromo.imagen_url || 'https://via.placeholder.com/60x60?text=Cromo'} alt={cromo.nombre} style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', marginBottom: 6 }} />
                            <div style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '0.95em' }}>{cromo.nombre}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 