"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  History,
  Loader2,
  MessageCircleMore,
  Phone,
  RefreshCw,
  Save,
  Search,
  Send,
  UserCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { useFirestore, useUser } from "@/firebase";
import {
  FOLLOW_UP_CHANNEL_LABELS,
  FOLLOW_UP_OUTCOME_LABELS,
  RETURN_STATUS_LABELS,
  buildReturnMessage,
  createReturnFollowUp,
  daysSince,
  latestAttendanceByAthlete,
  returnStatus,
  whatsappFollowUpUrl,
  type FollowUpChannel,
  type FollowUpOutcome,
  type ReturnFollowUp,
  type ReturnStatus,
} from "@/lib/return-follow-up";

type AthleteDocument = {
  nombre?: string;
  fotoUrl?: string;
  imagenUrl?: string;
  disciplina?: string;
  grado?: string;
  telefono?: string;
  activo?: boolean;
  seguimientoAusencias?: unknown;
};

type Athlete = {
  id: string;
  nombre: string;
  fotoUrl: string;
  disciplina: string;
  grado: string;
  telefono: string;
  ultimaAsistencia: Date | null;
  diasAusente: number | null;
  status: ReturnStatus;
  seguimientos: ReturnFollowUp[];
};

type AttendanceDocument = {
  alumnoId?: string;
  fecha?: Timestamp;
};

const HISTORY_DAYS = 180;
const MAX_FOLLOW_UPS = 20;

function isFollowUp(value: unknown): value is ReturnFollowUp {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.fecha === "string" && typeof record.canal === "string" && typeof record.resultado === "string";
}

function parseFollowUps(value: unknown) {
  return Array.isArray(value) ? value.filter(isFollowUp).sort((a, b) => b.fecha.localeCompare(a.fecha)) : [];
}

function statusClasses(status: ReturnStatus) {
  const styles: Record<ReturnStatus, string> = {
    activo: "border-emerald-300/25 bg-emerald-500/15 text-emerald-100",
    atencion: "border-sky-300/25 bg-sky-500/15 text-sky-100",
    reconectar: "border-amber-300/30 bg-amber-500/15 text-amber-100",
    ausente: "border-red-300/30 bg-red-500/15 text-red-100",
    "sin-registro": "border-violet-300/25 bg-violet-500/15 text-violet-100",
  };
  return styles[status];
}

function statusPriority(status: ReturnStatus) {
  return { ausente: 5, "sin-registro": 4, reconectar: 3, atencion: 2, activo: 1 }[status];
}

