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
  const [loading, setLoading] = useState(false);

  async function fetchProfile(userId: string) {
    let { data, error } = await supabase
      .from("profiles")
      .select("id, email, nombre, rol")
      .eq("id", userId)
      .single();

    if (error) {
      const { data: sd } = await supabase.auth.getSession();
      const u = sd.session?.user;
      if (u) {
        const meta = u.user_metadata || {};
        const rol = meta.rol || "admin";
        try { await supabase.from("profiles").insert({ id: userId, email: u.email, nombre: meta.nombre || u.email, rol }); } catch {}
        if (rol === "repartidor") {
          try { await supabase.from("repartidores").insert({ user_id: userId, nombre: meta.nombre || u.email, estado: "No disponible" }); } catch {}
        }
        data = { id: userId, email: u.email, nombre: meta.nombre || u.email, rol };
      }
    }

    if (data) {
      setProfile({ id: data.id, email: data.email, nombre: data.nombre, rol: data.rol === "repartidor" ? "repartidor" : "admin" });
    }
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        if (session) {
          setUser(session.user);
          fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    }).catch(() => {
      if (mounted) { setUser(null); setProfile(null); }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); throw error; }
    if (data.user) await fetchProfile(data.user.id);
    return data.user;
  }, []);

  const registerRepartidor = useCallback(async (
    email: string, password: string, nombre: string,
    telefono: string, documento: string, vehiculo: string, placa: string
  ) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre, rol: "repartidor", telefono, documento, vehiculo, placa } },
    });
    if (error) { setLoading(false); throw error; }
    if (!data.user) { setLoading(false); throw new Error("No se pudo crear el usuario"); }
    return data.user;
  }, []);

  const registerAdmin = useCallback(async (email: string, password: string, nombre: string, accessCode: string) => {
    setLoading(true);
    const validCode = process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE;
    if (!validCode || accessCode !== validCode) { setLoading(false); throw new Error("Código de acceso inválido."); }
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre, rol: "admin" } },
    });
    if (error) { setLoading(false); throw error; }
    if (!data.user) { setLoading(false); throw new Error("No se pudo crear el usuario"); }
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await supabase.auth.signOut(); } catch {}
    const keys = Object.keys(localStorage).filter(k => k.startsWith("sb-"));
    keys.forEach(k => localStorage.removeItem(k));
    setUser(null);
    setProfile(null);
    window.location.href = "/login";
  }, []);

  return { user, profile, loading, login, registerAdmin, registerRepartidor, logout };
}
