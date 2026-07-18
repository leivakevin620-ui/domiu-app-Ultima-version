'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bike, ChevronRight, Clock3, MapPin, Search, ShieldCheck, Store } from 'lucide-react';
import { DomiUMark } from '@/components/brand/DomiULogo';

const fadeIn = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
};

const stagger = { animate: { transition: { staggerChildren: 0.08 } } };
const POPULAR_TAGS = ['Pizza', 'Hamburguesas', 'Pollo', 'Farmacia', 'Mercado'];

export function Hero() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    router.push(query ? `/cliente/search?q=${encodeURIComponent(query)}` : '/register');
  };

  return (
    <section className="relative overflow-hidden border-b border-[#E7E9ED] bg-white pt-24 sm:pt-28">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#FFF9DE] to-transparent" />
      <motion.div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-20" variants={stagger} initial="initial" animate="animate">
        <div className="flex flex-col justify-center">
          <motion.div variants={fadeIn} className="inline-flex w-fit items-center gap-2 rounded-full border border-[#E7C300] bg-[#FFF8CF] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#745C00]">
            <span className="h-2 w-2 rounded-full bg-[#E3B800]" /> Activos en Santa Marta
          </motion.div>

          <motion.h1 variants={fadeIn} className="mt-6 max-w-3xl text-5xl font-black leading-[.98] tracking-[-0.055em] text-[#17191F] sm:text-6xl lg:text-7xl">
            Pide lo que necesitas. <span className="text-[#C99D00]">Recíbelo con DomiU.</span>
          </motion.h1>

          <motion.p variants={fadeIn} className="mt-6 max-w-2xl text-base font-medium leading-relaxed text-[#606874] sm:text-lg">
            Restaurantes, supermercados, farmacias y comercios locales conectados con repartidores y seguimiento visible en una sola plataforma.
          </motion.p>

          <motion.form variants={fadeIn} onSubmit={handleSearch} className="mt-8 rounded-2xl border border-[#E2E5EA] bg-white p-2 shadow-[0_18px_50px_-28px_rgba(16,24,40,.42)]">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[#F4F6F8] px-4 text-sm font-black text-[#343840]">
                <MapPin className="h-5 w-5 text-[#C59B00]" /> Santa Marta
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7B828C]" />
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Busca un comercio, plato o producto…" className="h-12 w-full rounded-xl bg-[#F4F6F8] pl-12 pr-4 text-sm font-semibold text-[#25282E] outline-none placeholder:text-[#858C96] focus:bg-white focus:ring-2 focus:ring-[#FFD400]" />
              </div>
              <button type="submit" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#FFD400] px-6 text-sm font-black text-[#17191F] shadow-lg shadow-[#FFD400]/20 transition hover:brightness-105">
                <Search className="h-4 w-4" /> Buscar
              </button>
            </div>
          </motion.form>

          <motion.div variants={fadeIn} className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-bold text-[#7A818C]">Lo más buscado:</span>
            {POPULAR_TAGS.map((tag) => (
              <button key={tag} type="button" onClick={() => router.push(`/cliente/search?q=${encodeURIComponent(tag)}`)} className="rounded-full border border-[#DDE1E7] bg-white px-3.5 py-2 text-xs font-black text-[#454A52] transition hover:border-[#FFD400] hover:bg-[#FFF9D8]">
                {tag}
              </button>
            ))}
          </motion.div>

          <motion.div variants={fadeIn} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#17191F] px-7 text-sm font-black text-white transition hover:bg-[#2A2E35]">
              Crear cuenta gratis <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-xl border border-[#D8DCE3] bg-white px-7 text-sm font-black text-[#292D34] transition hover:border-[#FFD400]">
              Iniciar sesión
            </Link>
          </motion.div>
        </div>

        <motion.div variants={fadeIn} className="relative flex min-h-[520px] items-center justify-center rounded-[2.25rem] bg-gradient-to-br from-[#FFF7C4] via-[#FFD400] to-[#F3B800] p-6 shadow-[0_30px_90px_-45px_rgba(115,86,0,.65)] sm:p-10">
          <div className="absolute left-6 top-6 rounded-full bg-white/75 px-4 py-2 text-xs font-black uppercase tracking-[0.13em] text-[#685300] backdrop-blur">DomiU en vivo</div>
          <DomiUMark className="h-28 w-40 sm:h-32 sm:w-44" />

          <div className="absolute inset-x-5 bottom-5 grid grid-cols-3 gap-2 sm:inset-x-8 sm:bottom-8 sm:gap-3">
            {[
              { icon: Store, label: 'Comercios', value: 'Locales' },
              { icon: Bike, label: 'Reparto', value: 'Visible' },
              { icon: Clock3, label: 'Entrega', value: 'Organizada' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-2xl border border-white/45 bg-white/80 p-3 text-center shadow-sm backdrop-blur sm:p-4">
                <Icon className="mx-auto h-5 w-5 text-[#8D7000]" />
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#77705A]">{label}</p>
                <p className="mt-0.5 text-xs font-black text-[#22241F]">{value}</p>
              </div>
            ))}
          </div>

          <div className="absolute -right-3 top-24 hidden rounded-2xl border border-[#E3E6EB] bg-white p-4 shadow-xl lg:block">
            <ShieldCheck className="h-6 w-6 text-[#B18A00]" />
            <p className="mt-2 text-xs font-black text-[#202329]">Operación segura</p>
            <p className="mt-1 text-[11px] text-[#747B86]">Perfiles y pedidos organizados</p>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
