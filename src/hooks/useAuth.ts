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

    const timeout = setTimeout(() => {
      if (!cancelled) {
        console.log("Auth init timeout - forcing initialized");
        setInitialized(true);
      }
    }, 5000);

    async function fetchProfile(userId: string, sessionUser: User) {
      const { data: pData, error: pError } = await supabase
        .from("profiles")
        .select("id, email, nombre, rol")
        .eq("id", userId)
        .maybeSingle();

      if (pError) console.error("Profile query error:", pError.message);

      if (!cancelled && pData) {
        setProfile({
          id: pData.id,
          email: pData.email || sessionUser.email || "",
          nombre: pData.nombre || sessionUser.email || "",
          rol: (pData.rol === "repartidor" ? "repartidor" : "admin") as "admin" | "repartidor",
        });
      }
    }

    async function init() {
      try {
        console.log("Auth init starting...");
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        console.log("getSession done:", sessionData?.session?.user?.email, sessionError?.message);
        if (sessionError) console.error("getSession error:", sessionError.message);
        if (cancelled) return;

        if (sessionData.session) {
          setUser(sessionData.session.user);
          console.log("Fetching profile for:", sessionData.session.user.id);
          await fetchProfile(sessionData.session.user.id, sessionData.session.user);
          console.log("Profile done");
        } else {
          console.log("No session found");
        }
      } catch (e) {
        console.error("init error:", e);
      } finally {
        if (!cancelled) {
          console.log("Setting initialized = true");
          setInitialized(true);
        }
        clearTimeout(timeout);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      console.log("onAuthStateChange:", event);

      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        if (!cancelled) setInitialized(true);
        return;
      }

      if (session) {
        setUser(session.user);
        await fetchProfile(session.user.id, session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
      if (!cancelled) setInitialized(true);
    });

    return () => { cancelled = true; subscription.unsubscribe(); clearTimeout(timeout); };
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
