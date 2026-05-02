"use client";

import { useState, useEffect, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type UserProfile = {
  id: string;
  email: string;
  nombre: string;
  rol: "admin" | "repartidor";
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    let { data, error } = await supabase
      .from("profiles")
      .select("id, email, nombre, rol")
      .eq("id", userId)
      .single();

    if (error) {
      const { data: sessionData } = await supabase.auth.getSession();
      const u = sessionData.session?.user;
      if (u) {
        const meta = u.user_metadata || {};
        const rol = meta.rol || "admin";

        await supabase.from("profiles").insert({
          id: userId,
          email: u.email,
          nombre: meta.nombre || u.email,
          rol,
        });

        if (rol === "repartidor") {
          await supabase.from("repartidores").insert({
            user_id: userId,
            nombre: meta.nombre || u.email,
            telefono: meta.telefono || null,
            documento: meta.documento || null,
            vehiculo: meta.vehiculo || null,
            placa: meta.placa || null,
            estado: "No disponible",
          });
        }

        data = { id: userId, email: u.email, nombre: meta.nombre || u.email, rol };
      }
    }

    if (data) {
      setProfile({
        id: data.id,
        email: data.email,
        nombre: data.nombre,
        rol: data.rol === "repartidor" ? "repartidor" : "admin",
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (mounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      if (mounted) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        if (!session) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      await fetchProfile(data.user.id);
    }
    return data.user;
  }, [fetchProfile]);

  const registerRepartidor = useCallback(async (
    email: string, password: string, nombre: string,
    telefono: string, documento: string, vehiculo: string, placa: string
  ) => {
    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { nombre, rol: "repartidor", telefono, documento, vehiculo, placa },
      },
    });
    if (signUpError) throw signUpError;
    if (!data.user) throw new Error("No se pudo crear el usuario");
    return data.user;
  }, []);

  const registerAdmin = useCallback(async (email: string, password: string, nombre: string, accessCode: string) => {
    const validCode = process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE;
    if (!validCode || accessCode !== validCode) {
      throw new Error("Código de acceso inválido.");
    }
    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre, rol: "admin" } },
    });
    if (signUpError) throw signUpError;
    if (!data.user) throw new Error("No se pudo crear el usuario");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignore errors during signout
    }
    // Limpiar manualmente tokens de localStorage
    const keys = Object.keys(localStorage).filter(k => k.startsWith("sb-"));
    keys.forEach(k => localStorage.removeItem(k));
    setUser(null);
    setProfile(null);
    window.location.replace("/login");
  }, []);

  return { user, profile, loading, login, registerAdmin, registerRepartidor, logout };
}
