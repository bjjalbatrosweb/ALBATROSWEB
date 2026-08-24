"use client";

import { useEffect } from "react";

const sent = new Map<string, number>();

function safeMessage(value: unknown) {
  const raw = value instanceof Error ? value.message : String(value || "Error de interfaz");
  return raw
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[correo]")
    .replace(/\b(?:\+?52)?\s*\d(?:[\s()-]*\d){9,12}\b/g, "[teléfono]")
    .replace(/\b[A-Fa-f0-9]{24,}\b/g, "[identificador]")
    .slice(0, 300);
}

function report(message: string, digest = "") {
  const key = `${message}|${window.location.pathname}`;
  const previous = sent.get(key) || 0;
  if (Date.now() - previous < 60_000) return;
  sent.set(key, Date.now());
  const payload = JSON.stringify({ message, digest: digest.slice(0, 100), path: window.location.pathname });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/observabilidad", new Blob([payload], { type: "application/json" }));
  else void fetch("/api/observabilidad", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
}

export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => report(safeMessage(event.error || event.message));
    const onRejection = (event: PromiseRejectionEvent) => report(safeMessage(event.reason));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
