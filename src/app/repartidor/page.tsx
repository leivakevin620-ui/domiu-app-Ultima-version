"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import RiderApp from "@/components/RiderApp";

export default function RepartidorPage() {
  const { user, loading, profile, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (profile?.rol !== 'repartidor') {
        router.push("/admin");
      }
    }
  }, [user, loading, profile, router]);

  if (loading || !user || profile?.rol !== 'repartidor') {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <p className="text-slate-400">Cargando...</p>
      </div>
    );
  }

  return <RiderApp />;
}
