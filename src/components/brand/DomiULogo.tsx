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
 * Isotipo oficial de DomiU. Usa su archivo independiente, transparente y completo.
 * Nunca recorta el logotipo principal ni agrega fondos, bordes o residuos visuales.
 */
export function DomiUMark({ className, title = 'DomiU Magdalena' }: DomiUMarkProps) {
  return (
    <span
      role="img"
      aria-label={title}
      className={cn('relative block h-10 w-14 shrink-0 overflow-visible', className)}
    >
      <img
        src={DOMIU_OFFICIAL_MARK_DATA_URI}
        alt={title}
        draggable={false}
        decoding="async"
        className="absolute inset-0 h-full w-full select-none object-contain"
      />
    </span>
  );
}

/**
 * Lockup oficial completo de DomiU Magdalena.
 *
 * El archivo entregado por la marca está guardado sobre un lienzo cuadrado que
 * contiene espacio transparente debajo del arte. El SVG conserva cada píxel
 * visible del logo y elimina únicamente ese espacio vacío del área de maquetación.
 * Así el encabezado nunca estira, aplasta ni corta el símbolo o la palabra DomiU.
 */
export function DomiULogo({
  className,
  markClassName,
  variant = 'auto',
  compact = false,
  showTagline = false,
}: DomiULogoProps) {
  if (compact) {
    return <DomiUMark className={cn('h-10 w-14', markClassName, className)} />;
  }

  return (
    <span
      role="img"
      aria-label="DomiU Magdalena — Pide fácil, recibe rápido"
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
      data-variant={variant}
    >
      <svg
        viewBox="0 0 128 82"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
        className={cn(
          'block max-h-full shrink-0 overflow-visible select-none',
          showTagline ? 'w-28 sm:w-32' : 'w-24 sm:w-28',
        )}
      >
        <image
          href={DOMIU_OFFICIAL_LOGO_DATA_URI}
          x="0"
          y="0"
          width="128"
          height="128"
          preserveAspectRatio="xMidYMin meet"
        />
      </svg>
    </span>
  );
}
