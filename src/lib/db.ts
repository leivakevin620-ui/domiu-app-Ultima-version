import { supabase } from "./supabase";

export type Pedido = {
  id: string;
  codigo: string;
  cliente: string;
  telefono: string;
  direccion: string;
  barrio: string;
  local_id: string | null;
  repartidor_id: string | null;
  km: number;
  envio: number;
  precio: number;
  pago_repartidor: number;
  empresa_recibe: number;
  estado: "Pendiente" | "Asignado" | "Recibido" | "Entregado";
  liquidado: boolean;
  tiempo_min: number;
  created_at: string;
};

export async function getPedidos() {
  const { data, error } = await supabase.from("pedidos").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPedido(pedido: Omit<Pedido, "id" | "created_at">) {
  const { data, error } = await supabase.from("pedidos").insert(pedido).select().single();
  if (error) throw error;
  return data;
}

export async function updatePedido(id: string, updates: Partial<Pedido>) {
  const { data, error } = await supabase.from("pedidos").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deletePedido(id: string) {
  const { error } = await supabase.from("pedidos").delete().eq("id", id);
  if (error) throw error;
}

export async function getRepartidores() {
  const { data, error } = await supabase.from("repartidores").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createRepartidor(nombre: string, telefono: string) {
  const { data, error } = await supabase.from("repartidores").insert({ nombre, telefono }).select().single();
  if (error) throw error;
  return data;
}

export async function updateRepartidor(id: string, updates: { nombre?: string; telefono?: string }) {
  const { data, error } = await supabase.from("repartidores").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRepartidor(id: string) {
  const { error } = await supabase.from("repartidores").delete().eq("id", id);
  if (error) throw error;
}

export async function getLocales() {
  const { data, error } = await supabase.from("locales").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createLocal(nombre: string, direccion: string, telefono: string) {
  const { data, error } = await supabase.from("locales").insert({ nombre, direccion, telefono }).select().single();
  if (error) throw error;
  return data;
}

export async function updateLocal(id: string, updates: { nombre?: string; direccion?: string; telefono?: string }) {
  const { data, error } = await supabase.from("locales").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteLocal(id: string) {
  const { error } = await supabase.from("locales").delete().eq("id", id);
  if (error) throw error;
}

export async function getConfig() {
  const { data, error } = await supabase.from("app_config").select("*").single();
  if (error) throw error;
  return data;
}

export async function updateConfig(updates: { tarifa_base?: number; costo_por_km?: number; porcentaje_repartidor?: number }) {
  const { data, error } = await supabase.from("app_config").update(updates).select().single();
  if (error) throw error;
  return data;
}
