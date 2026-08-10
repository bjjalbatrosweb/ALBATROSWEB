"use client";

import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";

import { JiujitsuScoreControl } from "@/components/jiujitsu/score-control";

export default function ControlJiujitsuPage() {
  const { id } = useParams<{ id: string }>();
  const controlToken = useSearchParams().get("control") || "";
  if (!controlToken) {
    return (
      <main className="grid min-h-screen place-items-center bg-black text-white">
        Enlace de control incompleto o revocado.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#07100d] to-black p-2 text-white">
      <header className="mx-auto mb-3 flex max-w-5xl items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-white shadow-xl">
        <ShieldCheck className="shrink-0 text-emerald-400" />
        <div className="min-w-0 flex-1">
          <h1 className="font-black uppercase">Control arbitral IBJJF</h1>
          <p className="text-xs text-white/60">
            Puntos, ventajas, penalizaciones y resultado del combate.
          </p>
        </div>
        <Link
          href={`/jiujitsu/marcador/${id}`}
          target="_blank"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-[#090a0e] px-3 text-xs font-black text-white transition hover:bg-white/10"
        >
          <ExternalLink className="h-4 w-4" />
          <span className="hidden sm:inline">Ver marcador</span>
        </Link>
      </header>
      <div className="mx-auto max-w-5xl">
        <JiujitsuScoreControl id={id} controlToken={controlToken} compacto />
      </div>
    </main>
  );
}
