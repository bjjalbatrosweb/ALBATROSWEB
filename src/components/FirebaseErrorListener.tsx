"use client";

import { useState, useEffect } from "react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It reports permission failures without taking down the complete application.
 */
export function FirebaseErrorListener() {
  // Use the specific error type for the state for type safety.
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    // The callback now expects a strongly-typed error, matching the event payload.
    const handleError = (error: FirestorePermissionError) => {
      // Set error in state to trigger a re-render.
      setError(error);
    };

    // The typed emitter will enforce that the callback for 'permission-error'
    // matches the expected payload type (FirestorePermissionError).
    errorEmitter.on("permission-error", handleError);

    // Unsubscribe on unmount to prevent memory leaks.
    return () => {
      errorEmitter.off("permission-error", handleError);
    };
  }, []);

  if (!error) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-3 bottom-3 z-[9999] mx-auto flex max-w-xl items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-[#17120a]/95 px-4 py-3 text-sm text-amber-50 shadow-2xl backdrop-blur"
    >
      <div>
        <p className="font-black">
          No se pudo acceder a una parte de los datos.
        </p>
        <p className="mt-0.5 text-xs text-amber-100/70">
          La sesión continúa activa. Revisa tus permisos o vuelve a intentarlo.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setError(null)}
        className="shrink-0 rounded-lg border border-amber-300/30 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10"
      >
        Cerrar
      </button>
    </div>
  );
}
