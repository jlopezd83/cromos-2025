import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Registro() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");

  const handleRegistro = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      setMensaje(error.message);
    } else {
      // Crear perfil en la tabla perfiles con nombre_usuario único
      const user = data.user;
      if (user) {
        let base = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
        let nombre_usuario = base;
        let sufijo = 1;
        let existe = true;
        while (existe) {
          const { data: existentes } = await supabase
            .from("perfiles")
            .select("id")
            .eq("nombre_usuario", nombre_usuario);
          if (!existentes || existentes.length === 0) {
            existe = false;
          } else {
            nombre_usuario = base + sufijo;
            sufijo++;
          }
        }
        await supabase.from("perfiles").insert({
          id: user.id,
          nombre_usuario
        });
      }
      setMensaje("¡Revisa tu correo para confirmar el registro!");
    }
  };

  return (
    <div>
      <h2>Registro</h2>
      <form onSubmit={handleRegistro}>
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        /><br />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        /><br />
        <button type="submit">Registrarse</button>
      </form>
      {mensaje && <p>{mensaje}</p>}
    </div>
  );
} 