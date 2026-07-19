'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DomiU] Global application error:', error);
  }, [error]);

  const reloadLatestVersion = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('__domiu_refresh', Date.now().toString(36));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  return (
    <html lang="es">
      <body style={{ margin: 0, background: '#F7F8FA', color: '#17191F', fontFamily: 'Arial, sans-serif' }}>
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: '24px',
          }}
        >
          <section
            style={{
              width: '100%',
              maxWidth: '480px',
              border: '1px solid #E1E4E8',
              borderRadius: '28px',
              background: '#FFFFFF',
              padding: '32px',
              boxSizing: 'border-box',
              boxShadow: '0 24px 70px -42px rgba(23,25,31,.45)',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: '54px',
                height: '54px',
                borderRadius: '18px',
                background: '#FFD400',
                fontSize: '28px',
                fontWeight: 900,
              }}
            >
              DU
            </div>
            <p style={{ margin: '22px 0 0', color: '#8A6D00', fontSize: '12px', fontWeight: 900, letterSpacing: '.14em' }}>
              DOMIU MAGDALENA
            </p>
            <h1 style={{ margin: '8px 0 0', fontSize: '28px', lineHeight: 1.1 }}>
              No pudimos completar la carga
            </h1>
            <p style={{ margin: '14px 0 0', color: '#68707D', fontSize: '15px', lineHeight: 1.6 }}>
              Puede haber quedado una versión anterior en el navegador. Actualiza para cargar la publicación más reciente sin perder tu cuenta ni tus datos.
            </p>
            <div style={{ display: 'grid', gap: '10px', marginTop: '24px' }}>
              <button
                type="button"
                onClick={reloadLatestVersion}
                style={{
                  minHeight: '48px',
                  border: 0,
                  borderRadius: '14px',
                  background: '#FFD400',
                  color: '#17191F',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                Cargar la versión más reciente
              </button>
              <button
                type="button"
                onClick={reset}
                style={{
                  minHeight: '46px',
                  border: '1px solid #DDE1E7',
                  borderRadius: '14px',
                  background: '#FFFFFF',
                  color: '#30353C',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Intentar nuevamente
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
