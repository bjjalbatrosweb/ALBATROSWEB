import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CalendarViewer } from '@/components/calendar/calendar-viewer';
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
          <CalendarViewer />
        </div>
      </section>
    </main>
  );
}
