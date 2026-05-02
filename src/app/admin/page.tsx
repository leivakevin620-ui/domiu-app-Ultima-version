"use client";

import { useAuth } from "@/hooks/useAuth";
import AdminApp from "@/components/AdminApp";

export default function AdminPage() {
  const { profile, initialized, logout } = useAuth();

  if (!initialized) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
        <p style={{ color: "#94a3b8", fontSize: 18 }}>Cargando...</p>
      </div>
    );
  }

  if (!profile || profile.rol !== "admin") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0f172a", gap: 16 }}>
        <p style={{ color: "#fca5a5", fontSize: 16 }}>Acceso no autorizado</p>
        <p style={{ color: "#94a3b8", fontSize: 14 }}>Profile: {JSON.stringify(profile)}</p>
        <a href="/login" style={{ color: "#facc15", fontSize: 14 }}>Volver al login</a>
      </div>
    );
  }

  return <AdminApp />;
}
