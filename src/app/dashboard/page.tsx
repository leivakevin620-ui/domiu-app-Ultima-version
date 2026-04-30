"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import DomiUApp from "@/components/DomiUApp";

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#02060d",
      }}>
        <p style={{ color: "#94a3b8" }}>Cargando...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div>
      <div style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 100,
      }}>
        <button
          onClick={logout}
          style={{
            padding: "10px 18px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "#f8fafc",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Cerrar sesión
        </button>
      </div>
      <DomiUApp />
    </div>
  );
}
