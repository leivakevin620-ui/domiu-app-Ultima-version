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

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session) {
        setUser(session.user);
        getOrCreateProfile(session.user.id, session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        return;
      }
      if (session) {
        setUser(session.user);
        getOrCreateProfile(session.user.id, session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function getOrCreateProfile(userId: string, authUser: User) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, email, nombre, rol")
      .eq("id", userId)
      .single();

    if (existing) {
      setProfile({ id: existing.id, email: existing.email, nombre: existing.nombre, rol: existing.rol === "repartidor" ? "repartidor" : "admin" });
    } else {
      const meta = authUser.user_metadata || {};
      const rol = meta.rol || "admin";
      await supabase.from("profiles").insert({
        id: userId, email: authUser.email, nombre: meta.nombre || authUser.email, rol
      });
      if (rol === "repartidor") {
        await supabase.from("repartidores").insert({
          user_id: userId, nombre: meta.nombre || authUser.email, telefono: meta.telefono || null,
          documento: meta.documento || null, vehiculo: meta.vehiculo || null, placa: meta.placa || null, estado: "No disponible"
        });
      }
      setProfile({ id: userId, email: authUser.email!, nombre: meta.nombre || authUser.email!, rol });
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); throw error; }
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
    Object.keys(localStorage).filter(k => k.startsWith("sb-")).forEach(k => localStorage.removeItem(k));
    setUser(null);
    setProfile(null);
    window.location.href = "/login";
  }, []);

  return { user, profile, loading, login, registerAdmin, registerRepartidor, logout };
}
