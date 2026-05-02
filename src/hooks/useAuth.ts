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
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (data.session) {
        setUser(data.session.user);
        const { data: pData } = await supabase
          .from("profiles")
          .select("id, email, nombre, rol")
          .eq("id", data.session.user.id)
          .maybeSingle();

        if (!cancelled && pData) {
          setProfile({
            id: pData.id,
            email: pData.email || data.session.user.email || "",
            nombre: pData.nombre || data.session.user.email || "",
            rol: (pData.rol === "repartidor" ? "repartidor" : "admin") as "admin" | "repartidor",
          });
        }
      }

      if (!cancelled) setInitialized(true);
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setInitialized(true);
        return;
      }

      if (session) {
        setUser(session.user);
        const { data: pData } = await supabase
          .from("profiles")
          .select("id, email, nombre, rol")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!cancelled && pData) {
          setProfile({
            id: pData.id,
            email: pData.email || session.user.email || "",
            nombre: pData.nombre || session.user.email || "",
            rol: (pData.rol === "repartidor" ? "repartidor" : "admin") as "admin" | "repartidor",
          });
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      if (!cancelled) setInitialized(true);
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); throw error; }
    if (data.user) {
      const { data: pData } = await supabase
        .from("profiles")
        .select("id, email, nombre, rol")
        .eq("id", data.user.id)
        .maybeSingle();

      setLoading(false);
      return {
        user: data.user,
        profile: pData ? {
          id: pData.id,
          email: pData.email || data.user.email || "",
          nombre: pData.nombre || data.user.email || "",
          rol: (pData.rol === "repartidor" ? "repartidor" : "admin") as "admin" | "repartidor",
        } : null,
      };
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
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setInitialized(false);
    window.location.href = "/login";
  }, []);

  return { user, profile, loading, initialized, login, registerAdmin, registerRepartidor, logout };
}
