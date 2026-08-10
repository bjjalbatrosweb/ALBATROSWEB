"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  CircleCheckBig,
  Clock3,
  Loader2,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";

import { useFirestore, useUser } from "@/firebase";
import {
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_CONDITION_LABELS,
  EQUIPMENT_TEMPLATES,
  createEquipmentLoan,
  defaultLoanDates,
  isLoanOverdue,
  loanDaysRemaining,
  markEquipmentLost,
  returnEquipmentLoan,
  type EquipmentCategory,
  type EquipmentCondition,
  type EquipmentLoan,
} from "@/lib/equipment-loans";

type AthleteDocument = {
  nombre?: string;
  fotoUrl?: string;
  imagenUrl?: string;
  disciplina?: string;
  grado?: string;
  activo?: boolean;
  prestamosEquipo?: unknown;
};

type Athlete = {
  id: string;
  nombre: string;
  fotoUrl: string;
  disciplina: string;
  grado: string;
  prestamos: EquipmentLoan[];
};

type View = "prestados" | "historial";
type Resolution = { loanId: string; mode: "return" | "lost" } | null;
const MAX_RETURNED_HISTORY = 40;

function isEquipmentLoan(value: unknown): value is EquipmentLoan {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.articulo === "string" &&
    typeof record.categoria === "string" &&
    typeof record.fechaPrestamo === "string" &&
    typeof record.estado === "string"
  );
}

function parseLoans(value: unknown) {
  return Array.isArray(value)
    ? value.filter(isEquipmentLoan).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
    : [];
}

function compactLoans(loans: EquipmentLoan[]) {
  const active = loans.filter((loan) => loan.estado === "prestado");
  const history = loans
    .filter((loan) => loan.estado !== "prestado")
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
    .slice(0, MAX_RETURNED_HISTORY);
  return [...active, ...history].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
}

function categoryClasses(category: EquipmentCategory) {
  const styles: Record<EquipmentCategory, string> = {
    proteccion: "border-sky-300/30 bg-sky-500/15 text-sky-100",
    uniforme: "border-violet-300/30 bg-violet-500/15 text-violet-100",
    entrenamiento: "border-orange-300/30 bg-orange-500/15 text-orange-100",
    electronica: "border-emerald-300/30 bg-emerald-500/15 text-emerald-100",
    otro: "border-slate-300/25 bg-slate-500/15 text-slate-100",
  };
  return styles[category];
}

