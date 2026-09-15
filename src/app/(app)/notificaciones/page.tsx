"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarCheck,
  CheckCheck,
  CreditCard,
  Loader2,
  Megaphone,
  RefreshCw,
  Swords,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUser } from "@/firebase";
import { apiErrorMessage, apiRequest } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type NotificationCategory = "aviso" | "pago" | "reserva" | "reto" | "meta";
type NotificationItem = {
  id: string;
  categoria: NotificationCategory;
  prioridad: "normal" | "importante" | "urgente";
  titulo: string;
  detalle: string;
  href: string;
  fecha: string | null;
};
type Filter = "pendientes" | "todas" | "leidas";

const categoryStyle: Record<
  NotificationCategory,
  { label: string; icon: typeof BellRing; color: string }
> = {
  aviso: { label: "Academia", icon: Megaphone, color: "text-sky-300" },
  pago: { label: "Pago", icon: CreditCard, color: "text-amber-300" },
  reserva: { label: "Reserva", icon: CalendarCheck, color: "text-emerald-300" },
  reto: { label: "PvP", icon: Swords, color: "text-red-300" },
  meta: { label: "Meta", icon: Target, color: "text-violet-300" },
};

function storageKey(uid: string) {
  return `albatrosNotificacionesLeidas:${uid}`;
}

function readStoredIds(uid: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(uid)) || "[]");
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

function readableDate(value: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AthleteNotificationsPage() {
  const { user, isUserLoading } = useUser();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("pendientes");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");

  const load = useCallback(
    async (refresh = false) => {
      if (!user) return;
      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError("");
        const token = await user.getIdToken();
        const { response, data } = await apiRequest<{
          ok?: boolean;
          mensaje?: string;
          items?: NotificationItem[];
          generatedAt?: string;
        }>("/api/notificaciones", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok || !data.ok || !Array.isArray(data.items)) {
          throw new Error(
            apiErrorMessage(
              response.status,
              data.mensaje,
              "No se pudo cargar tu bandeja.",
            ),
          );
        }
        setItems(data.items);
        setGeneratedAt(data.generatedAt || "");
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "No se pudo cargar tu bandeja.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user) return;
    setReadIds(readStoredIds(user.uid));
    void load();
  }, [load, user]);

  const saveReadIds = (next: Set<string>) => {
    if (!user) return;
    setReadIds(next);
    localStorage.setItem(storageKey(user.uid), JSON.stringify([...next]));
  };

  const markRead = (id: string) => {
    if (readIds.has(id)) return;
    const next = new Set(readIds);
    next.add(id);
    saveReadIds(next);
  };

  const unread = items.filter((item) => !readIds.has(item.id));
  const visible = useMemo(
    () =>
      items.filter((item) =>
        filter === "todas"
          ? true
          : filter === "pendientes"
            ? !readIds.has(item.id)
            : readIds.has(item.id),
      ),
    [filter, items, readIds],
  );

  if (isUserLoading || (loading && !user)) {
    return (
      <main className="grid min-h-[70vh] place-items-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 pb-28 text-white md:px-8 md:pb-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_85%_10%,rgba(251,191,36,.16),transparent_35%),linear-gradient(135deg,#17191f,#0b101a)] p-6 md:p-8">
          <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-amber-300">
                <BellRing className="h-4 w-4" /> Centro personal
              </p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">Notificaciones</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                Avisos, mensualidad, reservas, retos y metas importantes en una sola bandeja.
              </p>
              {generatedAt && (
                <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Actualizado {readableDate(generatedAt)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-amber-300/15 bg-amber-300/10 px-5 py-3 text-center">
                <b className="block text-3xl text-amber-200">{unread.length}</b>
                <span className="text-[10px] font-black uppercase text-amber-300">Pendientes</span>
              </div>
              <Button type="button" variant="outline" disabled={refreshing} onClick={() => void load(true)} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
                Actualizar
              </Button>
            </div>
          </div>
        </header>

        <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-3 gap-2">
            {(["pendientes", "todas", "leidas"] as const).map((value) => (
              <button key={value} type="button" onClick={() => setFilter(value)} className={cn("rounded-xl px-4 py-2 text-xs font-black capitalize transition", filter === value ? "bg-amber-300 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white")}>
                {value}
              </button>
            ))}
          </div>
          <Button type="button" variant="ghost" disabled={unread.length === 0} onClick={() => saveReadIds(new Set([...readIds, ...items.map((item) => item.id)]))} className="text-slate-300 hover:bg-white/5 hover:text-white">
            <CheckCheck className="mr-2 h-4 w-4" /> Marcar todas como leídas
          </Button>
        </section>

        {error && (
          <div role="alert" className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid min-h-56 place-items-center rounded-3xl border border-white/10 bg-white/[.025]">
            <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[.02] px-6 py-16 text-center">
            <CheckCheck className="mx-auto h-10 w-10 text-emerald-300" />
            <h2 className="mt-4 text-xl font-black">Todo al día</h2>
            <p className="mt-2 text-sm text-slate-400">
              {filter === "leidas" ? "Todavía no has marcado notificaciones como leídas." : "No hay notificaciones pendientes en este momento."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {visible.map((item) => {
              const style = categoryStyle[item.categoria];
              const Icon = style.icon;
              const read = readIds.has(item.id);
              return (
                <article key={item.id} className={cn("rounded-2xl border p-4 transition sm:p-5", read ? "border-white/[.07] bg-white/[.025] opacity-70" : item.prioridad === "urgente" ? "border-red-400/30 bg-red-500/[.08]" : "border-white/10 bg-white/[.045]")}>
                  <div className="flex gap-4">
                    <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black/25", style.color)}><Icon className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-white/10 text-slate-300">{style.label}</Badge>
                        {item.prioridad !== "normal" && <Badge variant={item.prioridad === "urgente" ? "destructive" : "secondary"}>{item.prioridad}</Badge>}
                        {!read && <span className="h-2 w-2 rounded-full bg-amber-300" aria-label="No leída" />}
                      </div>
                      <h2 className="mt-3 text-lg font-black text-white">{item.titulo}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{item.detalle}</p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{readableDate(item.fecha)}</span>
                        <div className="flex gap-2">
                          {!read && <Button type="button" size="sm" variant="ghost" onClick={() => markRead(item.id)} className="text-slate-300 hover:bg-white/5 hover:text-white">Marcar leída</Button>}
                          <Button asChild size="sm" className="font-black">
                            <Link href={item.href} onClick={() => markRead(item.id)}>Abrir</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
