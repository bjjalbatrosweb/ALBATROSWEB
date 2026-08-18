"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

import {
  forceChunkRecovery,
  isStaleChunkError,
  recoverFromStaleChunk,
} from "@/lib/chunk-recovery";

export function ChunkRecovery() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      const resource = event.target as HTMLScriptElement | null;
      const reason =
        event.error || event.message || event.filename || resource?.src || "";
      if (isStaleChunkError(reason)) void recoverFromStaleChunk(reason);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isStaleChunkError(event.reason))
        void recoverFromStaleChunk(event.reason);
    };
    const onRecoveryNeeded = () => setShowPrompt(true);

    window.addEventListener("error", onWindowError, true);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener(
      "albatros:chunk-recovery-needed",
      onRecoveryNeeded,
    );
    return () => {
      window.removeEventListener("error", onWindowError, true);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener(
        "albatros:chunk-recovery-needed",
        onRecoveryNeeded,
      );
    };
  }, []);

  if (!showPrompt) return null;

  return (
    <aside
      role="alert"
      className="fixed inset-x-4 bottom-4 z-[200] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-amber-300/25 bg-[#15130e]/95 p-4 text-white shadow-2xl backdrop-blur-xl"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300">
        <RefreshCw className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">Hay una versión nueva disponible</p>
        <p className="mt-0.5 text-xs text-white/60">
          Actualiza la interfaz para cargar los archivos correctos.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void forceChunkRecovery()}
        className="min-h-10 rounded-xl bg-amber-300 px-4 text-xs font-black text-black transition hover:bg-amber-200"
      >
        Actualizar
      </button>
      <button
        type="button"
        onClick={() => setShowPrompt(false)}
        aria-label="Cerrar aviso"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </aside>
  );
}

