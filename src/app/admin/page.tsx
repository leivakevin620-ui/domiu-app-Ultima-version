"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import AdminApp from "@/components/AdminApp";

export default function AdminPage() {
  const { user, profile, initialized, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;
    if (!user || profile?.rol !== "admin") {
      router.replace("/login");
    }
  }, [user, profile, initialized, router]);

  if (!initialized) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
        <p style={{ color: "#94a3b8", fontSize: 18 }}>Cargando...</p>
      </div>
    );
  }

  if (!user || profile?.rol !== "admin") {
    return null;
  }

  return <AdminApp />;
}
