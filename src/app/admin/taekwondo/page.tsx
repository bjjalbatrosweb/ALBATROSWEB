'use client';

import { useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { ExternalLink, Monitor, Smartphone, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/firebase';
import { ScoreControl } from '@/components/taekwondo/score-control';

export default function TaekwondoPage() {
  const auth = useAuth();
  const [rojo, setRojo] = useState('Competidor rojo');
  const [azul, setAzul] = useState('Competidor azul');
  const [segundos, setSegundos] = useState(120);
  const [match, setMatch] = useState<{ id: string; token: string; qr: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      const tokenAuth = await auth.currentUser?.getIdToken(true);
      const sede = localStorage.getItem('userSede') || 'MMA';
      const response = await fetch('/api/taekwondo', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAuth}` }, body: JSON.stringify({ rojo, azul, segundos, sede }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje || 'No se pudo crear.');
      const remote = `${location.origin}/taekwondo/control/${data.combateId}?token=${data.token}`;
      setMatch({ id: data.combateId, token: data.token, qr: await QRCode.toDataURL(remote, { width: 360, margin: 1 }) });
    } finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
    <header><div className="flex items-center gap-2 text-primary"><Sparkles /><span className="text-xs font-black uppercase tracking-[.25em]">Dojang Live</span></div><h1 className="text-3xl font-black uppercase">Taekwondo · Marcador de torneo</h1><p className="text-muted-foreground">Opera el combate, proyecta el marcador y comparte controles de puntuación.</p></header>
    {!match ? <Card><CardHeader><CardTitle>Nuevo combate</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><Input value={rojo} onChange={(e) => setRojo(e.target.value)} placeholder="Nombre rojo"/><Input value={azul} onChange={(e) => setAzul(e.target.value)} placeholder="Nombre azul"/><Input type="number" min={30} max={600} value={segundos} onChange={(e) => setSegundos(Number(e.target.value))}/><Button disabled={busy} className="md:col-span-3" onClick={create}>{busy ? 'Creando…' : 'Crear combate'}</Button></CardContent></Card> : <>
      <div className="grid gap-4 md:grid-cols-[1fr_220px]"><Card><CardContent className="flex flex-wrap gap-3 p-4"><Button asChild><Link target="_blank" href={`/taekwondo/marcador/${match.id}`}><Monitor />Abrir pantalla TV<ExternalLink /></Link></Button><Button asChild variant="secondary"><Link target="_blank" href={`/taekwondo/control/${match.id}?token=${match.token}`}><Smartphone />Abrir control móvil</Link></Button></CardContent></Card><Card><CardContent className="p-3 text-center"><img className="mx-auto w-40 rounded-lg bg-white p-2" src={match.qr} alt="QR para control móvil"/><p className="mt-1 text-xs text-muted-foreground">QR privado para jueces</p></CardContent></Card></div>
      <ScoreControl id={match.id} token={match.token}/>
    </>}
  </main>;
}
