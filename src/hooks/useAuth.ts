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
    if (data) setProfile(data);
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
    return data.user;
  }, []);

  const registerAdmin = useCallback(async (email: string, password: string, nombre: string, accessCode: string) => {
    const code = process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE;
    if (code && accessCode && accessCode !== code) throw new Error("Codigo de acceso invalido");

    const { data, error: authError } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre, rol: "admin" } },
    });
    if (authError) throw authError;
    if (!data.user) throw new Error("No se pudo crear el usuario");

    await supabase.from("profiles").update({ rol: "admin", nombre }).eq("id", data.user.id);
    return data.user;
  }, []);

  const registerRepartidor = useCallback(async (
    email: string, password: string, nombre: string,
    telefono: string, documento: string, vehiculo: string, placa: string
  ) => {
    const { data, error: authError } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre, rol: "repartidor" } },
    });
    if (authError) throw authError;
    if (!data.user) throw new Error("No se pudo crear el usuario");

    await supabase.from("profiles").update({ rol: "repartidor", nombre }).eq("id", data.user.id);

    const { error: riderError } = await supabase.from("repartidores").insert({
      user_id: data.user.id,
      nombre,
      telefono: telefono || null,
      documento: documento || null,
      vehiculo: vehiculo || null,
      placa: placa || null,
      estado: "No disponible",
    });
    if (riderError) throw new Error("Error al registrar repartidor: " + riderError.message);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { user, profile, loading, login, registerAdmin, registerRepartidor, logout };
}
