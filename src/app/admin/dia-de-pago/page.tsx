"use client";

import { useMemo, useState } from "react";
import { CalendarCheck2, CalendarClock, Check, CircleDollarSign, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculatePaymentDay, parseLocalDate, toDateInputValue, type TrainingSchedule } from "@/lib/payment-day";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
const monthName = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });
const longDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" });
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export default function PaymentDayPage() {
  const todayValue = toDateInputValue(new Date());
  const [startDate, setStartDate] = useState(todayValue);
  const [disciplines, setDisciplines] = useState<1 | 2>(1);
  const [schedule, setSchedule] = useState<TrainingSchedule>("monday");
  const selectedDate = useMemo(() => parseLocalDate(startDate), [startDate]);
  const result = useMemo(() => calculatePaymentDay(selectedDate, disciplines, schedule), [disciplines, schedule, selectedDate]);
  const firstOffset = (new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay() + 6) % 7;
  const lastDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstOffset + lastDay }, (_, index) => index < firstOffset ? null : index - firstOffset + 1);
  const classDays = new Set(result.classDates.map((date) => date.getDate()));

  function selectDay(day: number) {
    setStartDate(toDateInputValue(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day, 12)));
  }

  return <main className="min-h-screen bg-[#08090c] px-4 py-6 text-white sm:px-6"><div className="mx-auto grid w-full max-w-7xl gap-6">
    <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1c22] via-[#111319] to-[#17130a] p-6"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-amber-300"><CalendarClock className="h-4 w-4" /> Caja · Calculadora</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Día de pago</h1><p className="mt-2 max-w-3xl text-sm text-white/70">Selecciona cuándo inicia la persona. Calculamos solamente las clases que le corresponden hasta finalizar ese mes; después su fecha regular de pago será el día 1.</p></header>

    <section className="grid min-w-0 gap-6 xl:grid-cols-[.9fr_1.1fr]">
      <article className="min-w-0 rounded-3xl border border-white/10 bg-[#15171d] p-5 sm:p-6"><h2 className="text-xl font-black">Datos de inscripción</h2><div className="mt-5 grid gap-5">
        <div><Label htmlFor="payment-start" className="text-white">Fecha de inicio</Label><Input id="payment-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value || todayValue)} className="mt-2 border-white/15 bg-black/30 text-white [color-scheme:dark]" /></div>
        <fieldset><legend className="text-sm font-bold">Plan</legend><div className="mt-2 grid grid-cols-2 gap-2"><Choice active={disciplines === 1} onClick={() => setDisciplines(1)} title="1 disciplina" detail="$600 al mes"/><Choice active={disciplines === 2} onClick={() => setDisciplines(2)} title="2 disciplinas" detail="$900 al mes"/></div></fieldset>
        <fieldset><legend className="text-sm font-bold">Horario de clases</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><Choice active={schedule === "monday"} onClick={() => setSchedule("monday")} title="Lunes · Miércoles · Viernes" detail="3 clases por semana"/><Choice active={schedule === "tuesday"} onClick={() => setSchedule("tuesday")} title="Martes · Jueves · Sábado" detail="3 clases por semana"/></div></fieldset>
        <Button type="button" variant="outline" onClick={() => setStartDate(todayValue)} className="text-white"><RefreshCw className="mr-2 h-4 w-4" /> Usar fecha de hoy</Button>
      </div></article>

      <article className="min-w-0 rounded-3xl border border-white/10 bg-[#15171d] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-sky-300">Calendario de inicio</p><h2 className="mt-1 text-xl font-black capitalize">{monthName.format(selectedDate)}</h2></div><p className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/70"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-300" />Día con clase</p></div><div className="mt-5 grid grid-cols-7 gap-1 text-center">{WEEKDAYS.map((day, index) => <div key={`${day}-${index}`} className="py-2 text-xs font-black text-white/60">{day}</div>)}{cells.map((day, index) => day === null ? <span key={`empty-${index}`} /> : <button key={day} type="button" onClick={() => selectDay(day)} aria-label={`Seleccionar día ${day}`} aria-pressed={selectedDate.getDate() === day} className={`relative grid aspect-square min-h-10 place-items-center rounded-xl border text-sm font-bold transition ${selectedDate.getDate() === day ? "border-amber-300 bg-amber-300 text-slate-950" : "border-white/10 bg-black/20 text-white hover:border-white/30"}`}>{day}{classDays.has(day) && <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${selectedDate.getDate() === day ? "bg-slate-950" : "bg-emerald-300"}`} />}</button>)}</div></article>
    </section>

    <section aria-live="polite" className="rounded-3xl border border-amber-300/25 bg-gradient-to-br from-amber-500/10 to-emerald-500/[.06] p-5 sm:p-7"><div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-amber-300"><CircleDollarSign className="h-5 w-5" /> Importe correspondiente</p><p className="mt-3 text-4xl font-black text-white sm:text-5xl">{money.format(result.amountDue)}</p><p className="mt-2 text-sm text-white/70">Alta el {longDate.format(selectedDate)} · mensualidad normal {money.format(result.monthlyPrice)}</p></div><div className="grid gap-2 sm:grid-cols-3 lg:min-w-[520px]"><Result label="Clases del mes" value={String(result.totalClasses)} /><Result label="Clases restantes" value={String(result.remainingClasses)} /><Result label="Próximo pago" value={longDate.format(result.nextPaymentDate)} /></div></div><div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-50"><Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"/><p>El cálculo es proporcional: {result.remainingClasses} de {result.totalClasses} clases programadas en el mes. No realiza cobros ni modifica al alumno; sirve para informar cuánto pagar al inscribirse.</p></div></section>
  </div></main>;
}

function Choice({ active, onClick, title, detail }: { active: boolean; onClick: () => void; title: string; detail: string }) { return <button type="button" onClick={onClick} aria-pressed={active} className={`min-h-20 rounded-2xl border p-4 text-left transition ${active ? "border-amber-300/60 bg-amber-500/15 text-white" : "border-white/10 bg-black/20 text-white hover:border-white/25"}`}><span className="flex items-center gap-2 font-black">{active && <CalendarCheck2 className="h-4 w-4 text-amber-300"/>}{title}</span><span className="mt-1 block text-xs text-white/65">{detail}</span></button>; }
function Result({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-white/60">{label}</p><p className="mt-2 font-black text-white">{value}</p></div>; }
