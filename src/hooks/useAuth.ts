"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { getSupabaseClient, resetSupabaseClient } from "@/lib/supabase";

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
  const profileCache = useRef<string | null>(null);

  const sb = getSupabaseClient();

  const fetchProfile = useCallback(async (userId: string) => {
    if (profileCache.current === userId) return;
    profileCache.current = userId;

    let { data, error } = await sb
      .from("profiles")
      .select("id, email, nombre, rol")
      .eq("id", userId)
      .single();

    if (error) {
      const { data: sd } = await sb.auth.getSession();
      const u = sd.session?.user;
      if (u) {
        const meta = u.user_metadata || {};
        const rol = meta.rol || "admin";
        try { await sb.from("profiles").insert({ id: userId, email: u.email, nombre: meta.nombre || u.email, rol }); } catch {}
        if (rol === "repartidor") {
          try { await sb.from("repartidores").insert({ user_id: userId, nombre: meta.nombre || u.email, telefono: meta.telefono || null, documento: meta.documento || null, vehiculo: meta.vehiculo || null, placa: meta.placa || null, estado: "No disponible" }); } catch {}
        }
        data = { id: userId, email: u.email, nombre: meta.nombre || u.email, rol };
      }
    }

    if (data) {
      setProfile({ id: data.id, email: data.email, nombre: data.nombre, rol: data.rol === "repartidor" ? "repartidor" : "admin" });
    }
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    const sb = getSupabaseClient();
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;

    const initAuth = async () => {
      timer = setTimeout(() => {
        if (mounted) { setUser(null); setProfile(null); setLoading(false); }
      }, 6000);

      try {
        const { data: { session } } = await sb.auth.getSession();
        clearTimeout(timer);
        if (mounted) {
          if (session) { setUser(session.user); fetchProfile(session.user.id); }
          else { setUser(null); setProfile(null); setLoading(false); }
        }
      } catch {
        clearTimeout(timer);
        if (mounted) { setUser(null); setProfile(null); setLoading(false); }
      }
    };

    initAuth();

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        setUser(null); setProfile(null); setLoading(false); profileCache.current = null;
        return;
      }
      if (session) { setUser(session.user); fetchProfile(session.user.id); }
      else { setUser(null); setProfile(null); setLoading(false); }
    });

    return () => { mounted = false; clearTimeout(timer); subscription.unsubscribe(); };
  }, [fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) await fetchProfile(data.user.id);
    return data.user;
  }, [fetchProfile]);

  const registerRepartidor = useCallback(async (
    email: string, password: string, nombre: string,
    telefono: string, documento: string, vehiculo: string, placa: string
  ) => {
    const { data, error } = await getSupabaseClient().auth.signUp({
      email, password,
      options: { data: { nombre, rol: "repartidor", telefono, documento, vehiculo, placa } },
    });
    if (error) throw error;
    if (!data.user) throw new Error("No se pudo crear el usuario");
    return data.user;
  }, []);

  const registerAdmin = useCallback(async (email: string, password: string, nombre: string, accessCode: string) => {
    const validCode = process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE;
    if (!validCode || accessCode !== validCode) throw new Error("Código de acceso inválido.");
    const { data, error } = await getSupabaseClient().auth.signUp({
      email, password,
      options: { data: { nombre, rol: "admin" } },
    });
    if (error) throw error;
    if (!data.user) throw new Error("No se pudo crear el usuario");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await getSupabaseClient().auth.signOut(); } catch {}
    Object.keys(localStorage).forEach(k => { if (k.startsWith("sb-")) localStorage.removeItem(k); });
    resetSupabaseClient();
    setUser(null); setProfile(null); setLoading(false); profileCache.current = null;
    window.location.href = "/login";
  }, []);

  return { user, profile, loading, login, registerAdmin, registerRepartidor, logout };
}
