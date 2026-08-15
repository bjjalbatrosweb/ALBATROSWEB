"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock3,
  Copy,
  Flag,
  Loader2,
  Medal,
  Presentation,
  RefreshCw,
  Search,
  ShieldCheck,
  Trophy,
  UserPlus,
  UserRound,
  Users,
  Weight,
  X,
} from "lucide-react";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { useFirestore } from "@/firebase";
import {
  CHECKLIST_LABELS,
  COMPETITION_STATUS_LABELS,
  COMPETITION_STATUS_ORDER,
  checklistProgress,
  createCompetitionEntry,
  createCompetitionSession,
  daysUntil,
  moveCompetitionStatus,
  passportReadiness,
  weightDifference,
  type CompetitionAthlete,
  type CompetitionChecklist,
  type CompetitionEntry,
  type CompetitionSession,
  type CompetitionStatus,
} from "@/lib/competition-mode";

type View = "pasaportes" | "equipo" | "vivo";
type AthleteDocument = {
  nombre?: string;
  fotoUrl?: string;
  imagenUrl?: string;
  disciplina?: string;
  grado?: string;
  pesoActual?: number;
  pesoObjetivo?: number;
  categoriaDeportiva?: string;
  proximaCompetencia?: string;
  fechaCompetencia?: string;
  objetivo?: string;
  resultadosCompetencias?: Array<{ fecha?: string; evento?: string; resultado?: string }>;
  activo?: boolean;
};

const STORAGE_PREFIX = "albatros-competition-session-v1";
const resultOptions = ["Oro", "Plata", "Bronce", "Victoria", "Participación", "Derrota"];

const statusColors: Record<CompetitionStatus, string> = {
  preparacion: "border-white/15 bg-white/[.05] text-white/70",
  calentamiento: "border-orange-300/30 bg-orange-500/15 text-orange-200",
  llamado: "border-amber-300/35 bg-amber-500/15 text-amber-100",
  combatiendo: "border-red-300/40 bg-red-500/20 text-red-100",
  finalizado: "border-emerald-300/30 bg-emerald-500/15 text-emerald-100",
};

function progressColor(value: number) {
  if (value >= 85) return "bg-emerald-400";
  if (value >= 60) return "bg-amber-400";
  return "bg-red-400";
}

