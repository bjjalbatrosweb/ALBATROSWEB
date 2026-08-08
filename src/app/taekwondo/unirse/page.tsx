"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LockKeyhole,
  Radio,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Athlete = { nombre: string; fotoUrl?: string };
type Table = {
  id: string;
  rojo: Athlete;
  azul: Athlete;
  puntosRojo: number;
  puntosAzul: number;
  round: number;
  rounds: number;
  fase: string;
  protegida: boolean;
};

export default function UnirseMesaPage() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [selected, setSelected] = useState<Table | null>(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (document.hidden) return;
    const response = await fetch("/api/taekwondo/mesas", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setTables(data.mesas || []);
  };
  useEffect(() => {
    void load();
    const refresh = () => {
      if (!document.hidden) void load();
    };
    const timer = window.setInterval(() => void load(), 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const join = async () => {
    if (!selected || !name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/taekwondo/mesas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, nombre: name, pin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje);
      router.push(
        `/taekwondo/control/${selected.id}?control=${encodeURIComponent(data.controlToken)}`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo unir.");
    } finally {
      setBusy(false);
    }
  };

  const photo = (athlete: Athlete, color: "red" | "blue") => (
    <div
      className={`h-12 w-12 overflow-hidden rounded-xl border ${color === "red" ? "border-red-400/30 bg-red-500/15" : "border-blue-400/30 bg-blue-500/15"}`}
    >
      {athlete.fotoUrl ? (
        <img
          src={athlete.fotoUrl}
          alt={athlete.nombre}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          style={{ color: "#fff" }}
          className="grid h-full place-items-center font-black"
        >
          {athlete.nombre.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );

  return (
    <main
      style={{ color: "#fff", background: "#07080b" }}
      className="min-h-screen p-4 sm:p-6"
    >
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-red-400">
              Dojang Live
            </p>
            <h1
              style={{ color: "#fff" }}
              className="text-2xl font-black sm:text-3xl"
            >
              Mesas abiertas
            </h1>
            <p className="text-sm text-white/55">
              Selecciona una mesa y convierte este dispositivo en control
              arbitral.
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            style={{ color: "#fff" }}
            className="border-white/15 bg-white/5"
            onClick={() => void load()}
          >
            <RefreshCw />
          </Button>
        </header>

        <div className="grid gap-3">
          {tables.map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => {
                setSelected(table);
                setError("");
              }}
              style={{ color: "#fff", WebkitTextFillColor: "#fff" }}
              className={`overflow-hidden rounded-3xl border text-left transition ${selected?.id === table.id ? "border-red-500 bg-red-500/10" : "border-white/10 bg-white/[0.04]"}`}
            >
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-3">
                <div className="flex min-w-0 items-center gap-2">
                  {photo(table.rojo, "red")}
                  <div className="min-w-0">
                    <b className="block truncate">{table.rojo.nombre}</b>
                    <strong className="text-2xl">{table.puntosRojo}</strong>
                  </div>
                </div>
                <div className="text-center text-[10px] font-black uppercase text-white/45">
                  <Radio className="mx-auto mb-1 h-4 w-4 text-emerald-400" />R{" "}
                  {table.round}/{table.rounds}
                </div>
                <div className="flex min-w-0 flex-row-reverse items-center gap-2 text-right">
                  {photo(table.azul, "blue")}
                  <div className="min-w-0">
                    <b className="block truncate">{table.azul.nombre}</b>
                    <strong className="text-2xl">{table.puntosAzul}</strong>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-[10px] uppercase tracking-wider text-white/50">
                <span>{table.fase}</span>
                <span>
                  {table.protegida ? (
                    <>
                      <LockKeyhole className="mr-1 inline h-3 w-3" />
                      Con PIN
                    </>
                  ) : (
                    "Acceso abierto"
                  )}
                </span>
              </div>
            </button>
          ))}
          {!tables.length && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-white/50">
              No hay mesas abiertas en este momento.
            </div>
          )}
        </div>

        {selected && (
          <section className="sticky bottom-3 rounded-3xl border border-white/10 bg-[#111319]/95 p-4 shadow-2xl backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="text-emerald-400" />
              <b style={{ color: "#fff" }}>Conectar como juez</b>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tu nombre o posición"
                className="h-12 border-white/15 bg-black/30 text-white placeholder:text-white/35"
              />
              {selected.protegida && (
                <Input
                  value={pin}
                  onChange={(event) =>
                    setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="PIN"
                  inputMode="numeric"
                  className="h-12 border-white/15 bg-black/30 text-center text-white placeholder:text-white/35"
                />
              )}
              <Button
                disabled={busy || !name.trim()}
                onClick={() => void join()}
                style={{ color: "#fff" }}
                className="h-12 bg-red-600 hover:bg-red-500"
              >
                <Users />
                {busy ? "Conectando…" : "Unirme"}
              </Button>
            </div>
            {error && (
              <p className="mt-2 text-sm font-bold text-red-400">{error}</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
