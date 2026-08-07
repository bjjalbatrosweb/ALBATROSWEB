"use client";
import { useParams, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ScoreControl } from "@/components/taekwondo/score-control";
export default function ControlMovilPage() {
  const { id } = useParams<{ id: string }>();
  const controlToken = useSearchParams().get("control") || "";
  if (!controlToken)
    return (
      <main className="grid min-h-screen place-items-center bg-black text-white">
        Enlace de control incompleto o revocado.
      </main>
    );
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0b0c10] to-black p-2 text-white">
      <header className="mx-auto mb-3 flex max-w-4xl items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3 shadow-xl">
        <ShieldCheck className="text-emerald-500" />
        <div>
          <h1 className="font-black uppercase">Control arbitral</h1>
          <p className="text-xs text-white/60">
            Los puntos requieren consenso en menos de 2 segundos.
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-4xl">
        <ScoreControl id={id} controlToken={controlToken} compacto />
      </div>
    </main>
  );
}
