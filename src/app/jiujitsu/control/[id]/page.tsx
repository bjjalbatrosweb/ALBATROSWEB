"use client";

import { Loader2, QrCode, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";

import { JiujitsuScoreControl } from "@/components/jiujitsu/score-control";
import { useLiveControlPairing } from "@/hooks/use-live-control-pairing";

export default function ControlJiujitsuPage() {
  const { id } = useParams<{ id: string }>();
  const { controlToken, status } = useLiveControlPairing({
    discipline: "jiujitsu",
    fightId: id,
  });
  if (!controlToken) {
    return (
      <main className="grid min-h-screen place-items-center bg-black p-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-[#111318] p-8 text-center">
          {status === "Preparando control…" ? (
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-emerald-400" />
          ) : (
            <QrCode className="mx-auto h-12 w-12 text-emerald-400" />
          )}
          <p className="mt-4 font-black text-white">{status}</p>
          <p className="mt-2 text-sm text-white/55">Cada QR individual funciona una sola vez.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#07100d] to-black p-2 text-white">
      <header className="mx-auto mb-3 flex max-w-5xl items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3 shadow-xl">
        <ShieldCheck className="text-emerald-400" />
        <div>
          <h1 className="font-black uppercase">Control arbitral IBJJF</h1>
          <p className="text-xs text-white/60">
            Puntos, ventajas, penalizaciones y resultado del combate.
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-5xl">
        <JiujitsuScoreControl id={id} controlToken={controlToken} compacto />
      </div>
    </main>
  );
}
