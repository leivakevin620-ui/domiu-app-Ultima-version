import type { Metadata, Viewport } from 'next';
import { Inter, Montserrat, Geist_Mono } from 'next/font/google';
import './globals.css';
import './brand-vivid.css';
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

const DEPLOYMENT_RECOVERY_SCRIPT = `
(function () {
  var STORAGE_KEY = 'domiu:deployment-asset-recovery:v1';
  var REFRESH_PARAM = '__domiu_refresh';
  var RECOVERY_WINDOW_MS = 300000;

  function asText(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value.message === 'string') return value.message;
    try { return String(value); } catch (_) { return ''; }
  }

  function isNextAsset(target) {
    if (!target || !target.tagName) return false;
    var tagName = String(target.tagName).toUpperCase();
    if (tagName !== 'SCRIPT' && tagName !== 'LINK') return false;
    var source = target.src || target.href || '';
    return source.indexOf('/_next/static/') !== -1;
  }

  function isRecoverableMessage(value) {
    var message = asText(value);
    return /ChunkLoadError|Loading chunk[^\\n]*failed|Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script|CSS_CHUNK_LOAD_FAILED|Failed to load CSS chunk|error loading dynamically imported module/i.test(message);
  }

  function recentlyRecovered() {
    try {
      var previous = Number(window.sessionStorage.getItem(STORAGE_KEY) || 0);
      return previous > 0 && Date.now() - previous < RECOVERY_WINDOW_MS;
    } catch (_) {
      return false;
    }
  }

  function markRecovery() {
    try { window.sessionStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (_) {}
  }

  function clearBrowserAssetCaches() {
    var jobs = [];
    try {
      if ('caches' in window) {
        jobs.push(window.caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (key) { return window.caches.delete(key); }));
        }));
      }
    } catch (_) {}

    try {
      if ('serviceWorker' in navigator) {
        jobs.push(navigator.serviceWorker.getRegistrations().then(function (registrations) {
          return Promise.all(registrations.map(function (registration) { return registration.unregister(); }));
        }));
      }
    } catch (_) {}

    return Promise.all(jobs).catch(function () {});
  }

  function recover() {
    if (recentlyRecovered()) return;
    markRecovery();

    clearBrowserAssetCaches().finally(function () {
      var nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set(REFRESH_PARAM, Date.now().toString(36));
      window.location.replace(nextUrl.toString());
    });
  }

  window.addEventListener('error', function (event) {
    if (isNextAsset(event.target) || isRecoverableMessage(event.error || event.message)) {
      recover();
    }
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    if (isRecoverableMessage(event.reason)) recover();
  });

  window.addEventListener('load', function () {
    try {
      var currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.has(REFRESH_PARAM)) {
        currentUrl.searchParams.delete(REFRESH_PARAM);
        window.history.replaceState(window.history.state, '', currentUrl.toString());
      }
      window.setTimeout(function () {
        try { window.sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
      }, 30000);
    } catch (_) {}
  }, { once: true });
})();
`;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#FFD900',
};

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
  icons: { icon: '/icon', apple: '/apple-icon' },
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'theme-color': '#FFD900',
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
      <head>
        <script
          id="domiu-deployment-recovery"
          dangerouslySetInnerHTML={{ __html: DEPLOYMENT_RECOVERY_SCRIPT }}
        />
      </head>
      <body className="flex min-h-full w-full min-w-0 flex-col overflow-x-clip">
        <RootProviders>
          <ErrorBoundary fallback={<PageError />}>{children}</ErrorBoundary>
        </RootProviders>
      </body>
    </html>
  );
}
