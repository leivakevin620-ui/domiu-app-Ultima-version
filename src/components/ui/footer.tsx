import React from 'react';
import Link from 'next/link';
import { Mail, MapPin, Phone, Globe, ExternalLink, AtSign } from 'lucide-react';

const QUICK_LINKS = [
  { label: 'Restaurantes', href: '/cliente' },
  { label: 'Categorías', href: '/cliente/categories' },
  { label: 'Ofertas', href: '/cliente/search' },
  { label: 'Ciudades', href: '/cliente' },
];

const LEGAL_LINKS = [
  { label: 'Términos de servicio', href: '/terminos' },
  { label: 'Política de privacidad', href: '/privacidad' },
  { label: 'Política de cookies', href: '/privacidad' },
  { label: 'Trabaja con nosotros', href: '/register' },
];

const SOCIAL_LINKS = [
  { icon: AtSign, href: 'mailto:hola@domiu.app', label: 'Email' },
  { icon: Globe, href: 'https://domiu.app', label: 'Web' },
  { icon: ExternalLink, href: 'https://instagram.com/domiu.app', label: 'Instagram' },
];

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-card/50">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-md shadow-primary/20">
                D
              </div>
              <span className="text-lg font-bold text-foreground">DomiU</span>
            </Link>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
              La plataforma de delivery más rápida de Santa Marta. Conectamos restaurantes, clientes y repartidores en una experiencia seamless.
            </p>
            <div className="flex items-center gap-3">
              {SOCIAL_LINKS.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 hover:text-primary hover:shadow-sm"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground/80">
              Enlaces rápidos
            </h4>
            <ul className="space-y-3">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground/80">
              Legal
            </h4>
            <ul className="space-y-3">
              {LEGAL_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground/80">
              Contacto
            </h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 text-primary/70" />
                Santa Marta, Magdalena, Colombia
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0 text-primary/70" />
                <a href="mailto:hola@domiu.app" className="transition-colors hover:text-foreground">
                  hola@domiu.app
                </a>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0 text-primary/70" />
                <a href="tel:+573001234567" className="transition-colors hover:text-foreground">
                  +57 300 123 4567
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border/40 pt-7 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} DomiU. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
