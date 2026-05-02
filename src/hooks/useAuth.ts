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
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, nombre, rol")
      .eq("id", userId)
      .single();
    if (data && !error) {
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) await fetchProfile(data.user.id);
    return data.user;
  }, [fetchProfile]);

  const registerRepartidor = useCallback(async (
    email: string, password: string, nombre: string,
    telefono: string, documento: string, vehiculo: string, placa: string
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: {
          nombre,
          rol: "repartidor",
          telefono,
          documento,
          vehiculo,
          placa,
        },
      },
    });
    if (error) throw error;
    return data.user;
  }, []);

  const registerAdmin = useCallback(async (email: string, password: string, nombre: string) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { nombre, rol: "admin" },
      },
    });
    if (error) throw error;
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  return { user, profile, loading, login, registerAdmin, registerRepartidor, logout };
}
