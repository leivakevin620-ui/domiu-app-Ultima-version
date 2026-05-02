"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import AdminApp from "@/components/AdminApp";

export default function AdminPage() {
  const { user, loading, profile, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (profile?.rol !== "admin") {
        logout();
        router.push("/login");
      }
    }
  }, [user, loading, profile, router, logout]);

  if (loading || !user || profile?.rol !== "admin") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#02060d" }}>
        <p style={{ color: "#94a3b8" }}>Cargando...</p>
      </div>
    );
  }

  return <AdminApp />;
}
