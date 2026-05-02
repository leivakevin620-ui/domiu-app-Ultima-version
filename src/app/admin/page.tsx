"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import AdminApp from "@/components/AdminApp";

export default function AdminPage() {
  const { user, profile, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && profile?.rol === "admin") return;
    router.replace("/login");
  }, [user, profile, router]);

  if (!user || profile?.rol !== "admin") {
    return null;
  }

  return <AdminApp />;
}
