"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

function deviceId() {
  const key = "albatros-live-device-id";
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = window.crypto.randomUUID();
    window.localStorage.setItem(key, value);
  }
  return value;
}

export function useLiveControlPairing(input: {
  discipline: "taekwondo" | "jiujitsu";
  fightId: string;
}) {
  const search = useSearchParams();
  const attempted = useRef(false);
  const [controlToken, setControlToken] = useState("");
  const [status, setStatus] = useState("Preparando control…");

  useEffect(() => {
    if (attempted.current || !input.fightId) return;
    attempted.current = true;
    const storageKey = `${input.discipline}-paired-control-${input.fightId}`;
    const stored = window.localStorage.getItem(storageKey);
    const legacy = search.get("control") || "";
    const pairingToken = search.get("pair") || "";

    if (stored || legacy) {
      const token = stored || legacy;
      window.localStorage.setItem(storageKey, token);
      setControlToken(token);
      setStatus("Control vinculado");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (!pairingToken) {
      setStatus("Escanea el QR mostrado en la mesa para vincular este control.");
      return;
    }

    void fetch(
      `/api/${input.discipline}/${input.fightId}/controles/vincular`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairingToken, deviceId: deviceId() }),
      },
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || "No se pudo vincular.");
        window.localStorage.setItem(storageKey, data.controlToken);
        setControlToken(data.controlToken);
        setStatus(`${data.control?.nombre || "Control"} vinculado correctamente`);
        window.history.replaceState({}, "", window.location.pathname);
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "No se pudo vincular.");
      });
  }, [input.discipline, input.fightId, search]);

  return { controlToken, status };
}
