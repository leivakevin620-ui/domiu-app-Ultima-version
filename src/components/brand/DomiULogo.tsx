import React from 'react';
import { cn } from '@/lib/utils';
import { DOMIU_OFFICIAL_LOGO_DATA_URI } from '@/lib/brand-assets';
import { DOMIU_OFFICIAL_MARK_DATA_URI } from '@/lib/brand-mark';

type LogoVariant = 'dark' | 'light' | 'auto';

type DomiUMarkProps = {
  className?: string;
  title?: string;
};

type DomiULogoProps = {
  className?: string;
  markClassName?: string;
  variant?: LogoVariant;
  compact?: boolean;
  showTagline?: boolean;
};

/**
 * Isotipo oficial de DomiU.
 *
 * El contenedor mantiene siempre la relación de aspecto y la imagen utiliza
 * object-contain. De esta forma el arte nunca se estira, aplasta ni recorta.
 */
export function DomiUMark({ className, title = 'DomiU Magdalena' }: DomiUMarkProps) {
  return (
    <span
      role="img"
      aria-label={title}
      className={cn('relative block aspect-[1.15/1] h-10 shrink-0 overflow-visible', className)}
    >
      <img
        src={DOMIU_OFFICIAL_MARK_DATA_URI}
        alt={title}
        draggable={false}
        decoding="async"
        className="absolute inset-0 h-full w-full select-none object-contain object-center"
      />
    </span>
  );
}

/**
 * Logotipo oficial completo de DomiU Magdalena.
 *
 * No se modifica el archivo entregado por la marca. El tamaño se controla
 * únicamente desde el contenedor y nunca se fuerza simultáneamente ancho y alto.
 */
export function DomiULogo({
  className,
  markClassName,
  variant = 'auto',
  compact = false,
  showTagline = false,
}: DomiULogoProps) {
  if (compact) {
    return <DomiUMark className={cn('h-10', markClassName, className)} />;
  }

  return (
    <span
      role="img"
      aria-label="DomiU Magdalena — Pide fácil, recibe rápido"
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-visible',
        showTagline ? 'h-20 w-20 sm:h-24 sm:w-24' : 'h-14 w-14 sm:h-16 sm:w-16',
        className,
      )}
      data-variant={variant}
    >
      <img
        src={DOMIU_OFFICIAL_LOGO_DATA_URI}
        alt="DomiU Magdalena — Pide fácil, recibe rápido"
        draggable={false}
        decoding="async"
        className="h-full w-full select-none object-contain object-center"
      />
    </span>
  );
}

/**
 * Lockup horizontal seguro para barras laterales y encabezados estrechos.
 * Usa el isotipo oficial y texto tipográfico, evitando encoger el lienzo cuadrado
 * del logotipo completo hasta volverlo ilegible.
 */
export function DomiUBrandLockup({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (compact) return <DomiUMark className={cn('h-10', className)} />;

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
      <DomiUMark className="h-11" />
      <span className="min-w-0 leading-none">
        <span className="block truncate font-heading text-lg font-black italic tracking-tight text-white">
          DOMI<span className="text-[#FFC400]">U</span>
        </span>
        <span className="mt-1 block truncate text-[9px] font-extrabold uppercase tracking-[0.28em] text-slate-300">
          Magdalena
        </span>
      </span>
    </span>
  );
}
