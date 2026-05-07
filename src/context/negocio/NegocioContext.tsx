"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Negocio = {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  logo: string;
  banner: string;
  direccion: string;
  telefono: string;
  horario: string;
  rating: number;
  tiempo_estimado: string;
  domicilio_cost: number;
  abierto: boolean;
  usuario_id: string;
};

const NegocioContext = createContext<{
  negocio: Negocio | null;
  loading: boolean;
  refetch: () => void;
}>({ negocio: null, loading: true, refetch: () => {} });

export function NegocioProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchNegocio = async () => {
    if (!userId) return;
    const { data } = await getSupabaseClient()
      .from("negocios")
      .select("*")
      .eq("usuario_id", userId)
      .maybeSingle();
    if (data) setNegocio(data);
    setLoading(false);
  };

  useEffect(() => { fetchNegocio(); }, [userId]);

  return (
    <NegocioContext.Provider value={{ negocio, loading, refetch: fetchNegocio }}>
      {children}
    </NegocioContext.Provider>
  );
}

export function useNegocio() {
  return useContext(NegocioContext);
}
