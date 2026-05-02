"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import AdminApp from "@/components/AdminApp";

export default function AdminPage() {
  const { user, loading, profile, logout } = useAuth();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        setRedirecting(true);
        router.push("/login");
      } else if (profile?.rol !== "admin") {
        logout();
        setRedirecting(true);
        router.push("/login");
      }
    }
  }, [user, loading, profile, router, logout]);

  if (loading || redirecting || !user || profile?.rol !== "admin") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#02060d" }}>
        <p style={{ color: "#94a3b8" }}>Cargando...</p>
      </div>
    );
  }

  return <AdminApp />;
}
