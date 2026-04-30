import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default function Home() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#02060d", color: "#cbd5e1" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>
            Domi<span style={{ color: "#facc15" }}>U</span>
          </h1>
          <p style={{ color: "#94a3b8" }}>Configura las variables de entorno de Supabase</p>
          <pre style={{ marginTop: 16, padding: 16, background: "#0f172a", borderRadius: 12, textAlign: "left", fontSize: 12 }}>
            NEXT_PUBLIC_SUPABASE_URL=...{"\n"}
            NEXT_PUBLIC_SUPABASE_ANON_KEY=...
          </pre>
        </div>
      </div>
    );
  }

  redirect("/login");
}
