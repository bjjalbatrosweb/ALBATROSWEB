"use client";

import { ShieldCheck } from "lucide-react";
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
