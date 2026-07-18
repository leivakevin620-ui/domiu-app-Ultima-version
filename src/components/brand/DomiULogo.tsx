import React from 'react';
import { cn } from '@/lib/utils';
import { DOMIU_OFFICIAL_LOGO_DATA_URI } from '@/lib/brand-assets';

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
 * Recorte del símbolo tomado del archivo oficial entregado por el propietario.
 * No redibuja ni modifica la identidad: solo oculta la parte inferior del lockup.
 */
export function DomiUMark({ className, title = 'DomiU Magdalena' }: DomiUMarkProps) {
  return (
    <span
      role="img"
      aria-label={title}
      className={cn(
        'relative block h-10 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-white via-[#FFFBEA] to-[#FFF1A8] p-0.5 shadow-[0_0_22px_rgba(255,218,0,.42)] ring-1 ring-[#FFD900]/50',
        className,
      )}
    >
      <img
        src={DOMIU_OFFICIAL_LOGO_DATA_URI}
        alt={title}
        draggable={false}
        className="block h-auto w-full select-none"
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
  const darkText = variant === 'light';
  const wordColor = darkText ? 'text-[#111317]' : 'text-white';
  const secondaryColor = darkText ? 'text-[#424750]' : 'text-white/72';

  if (showTagline) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-3xl bg-gradient-to-br from-white via-[#FFFDF2] to-[#FFF0A6] p-3 shadow-[0_20px_55px_-25px_rgba(255,214,0,.85)] ring-1 ring-[#FFE13A]/60',
          className,
        )}
      >
        <img
          src={DOMIU_OFFICIAL_LOGO_DATA_URI}
          alt="DomiU Magdalena — Pide fácil, recibe rápido"
          draggable={false}
          className="h-auto w-32 select-none object-contain"
        />
      </span>
    );
  }

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
      <DomiUMark className={markClassName} />
      {!compact && (
        <span className="min-w-0 leading-none">
          <span className={cn('block whitespace-nowrap font-heading text-[1.03rem] font-black italic tracking-[-0.045em]', wordColor)}>
            DOMI<span className="bg-gradient-to-r from-[#FFF000] via-[#FFD400] to-[#FF9D00] bg-clip-text text-transparent">U</span>
          </span>
          <span className={cn('mt-1 flex items-center gap-1.5 whitespace-nowrap text-[0.46rem] font-extrabold tracking-[0.27em]', secondaryColor)}>
            <span className="h-px w-3 bg-gradient-to-r from-transparent to-[#FFD900]" />
            MAGDALENA
            <span className="h-px w-3 bg-gradient-to-r from-[#FFD900] to-transparent" />
          </span>
        </span>
      )}
    </span>
  );
}
