import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DomiU Magdalena - Gestion de Domicilios",
  description: "App profesional para gestion de domicilios",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-950">{children}</body>
    </html>
  );
}
