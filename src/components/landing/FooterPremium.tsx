'use client';

import Link from 'next/link';
import { DomiULogo } from '@/components/brand/DomiULogo';

const FOOTER_SECTIONS = [
  {
    title: 'Descubre',
    links: [
      { label: 'Restaurantes', href: '/cliente' },
      { label: 'Categorías', href: '/cliente/categories' },
      { label: 'Ofertas', href: '/cliente/search' },
      { label: 'Mis pedidos', href: '/cliente/pedidos' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Términos', href: '/terminos' },
      { label: 'Privacidad', href: '/privacidad' },
      { label: 'Cookies', href: '/privacidad' },
      { label: 'Trabaja con nosotros', href: '/register' },
    ],
  },
  {
    title: 'Contacto',
    links: [
      { label: 'Santa Marta, Magdalena', href: '#' },
      { label: 'domiumagdalena@gmail.com', href: 'mailto:domiumagdalena@gmail.com' },
      { label: '+57 311 374 8405', href: 'tel:+573113748405' },
    ],
  },
];

const SOCIAL = [
  { label: 'Instagram', href: 'https://instagram.com/domiumagdalena' },
  { label: 'Facebook', href: '#' },
  { label: 'TikTok', href: '#' },
];

export function FooterPremium() {
  return (
    <footer className="border-t border-primary/10 bg-[#1A1D21]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="mb-5 inline-flex" aria-label="DomiU Magdalena">
              <DomiULogo variant="dark" markClassName="h-12 w-12" showTagline />
            </Link>
            <p className="mb-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
              La infraestructura digital para organizar compras, comercios y entregas locales en Magdalena.
            </p>
            <div className="flex items-center gap-3">
              {SOCIAL.map((social) => (
                <Link
                  key={social.label}
                  href={social.href}
                  className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-border bg-[#24282E] px-3 text-xs font-bold text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                  aria-label={social.label}
                >
                  {social.label.charAt(0)}
                </Link>
              ))}
            </div>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-primary">{section.title}</h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 border-t border-primary/10 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} DomiU Magdalena. Pide fácil, recibe rápido.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/terminos" className="text-xs text-muted-foreground transition-colors hover:text-primary">Términos</Link>
              <Link href="/privacidad" className="text-xs text-muted-foreground transition-colors hover:text-primary">Privacidad</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
