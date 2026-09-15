"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  MapPin,
  RefreshCw,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUser } from "@/firebase";
import { apiErrorMessage, apiRequest } from "@/lib/api-client";
import { reservationCalendarFile } from "@/lib/calendar-export";
import {
  availablePlaces,
  canReserve,
  type ReservationStatus,
} from "@/lib/class-reservations";

type Reservation = {
  id: string;
  nombre: string;
  disciplina: string;
  profesor: string;
  sede: string;
  inicio: string;
  cupo: number;
  reservados: number;
  estado: ReservationStatus;
  reservada: boolean;
};

type ReservationsResponse = {
  ok?: boolean;
  mensaje?: string;
  sede?: string;
  items?: Reservation[];
  asistencia?: { ultFecha: string | null; ultimos30Dias: number };
};

type Filter = "todas" | "reservadas" | "disponibles";

export default function AthleteReservationsPage() {
  const { user, isUserLoading } = useUser();
  const [site, setSite] = useState("");
  const [items, setItems] = useState<Reservation[]>([]);
  const [attendance, setAttendance] = useState<ReservationsResponse["asistencia"]>();
  const [filter, setFilter] = useState<Filter>("todas");
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (showLoader = true) => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (showLoader) setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const { response, data } = await apiRequest<ReservationsResponse>("/api/reservas", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok || !data.ok || !Array.isArray(data.items)) {
        throw new Error(apiErrorMessage(response.status, data.mensaje, "No se pudo cargar tu agenda."));
      }
      setSite(data.sede || "");
      setItems(data.items);
      setAttendance(data.asistencia);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar tu agenda.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(
    () => items.filter((item) =>
      filter === "reservadas" ? item.reservada :
      filter === "disponibles" ? !item.reservada : true,
    ),
    [filter, items],
  );
  const reservedCount = items.filter((item) => item.reservada).length;
  const nextReserved = items.find((item) => item.reservada);

  async function toggle(item: Reservation) {
    if (!user || working) return;
    if (item.reservada && !window.confirm(`¿Cancelar tu lugar en “${item.nombre}”?`)) return;
    setWorking(item.id);
    setMessage("");
    setError("");
    try {
      const token = await user.getIdToken();
      const { response, data } = await apiRequest<{ ok?: boolean; mensaje?: string }>(
        item.reservada ? `/api/reservas?claseId=${encodeURIComponent(item.id)}` : "/api/reservas",
        {
          method: item.reservada ? "DELETE" : "POST",
          headers: { Authorization: `Bearer ${token}` },
          ...(item.reservada ? {} : { body: JSON.stringify({ claseId: item.id }) }),
        },
      );
      if (!response.ok || !data.ok) {
        throw new Error(apiErrorMessage(response.status, data.mensaje, "No se pudo procesar la reserva."));
      }
      setMessage(data.mensaje || "Tu agenda quedó actualizada.");
      await load(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo procesar la reserva.");
    } finally {
      setWorking("");
    }
  }

  function downloadCalendar(item: Reservation) {
    try {
      const file = reservationCalendarFile({
        id: item.id,
        name: item.nombre,
        discipline: item.disciplina,
        teacher: item.profesor,
        site: item.sede,
        startsAt: item.inicio,
      });
      const url = URL.createObjectURL(new Blob([file.content], { type: "text/calendar;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Archivo de calendario preparado.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo preparar el calendario.");
    }
  }

  if (isUserLoading || loading) {
    return <main className="grid min-h-[70vh] place-items-center bg-[#08090c] text-white" aria-busy="true"><Loader2 className="h-7 w-7 animate-spin" /><span className="sr-only">Cargando agenda</span></main>;
  }

  return (
    <main className="min-h-screen bg-[#08090c] px-4 py-6 pb-28 text-white md:py-8 md:pb-10">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1c22] to-[#111824] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-sky-300"><CalendarCheck className="h-4 w-4" /> Agenda del atleta · {site.replace(/_/g, " ") || "Mi sede"}</p><h1 className="mt-2 text-3xl font-black">Clases y reservaciones</h1><p className="mt-2 max-w-2xl text-sm text-white/70">Consulta la programación, aparta tu lugar y lleva el inicio a tu calendario personal.</p></div>
            <div className="flex gap-2"><Button variant="outline" asChild className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Link href="/calendario"><CalendarDays className="mr-2 h-4 w-4" />Plan mensual</Link></Button><Button variant="outline" onClick={() => void load()} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"><RefreshCw className="h-4 w-4" /><span className="sr-only">Actualizar agenda</span></Button></div>
          </div>
        </header>

        <section className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Resumen de agenda">
          <Summary icon={CheckCircle2} label="Próximas reservadas" value={String(reservedCount)} detail={nextReserved ? new Date(nextReserved.inicio).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "Ninguna todavía"} tone="text-emerald-300" />
          <Summary icon={History} label="Asistencias · 30 días" value={String(attendance?.ultimos30Dias || 0)} detail={attendance?.ultFecha ? `Última: ${new Date(attendance.ultFecha).toLocaleDateString("es-MX", { dateStyle: "medium" })}` : "Sin asistencia registrada"} tone="text-amber-300" />
          <Summary icon={Users} label="Clases disponibles" value={String(items.length)} detail="Programación publicada en tu sede" tone="text-sky-300" />
        </section>

        <div className="mt-5" aria-live="polite">{message && <p role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4 font-bold text-emerald-100">{message}</p>}{error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/25 bg-red-500/10 p-4 font-bold text-red-100"><span>{error}</span><Button size="sm" variant="outline" onClick={() => void load()}>Reintentar</Button></div>}</div>

        <nav className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar clases">
          {([['todas','Todas'],['reservadas','Mis reservas'],['disponibles','Disponibles']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)} className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-black transition ${filter===value?'border-sky-300 bg-sky-400 text-slate-950':'border-white/10 bg-white/[.04] text-slate-300 hover:bg-white/[.08]'}`}>{label}</button>)}
        </nav>

        <section className="mt-4 grid gap-4 md:grid-cols-2">
          {!user ? <p className="col-span-full rounded-2xl border border-white/15 p-8 text-center">Inicia sesión como atleta para consultar las clases.</p> : visible.length === 0 ? <p className="col-span-full rounded-2xl border border-dashed border-white/20 p-8 text-center text-white/70">No hay clases en este filtro.</p> : visible.map((item) => {
            const startsAt = new Date(item.inicio);
            const availability = canReserve({ status: item.estado, capacity: item.cupo, reserved: item.reservados, startsAt });
            return <article key={item.id} className={`rounded-3xl border p-5 ${item.reservada?'border-emerald-300/30 bg-emerald-400/[.06]':'border-white/10 bg-[#15171d]'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-sky-300">{item.disciplina}</p><h2 className="mt-1 text-xl font-black">{item.nombre}</h2></div>{item.reservada&&<span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[10px] font-black uppercase text-emerald-200">Reservada</span>}</div><p className="mt-3 flex items-start gap-2 text-sm text-white/75"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />{startsAt.toLocaleString("es-MX", { dateStyle: "full", timeStyle: "short" })}</p><div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-white/70"><span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{item.sede.replace(/_/g, " ")}</span><span className="flex items-center gap-1"><Users className="h-4 w-4" />{availablePlaces(item.cupo, item.reservados)} lugares</span>{item.profesor&&<span>{item.profesor}</span>}</div><div className={`mt-5 grid gap-2 ${item.reservada?'sm:grid-cols-2':''}`}><Button onClick={() => void toggle(item)} disabled={working === item.id || (!item.reservada && !availability.allowed)} variant={item.reservada ? "outline" : "default"} className="min-h-11 w-full font-black">{working===item.id&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{item.reservada?"Cancelar reserva":availability.allowed?"Reservar lugar":availability.reason}</Button>{item.reservada&&<Button type="button" variant="outline" className="min-h-11 border-sky-300/25 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20 hover:text-white" onClick={()=>downloadCalendar(item)}><CalendarPlus className="mr-2 h-4 w-4"/>Añadir al calendario</Button>}</div></article>;
          })}
        </section>
      </div>
    </main>
  );
}

function Summary({icon:Icon,label,value,detail,tone}:{icon:typeof Users;label:string;value:string;detail:string;tone:string}){return <article className="rounded-2xl border border-white/10 bg-[#13151b] p-4"><Icon className={`h-5 w-5 ${tone}`}/><b className="mt-3 block text-2xl text-white">{value}</b><span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</span><small className="mt-1 block truncate text-slate-400">{detail}</small></article>}
