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
    <main className="min-h-screen bg-background p-2 text-foreground">
      <header className="mx-auto mb-2 flex max-w-4xl items-center gap-2 rounded-xl border p-3">
        <ShieldCheck className="text-emerald-500" />
        <div>
          <h1 className="font-black uppercase">Control arbitral</h1>
          <p className="text-xs text-muted-foreground">
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
