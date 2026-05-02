"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type UserProfile = {
  id: string;
  email: string;
  nombre: string;
  rol: "admin" | "repartidor";
};

const profileCache = new Map<string, Promise<UserProfile | null>>();

async function getProfile(userId: string, authUser: User): Promise<UserProfile | null> {
  const cached = profileCache.get(userId);
  if (cached) return cached;

  const promise = (async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, nombre, rol")
      .eq("id", userId);

    if (data && data.length > 0) {
      const p = data[0];
      return { id: p.id, email: p.email, nombre: p.nombre, rol: p.rol === "repartidor" ? "repartidor" : "admin" };
    }

    const meta = authUser.user_metadata || {};
    const rol = meta.rol || "admin";
    await supabase.from("profiles").insert({
      id: userId, email: authUser.email, nombre: meta.nombre || authUser.email, rol
    });
    if (rol === "repartidor") {
      await supabase.from("repartidores").insert({
        user_id: userId, nombre: meta.nombre || authUser.email, estado: "No disponible"
      });
    }
    return { id: userId, email: authUser.email!, nombre: meta.nombre || authUser.email!, rol };
  })();

  profileCache.set(userId, promise);
  promise.finally(() => profileCache.delete(userId));
  return promise;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const isAuthenticating = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function processSession(sessionUser: User) {
      if (isAuthenticating.current) return;
      isAuthenticating.current = true;
      setUser(sessionUser);
      const p = await getProfile(sessionUser.id, sessionUser);
      if (mounted && p) setProfile(p);
      isAuthenticating.current = false;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session && !profile) {
        processSession(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        setUser(null);
        setProfile(null);
        isAuthenticating.current = false;
        return;
      }
      if (profile?.id === session.user.id) return;
      processSession(session.user);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [profile]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); throw error; }
    if (data.user) {
      const p = await getProfile(data.user.id, data.user);
      if (p) setProfile(p);
    }
    setLoading(false);
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
    try { await supabase.auth.signOut(); } catch {}
    Object.keys(localStorage).filter(k => k.startsWith("sb-")).forEach(k => localStorage.removeItem(k));
    setUser(null);
    setProfile(null);
    window.location.href = "/login";
  }, []);

  return { user, profile, loading, login, registerAdmin, registerRepartidor, logout };
}
