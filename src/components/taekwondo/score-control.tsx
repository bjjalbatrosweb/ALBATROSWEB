'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';

type Fight = { rojo: string; azul: string; puntosRojo: number; puntosAzul: number; round: number; restanteMs: number; corriendo: boolean; terminado: boolean };

export function ScoreControl({ id, token }: { id: string; token: string }) {
  const [fight, setFight] = useState<Fight | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(`/api/taekwondo/${id}`, { cache: 'no-store' });
    const data = await response.json();
    if (response.ok) setFight(data.combate);
  }, [id]);
  useEffect(() => { void load(); const timer = setInterval(load, 800); return () => clearInterval(timer); }, [load]);

  const act = async (accion: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/taekwondo/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, accion, ...extra }) });
      const data = await response.json();
      if (response.ok) setFight(data.combate);
    } finally { setBusy(false); }
  };
  if (!fight) return <div className="p-8 text-center text-muted-foreground">Cargando combate…</div>;

  const side = (lado: 'rojo' | 'azul', name: string, score: number, color: string) => (
    <section className={`rounded-3xl border p-4 ${color}`}>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-black uppercase">{name}</h2><strong className="text-5xl tabular-nums">{score}</strong></div>
      <div className="grid grid-cols-2 gap-2">
        {[['Puño', 1], ['Patada cuerpo', 2], ['Patada cabeza', 3], ['Giro cuerpo', 4], ['Giro cabeza', 5], ['Corregir −1', -1]].map(([label, delta]) => (
          <Button key={String(label)} disabled={busy || fight.terminado} variant={Number(delta) < 0 ? 'outline' : 'secondary'} className="h-14 whitespace-normal font-bold" onClick={() => act('puntos', { lado, delta })}>{label}<span>{Number(delta) > 0 ? `+${delta}` : delta}</span></Button>
        ))}
      </div>
      <Button disabled={busy || fight.terminado} className="mt-2 w-full" variant="outline" onClick={() => act('puntos', { lado: lado === 'rojo' ? 'azul' : 'rojo', delta: 1 })}>Gam-jeom: +1 al rival</Button>
    </section>
  );

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border bg-card p-3">
      <span className="mr-2 font-black">ROUND {fight.round}</span>
      <Button disabled={busy || fight.terminado} onClick={() => act(fight.corriendo ? 'pausar' : 'iniciar')}>{fight.corriendo ? <Pause /> : <Play />}{fight.corriendo ? 'Pausar' : 'Iniciar'}</Button>
      <Button disabled={busy} variant="outline" onClick={() => act('siguiente_round')}><SkipForward />Siguiente round</Button>
      <Button disabled={busy} variant="outline" onClick={() => act('reiniciar')}><RotateCcw />Reiniciar</Button>
      <Button disabled={busy} variant="destructive" onClick={() => act('terminar')}><Square />Terminar</Button>
    </div>
    <div className="grid gap-4 md:grid-cols-2">{side('rojo', fight.rojo, fight.puntosRojo, 'border-red-500/40 bg-red-950/20')}{side('azul', fight.azul, fight.puntosAzul, 'border-blue-500/40 bg-blue-950/20')}</div>
  </div>;
}