export default function ReturnFollowUpPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [site, setSite] = useState("MMA");
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | "todos">("reconectar");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<FollowUpChannel>("whatsapp");
  const [outcome, setOutcome] = useState<FollowUpOutcome>("contactado");
  const [note, setNote] = useState("");
  const [coach, setCoach] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setSite(localStorage.getItem("userSede") || "MMA");
  }, []);

  useEffect(() => {
    if (!coach && user?.email) setCoach(user.email);
  }, [coach, user?.email]);

  const loadData = useCallback(async () => {
    if (!firestore || !site) return;
    setLoading(true);
    setError("");
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - HISTORY_DAYS);
      cutoff.setHours(0, 0, 0, 0);
      const [athleteSnapshot, attendanceSnapshot] = await Promise.all([
        getDocs(query(collection(firestore, "Alumnos"), where("sede", "==", site))),
        getDocs(query(collection(firestore, "Asistencias"), where("sede", "==", site), where("fecha", ">=", Timestamp.fromDate(cutoff)), orderBy("fecha", "desc"), limit(5000))),
      ]);
      const latest = latestAttendanceByAthlete(attendanceSnapshot.docs.map((record) => {
        const data = record.data() as AttendanceDocument;
        return { alumnoId: String(data.alumnoId || ""), date: data.fecha?.toDate?.() || new Date(Number.NaN) };
      }));
      const loaded = athleteSnapshot.docs
        .filter((record) => (record.data() as AthleteDocument).activo !== false)
        .map((record) => {
          const data = record.data() as AthleteDocument;
          const lastAttendance = latest.get(record.id) || null;
          const absentDays = daysSince(lastAttendance);
          return {
            id: record.id,
            nombre: String(data.nombre || "Atleta"),
            fotoUrl: String(data.fotoUrl || data.imagenUrl || ""),
            disciplina: String(data.disciplina || ""),
            grado: String(data.grado || ""),
            telefono: String(data.telefono || ""),
            ultimaAsistencia: lastAttendance,
            diasAusente: absentDays,
            status: returnStatus(absentDays),
            seguimientos: parseFollowUps(data.seguimientoAusencias),
          } satisfies Athlete;
        })
        .sort((a, b) => statusPriority(b.status) - statusPriority(a.status) || (b.diasAusente || 0) - (a.diasAusente || 0) || a.nombre.localeCompare(b.nombre, "es"));
      setAthletes(loaded);
      setSelectedId((current) => current && loaded.some((athlete) => athlete.id === current) ? current : loaded[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo analizar la asistencia.");
    } finally {
      setLoading(false);
    }
  }, [firestore, site]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selected = athletes.find((athlete) => athlete.id === selectedId) || null;
  useEffect(() => {
    if (!selected) return;
    setMessage(buildReturnMessage(selected.nombre, selected.diasAusente));
    setNote("");
    setConfirming(false);
    setSuccess("");
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => ({
    active: athletes.filter((athlete) => athlete.status === "activo").length,
    attention: athletes.filter((athlete) => athlete.status === "atencion").length,
    reconnect: athletes.filter((athlete) => athlete.status === "reconectar").length,
    absent: athletes.filter((athlete) => athlete.status === "ausente" || athlete.status === "sin-registro").length,
  }), [athletes]);

  const visibleAthletes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return athletes.filter((athlete) => {
      const matchesStatus = statusFilter === "todos" || athlete.status === statusFilter;
      return matchesStatus && (!term || `${athlete.nombre} ${athlete.telefono} ${athlete.disciplina}`.toLocaleLowerCase("es").includes(term));
    });
  }, [athletes, search, statusFilter]);

  const whatsappUrl = selected ? whatsappFollowUpUrl(selected.telefono, message) : "";

  const saveFollowUp = async () => {
    if (!firestore || !selected || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const followUp = createReturnFollowUp({ channel, outcome, note, coach });
      const history = [...selected.seguimientos, followUp]
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .slice(-MAX_FOLLOW_UPS);
      await updateDoc(doc(firestore, "Alumnos", selected.id), { seguimientoAusencias: history });
      setAthletes((current) => current.map((athlete) => athlete.id === selected.id ? { ...athlete, seguimientos: [...history].reverse() } : athlete));
      setConfirming(false);
      setNote("");
      setSuccess(`Seguimiento guardado para ${selected.nombre}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el seguimiento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07090d] px-4 py-6 text-white sm:px-6 lg:px-8"><div className="mx-auto max-w-[1500px] space-y-6"><header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,.18),transparent_38%),linear-gradient(135deg,#091722,#090b11)] p-6 shadow-2xl sm:p-8"><div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end"><div><p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.24em] text-sky-300"><UserCheck className="h-4 w-4" /> Comunicación · {site}</p><h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Seguimiento de regreso</h1><p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">Detecta ausencias a tiempo y organiza un contacto humano, breve y respetuoso. Ningún mensaje se envía automáticamente.</p></div><button onClick={() => void loadData()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[.06] px-4 font-bold text-white"><RefreshCw className="h-4 w-4" /> Actualizar análisis</button></div><div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric value={summary.active} label="0–6 días" color="text-emerald-200" /><Metric value={summary.attention} label="7–13 días" color="text-sky-200" /><Metric value={summary.reconnect} label="14–29 días" color="text-amber-200" /><Metric value={summary.absent} label="30+ / sin visita" color="text-red-200" /></div></header>{error && <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-red-400/30 bg-red-950/50 p-4 text-red-100"><span className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> {error}</span><button onClick={() => setError("")}><X className="h-4 w-4" /></button></div>}{success && <div role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-950/50 p-4 text-emerald-100"><Check className="h-5 w-5" /> {success}</div>}

      <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]"><aside className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#11141b]"><div className="border-b border-white/10 p-4"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar atleta..." className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ReturnStatus | "todos")} className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/50 px-3 font-bold text-white"><option value="todos">Todos los estados</option>{Object.entries(RETURN_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="max-h-[850px] space-y-2 overflow-y-auto p-2">{loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-sky-300" /></div> : visibleAthletes.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">No hay atletas en este filtro.</p> : visibleAthletes.map((athlete) => <button key={athlete.id} onClick={() => setSelectedId(athlete.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${selected?.id === athlete.id ? "border-sky-300/50 bg-sky-500/15" : "border-transparent bg-white/[.02] hover:border-white/10 hover:bg-white/[.05]"}`}><AthletePhoto athlete={athlete} className="h-14 w-14 rounded-2xl" /><span className="min-w-0 flex-1"><span className="block truncate font-black text-white">{athlete.nombre}</span><span className="mt-1 block truncate text-xs text-slate-400">{athlete.ultimaAsistencia ? `Última visita: ${formatDate(athlete.ultimaAsistencia)}` : `Sin visita en ${HISTORY_DAYS} días`}</span><span className={`mt-2 inline-flex rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${statusClasses(athlete.status)}`}>{RETURN_STATUS_LABELS[athlete.status]}</span></span>{athlete.seguimientos.length > 0 && <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-white/10 px-2 text-xs font-black text-white">{athlete.seguimientos.length}</span>}</button>)}</div></aside>

        {!selected ? <section className="grid min-h-[600px] place-items-center rounded-[1.75rem] border border-dashed border-white/15 bg-white/[.025] text-center"><div><Users className="mx-auto h-10 w-10 text-slate-500" /><p className="mt-3 font-black text-white">Selecciona un atleta.</p></div></section> : <section className="space-y-6"><div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5 sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><AthletePhoto athlete={selected} className="h-28 w-28 rounded-[2rem]" /><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[.2em] text-sky-300">Ficha de contacto</p><h2 className="mt-1 truncate text-3xl font-black text-white">{selected.nombre}</h2><p className="mt-1 text-sm text-slate-300">{selected.disciplina || "Sin disciplina"}{selected.grado ? ` · ${selected.grado}` : ""}</p><p className="mt-2 flex items-center gap-2 text-sm text-slate-400"><Phone className="h-4 w-4" /> {selected.telefono || "Sin teléfono registrado"}</p></div><div className={`rounded-2xl border px-5 py-4 text-center ${statusClasses(selected.status)}`}><span className="block text-3xl font-black">{selected.diasAusente === null ? "180+" : selected.diasAusente}</span><span className="mt-1 block text-xs font-black uppercase tracking-wide">días sin visita</span></div></div></div>

          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_400px]"><div className="space-y-6"><div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><MessageCircleMore className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Contacto personal</p><h3 className="font-black text-white">Mensaje sugerido</h3></div></div><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={6} className="mt-4 w-full resize-y rounded-2xl border border-white/15 bg-black/40 p-4 text-sm leading-relaxed text-white outline-none placeholder:text-slate-500 focus:border-emerald-400" /><p className="mt-2 text-xs text-slate-400">Revisa siempre el texto antes de abrir WhatsApp. La web no envía mensajes por sí sola.</p>{whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 font-black text-slate-950 hover:bg-emerald-300"><Send className="h-5 w-5" /> Abrir WhatsApp</a> : <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm text-amber-100">Agrega un teléfono válido en la ficha del atleta para usar WhatsApp.</div>}</div>
            <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5 sm:p-6"><div className="flex items-center gap-3"><History className="h-5 w-5 text-violet-300" /><div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Historial</p><h3 className="font-black text-white">Seguimientos anteriores</h3></div></div>{selected.seguimientos.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">Todavía no hay contactos registrados.</p> : <div className="mt-4 space-y-3">{selected.seguimientos.map((followUp) => <article key={followUp.id} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-black text-white">{FOLLOW_UP_CHANNEL_LABELS[followUp.canal]}</span><span className="text-xs text-slate-500">{formatDateTime(followUp.fecha)}</span></div><p className="mt-2 font-bold text-white">{FOLLOW_UP_OUTCOME_LABELS[followUp.resultado]}</p>{followUp.nota && <p className="mt-1 text-sm text-slate-400">{followUp.nota}</p>}{followUp.coach && <p className="mt-2 text-xs text-slate-500">Registró: {followUp.coach}</p>}</article>)}</div>}</div></div>

            <aside className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5"><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Bitácora del coach</p><h3 className="mt-1 font-black text-white">Registrar seguimiento</h3><div className="mt-4 space-y-4"><SelectField label="Canal" value={channel} onChange={(value) => setChannel(value as FollowUpChannel)} options={FOLLOW_UP_CHANNEL_LABELS} /><SelectField label="Resultado" value={outcome} onChange={(value) => setOutcome(value as FollowUpOutcome)} options={FOLLOW_UP_OUTCOME_LABELS} /><TextField label="Nota" value={note} onChange={setNote} placeholder="Acuerdo, horario propuesto o próximo paso" /><Field label="Coach" value={coach} onChange={setCoach} placeholder="Nombre o correo" /></div>{!confirming ? <button onClick={() => setConfirming(true)} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 font-black text-slate-950"><Save className="h-5 w-5" /> Revisar registro</button> : <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4"><p className="font-black text-amber-100">¿Guardar este seguimiento?</p><p className="mt-1 text-xs text-amber-50/70">No cambia la asistencia ni contacta al atleta automáticamente.</p><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setConfirming(false)} disabled={saving} className="min-h-11 rounded-xl border border-white/15 bg-black/25 font-bold text-white">Cancelar</button><button onClick={() => void saveFollowUp()} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 font-black text-slate-950 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar</button></div></div>}</aside></div>
        </section>}
      </div></div></main>
  );
}

function Metric({ value, label, color }: { value: number; label: string; color: string }) { return <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-center"><span className={`block text-2xl font-black ${color}`}>{value}</span><span className="mt-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</span></div>; }
function AthletePhoto({ athlete, className }: { athlete: Athlete; className: string }) { return <span className={`relative shrink-0 overflow-hidden border border-white/10 bg-white/[.06] ${className}`}>{athlete.fotoUrl ? <Image src={athlete.fotoUrl} alt={`Foto de ${athlete.nombre}`} fill sizes="140px" unoptimized className="object-cover" /> : <span className="grid h-full place-items-center text-slate-400"><UserRound className="h-1/2 w-1/2" /></span>}</span>; }
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" /></label>; }
function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} className="w-full resize-y rounded-xl border border-white/15 bg-black/40 p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string> }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><span className="relative block"><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full appearance-none rounded-xl border border-white/15 bg-black/50 px-3 pr-10 text-sm font-bold text-white outline-none focus:border-amber-400">{Object.entries(options).map(([option, labelText]) => <option key={option} value={option}>{labelText}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" /></span></label>; }
function formatDate(date: Date) { return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(date); }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date); }
