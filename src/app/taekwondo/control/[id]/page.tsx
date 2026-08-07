'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

import { ScoreControl } from '@/components/taekwondo/score-control';

export default function ControlMovilPage() {
  const params = useParams<{ id: string }>();
  const token = useSearchParams().get('token') || '';
  if (!token) return <main className="grid min-h-screen place-items-center bg-black text-white"><p>Enlace de control incompleto.</p></main>;
  return <main className="min-h-screen bg-background p-3 text-foreground"><header className="mx-auto mb-4 flex max-w-4xl items-center gap-2 py-2"><ShieldCheck className="text-emerald-500"/><div><h1 className="font-black uppercase">Control de juez</h1><p className="text-xs text-muted-foreground">Enlace privado · no lo compartas con el público</p></div></header><div className="mx-auto max-w-4xl"><ScoreControl id={params.id} token={token}/></div></main>;
}
