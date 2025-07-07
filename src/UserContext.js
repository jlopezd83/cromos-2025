import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null); // sesión de Supabase
  const [perfil, setPerfil] = useState(null); // datos de la tabla perfiles
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchar cambios de sesión
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

  useEffect(() => {
    if (!user) {
      setPerfil(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('perfiles')
      .select('id, nombre_usuario, avatar_url, premium')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setPerfil(data || null);
        setLoading(false);
      });
  }, [user]);

  return (
    <UserContext.Provider value={{ user, perfil, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
} 