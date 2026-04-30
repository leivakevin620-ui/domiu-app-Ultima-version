"use client";

import DomiUApp from "./DomiUApp";
import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";

export default function AdminApp() {
  const { logout } = useAuth();

  return (
    <div className="relative">
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 border border-slate-700"
        >
          <LogOut size={16} /> Salir
        </button>
      </div>
      <DomiUApp />
    </div>
  );
}
