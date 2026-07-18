import React from 'react';
import { cn } from '@/lib/utils';

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
 * Símbolo oficial para interfaces DomiU.
 * Mantiene el lenguaje de marca: ubicación, movilidad, velocidad y última milla.
 */
export function DomiUMark({ className, title = 'DomiU Magdalena' }: DomiUMarkProps) {
  return (
    <svg
      viewBox="0 0 72 72"
      role="img"
      aria-label={title}
      className={cn('h-10 w-10 shrink-0', className)}
    >
      <title>{title}</title>
      <path
        d="M35.8 4.5C19.7 4.5 7 16.6 7 32.2c0 20.3 22.6 34 27.5 36.8a2.7 2.7 0 0 0 2.7 0C42.1 66.2 65 52.5 65 32.2 65 16.6 52 4.5 35.8 4.5Z"
        fill="#FFC400"
      />
      <path
        d="M35.8 11.2c12.5 0 22.2 9.1 22.2 21 0 12-11.3 22-22.2 29-10.7-7-21.8-17-21.8-29 0-11.9 9.5-21 21.8-21Z"
        fill="#1A1D21"
      />
      <path d="M7.5 25.3H23" stroke="#FFC400" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M3.8 32.2h15.8" stroke="#FFC400" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M8.8 39.1h12.7" stroke="#FFC400" strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="31.2" cy="42.3" r="6.2" fill="none" stroke="#FFFFFF" strokeWidth="3.2" />
      <circle cx="49.8" cy="42.3" r="6.2" fill="none" stroke="#FFFFFF" strokeWidth="3.2" />
      <path
        d="M31.2 42.3 37 31.8h8.2l4.6 10.5M36.8 32l-3.7-5.2h7.1l5 5.1M37 31.8l7.1 10.5H31.2M42.4 25.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Z"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M47.2 29.6h7" stroke="#FFC400" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function DomiULogo({
  className,
  markClassName,
  variant = 'auto',
  compact = false,
  showTagline = false,
}: DomiULogoProps) {
  const darkText = variant === 'light';
  const wordColor = darkText ? 'text-[#1A1D21]' : variant === 'dark' ? 'text-white' : 'text-foreground';
  const secondaryColor = darkText ? 'text-[#2C3138]' : variant === 'dark' ? 'text-white/80' : 'text-muted-foreground';

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
      <DomiUMark className={markClassName} />
      {!compact && (
        <span className="min-w-0 leading-none">
          <span className={cn('block whitespace-nowrap font-heading text-[1.05rem] font-extrabold italic tracking-[-0.04em]', wordColor)}>
            DOMI<span className="text-[#FFC400]">U</span>
          </span>
          <span className={cn('mt-1 flex items-center gap-1.5 whitespace-nowrap text-[0.48rem] font-bold tracking-[0.28em]', secondaryColor)}>
            <span className="h-px w-3 bg-[#FFC400]" />
            MAGDALENA
            <span className="h-px w-3 bg-[#FFC400]" />
          </span>
          {showTagline && (
            <span className={cn('mt-1.5 block whitespace-nowrap text-[0.48rem] font-medium tracking-wide', secondaryColor)}>
              <span className="mr-1 text-[#FFC400]">⚡</span>Pide fácil, recibe rápido
            </span>
          )}
        </span>
      )}
    </span>
  );
}
