import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';
import { CalendarViewer } from '@/components/calendar/calendar-viewer';

export const metadata: Metadata = {
  title: 'Calendario de entrenamiento | Albatros',
  description: 'Calendario mensual de clases de BJJ y MMA de Albatros.',
};

export default function CalendarioPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08090d] pb-28 text-white md:pb-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,0,0,0.16),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:42px_42px]" />

      <section className="relative z-10 container mx-auto px-4 py-6 sm:py-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex justify-end"><Link href="/reservas" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10"><CalendarCheck className="h-4 w-4 text-primary"/>Ver clases reservables</Link></div>
          <CalendarViewer />
        </div>
      </section>
    </main>
  );
}
