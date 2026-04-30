import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DomiU Magdalena - Gestión de Domicilios",
  description: "App profesional para gestión de domicilios",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