export default function CompetitionCenterPage() {
  const firestore = useFirestore();
  const [site, setSite] = useState("MMA");
  const [view, setView] = useState<View>("pasaportes");
  const [athletes, setAthletes] = useState<CompetitionAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [discipline, setDiscipline] = useState("Todas");
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [session, setSession] = useState<CompetitionSession>(createCompetitionSession);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [savingResultId, setSavingResultId] = useState("");
  const [copied, setCopied] = useState(false);
  const [presentation, setPresentation] = useState(false);
  const [wallClock, setWallClock] = useState("--:--:--");

  useEffect(() => {
    setSite(localStorage.getItem("userSede") || "MMA");
  }, []);

  useEffect(() => {
    setSessionLoaded(false);
    const stored = localStorage.getItem(`${STORAGE_PREFIX}:${site}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CompetitionSession;
        if (Array.isArray(parsed.entries)) setSession(parsed);
        else setSession(createCompetitionSession());
      } catch {
        setSession(createCompetitionSession());
      }
    } else {
      setSession(createCompetitionSession());
    }
    setSessionLoaded(true);
  }, [site]);

  useEffect(() => {
    if (!sessionLoaded) return;
    localStorage.setItem(
      `${STORAGE_PREFIX}:${site}`,
      JSON.stringify({ ...session, updatedAt: new Date().toISOString() }),
    );
  }, [session, sessionLoaded, site]);

  useEffect(() => {
    const update = () =>
      setWallClock(
        new Intl.DateTimeFormat("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadAthletes = useCallback(async () => {
    if (!firestore || !site) return;
    setLoading(true);
    setError("");
    try {
      const snapshot = await getDocs(
        query(collection(firestore, "Alumnos"), where("sede", "==", site)),
      );
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
            pesoActual: Number(data.pesoActual) > 0 ? Number(data.pesoActual) : null,
            pesoObjetivo: Number(data.pesoObjetivo) > 0 ? Number(data.pesoObjetivo) : null,
            categoriaDeportiva: String(data.categoriaDeportiva || ""),
            proximaCompetencia: String(data.proximaCompetencia || ""),
            fechaCompetencia: String(data.fechaCompetencia || ""),
            objetivo: String(data.objetivo || ""),
            resultadosCompetencias: (data.resultadosCompetencias || []).map((result) => ({
              fecha: String(result.fecha || ""),
              evento: String(result.evento || ""),
              resultado: String(result.resultado || ""),
            })),
          } satisfies CompetitionAthlete;
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      setAthletes(loaded);
      setSelectedAthleteId((current) => current || loaded[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los atletas.");
    } finally {
      setLoading(false);
    }
  }, [firestore, site]);

  useEffect(() => {
    void loadAthletes();
  }, [loadAthletes]);

  const disciplines = useMemo(
    () => ["Todas", ...new Set(athletes.map((athlete) => athlete.disciplina || "Sin disciplina"))],
    [athletes],
  );

  const visibleAthletes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return athletes.filter((athlete) => {
      const disciplineMatches =
        discipline === "Todas" || (athlete.disciplina || "Sin disciplina") === discipline;
      const searchMatches =
        !term ||
        `${athlete.nombre} ${athlete.disciplina} ${athlete.grado} ${athlete.categoriaDeportiva}`
          .toLocaleLowerCase("es")
          .includes(term);
      return disciplineMatches && searchMatches;
    });
  }, [athletes, discipline, search]);

  const selectedAthlete =
    athletes.find((athlete) => athlete.id === selectedAthleteId) || visibleAthletes[0] || null;

  const athleteForEntry = (entry: CompetitionEntry) =>
    athletes.find((athlete) => athlete.id === entry.athleteId) || null;

  const updateSession = <K extends keyof CompetitionSession>(
    field: K,
    value: CompetitionSession[K],
  ) => setSession((current) => ({ ...current, [field]: value }));

  const updateEntry = (entryId: string, patch: Partial<CompetitionEntry>) => {
    setSession((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              ...patch,
              resultadoGuardado:
                patch.resultado !== undefined
                  ? false
                  : patch.resultadoGuardado ?? entry.resultadoGuardado,
            }
          : entry,
      ),
    }));
  };

  const addToTeam = (athlete: CompetitionAthlete) => {
    if (session.entries.some((entry) => entry.athleteId === athlete.id)) {
      setView("equipo");
      return;
    }
    setSession((current) => ({
      ...current,
      entries: [...current.entries, createCompetitionEntry(athlete)],
    }));
    setView("equipo");
  };

  const removeEntry = (entryId: string) => {
    if (!window.confirm("¿Quitar a este atleta del equipo de competencia?")) return;
    setSession((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.id !== entryId),
    }));
  };

  const toggleChecklist = (entry: CompetitionEntry, key: keyof CompetitionChecklist) => {
    updateEntry(entry.id, {
      checklist: { ...entry.checklist, [key]: !entry.checklist[key] },
    });
  };

  const moveStatus = (entry: CompetitionEntry, direction: -1 | 1) => {
    updateEntry(entry.id, { status: moveCompetitionStatus(entry.status, direction) });
  };

  const saveResult = async (entry: CompetitionEntry) => {
    const athlete = athleteForEntry(entry);
    if (!firestore || !athlete || !entry.resultado || savingResultId) return;
    setSavingResultId(entry.id);
    setError("");
    try {
      const result = {
        fecha: session.eventDate || new Date().toISOString().slice(0, 10),
        evento: session.eventName || "Competencia",
        resultado: entry.resultado,
      };
      await updateDoc(doc(firestore, "Alumnos", athlete.id), {
        resultadosCompetencias: arrayUnion(result),
      });
      updateEntry(entry.id, { resultadoGuardado: true });
      setAthletes((current) =>
        current.map((item) =>
          item.id === athlete.id
            ? { ...item, resultadosCompetencias: [...item.resultadosCompetencias, result] }
            : item,
        ),
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el resultado.");
    } finally {
      setSavingResultId("");
    }
  };

  const copyTeam = async () => {
    const text = [
      `${session.eventName} · ${session.eventDate || "Sin fecha"}`,
      session.venue ? `Sede: ${session.venue}` : "",
      "",
      ...session.entries.map((entry, index) => {
        const athlete = athleteForEntry(entry);
        return `${index + 1}. ${athlete?.nombre || "Atleta"} · ${entry.categoria || "Sin categoría"} · Tatami ${entry.tatami || "?"} · ${COMPETITION_STATUS_LABELS[entry.status]}`;
      }),
    ]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const openPresentation = async () => {
    setPresentation(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // El tablero permanece abierto si el navegador no permite fullscreen.
    }
  };

  const closePresentation = async () => {
    setPresentation(false);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  };

  const tabs: Array<{ id: View; label: string; icon: typeof Trophy }> = [
    { id: "pasaportes", label: "Pasaportes", icon: ShieldCheck },
    { id: "equipo", label: "Equipo", icon: Users },
    { id: "vivo", label: "Modo competencia", icon: Flag },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 text-white md:p-8">
      <header className="rounded-[28px] border border-white/10 bg-gradient-to-br from-[#171409] via-[#0d0e0f] to-[#050607] p-5 shadow-2xl md:p-7">
        <div className="flex items-center gap-2 text-amber-300"><Medal className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-[.24em]">Preparación y operación</span></div>
        <h1 className="mt-2 text-3xl font-black uppercase md:text-5xl">Centro de competencia</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/65 md:text-base">Pasaportes deportivos, checklist del equipo y seguimiento en vivo durante el torneo.</p>
      </header>

      <nav className="grid grid-cols-3 gap-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setView(id)} className={`min-h-14 rounded-2xl border px-2 text-xs font-black text-white transition sm:text-sm ${view === id ? "border-amber-300/45 bg-amber-500/15" : "border-white/10 bg-[#090b0d] hover:bg-white/[.06]"}`}><Icon className="mx-auto mb-1 h-4 w-4" />{label}</button>
        ))}
      </nav>

      {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-950/40 p-4 text-red-100"><AlertTriangle className="h-5 w-5 shrink-0 text-red-300" /><p className="flex-1 text-sm font-bold">{error}</p><button type="button" onClick={() => setError("")}><X /></button></div>}

      {view === "pasaportes" && (
        <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <div className="rounded-[26px] border border-white/10 bg-[#090b0d] p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-amber-300">Sede {site}</p><h2 className="font-black uppercase">Atletas</h2></div><button type="button" onClick={() => void loadAthletes()} className="competition-tool-button"><RefreshCw />Actualizar</button></div>
            <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_150px] xl:grid-cols-1">
              <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar atleta…" className="competition-input pl-9" /></label>
              <select value={discipline} onChange={(event) => setDiscipline(event.target.value)} className="competition-input">{disciplines.map((value) => <option key={value}>{value}</option>)}</select>
            </div>
            {loading ? <div className="grid min-h-80 place-items-center text-center font-black text-white/70"><div><Loader2 className="mx-auto mb-3 animate-spin text-amber-300" />Cargando pasaportes…</div></div> : <div className="max-h-[650px] space-y-2 overflow-auto pr-1">{visibleAthletes.map((athlete) => { const readiness = passportReadiness(athlete); return <button key={athlete.id} type="button" onClick={() => setSelectedAthleteId(athlete.id)} className={`grid w-full grid-cols-[50px_1fr_auto] items-center gap-3 rounded-2xl border p-2 text-left text-white transition ${selectedAthlete?.id === athlete.id ? "border-amber-300/40 bg-amber-500/12" : "border-white/10 bg-black/20 hover:border-white/25"}`}><AthletePhoto athlete={athlete} className="h-12 w-12 rounded-xl" /><span className="min-w-0"><strong className="block truncate text-sm">{athlete.nombre}</strong><span className="block truncate text-[10px] text-white/70">{athlete.disciplina || "Sin disciplina"} · {athlete.grado || "Sin grado"}</span></span><span className={`rounded-full px-2 py-1 text-[10px] font-black ${readiness.score >= 75 ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200"}`}>{readiness.score}%</span></button>; })}</div>}
          </div>

          {selectedAthlete ? <PassportCard athlete={selectedAthlete} inTeam={session.entries.some((entry) => entry.athleteId === selectedAthlete.id)} onAdd={() => addToTeam(selectedAthlete)} /> : <div className="grid min-h-[600px] place-items-center rounded-[26px] border border-white/10 bg-[#090b0d] text-center text-white/70"><div><UserRound className="mx-auto mb-3 h-12 w-12" />Selecciona un atleta.</div></div>}
        </section>
      )}

      {view === "equipo" && (
        <section className="space-y-5">
          <div className="grid gap-4 rounded-[26px] border border-white/10 bg-[#090b0d] p-5 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Evento"><input value={session.eventName} onChange={(event) => updateSession("eventName", event.target.value)} className="competition-input" /></Field>
            <Field label="Fecha"><input type="date" value={session.eventDate} onChange={(event) => updateSession("eventDate", event.target.value)} className="competition-input" /></Field>
            <Field label="Lugar"><input value={session.venue} onChange={(event) => updateSession("venue", event.target.value)} placeholder="Ciudad / sede" className="competition-input" /></Field>
            <Field label="Coach responsable"><input value={session.coach} onChange={(event) => updateSession("coach", event.target.value)} placeholder="Nombre" className="competition-input" /></Field>
          </div>
          {session.entries.length ? <div className="grid gap-4 xl:grid-cols-2">{session.entries.map((entry) => { const athlete = athleteForEntry(entry); if (!athlete) return null; const progress = checklistProgress(entry.checklist); return <article key={entry.id} className="rounded-[24px] border border-white/10 bg-[#090b0d] p-4"><div className="flex items-start gap-3"><AthletePhoto athlete={athlete} className="h-16 w-16 rounded-2xl" /><div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-wider text-amber-300">{athlete.disciplina || "Disciplina pendiente"}</p><h3 className="truncate text-lg font-black uppercase">{athlete.nombre}</h3><p className="text-xs text-white/70">{athlete.pesoActual ? `${athlete.pesoActual} kg` : "Sin peso"} · {athlete.grado || "Sin grado"}</p></div><button type="button" onClick={() => removeEntry(entry.id)} className="text-white/70 hover:text-red-300" aria-label="Quitar atleta"><X /></button></div><div className="my-4"><div className="mb-1 flex justify-between text-[10px] font-black uppercase text-white/70"><span>Preparación</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${progressColor(progress)}`} style={{ width: `${progress}%` }} /></div></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{(Object.keys(CHECKLIST_LABELS) as Array<keyof CompetitionChecklist>).map((key) => <button key={key} type="button" onClick={() => toggleChecklist(entry, key)} className={`flex min-h-11 items-center gap-2 rounded-xl border p-2 text-left text-[10px] font-bold text-white ${entry.checklist[key] ? "border-emerald-300/25 bg-emerald-500/12" : "border-white/10 bg-black/20"}`}><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ${entry.checklist[key] ? "bg-emerald-400 text-emerald-950" : "bg-white/10 text-white/70"}`}>{entry.checklist[key] && <Check className="h-3 w-3" />}</span>{CHECKLIST_LABELS[key]}</button>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Categoría"><input value={entry.categoria} onChange={(event) => updateEntry(entry.id, { categoria: event.target.value })} className="competition-input" /></Field><Field label="Tatami"><input value={entry.tatami} onChange={(event) => updateEntry(entry.id, { tatami: event.target.value })} className="competition-input" /></Field><Field label="Orden"><input value={entry.orden} onChange={(event) => updateEntry(entry.id, { orden: event.target.value })} placeholder="#" className="competition-input" /></Field><Field label="Hora estimada"><input type="time" value={entry.horaEstimada} onChange={(event) => updateEntry(entry.id, { horaEstimada: event.target.value })} className="competition-input" /></Field></div><Field label="Notas para el coach"><input value={entry.notas} onChange={(event) => updateEntry(entry.id, { notas: event.target.value })} placeholder="Estrategia, llamado o indicación breve…" className="competition-input" /></Field></article>; })}</div> : <EmptyTeam onGo={() => setView("pasaportes")} />}
        </section>
      )}

      {view === "vivo" && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-[#090b0d] p-4"><div><p className="text-[10px] font-black uppercase tracking-wider text-amber-300">{session.eventDate || "Sin fecha"} · {session.venue || "Lugar pendiente"}</p><h2 className="text-2xl font-black uppercase">{session.eventName}</h2><p className="text-xs text-white/70">{session.entries.length} competidores · hora local {wallClock}</p></div><div className="flex gap-2"><button type="button" onClick={() => void copyTeam()} className="competition-tool-button">{copied ? <Check /> : <Copy />}{copied ? "Copiado" : "Copiar equipo"}</button><button type="button" disabled={!session.entries.length} onClick={() => void openPresentation()} className="competition-tool-button border-amber-300/25 bg-amber-500/10"><Presentation />Presentar</button></div></div>
          {session.entries.length ? <div className="grid gap-4 xl:grid-cols-2">{session.entries.map((entry) => { const athlete = athleteForEntry(entry); if (!athlete) return null; return <article key={entry.id} className={`rounded-[24px] border p-4 ${statusColors[entry.status]}`}><div className="flex items-start gap-3"><AthletePhoto athlete={athlete} className="h-16 w-16 rounded-2xl" /><div className="min-w-0 flex-1"><span className="text-[9px] font-black uppercase tracking-wider opacity-70">{COMPETITION_STATUS_LABELS[entry.status]}</span><h3 className="truncate text-xl font-black uppercase text-white">{athlete.nombre}</h3><p className="text-xs text-white/70">{entry.categoria || "Sin categoría"} · Tatami {entry.tatami || "?"} · Orden {entry.orden || "?"}</p>{entry.horaEstimada && <p className="mt-1 flex items-center gap-1 text-xs font-black text-white/70"><Clock3 className="h-3 w-3" />{entry.horaEstimada}</p>}</div><span className="rounded-full border border-current/20 px-2 py-1 text-[10px] font-black">{checklistProgress(entry.checklist)}%</span></div>{entry.notas && <p className="mt-3 rounded-xl bg-black/20 p-3 text-xs font-bold text-white/70">Coach: {entry.notas}</p>}<div className="mt-4 grid grid-cols-[auto_1fr_auto] gap-2"><button type="button" disabled={entry.status === "preparacion"} onClick={() => moveStatus(entry, -1)} className="status-button"><ArrowLeft /></button><select value={entry.status} onChange={(event) => updateEntry(entry.id, { status: event.target.value as CompetitionStatus })} className="competition-input text-center font-black">{COMPETITION_STATUS_ORDER.map((status) => <option key={status} value={status}>{COMPETITION_STATUS_LABELS[status]}</option>)}</select><button type="button" disabled={entry.status === "finalizado"} onClick={() => moveStatus(entry, 1)} className="status-button"><ArrowRight /></button></div>{entry.status === "finalizado" && <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3"><select value={entry.resultado} onChange={(event) => updateEntry(entry.id, { resultado: event.target.value, resultadoGuardado: false })} className="competition-input min-w-44 flex-1"><option value="">Seleccionar resultado</option>{resultOptions.map((result) => <option key={result}>{result}</option>)}</select><button type="button" disabled={!entry.resultado || entry.resultadoGuardado || savingResultId === entry.id} onClick={() => void saveResult(entry)} className="competition-tool-button min-w-40 justify-center border-emerald-300/25 bg-emerald-500/10">{savingResultId === entry.id ? <Loader2 className="animate-spin" /> : entry.resultadoGuardado ? <Check /> : <Trophy />}{entry.resultadoGuardado ? "Guardado" : "Guardar resultado"}</button></div>}</article>; })}</div> : <EmptyTeam onGo={() => setView("pasaportes")} />}
        </section>
      )}

      {presentation && (
        <CompetitionPresentation session={session} athletes={athletes} wallClock={wallClock} onClose={() => void closePresentation()} />
      )}

      <style jsx global>{`
        .competition-input { height: 2.7rem; width: 100%; border-radius: .85rem; border: 1px solid rgba(255,255,255,.12); background: #07090b; padding: 0 .75rem; color: white; outline: none; }
        .competition-input:focus { border-color: rgba(252,211,77,.55); box-shadow: 0 0 0 3px rgba(245,158,11,.1); }
        .competition-input option { background: #07090b; color: white; }
        .competition-tool-button { display: inline-flex; min-height: 2.55rem; align-items: center; gap: .45rem; border-radius: .8rem; border: 1px solid rgba(255,255,255,.14); background: #080a0c; padding: 0 .75rem; color: white; font-size: .7rem; font-weight: 900; }
        .competition-tool-button:disabled, .status-button:disabled { opacity: .3; }
        .competition-tool-button svg { width: 1rem; height: 1rem; }
        .status-button { display: grid; height: 2.7rem; width: 2.7rem; place-items: center; border-radius: .85rem; border: 1px solid rgba(255,255,255,.14); background: rgba(0,0,0,.25); color: white; }
      `}</style>
    </main>
  );
}

function PassportCard({ athlete, inTeam, onAdd }: { athlete: CompetitionAthlete; inTeam: boolean; onAdd: () => void }) {
  const readiness = passportReadiness(athlete);
  const difference = weightDifference(athlete);
  const remainingDays = daysUntil(athlete.fechaCompetencia);
  return <article className="overflow-hidden rounded-[28px] border border-white/10 bg-[#090b0d] shadow-2xl"><div className="relative bg-gradient-to-br from-amber-500/20 via-[#11110d] to-black p-5 md:p-7"><div className="flex items-start gap-4"><AthletePhoto athlete={athlete} className="h-24 w-24 rounded-[24px] md:h-32 md:w-32" /><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">Pasaporte deportivo · ALB-{athlete.id.slice(0, 6).toUpperCase()}</p><h2 className="mt-1 truncate text-2xl font-black uppercase md:text-4xl">{athlete.nombre}</h2><p className="mt-1 text-sm text-white/70">{athlete.disciplina || "Sin disciplina"} · {athlete.grado || "Sin grado"}</p><button type="button" onClick={onAdd} className="competition-tool-button mt-4 border-amber-300/25 bg-amber-500/10">{inTeam ? <Check /> : <UserPlus />}{inTeam ? "Ya está en el equipo" : "Agregar al equipo"}</button></div></div></div><div className="grid gap-4 p-5 md:grid-cols-3 md:p-7"><Metric icon={Weight} label="Peso" value={athlete.pesoActual ? `${athlete.pesoActual} kg` : "Pendiente"} detail={difference === null ? "Sin peso objetivo" : difference === 0 ? "En objetivo" : `${difference > 0 ? "+" : ""}${difference} kg del objetivo`} /><Metric icon={Medal} label="Categoría" value={athlete.categoriaDeportiva || "Pendiente"} detail={athlete.objetivo || "Sin objetivo registrado"} /><Metric icon={CalendarDays} label="Próximo evento" value={athlete.proximaCompetencia || "Pendiente"} detail={remainingDays === null ? "Sin fecha" : remainingDays < 0 ? "Fecha vencida" : remainingDays === 0 ? "Hoy" : `Faltan ${remainingDays} días`} /></div><div className="grid gap-5 border-t border-white/10 p-5 md:grid-cols-[1fr_1.3fr] md:p-7"><div><div className="mb-2 flex justify-between text-xs font-black uppercase"><span>Pasaporte completo</span><span className="text-amber-300">{readiness.score}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${progressColor(readiness.score)}`} style={{ width: `${readiness.score}%` }} /></div><div className="mt-3 grid grid-cols-2 gap-2">{readiness.checks.map((check) => <div key={check.label} className={`flex items-center gap-2 rounded-xl border p-2 text-[10px] font-bold ${check.ready ? "border-emerald-300/15 bg-emerald-500/[.07] text-emerald-100" : "border-amber-300/15 bg-amber-500/[.07] text-amber-100"}`}><span>{check.ready ? "✓" : "•"}</span>{check.label}</div>)}</div></div><div><p className="mb-2 text-xs font-black uppercase">Resultados recientes</p>{athlete.resultadosCompetencias.length ? <div className="space-y-2">{athlete.resultadosCompetencias.slice(-4).reverse().map((result, index) => <div key={`${result.fecha}-${result.evento}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3"><div className="min-w-0"><strong className="block truncate text-sm">{result.evento}</strong><span className="text-[10px] text-white/70">{result.fecha}</span></div><span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-200">{result.resultado}</span></div>)}</div> : <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-white/10 text-center text-xs text-white/70">Todavía no hay resultados registrados.</div>}</div></div></article>;
}

function CompetitionPresentation({ session, athletes, wallClock, onClose }: { session: CompetitionSession; athletes: CompetitionAthlete[]; wallClock: string; onClose: () => void }) {
  const priority: CompetitionStatus[] = ["combatiendo", "llamado", "calentamiento", "preparacion", "finalizado"];
  const entries = [...session.entries].sort((a, b) => priority.indexOf(a.status) - priority.indexOf(b.status));
  return <div className="fixed inset-0 z-[100] overflow-auto bg-black p-4 text-white md:p-8"><header className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">{session.venue || "Competencia"}</p><h2 className="truncate text-2xl font-black uppercase md:text-5xl">{session.eventName}</h2></div><div className="rounded-2xl border border-white/15 bg-white/[.06] px-5 py-2 text-center"><span className="block text-[9px] font-black uppercase tracking-wider text-white/70">Hora local</span><strong className="font-mono text-2xl tabular-nums md:text-4xl">{wallClock}</strong></div><button type="button" onClick={onClose} className="ml-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/10"><X /></button></header><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{entries.map((entry) => { const athlete = athletes.find((item) => item.id === entry.athleteId); if (!athlete) return null; return <article key={entry.id} className={`rounded-[28px] border p-5 ${statusColors[entry.status]}`}><div className="mb-4 flex items-center justify-between gap-3"><span className="text-xs font-black uppercase tracking-wider">{COMPETITION_STATUS_LABELS[entry.status]}</span><span className="text-xs font-black">Tatami {entry.tatami || "?"}</span></div><div className="flex items-center gap-4"><AthletePhoto athlete={athlete} className="h-24 w-24 rounded-[24px]" /><div className="min-w-0"><h3 className="truncate text-2xl font-black uppercase">{athlete.nombre}</h3><p className="text-sm opacity-65">{entry.categoria || "Sin categoría"}</p>{entry.horaEstimada && <p className="mt-2 font-mono text-lg font-black">{entry.horaEstimada}</p>}</div></div></article>; })}</div></div>;
}

function AthletePhoto({ athlete, className }: { athlete: CompetitionAthlete; className: string }) {
  return <div className={`relative shrink-0 overflow-hidden border border-white/10 bg-white/[.06] ${className}`}>{athlete.fotoUrl ? <Image src={athlete.fotoUrl} alt={`Foto de ${athlete.nombre}`} fill sizes="160px" unoptimized className="object-cover" /> : <div className="grid h-full place-items-center text-white/70"><UserRound className="h-1/3 w-1/3" /></div>}</div>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Weight; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><Icon className="mb-3 h-5 w-5 text-amber-300" /><p className="text-[9px] font-black uppercase tracking-wider text-white/70">{label}</p><strong className="mt-1 block truncate">{value}</strong><span className="mt-1 block truncate text-[10px] text-white/70">{detail}</span></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-white/70">{label}</span>{children}</label>;
}

function EmptyTeam({ onGo }: { onGo: () => void }) {
  return <div className="grid min-h-[480px] place-items-center rounded-[26px] border border-dashed border-white/10 bg-[#090b0d] p-8 text-center"><div><ClipboardCheck className="mx-auto mb-4 h-12 w-12 text-white/70" /><h2 className="text-xl font-black uppercase">El equipo está vacío</h2><p className="mx-auto mt-2 max-w-sm text-sm text-white/70">Agrega atletas desde sus pasaportes para preparar el evento.</p><button type="button" onClick={onGo} className="mt-5 rounded-2xl bg-amber-400 px-5 py-3 font-black text-amber-950">Ver pasaportes</button></div></div>;
}
