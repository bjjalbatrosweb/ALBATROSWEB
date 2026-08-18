"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isStaleChunkError, recoverFromStaleChunk } from "@/lib/chunk-recovery";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (isStaleChunkError(error)) void recoverFromStaleChunk(error);
    const payload = JSON.stringify({ message: error.message || "Error de interfaz", digest: error.digest || "", path: window.location.pathname });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/observabilidad", new Blob([payload], { type: "application/json" }));
    else void fetch("/api/observabilidad", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
  }, [error]);
  return <main className="grid min-h-[70vh] place-items-center bg-[#08090c] p-5 text-white"><section role="alert" className="w-full max-w-lg rounded-3xl border border-red-400/30 bg-[#171318] p-7 text-center shadow-2xl"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/15 text-red-300"><AlertTriangle className="h-7 w-7" /></span><h1 className="mt-5 text-2xl font-black">No pudimos mostrar este apartado</h1><p className="mt-2 text-sm leading-relaxed text-white/70">Tus datos no se borraron. Registramos el fallo técnico sin incluir información personal para poder diagnosticarlo.</p><Button type="button" onClick={reset} className="mt-6 min-h-11 font-black"><RefreshCw className="mr-2 h-4 w-4" /> Intentar nuevamente</Button></section></main>;
}
