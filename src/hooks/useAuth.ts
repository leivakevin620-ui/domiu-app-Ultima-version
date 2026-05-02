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

async function fetchProfile(userId: string, sessionUser: User): Promise<UserProfile> {
  try {
    // Primero verificar si existe en repartidores
    const { data: riderData } = await supabase
      .from("repartidores")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (riderData) {
      return {
        id: riderData.id,
        email: sessionUser.email || "",
        nombre: riderData.nombre || sessionUser.email || "",
        rol: "repartidor",
      };
    }

    // Segundo verificar profiles
    const { data: pData } = await supabase
      .from("profiles")
      .select("id, email, nombre, rol")
      .eq("id", userId)
      .maybeSingle();

    if (pData) {
      return {
        id: pData.id,
        email: pData.email || sessionUser.email || "",
        nombre: pData.nombre || sessionUser.email || "",
        rol: (pData.rol === "repartidor" ? "repartidor" : "admin") as "admin" | "repartidor",
      };
    }

    // Fallback: metadata
    const meta = sessionUser.user_metadata || {};
    return {
      id: userId,
      email: sessionUser.email || "",
      nombre: meta.nombre || sessionUser.email || "",
      rol: (meta.rol === "repartidor" ? "repartidor" : "admin") as "admin" | "repartidor",
    };
  } catch (e) {
    const meta = sessionUser.user_metadata || {};
    return {
      id: userId,
      email: sessionUser.email || "",
      nombre: meta.nombre || sessionUser.email || "",
      rol: (meta.rol === "repartidor" ? "repartidor" : "admin") as "admin" | "repartidor",
    };
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let processedEvent = false;

    async function processSession(session: any) {
      if (cancelled || processedEvent) return;
      processedEvent = true;
      if (session) {
        setUser(session.user);
        const p = await fetchProfile(session.user.id, session.user);
        if (!cancelled && p) setProfile(p);
      } else {
        setUser(null);
        setProfile(null);
      }
      if (!cancelled) setInitialized(true);
    }

    // Primero intentar obtener sesión inmediatamente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && !processedEvent) processSession(session);
    });

    // Suscribirse a cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      console.log("auth event:", event, "user:", session?.user?.email, "rol:", session?.user?.user_metadata?.rol);
      processSession(session);
    });

    // Timeout de seguridad
    const timeout = setTimeout(() => {
      if (!cancelled && !processedEvent) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!cancelled) processSession(session);
        }).catch(() => {
          if (!cancelled) {
            setUser(null);
            setProfile(null);
            setInitialized(true);
          }
        });
      }
    }, 1500);

    return () => { cancelled = true; subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); throw error; }
    if (data.user) {
      const p = await fetchProfile(data.user.id, data.user);
      setLoading(false);
      return { user: data.user, profile: p };
    }
    setLoading(false);
    return { user: data.user, profile: null };
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
    setLoading(false);
    return data.user;
  }, []);

  const registerAdmin = useCallback(async (email: string, password: string, nombre: string, accessCode: string) => {
    setLoading(true);
    const validCode = process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE;
    if (!validCode || accessCode !== validCode) { setLoading(false); throw new Error("Codigo de acceso invalido."); }
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre, rol: "admin" } },
    });
    if (error) { setLoading(false); throw error; }
    if (!data.user) { setLoading(false); throw new Error("No se pudo crear el usuario"); }
    setLoading(false);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await supabase.auth.signOut({ scope: 'global' }); } catch {}
    Object.keys(localStorage).filter(k => k.startsWith("sb-")).forEach(k => localStorage.removeItem(k));
    window.location.href = "/login";
  }, []);

  return { user, profile, loading, initialized, login, registerAdmin, registerRepartidor, logout };
}
