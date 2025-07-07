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
      .select('id, nombre_usuario, avatar_url, premium, premium_until')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          // Verificar si el premium ha expirado
          const now = new Date();
          const premiumUntil = data.premium_until ? new Date(data.premium_until) : null;
          
          console.log('Verificando premium:', {
            userId: user.id,
            premium: data.premium,
            premiumUntil: data.premium_until,
            now: now.toISOString(),
            isExpired: premiumUntil && now > premiumUntil
          });
          
          if (data.premium && premiumUntil && now > premiumUntil) {
            console.log('Premium expirado, actualizando...');
            // Premium expirado, actualizar en la base de datos
            supabase
              .from('perfiles')
              .update({ premium: false })
              .eq('id', user.id)
              .then(({ error }) => {
                if (error) {
                  console.error('Error actualizando premium:', error);
                } else {
                  console.log('Premium actualizado correctamente en BD');
                }
              });
            
            // Actualizar el estado local
            data.premium = false;
          }
        }
        setPerfil(data || null);
        setLoading(false);
      });
  }, [user]);

  // Verificación periódica para usuarios premium
  useEffect(() => {
    if (!perfil || !perfil.premium) return;

    const checkPremiumExpiration = () => {
      const now = new Date();
      const premiumUntil = perfil.premium_until ? new Date(perfil.premium_until) : null;
      
      if (premiumUntil && now > premiumUntil) {
        console.log('Premium expirado en verificación periódica');
        // Actualizar en BD y estado local
        supabase
          .from('perfiles')
          .update({ premium: false })
          .eq('id', user.id)
          .then(({ error }) => {
            if (!error) {
              setPerfil(prev => prev ? { ...prev, premium: false } : null);
            }
          });
      }
    };

    // Verificar cada 5 minutos
    const interval = setInterval(checkPremiumExpiration, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [perfil, user]);

  return (
    <UserContext.Provider value={{ user, perfil, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
} 