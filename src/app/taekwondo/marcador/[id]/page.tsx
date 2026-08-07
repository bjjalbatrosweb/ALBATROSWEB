'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Fight = { rojo: string; azul: string; puntosRojo: number; puntosAzul: number; round: number; restanteMs: number; corriendo: boolean; terminado: boolean };

function clock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function MarcadorPage() {
  const { id } = useParams<{ id: string }>();
  const [fight, setFight] = useState<Fight | null>(null);
  const [shownMs, setShownMs] = useState(0);
  const load = useCallback(async () => {
    const response = await fetch(`/api/taekwondo/${id}`, { cache: 'no-store' });
    const data = await response.json();
    if (response.ok) { setFight(data.combate); setShownMs(data.combate.restanteMs); }
  }, [id]);
  useEffect(() => { void load(); const timer = setInterval(load, 700); return () => clearInterval(timer); }, [load]);
  useEffect(() => { if (!fight?.corriendo) return; const timer = setInterval(() => setShownMs((v) => Math.max(0, v - 100)), 100); return () => clearInterval(timer); }, [fight?.corriendo]);
  if (!fight) return <main className="grid min-h-screen place-items-center bg-black text-white">Cargando marcador…</main>;
  return <main className="grid min-h-screen grid-rows-[auto_1fr] overflow-hidden bg-[#050505] text-white">
    <header className="flex items-center justify-center gap-8 border-b border-white/10 bg-black/80 px-4 py-3"><span className="text-xl font-black uppercase tracking-[.25em]">Round {fight.round}</span><strong className={`font-mono text-6xl tabular-nums ${shownMs <= 10000 ? 'text-amber-400' : ''}`}>{clock(shownMs)}</strong>{fight.terminado && <span className="rounded-full bg-white px-4 py-1 font-black text-black">FINAL</span>}</header>
    <div className="grid grid-cols-2"><section className="grid place-items-center bg-gradient-to-br from-red-600 to-red-950 p-6 text-center"><div><h1 className="mb-4 max-w-[42vw] truncate text-4xl font-black uppercase md:text-6xl">{fight.rojo}</h1><div className="text-[28vw] font-black leading-none tabular-nums md:text-[24vw]">{fight.puntosRojo}</div></div></section><section className="grid place-items-center bg-gradient-to-br from-blue-600 to-blue-950 p-6 text-center"><div><h1 className="mb-4 max-w-[42vw] truncate text-4xl font-black uppercase md:text-6xl">{fight.azul}</h1><div className="text-[28vw] font-black leading-none tabular-nums md:text-[24vw]">{fight.puntosAzul}</div></div></section></div>
  </main>;
}
