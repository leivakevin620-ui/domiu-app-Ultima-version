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

async function handleProfile(userId: string, authUser: User): Promise<UserProfile | null> {
  console.log("handleProfile called for", userId);
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, nombre, rol")
    .eq("id", userId);

  console.log("profiles query:", data, error);

  if (data && data.length > 0) {
    const p = data[0];
    const profile = { id: p.id, email: p.email, nombre: p.nombre, rol: p.rol === "repartidor" ? "repartidor" : "admin" };
    console.log("existing profile found:", profile);
    return profile;
  }

  console.log("no profile found, creating one...");
  const meta = authUser.user_metadata || {};
  const rol = meta.rol || "admin";
  console.log("metadata:", meta, "rol:", rol);

  const { error: insertErr } = await supabase.from("profiles").insert({
    id: userId, email: authUser.email, nombre: meta.nombre || authUser.email, rol
  });
  console.log("profile insert error:", insertErr);

  if (rol === "repartidor") {
    await supabase.from("repartidores").insert({
      user_id: userId, nombre: meta.nombre || authUser.email, estado: "No disponible"
    });
  }

  const profile = { id: userId, email: authUser.email!, nombre: meta.nombre || authUser.email!, rol };
  console.log("created profile:", profile);
  return profile;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log("initAuth session:", session ? session.user.id : "no session");
      if (mounted && session) {
        setUser(session.user);
        const p = await handleProfile(session.user.id, session.user);
        if (mounted && p) {
          console.log("setting profile:", p);
          setProfile(p);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("onAuthStateChange:", event, session ? session.user.id : "no session");
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        return;
      }
      if (session) {
        setUser(session.user);
        const p = await handleProfile(session.user.id, session.user);
        if (mounted && p) {
          console.log("setting profile from event:", p);
          setProfile(p);
        }
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
    console.log("login result:", data ? data.user.id : "error", error);
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
    if (!validCode || accessCode !== validCode) { setLoading(false); throw new Error("Codigo de acceso invalido."); }
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
