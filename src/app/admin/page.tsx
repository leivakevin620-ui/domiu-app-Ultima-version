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
    window.location.href = "/login";
    return null;
  }

  return <AdminApp />;
}
