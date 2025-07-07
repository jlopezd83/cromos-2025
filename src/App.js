import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Login from "./Login";
import Registro from "./Registro";
import Colecciones from "./Colecciones";
import ColeccionDetalle from "./ColeccionDetalle";
import MisColecciones from "./MisColecciones";
import Repetidos from "./Repetidos";
import Perfil from "./Perfil";
import Amigos from "./Amigos";
import Sobres from "./Sobres";
import Mercado from "./Mercado";
import { supabase } from "./supabaseClient";
import "./App.css";

function Navbar() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMenuOpen(false);
  };

  // Cierra el menú al navegar
  const handleNavClick = () => setMenuOpen(false);

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <span role="img" aria-label="cromo" style={{ fontSize: '2rem' }}>🟦</span>
        <span className="navbar-title">Cromos 2025</span>
      </div>
      <button className="navbar-burger" onClick={() => setMenuOpen(m => !m)} aria-label="Abrir menú">
        <span style={{ fontSize: 28, color: '#fff' }}>&#9776;</span>
      </button>
      <div className={`navbar-links${menuOpen ? ' open' : ''}`}>
        <Link className={location.pathname === "/" ? "active" : ""} to="/" onClick={handleNavClick}>Inicio</Link>
        {!user && (
          <>
            <Link className={location.pathname === "/login" ? "active" : ""} to="/login" onClick={handleNavClick}>Login</Link>
            <Link className={location.pathname === "/registro" ? "active" : ""} to="/registro" onClick={handleNavClick}>Registro</Link>
          </>
        )}
        {user && (
          <>
            <Link className={location.pathname === "/mis-colecciones" ? "active" : ""} to="/mis-colecciones" onClick={handleNavClick}>Mis colecciones</Link>
            <Link className={location.pathname.startsWith("/colecciones") ? "active" : ""} to="/colecciones" onClick={handleNavClick}>Explorar</Link>
            <Link className={location.pathname === "/repetidos" ? "active" : ""} to="/repetidos" onClick={handleNavClick}>Repetidos</Link>
            <Link className={location.pathname === "/sobres" ? "active" : ""} to="/sobres" onClick={handleNavClick}>Sobres</Link>
            <Link className={location.pathname === "/amigos" ? "active" : ""} to="/amigos" onClick={handleNavClick}>Amigos</Link>
            <Link className={location.pathname === "/perfil" ? "active" : ""} to="/perfil" onClick={handleNavClick}>Mi perfil</Link>
            <Link className={location.pathname === "/mercado" ? "active" : ""} to="/mercado" onClick={handleNavClick}>Mercado</Link>
            <button onClick={handleLogout} style={{
              background: "#fff",
              color: "#2563eb",
              border: "none",
              borderRadius: "5px",
              padding: "0.3em 0.7em",
              fontWeight: "bold",
              cursor: "pointer",
              marginLeft: 8
            }}>
              Cerrar sesión
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

// Componente de ruta protegida
function RutaProtegida({ children }) {
  const [user, setUser] = useState(undefined); // undefined: cargando, null: no logueado
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);
  if (user === undefined) return <div style={{textAlign:'center',marginTop:40}}>Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <Router>
      <Navbar />
      <div className="main-content">
        <Routes>
          <Route path="/" element={
            <div style={{textAlign: 'center', maxWidth: 600, margin: '0 auto'}}>
              <h1 style={{color:'#2563eb', fontWeight:'bold'}}>¡Bienvenido a Cromos 2025!</h1>
              <p style={{fontSize:'1.2em', color:'#333', marginTop:24}}>
                Descubre el mundo de los cromos digitales con propósito educativo.<br/>
                Colecciona, aprende y comparte mientras completas álbumes temáticos de historia, ciencia, arte y mucho más.<br/>
                ¡Cada cromo es una oportunidad para aprender algo nuevo y divertido!
              </p>
              <p style={{marginTop:32, color:'#2563eb', fontWeight:'bold'}}>Regístrate o inicia sesión para empezar tu colección y desbloquear sorpresas diarias.</p>
            </div>
          } />
          <Route path="/mis-colecciones" element={<RutaProtegida><MisColecciones /></RutaProtegida>} />
          <Route path="/colecciones" element={<RutaProtegida><Colecciones /></RutaProtegida>} />
          <Route path="/colecciones/:id" element={<RutaProtegida><ColeccionDetalle /></RutaProtegida>} />
          <Route path="/repetidos" element={<RutaProtegida><Repetidos /></RutaProtegida>} />
          <Route path="/sobres" element={<RutaProtegida><Sobres /></RutaProtegida>} />
          <Route path="/amigos" element={<RutaProtegida><Amigos /></RutaProtegida>} />
          <Route path="/perfil" element={<RutaProtegida><Perfil /></RutaProtegida>} />
          <Route path="/mercado" element={<RutaProtegida><Mercado /></RutaProtegida>} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 