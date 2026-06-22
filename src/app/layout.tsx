import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RootProviders } from "@/components/providers/RootProviders";
import { ErrorBoundary, PageError } from "@/components/error-boundary";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "DomiU | Delivery Inteligente", template: "%s | DomiU" },
  description:
    "La plataforma de delivery inteligente que conecta usuarios, negocios y repartidores.",
  keywords: [
    "delivery",
    "domicilios",
    "comida",
    "repartidores",
    "negocios",
    "Colombia",
  ],
  authors: [{ name: "DomiU" }],
  creator: "DomiU",
  publisher: "DomiU",
  metadataBase: new URL("https://domiu.app"),
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "DomiU",
    title: "DomiU | Delivery Inteligente",
    description:
      "La plataforma de delivery inteligente que conecta usuarios, negocios y repartidores.",
  },
  twitter: {
    card: "summary_large_image",
    title: "DomiU | Delivery Inteligente",
    description:
      "La plataforma de delivery inteligente que conecta usuarios, negocios y repartidores.",
  },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.ico", apple: "/apple-icon.png" },
  manifest: "/manifest.json",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "theme-color": "#6366f1",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <RootProviders>
          <ErrorBoundary fallback={<PageError />}>
            {children}
          </ErrorBoundary>
        </RootProviders>
      </body>
    </html>
  );
}
