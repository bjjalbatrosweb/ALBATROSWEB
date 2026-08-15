"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Radio } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Mesa = {
  id: string;
  rojo: { nombre?: string };
  azul: { nombre?: string };
  protegida?: boolean;
  categoria?: string;
  modalidad?: string;
};

export default function UnirseJiujitsuPage() {
  const router = useRouter();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [nombre, setNombre] = useState("Árbitro");
  const [pins, setPins] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/jiujitsu/mesas", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje);
      setMesas(data.mesas || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "No se pudo cargar.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const join = async (mesa: Mesa) => {
    setBusy(mesa.id);
    setError("");
    try {
      const response = await fetch("/api/jiujitsu/mesas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: mesa.id,
          nombre,
          pin: pins[mesa.id] || "",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje);
      router.push(
        `/jiujitsu/control/${mesa.id}?control=${encodeURIComponent(
          data.controlToken,
        )}`,
      );
    } catch (joinError) {
      setError(
        joinError instanceof Error ? joinError.message : "No se pudo unir.",
      );
    } finally {
      setBusy("");
    }
  };

  return (
    <main className="min-h-screen bg-[#070b09] p-4 text-white">
      <div className="mx-auto max-w-3xl space-y-5">
        <header>
          <div className="flex items-center gap-2 text-emerald-400">
            <Radio />
            <span className="text-xs font-black uppercase tracking-[.25em]">
              Jiu-Jitsu Live
            </span>
          </div>
          <h1 className="text-3xl font-black uppercase">Mesas disponibles</h1>
        </header>
        <Input
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          placeholder="Nombre del árbitro o control"
          className="border-white/15 bg-white/[0.05]"
        />
        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-red-200">
            {error}
          </p>
        )}
        {mesas.length === 0 ? (
          <Card className="border-white/10 bg-white/[0.04] text-white">
            <CardContent className="p-8 text-center text-white/60">
              No hay combates abiertos.
            </CardContent>
          </Card>
        ) : (
          mesas.map((mesa) => (
            <Card key={mesa.id} className="border-white/10 bg-white/[0.04] text-white">
              <CardHeader>
                <CardTitle>
                  {mesa.rojo.nombre} vs. {mesa.azul.nombre}
                </CardTitle>
                <p className="text-xs text-white/70">
                  {mesa.modalidad} · {mesa.categoria}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 sm:flex-row">
                {mesa.protegida && (
                  <Input
                    type="password"
                    inputMode="numeric"
                    placeholder="PIN de mesa"
                    value={pins[mesa.id] || ""}
                    onChange={(event) =>
                      setPins((current) => ({
                        ...current,
                        [mesa.id]: event.target.value,
                      }))
                    }
                  />
                )}
                <Button
                  className="sm:ml-auto"
                  disabled={busy === mesa.id}
                  onClick={() => void join(mesa)}
                >
                  {busy === mesa.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <ExternalLink />
                  )}
                  Abrir control
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}
