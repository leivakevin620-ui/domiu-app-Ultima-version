import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Faltan variables de entorno de Supabase. Revisa .env.local");
}

let client = createClient(supabaseUrl, supabaseAnonKey);

export { client as supabase };

export function resetSupabaseClient() {
  client = createClient(supabaseUrl, supabaseAnonKey);
}

export function getSupabaseClient() {
  return client;
}