export default function EquipmentLoansPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const defaults = useMemo(() => defaultLoanDates(), []);
  const [site, setSite] = useState("MMA");
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("prestados");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmingCreate, setConfirmingCreate] = useState(false);
  const [resolution, setResolution] = useState<Resolution>(null);
  const [item, setItem] = useState("");
  const [category, setCategory] = useState<EquipmentCategory>("proteccion");
  const [identifier, setIdentifier] = useState("");
  const [size, setSize] = useState("");
  const [condition, setCondition] = useState<EquipmentCondition>("bueno");
  const [loanDate, setLoanDate] = useState(defaults.loanDate);
  const [dueDate, setDueDate] = useState(defaults.dueDate);
  const [notes, setNotes] = useState("");
  const [responsible, setResponsible] = useState("");
  const [returnCondition, setReturnCondition] = useState<EquipmentCondition>("bueno");
  const [returnNote, setReturnNote] = useState("");

  useEffect(() => {
    setSite(localStorage.getItem("userSede") || "MMA");
  }, []);

  useEffect(() => {
    if (!responsible && user?.email) setResponsible(user.email);
  }, [responsible, user?.email]);

  const loadAthletes = useCallback(async () => {
    if (!firestore || !site) return;
    setLoading(true);
    setError("");
    try {
      const snapshot = await getDocs(query(collection(firestore, "Alumnos"), where("sede", "==", site)));
      const loaded = snapshot.docs
        .filter((record) => (record.data() as AthleteDocument).activo !== false)
        .map((record) => {
          const data = record.data() as AthleteDocument;
          return {
            id: record.id,
            nombre: String(data.nombre || "Atleta"),
            fotoUrl: String(data.fotoUrl || data.imagenUrl || ""),
            disciplina: String(data.disciplina || ""),
            grado: String(data.grado || ""),
            prestamos: parseLoans(data.prestamosEquipo),
          } satisfies Athlete;
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      setAthletes(loaded);
      setSelectedId((current) => current && loaded.some((athlete) => athlete.id === current) ? current : loaded[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los atletas.");
    } finally {
      setLoading(false);
    }
  }, [firestore, site]);

  useEffect(() => {
    void loadAthletes();
  }, [loadAthletes]);

  const selected = athletes.find((athlete) => athlete.id === selectedId) || null;
  const visibleAthletes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return athletes.filter((athlete) => !term || `${athlete.nombre} ${athlete.disciplina} ${athlete.grado}`.toLocaleLowerCase("es").includes(term));
  }, [athletes, search]);
  const activeLoans = selected?.prestamos.filter((loan) => loan.estado === "prestado") || [];
  const loanHistory = selected?.prestamos.filter((loan) => loan.estado !== "prestado") || [];
  const displayedLoans = view === "prestados" ? activeLoans : loanHistory;
  const summary = useMemo(() => {
    const all = athletes.flatMap((athlete) => athlete.prestamos);
    return {
      active: all.filter((loan) => loan.estado === "prestado").length,
      overdue: all.filter((loan) => isLoanOverdue(loan)).length,
      damaged: all.filter((loan) => loan.estado === "devuelto" && loan.condicionEntrada === "danado").length,
      athletes: athletes.filter((athlete) => athlete.prestamos.some((loan) => loan.estado === "prestado")).length,
    };
  }, [athletes]);

  const persist = async (athlete: Athlete, loans: EquipmentLoan[], message: string) => {
    if (!firestore || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const compacted = compactLoans(loans);
      await updateDoc(doc(firestore, "Alumnos", athlete.id), { prestamosEquipo: compacted });
      setAthletes((current) => current.map((entry) => entry.id === athlete.id ? { ...entry, prestamos: [...compacted].reverse() } : entry));
      setSuccess(message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el préstamo.");
    } finally {
      setSaving(false);
    }
  };

  const selectTemplate = (template: (typeof EQUIPMENT_TEMPLATES)[number]) => {
    setItem(template.articulo);
    setCategory(template.categoria);
    setConfirmingCreate(false);
  };

  const createLoan = async () => {
    if (!selected || !item.trim() || saving) return;
    if (dueDate && loanDate && dueDate < loanDate) {
      setError("La fecha límite no puede ser anterior a la fecha del préstamo.");
      setConfirmingCreate(false);
      return;
    }
    const loan = createEquipmentLoan({ item, category, identifier, size, condition, loanDate, dueDate, notes, responsible });
    await persist(selected, [...selected.prestamos, loan], `${item} quedó prestado a ${selected.nombre}.`);
    setItem("");
    setIdentifier("");
    setSize("");
    setNotes("");
    setConfirmingCreate(false);
    setView("prestados");
  };

  const resolveLoan = async () => {
    if (!selected || !resolution || saving) return;
    const current = selected.prestamos.find((loan) => loan.id === resolution.loanId);
    if (!current) return;
    const updated = resolution.mode === "return"
      ? returnEquipmentLoan(current, returnCondition, returnNote)
      : markEquipmentLost(current, returnNote);
    const next = selected.prestamos.map((loan) => loan.id === current.id ? updated : loan);
    await persist(selected, next, resolution.mode === "return" ? `${current.articulo} fue devuelto.` : `${current.articulo} fue marcado como no recuperado.`);
    setResolution(null);
    setReturnCondition("bueno");
    setReturnNote("");
  };

  const reactivateLoan = async (loan: EquipmentLoan) => {
    if (!selected || saving) return;
    const updated: EquipmentLoan = { ...loan, estado: "prestado", fechaDevolucion: undefined, condicionEntrada: undefined, notaDevolucion: undefined };
    await persist(selected, selected.prestamos.map((entry) => entry.id === loan.id ? updated : entry), `${loan.articulo} volvió a préstamos activos.`);
    setView("prestados");
  };

  return (
    <main className="min-h-screen bg-[#07090d] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,.18),transparent_36%),linear-gradient(135deg,#0c1720,#090b11)] p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end"><div><p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.24em] text-sky-300"><Package className="h-4 w-4" /> Operaciones · {site}</p><h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Equipamiento y préstamos</h1><p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">Controla qué material salió, quién lo tiene, cuándo debe volver y en qué estado fue entregado.</p></div><div className="grid grid-cols-4 gap-2 sm:min-w-[520px]"><Metric value={summary.active} label="Prestados" color="text-sky-200" /><Metric value={summary.overdue} label="Atrasados" color="text-red-200" /><Metric value={summary.damaged} label="Con daño" color="text-orange-200" /><Metric value={summary.athletes} label="Atletas" color="text-emerald-200" /></div></div>
        </header>
        {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-950/50 p-4 text-red-100"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" /><span>{error}</span></div>}
        {success && <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-950/50 p-4 text-emerald-100"><Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><span>{success}</span></div>}

        <div className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#11141b]"><div className="flex gap-2 border-b border-white/10 p-4"><label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar atleta..." className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" /></label><button onClick={() => void loadAthletes()} aria-label="Actualizar" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[.05] text-white"><RefreshCw className="h-4 w-4" /></button></div><div className="max-h-[900px] space-y-1 overflow-y-auto p-2">{loading ? <div className="grid min-h-56 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-sky-300" /></div> : visibleAthletes.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">No hay atletas activos.</p> : visibleAthletes.map((athlete) => { const active = athlete.prestamos.filter((loan) => loan.estado === "prestado"); const overdue = active.filter((loan) => isLoanOverdue(loan)).length; const chosen = athlete.id === selected?.id; return <button key={athlete.id} onClick={() => { setSelectedId(athlete.id); setSuccess(""); }} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${chosen ? "border-sky-300/50 bg-sky-500/15" : "border-transparent bg-white/[.02] hover:border-white/10 hover:bg-white/[.05]"}`}><AthletePhoto athlete={athlete} className="h-12 w-12 rounded-xl" /><span className="min-w-0 flex-1"><span className="block truncate font-black text-white">{athlete.nombre}</span><span className="block truncate text-xs text-slate-400">{athlete.disciplina || "Sin disciplina"}{athlete.grado ? ` · ${athlete.grado}` : ""}</span></span><span className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs font-black ${overdue ? "bg-red-400 text-slate-950" : active.length ? "bg-sky-400 text-slate-950" : "bg-white/10 text-slate-300"}`}>{overdue || active.length}</span></button>; })}</div></aside>

          {!selected ? <section className="grid min-h-[520px] place-items-center rounded-[1.75rem] border border-dashed border-white/15 bg-white/[.025] p-8 text-center"><div><Package className="mx-auto h-10 w-10 text-slate-500" /><p className="mt-3 font-black text-white">Selecciona un atleta</p><p className="mt-1 text-sm text-slate-400">Sus préstamos aparecerán aquí.</p></div></section> : <section className="space-y-6">
            <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5 sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><AthletePhoto athlete={selected} className="h-24 w-24 rounded-3xl" /><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[.2em] text-sky-300">Responsable del material</p><h2 className="mt-1 truncate text-2xl font-black text-white sm:text-3xl">{selected.nombre}</h2><p className="mt-1 text-sm text-slate-300">{selected.disciplina || "Sin disciplina"}{selected.grado ? ` · ${selected.grado}` : ""}</p></div><div className="grid grid-cols-2 gap-2"><Metric value={activeLoans.length} label="En préstamo" color="text-sky-200" /><Metric value={activeLoans.filter((loan) => isLoanOverdue(loan)).length} label="Atrasados" color="text-red-200" /></div></div></div>

            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Seguimiento</p><h3 className="mt-1 text-xl font-black text-white">Material del atleta</h3></div><div className="flex rounded-xl border border-white/10 bg-black/30 p-1"><button onClick={() => setView("prestados")} className={`min-h-10 rounded-lg px-4 text-sm font-bold ${view === "prestados" ? "bg-white text-slate-950" : "text-slate-300"}`}>Prestados ({activeLoans.length})</button><button onClick={() => setView("historial")} className={`min-h-10 rounded-lg px-4 text-sm font-bold ${view === "historial" ? "bg-white text-slate-950" : "text-slate-300"}`}>Historial ({loanHistory.length})</button></div></div>{displayedLoans.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-10 text-center"><PackageCheck className="mx-auto h-9 w-9 text-slate-500" /><p className="mt-3 font-bold text-white">{view === "prestados" ? "No tiene material prestado." : "Todavía no hay devoluciones."}</p></div> : <div className="mt-5 space-y-4">{displayedLoans.map((loan) => <LoanCard key={loan.id} loan={loan} saving={saving} onReturn={() => { setResolution({ loanId: loan.id, mode: "return" }); setReturnCondition(loan.condicionSalida); setReturnNote(""); }} onLost={() => { setResolution({ loanId: loan.id, mode: "lost" }); setReturnNote(""); }} onReactivate={() => void reactivateLoan(loan)} />)}</div>}</div>

              <aside className="space-y-6"><div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5"><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Artículos frecuentes</p><div className="mt-4 grid grid-cols-2 gap-2">{EQUIPMENT_TEMPLATES.map((template) => <button key={template.id} onClick={() => selectTemplate(template)} className={`rounded-xl border p-3 text-left transition ${item === template.articulo ? "border-amber-300/45 bg-amber-500/15" : "border-white/10 bg-white/[.035] hover:bg-white/[.07]"}`}><Package className="mb-2 h-5 w-5 text-amber-300" /><span className="block text-sm font-bold text-white">{template.articulo}</span><span className="mt-1 block text-[10px] uppercase tracking-wide text-slate-400">{EQUIPMENT_CATEGORY_LABELS[template.categoria]}</span></button>)}</div></div>
                <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5"><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Nuevo préstamo</p><div className="mt-4 space-y-4"><Field label="Artículo" value={item} onChange={setItem} placeholder="Ej. Guantes de boxeo" /><SelectField label="Categoría" value={category} onChange={(value) => setCategory(value as EquipmentCategory)} options={EQUIPMENT_CATEGORY_LABELS} /><div className="grid grid-cols-2 gap-3"><Field label="Código / número" value={identifier} onChange={setIdentifier} placeholder="EQ-014" /><Field label="Talla" value={size} onChange={setSize} placeholder="M / 12 oz" /></div><SelectField label="Estado al salir" value={condition} onChange={(value) => setCondition(value as EquipmentCondition)} options={EQUIPMENT_CONDITION_LABELS} /><div className="grid grid-cols-2 gap-3"><DateField label="Préstamo" value={loanDate} onChange={setLoanDate} /><DateField label="Devolver antes de" value={dueDate} onChange={setDueDate} /></div><TextField label="Notas" value={notes} onChange={setNotes} placeholder="Accesorios incluidos o detalles" /><Field label="Responsable" value={responsible} onChange={setResponsible} placeholder="Nombre o correo" /></div>{!confirmingCreate ? <button onClick={() => setConfirmingCreate(true)} disabled={!item.trim()} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 font-black text-slate-950 hover:bg-emerald-300 disabled:opacity-40"><Plus className="h-5 w-5" /> Revisar préstamo</button> : <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4"><p className="font-black text-amber-100">¿Entregar “{item}”?</p><p className="mt-1 text-xs text-amber-50/70">Se registrará a nombre de {selected.nombre}.</p><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setConfirmingCreate(false)} disabled={saving} className="min-h-11 rounded-xl border border-white/15 bg-black/25 font-bold text-white">Cancelar</button><button onClick={() => void createLoan()} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 font-black text-slate-950 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar</button></div></div>}</div>
              </aside>
            </div>
          </section>}
        </div>
      </div>

      {resolution && selected && <ResolutionDialog loan={selected.prestamos.find((entry) => entry.id === resolution.loanId) || null} mode={resolution.mode} condition={returnCondition} note={returnNote} saving={saving} onCondition={setReturnCondition} onNote={setReturnNote} onCancel={() => setResolution(null)} onConfirm={() => void resolveLoan()} />}
    </main>
  );
}

function LoanCard({ loan, saving, onReturn, onLost, onReactivate }: { loan: EquipmentLoan; saving: boolean; onReturn: () => void; onLost: () => void; onReactivate: () => void }) {
  const overdue = isLoanOverdue(loan);
  const remaining = loanDaysRemaining(loan);
  return <article className={`rounded-2xl border p-4 sm:p-5 ${overdue ? "border-red-300/30 bg-red-500/[.07]" : loan.estado === "devuelto" ? "border-emerald-300/20 bg-emerald-500/[.05]" : loan.estado === "perdido" ? "border-orange-300/25 bg-orange-500/[.06]" : "border-white/10 bg-black/25"}`}><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-lg border px-2 py-1 text-xs font-black ${categoryClasses(loan.categoria)}`}>{EQUIPMENT_CATEGORY_LABELS[loan.categoria]}</span>{overdue && <span className="rounded-lg bg-red-400 px-2 py-1 text-xs font-black text-slate-950">Atrasado</span>}{loan.estado === "devuelto" && <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-400 px-2 py-1 text-xs font-black text-slate-950"><CircleCheckBig className="h-3 w-3" /> Devuelto</span>}{loan.estado === "perdido" && <span className="rounded-lg bg-orange-400 px-2 py-1 text-xs font-black text-slate-950">No recuperado</span>}</div><h4 className="mt-3 text-lg font-black text-white">{loan.articulo}</h4><p className="mt-1 text-xs text-slate-400">{[loan.identificador, loan.talla].filter(Boolean).join(" · ") || "Sin código ni talla"}</p></div><span className={`rounded-xl border px-3 py-2 text-xs font-black ${loan.condicionSalida === "danado" ? "border-red-300/30 bg-red-500/15 text-red-100" : "border-white/10 bg-white/[.05] text-slate-200"}`}>Salida: {EQUIPMENT_CONDITION_LABELS[loan.condicionSalida]}</span></div><div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400"><span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Prestado {formatDate(loan.fechaPrestamo)}</span><span className={`flex items-center gap-1 ${overdue ? "font-black text-red-200" : ""}`}><CalendarClock className="h-3.5 w-3.5" /> Límite {formatDate(loan.fechaLimite)}{loan.estado === "prestado" && remaining !== null ? remaining < 0 ? ` · ${Math.abs(remaining)} días tarde` : ` · faltan ${remaining} días` : ""}</span></div>{loan.notas && <p className="mt-3 rounded-xl bg-black/25 p-3 text-sm text-slate-300">{loan.notas}</p>}{loan.estado !== "prestado" && <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300"><p><strong className="text-white">Estado final:</strong> {loan.condicionEntrada ? EQUIPMENT_CONDITION_LABELS[loan.condicionEntrada] : "No recuperado"}</p>{loan.notaDevolucion && <p className="mt-1 text-slate-400">{loan.notaDevolucion}</p>}</div>}<div className="mt-4 flex flex-wrap justify-end gap-2">{loan.estado === "prestado" ? <><button onClick={onLost} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-orange-300/20 bg-orange-500/10 px-3 text-sm font-bold text-orange-100"><ShieldAlert className="h-4 w-4" /> No recuperado</button><button onClick={onReturn} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-black text-slate-950"><PackageCheck className="h-4 w-4" /> Registrar devolución</button></> : <button onClick={onReactivate} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[.05] px-4 text-sm font-bold text-white"><RotateCcw className="h-4 w-4" /> Reactivar préstamo</button>}</div></article>;
}

function ResolutionDialog({ loan, mode, condition, note, saving, onCondition, onNote, onCancel, onConfirm }: { loan: EquipmentLoan | null; mode: "return" | "lost"; condition: EquipmentCondition; note: string; saving: boolean; onCondition: (value: EquipmentCondition) => void; onNote: (value: string) => void; onCancel: () => void; onConfirm: () => void }) {
  if (!loan) return null;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-[1.75rem] border border-white/15 bg-[#151820] p-5 text-white shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className={`text-xs font-black uppercase tracking-[.2em] ${mode === "return" ? "text-emerald-300" : "text-orange-300"}`}>{mode === "return" ? "Devolución" : "Incidencia"}</p><h3 className="mt-1 text-xl font-black text-white">{loan.articulo}</h3></div><button onClick={onCancel} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-slate-300"><X className="h-4 w-4" /></button></div><p className="mt-3 text-sm leading-relaxed text-slate-400">{mode === "return" ? "Revisa el estado real del artículo antes de confirmar." : "Utiliza esta opción sólo cuando el artículo no haya podido recuperarse."}</p><div className="mt-5 space-y-4">{mode === "return" && <SelectField label="Estado al regresar" value={condition} onChange={(value) => onCondition(value as EquipmentCondition)} options={EQUIPMENT_CONDITION_LABELS} />}<TextField label={mode === "return" ? "Nota de devolución" : "Motivo / seguimiento"} value={note} onChange={onNote} placeholder={mode === "return" ? "Daños, piezas faltantes o sin novedad" : "Qué ocurrió y quién dará seguimiento"} /></div><div className="mt-6 grid grid-cols-2 gap-3"><button onClick={onCancel} disabled={saving} className="min-h-11 rounded-xl border border-white/15 bg-black/25 font-bold text-white">Cancelar</button><button onClick={onConfirm} disabled={saving} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-black text-slate-950 disabled:opacity-50 ${mode === "return" ? "bg-emerald-400" : "bg-orange-400"}`}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "return" ? <PackageCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />} Confirmar</button></div></div></div>;
}

function Metric({ value, label, color }: { value: number; label: string; color: string }) { return <div className="rounded-2xl border border-white/10 bg-black/30 px-2 py-3 text-center"><span className={`block text-2xl font-black ${color}`}>{value}</span><span className="mt-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</span></div>; }
function AthletePhoto({ athlete, className }: { athlete: Athlete; className: string }) { return <span className={`relative shrink-0 overflow-hidden border border-white/10 bg-white/[.06] ${className}`}>{athlete.fotoUrl ? <Image src={athlete.fotoUrl} alt={`Foto de ${athlete.nombre}`} fill sizes="120px" unoptimized className="object-cover" /> : <span className="grid h-full place-items-center text-slate-400"><UserRound className="h-1/2 w-1/2" /></span>}</span>; }
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" /></label>; }
function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="w-full resize-y rounded-xl border border-white/15 bg-black/40 p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" /></label>; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white outline-none [color-scheme:dark] focus:border-sky-400" /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string> }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><span className="relative block"><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full appearance-none rounded-xl border border-white/15 bg-black/50 px-3 pr-10 text-sm font-bold text-white outline-none focus:border-sky-400">{Object.entries(options).map(([option, labelText]) => <option key={option} value={option}>{labelText}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" /></span></label>; }
function formatDate(value: string) { if (!value) return "sin fecha"; const date = new Date(`${value.slice(0, 10)}T12:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(date); }
