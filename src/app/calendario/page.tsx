import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Download, Expand } from 'lucide-react';
import { Logo } from '@/components/logo';

export const metadata: Metadata = {
  title: 'Calendario de entrenamiento | Albatros',
  description: 'Calendario mensual de clases de BJJ y MMA de Albatros.',
};

export default function CalendarioPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08090d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,0,0,0.16),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:42px_42px]" />

      <header className="relative z-10 border-b border-white/10 bg-black/45 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:h-20">
          <Link href="/" aria-label="Volver al inicio">
            <Logo className="origin-left scale-90 md:scale-100" />
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-white/65 transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver al inicio</span>
            <span className="sm:hidden">Inicio</span>
          </Link>
        </div>
      </header>

      <section className="relative z-10 container mx-auto px-4 py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-7 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-primary">
                <CalendarDays className="h-5 w-5" />
                <span className="text-xs font-black uppercase tracking-[0.28em]">Plan mensual</span>
              </div>
              <h1 className="font-black uppercase italic tracking-tighter text-4xl sm:text-5xl lg:text-7xl">
                Calendario <span className="text-primary">Albatros</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-white/60 sm:text-base">
                Programa de BJJ y MMA organizado por sesiones físicas, técnicas y prácticas.
                Revisa el material requerido antes de cada clase.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/calendario-agosto-2026.png"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-black uppercase tracking-wider transition-colors hover:border-primary/60 hover:bg-primary/10"
              >
                <Expand className="h-4 w-4 text-primary" /> Ver completa
              </a>
              <a
                href="/calendario-agosto-2026.png"
                download="Calendario-Albatros-Agosto-2026.png"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-black uppercase tracking-wider shadow-[0_0_28px_-8px_rgba(255,0,0,.75)] transition-transform hover:scale-[1.02]"
              >
                <Download className="h-4 w-4" /> Descargar
              </a>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/55 p-2 shadow-[0_28px_90px_-35px_rgba(0,0,0,.95)] sm:rounded-3xl sm:p-3">
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            <a href="/calendario-agosto-2026.png" target="_blank" rel="noopener noreferrer">
              <Image
                src="/calendario-agosto-2026.png"
                alt="Calendario Albatros de entrenamiento BJJ y MMA para agosto de 2026"
                width={2400}
                height={1800}
                priority
                className="h-auto w-full rounded-xl sm:rounded-2xl"
                sizes="(max-width: 1280px) 100vw, 1152px"
              />
            </a>
          </div>

          <p className="mt-5 text-center text-xs font-bold uppercase tracking-[0.18em] text-white/35">
            Toca la imagen para verla en tamaño completo
          </p>
        </div>
      </section>
    </main>
  );
}
