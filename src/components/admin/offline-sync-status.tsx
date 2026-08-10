"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloudUpload, Database, Loader2 } from "lucide-react";

import { useFirestore, useUser } from "@/firebase";
import {
  countOfflineEntries,
  OFFLINE_QUEUE_EVENT,
  syncOfflineEntries,
} from "@/lib/offline-sync";

export function OfflineSyncStatus() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [online, setOnline] = useState(true);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    if (!user) {
      setPending(0);
      return;
    }
    try {
      setPending(await countOfflineEntries(user.uid));
    } catch {
      setMessage("No se pudo consultar el respaldo local.");
    }
  }, [user]);

  const synchronize = useCallback(async () => {
    if (
      !user ||
      syncingRef.current ||
      (typeof navigator !== "undefined" && !navigator.onLine)
    )
      return;
    try {
      syncingRef.current = true;
      setSyncing(true);
      setMessage("");
      const result = await syncOfflineEntries(
        firestore,
        user.uid,
        () => user.getIdToken(),
      );
      setPending(result.pending);
      if (result.synced > 0 || result.rejected > 0)
        setMessage(
          [
            result.synced > 0
              ? `${result.synced} registro${result.synced === 1 ? "" : "s"} sincronizado${result.synced === 1 ? "" : "s"}`
              : "",
            result.rejected > 0
              ? `${result.rejected} rechazado${result.rejected === 1 ? "" : "s"} por el servidor`
              : "",
          ]
            .filter(Boolean)
            .join(" · ") + ".",
        );
      else if (result.failed > 0)
        setMessage(
          "El servidor sigue sin estar disponible; el respaldo se conserva.",
        );
    } catch {
      setMessage("El respaldo continúa guardado en este dispositivo.");
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      void refreshCount();
    }
  }, [firestore, refreshCount, user]);

  useEffect(() => {
    void refreshCount();
    const handleChange = () => void refreshCount();
    const handleOnline = () => {
      setOnline(true);
      void synchronize();
    };
    const handleOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener(OFFLINE_QUEUE_EVENT, handleChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshCount, synchronize]);

  useEffect(() => {
    if (!user || pending === 0) return;
    void synchronize();
    const timer = window.setInterval(() => {
      if (!document.hidden) void synchronize();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [pending, synchronize, user]);

  useEffect(() => {
    if (pending > 0 || !message) return;
    const timer = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [message, pending]);

  if (pending === 0 && !message) return null;

  return (
    <aside className="fixed bottom-4 right-4 z-[120] w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-amber-500/25 bg-[#15120c]/95 p-4 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-400">
          {syncing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Database className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-black uppercase tracking-wide">
            {pending > 0
              ? `${pending} registro${pending === 1 ? "" : "s"} pendiente${pending === 1 ? "" : "s"}`
              : "Sincronización terminada"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/65">
            {message ||
              "Los datos están seguros en este dispositivo y se borrarán localmente después de subirlos."}
          </p>
          {pending > 0 && (
            <button
              type="button"
              disabled={syncing || !online}
              onClick={() => void synchronize()}
              className="mt-3 inline-flex items-center rounded-lg bg-amber-500 px-3 py-2 text-xs font-black text-black disabled:opacity-50"
            >
              <CloudUpload className="mr-2 h-4 w-4" />
              {online ? "Sincronizar ahora" : "Esperando conexión"}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
