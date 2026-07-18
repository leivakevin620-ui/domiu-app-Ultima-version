import React from 'react';
import { cn } from '@/lib/utils';
import { DOMIU_LOGO_ORIGINAL } from './domiu-logo-original';

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
 * Recurso de marca suministrado por DomiU. No se redibuja ni se altera.
 * El recorte del símbolo usa la misma imagen original para conservar su identidad.
 */
export function DomiUMark({ className, title = 'DomiU Magdalena' }: DomiUMarkProps) {
  return (
    <span
      role="img"
      aria-label={title}
      className={cn(
        'relative inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-black shadow-[0_0_22px_rgba(255,220,0,0.34)]',
        className,
      )}
    >
      <img
        src={DOMIU_LOGO_ORIGINAL}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute left-1/2 top-[-4%] h-[156%] w-[156%] max-w-none -translate-x-1/2 object-contain object-top"
      />
    </span>
  );
}

export function DomiULogo({
  className,
  markClassName,
  variant = 'auto',
  compact = false,
  showTagline = false,
}: DomiULogoProps) {
  void variant;
  void showTagline;

  if (compact) {
    return <DomiUMark className={cn(markClassName, className)} />;
  }

  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center rounded-xl bg-black/95 px-2 py-1 shadow-[0_0_0_1px_rgba(255,216,0,0.18),0_10px_32px_-14px_rgba(255,216,0,0.62)]',
        className,
      )}
    >
      <img
        src={DOMIU_LOGO_ORIGINAL}
        alt="DomiU Magdalena — Pide fácil, recibe rápido"
        draggable={false}
        className="h-auto w-[8.8rem] max-w-full select-none object-contain drop-shadow-[0_0_14px_rgba(255,216,0,0.28)] sm:w-[9.8rem]"
      />
    </span>
  );
}
