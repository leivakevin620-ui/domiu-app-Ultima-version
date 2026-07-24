"use client";

import { useState, useEffect, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type UserProfile = {
  id: string;
  email: string;
  nombre: string;
  rol: "admin" | "repartidor" | "negocio" | "financiero" | "cliente";
};

function mapRole(value: unknown): UserProfile["rol"] {
  const role = String(value || "").toLowerCase();
  if (["admin", "super_admin", "admin_general", "admin_operativo", "admin_soporte"].includes(role)) return "admin";
  if (["financiero", "finance", "financial"].includes(role)) return "financiero";
  if (["repartidor", "courier", "driver"].includes(role)) return "repartidor";
  if (["negocio", "merchant", "business"].includes(role)) return "negocio";
  return "cliente";
}

function roleForActiveSchema(role: UserProfile["rol"]) {
  if (role === "repartidor") return "courier";
  if (role === "negocio") return "merchant";
  if (role === "admin" || role === "financiero") return "admin";
  return "customer";
}

function syncAuthCookie(session: Session | null) {
  if (typeof document === "undefined") return;
  if (!session?.access_token) {
    document.cookie = "domiu-access-token=; Path=/; Max-Age=0; SameSite=Lax; Secure";
    return;
  }
  const maxAge = Math.max(60, Math.floor((session.expires_at || 0) - Date.now() / 1000));
  document.cookie = `domiu-access-token=${encodeURIComponent(session.access_token)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
}

function displayName(profile: Record<string, any> | null, user: User) {
  if (profile?.nombre) return String(profile.nombre);
  const composed = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  if (composed) return composed;
  return String(user.user_metadata?.nombre || user.user_metadata?.name || user.email || "Usuario");
}

async function fetchProfile(userId: string, sessionUser: User): Promise<UserProfile> {
  const meta = sessionUser.user_metadata || {};
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) console.warn("No fue posible consultar el perfil:", error.message);
    const profile = (data || null) as Record<string, any> | null;
    const rol = mapRole(profile?.rol || profile?.role || meta.rol || meta.role);
    return {
      id: userId,
      email: String(profile?.email || sessionUser.email || ""),
      nombre: displayName(profile, sessionUser),
      rol,
    };
  } catch (error) {
    console.warn("Perfil temporal desde Auth:", error);
    return {
      id: userId,
      email: sessionUser.email || "",
      nombre: displayName(null, sessionUser),
      rol: mapRole(meta.rol || meta.role),
    };
  }
}

async function persistCompatibleProfile(user: User, role: UserProfile["rol"], nombre: string, telefono?: string) {
  const parts = nombre.trim().split(/\s+/);
  const payload: Record<string, unknown> = {
    id: user.id,
    email: user.email || "",
    nombre,
    rol: role,
    role: roleForActiveSchema(role),
    first_name: parts.shift() || nombre,
    last_name: parts.join(" "),
  };
  if (telefono) {
    payload.telefono = telefono;
    payload.phone = telefono;
  }
  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) console.warn("No fue posible completar el perfil compatible:", error.message);
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const applySession = async (session: Session | null) => {
      syncAuthCookie(session);
      if (cancelled) return;
      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setInitialized(true);
        return;
      }

      setUser(session.user);
      const nextProfile = await fetchProfile(session.user.id, session.user);
      if (!cancelled) {
        setProfile(nextProfile);
        setInitialized(true);
      }
    };

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) console.warn("Error leyendo sesión:", error.message);
        return applySession(data.session);
      })
      .catch(() => applySession(null));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
      syncAuthCookie(data.session);
      if (!data.user) return { user: null, profile: null };
      const nextProfile = await fetchProfile(data.user.id, data.user);
      setUser(data.user);
      setProfile(nextProfile);
      return { user: data.user, profile: nextProfile };
    } finally {
      setLoading(false);
    }
  }, []);

  const registerRepartidor = useCallback(async (
    email: string, password: string, nombre: string,
    telefono: string, documento: string, vehiculo: string, placa: string,
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { nombre, rol: "repartidor", role: "courier", telefono, documento, vehiculo, placa } },
      });
      if (error) throw error;
      if (!data.user) throw new Error("No se pudo crear el usuario");
      await persistCompatibleProfile(data.user, "repartidor", nombre, telefono);
      return data.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const registerAdmin = useCallback(async (email: string, password: string, nombre: string, accessCode: string) => {
    setLoading(true);
    try {
      const validCode = process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE;
      if (!validCode || accessCode !== validCode) throw new Error("Codigo de acceso invalido.");
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options: { data: { nombre, rol: "admin", role: "admin" } },
      });
      if (error) throw error;
      if (!data.user) throw new Error("No se pudo crear el usuario");
      await persistCompatibleProfile(data.user, "admin", nombre);
      return data.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const registerFinanciero = useCallback(async (email: string, password: string, nombre: string, accessCode: string) => {
    setLoading(true);
    try {
      const validCode = process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE;
      if (!validCode || accessCode !== validCode) throw new Error("Codigo de acceso invalido.");
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options: { data: { nombre, rol: "financiero", role: "admin" } },
      });
      if (error) throw error;
      if (!data.user) throw new Error("No se pudo crear el usuario");
      await persistCompatibleProfile(data.user, "financiero", nombre);
      return data.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const registerNegocio = useCallback(async (
    email: string, password: string, nombreNegocio: string, telefono: string, categoria: string,
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options: { data: { nombre: nombreNegocio, rol: "negocio", role: "merchant", telefono, categoria } },
      });
      if (error) throw error;
      if (!data.user) throw new Error("No se pudo crear el usuario");
      await persistCompatibleProfile(data.user, "negocio", nombreNegocio, telefono);
      return data.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await supabase.auth.signOut({ scope: "local" }); } catch {}
    syncAuthCookie(null);
    if (typeof localStorage !== "undefined") {
      Object.keys(localStorage).filter((key) => key.startsWith("sb-")).forEach((key) => localStorage.removeItem(key));
    }
    window.location.href = "/login";
  }, []);

  return { user, profile, loading, initialized, login, registerAdmin, registerRepartidor, registerNegocio, registerFinanciero, logout };
}
