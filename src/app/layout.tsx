import type { Metadata } from 'next';
import { Inter, Montserrat, Geist_Mono } from 'next/font/google';
import './globals.css';
import { RootProviders } from '@/components/providers/RootProviders';
import { ErrorBoundary, PageError } from '@/components/error-boundary';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  display: 'swap',
  weight: ['600', '700', '800', '900'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: { default: 'DomiU Magdalena | Pide fácil, recibe rápido', template: '%s | DomiU Magdalena' },
  description:
    'DomiU Magdalena conecta clientes, negocios y repartidores en una experiencia de compra y entrega local rápida, visible y organizada.',
  keywords: [
    'delivery',
    'domicilios',
    'comida',
    'repartidores',
    'negocios',
    'Santa Marta',
    'Magdalena',
    'Colombia',
  ],
  authors: [{ name: 'DomiU Magdalena' }],
  creator: 'DomiU Magdalena',
  publisher: 'DomiU Magdalena',
  metadataBase: new URL('https://domiu-app-ultima-version.vercel.app'),
  applicationName: 'DomiU Magdalena',
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: 'DomiU Magdalena',
    title: 'DomiU Magdalena | Pide fácil, recibe rápido',
    description:
      'La plataforma local que conecta clientes, comercios y repartidores en Magdalena.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DomiU Magdalena | Pide fácil, recibe rápido',
    description:
      'La plataforma local que conecta clientes, comercios y repartidores en Magdalena.',
  },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.svg', apple: '/apple-icon.png' },
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'theme-color': '#1A1D21',
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
      className={`${inter.variable} ${montserrat.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <RootProviders>
          <ErrorBoundary fallback={<PageError />}>{children}</ErrorBoundary>
        </RootProviders>
      </body>
    </html>
  );
}
