"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Presentation,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Shuffle,
  SlidersHorizontal,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

import { useFirestore } from "@/firebase";
import {
  assessPair,
  calculateAge,
  estimateLevel,
  generateSparringRounds,
  normalizeDiscipline,
  type SparringAthlete,
  type SparringConfig,
  type SparringIntensity,
  type SparringRound,
} from "@/lib/sparring-matcher";

type AthleteDocument = {
  nombre?: string;
  fotoUrl?: string;
  imagenUrl?: string;
  disciplina?: string;
  grado?: string;
  pesoActual?: number;
  fechaNacimiento?: string;
  activo?: boolean;
  emergencia?: { fechaNacimiento?: string };
};

type SwapSlot = {
  roundIndex: number;
  pairIndex: number;
  side: "a" | "b";
};

const levelLabels = ["", "Inicial", "Básico", "Intermedio", "Avanzado", "Experto"];
const intensityLabels: Record<SparringIntensity, string> = {
  1: "Suave",
  2: "Moderada",
  3: "Alta",
};

function scoreColor(score: number) {
  if (score >= 85) return "border-emerald-300/35 bg-emerald-500/15 text-emerald-200";
  if (score >= 70) return "border-amber-300/35 bg-amber-500/15 text-amber-200";
  return "border-red-300/35 bg-red-500/15 text-red-200";
}

export default function SparringMatcherPage() {
  const firestore = useFirestore();
  const [site, setSite] = useState("MMA");
  const [athletes, setAthletes] = useState<SparringAthlete[]>([]);
  const [presentIds, setPresentIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("Todas");

  const [roundCount, setRoundCount] = useState(3);
  const [roundMinutes, setRoundMinutes] = useState(5);
  const [config, setConfig] = useState<SparringConfig>({
    mismaDisciplina: true,
    separarMenores: true,
    pesoEstricto: true,
    diferenciaPesoMaxima: 8,
    diferenciaNivelMaxima: 1,
    evitarRepeticiones: true,
  });
  const [rounds, setRounds] = useState<SparringRound[]>([]);
  const [activeRound, setActiveRound] = useState(0);
  const [swapSlot, setSwapSlot] = useState<SwapSlot | null>(null);
  const [copied, setCopied] = useState(false);
  const [presentation, setPresentation] = useState(false);

  useEffect(() => {
    setSite(localStorage.getItem("userSede") || "MMA");
  }, []);

  const load = useCallback(async () => {
    if (!firestore || !site) return;
    setLoading(true);
    setError("");
    try {
      const [athleteSnapshot, activeClassSnapshot] = await Promise.all([
        getDocs(query(collection(firestore, "Alumnos"), where("sede", "==", site))),
        getDoc(doc(firestore, "ClasesActivas", site)),
      ]);
      const loaded = athleteSnapshot.docs
        .filter((record) => (record.data() as AthleteDocument).activo !== false)
        .map((record) => {
          const data = record.data() as AthleteDocument;
          const birthDate = data.fechaNacimiento || data.emergencia?.fechaNacimiento;
          return {
            id: record.id,
            nombre: String(data.nombre || "Atleta"),
            fotoUrl: String(data.fotoUrl || data.imagenUrl || ""),
            disciplina: String(data.disciplina || "Sin disciplina"),
            grado: String(data.grado || "Sin grado"),
            peso: Number(data.pesoActual) > 0 ? Number(data.pesoActual) : null,
            edad: calculateAge(birthDate),
            nivel: estimateLevel(String(data.grado || "")),
            intensidad: 2 as SparringIntensity,
            soloTecnico: false,
          };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      setAthletes(loaded);

      if (activeClassSnapshot.exists()) {
        const classId = String(activeClassSnapshot.data().claseId || "");
        if (classId) {
          const attendanceSnapshot = await getDocs(
            query(collection(firestore, "AsistenciasClase"), where("claseId", "==", classId)),
          );
          setPresentIds(
            [...new Set(attendanceSnapshot.docs.map((record) => String(record.data().alumnoId || "")).filter(Boolean))],
          );
        } else {
          setPresentIds([]);
        }
      } else {
        setPresentIds([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los atletas.");
    } finally {
      setLoading(false);
    }
  }, [firestore, site]);

  useEffect(() => {
    void load();
  }, [load]);

  const disciplines = useMemo(
    () => ["Todas", ...new Set(athletes.map((athlete) => normalizeDiscipline(athlete.disciplina)))],
    [athletes],
  );

  const visibleAthletes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return athletes.filter((athlete) => {
      const disciplineMatches =
        disciplineFilter === "Todas" || normalizeDiscipline(athlete.disciplina) === disciplineFilter;
      const searchMatches =
        !term ||
        `${athlete.nombre} ${athlete.disciplina} ${athlete.grado}`.toLocaleLowerCase("es").includes(term);
      return disciplineMatches && searchMatches;
    });
  }, [athletes, disciplineFilter, search]);

  const selectedAthletes = useMemo(
    () => athletes.filter((athlete) => selectedIds.includes(athlete.id)),
    [athletes, selectedIds],
  );

  const currentRound = rounds[activeRound] || null;

  const toggleAthlete = (id: string) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
    setRounds([]);
  };

  const updateAthlete = <K extends keyof SparringAthlete>(
    id: string,
    field: K,
    value: SparringAthlete[K],
  ) => {
    setAthletes((current) =>
      current.map((athlete) => (athlete.id === id ? { ...athlete, [field]: value } : athlete)),
    );
    setRounds([]);
  };

  const generate = () => {
    setError("");
    if (selectedAthletes.length < 2) {
      setError("Selecciona por lo menos dos atletas presentes.");
      return;
    }
    const next = generateSparringRounds(selectedAthletes, config, roundCount);
    setRounds(next);
    setActiveRound(0);
    setSwapSlot(null);
  };

  const selectPresent = () => {
    const valid = presentIds.filter((id) => athletes.some((athlete) => athlete.id === id));
    setSelectedIds(valid);
    setRounds([]);
    if (!valid.length) setError("La clase activa todavía no tiene atletas registrados.");
  };

  const selectVisible = () => {
    const visibleIds = visibleAthletes.map((athlete) => athlete.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((ids) =>
      allSelected ? ids.filter((id) => !visibleIds.includes(id)) : [...new Set([...ids, ...visibleIds])],
    );
    setRounds([]);
  };

  const chooseSwapSlot = (slot: SwapSlot) => {
    if (!swapSlot) {
      setSwapSlot(slot);
      return;
    }
    if (
      swapSlot.roundIndex === slot.roundIndex &&
      swapSlot.pairIndex === slot.pairIndex &&
      swapSlot.side === slot.side
    ) {
      setSwapSlot(null);
      return;
    }
    if (swapSlot.roundIndex !== slot.roundIndex) {
      setError("Solo puedes intercambiar atletas dentro de la misma ronda.");
      setSwapSlot(null);
      return;
    }

    setRounds((current) => {
      const next = current.map((round) => ({
        ...round,
        pairs: round.pairs.map((pair) => ({ ...pair, reasons: [...pair.reasons], warnings: [...pair.warnings] })),
        unmatched: [...round.unmatched],
      }));
      const firstPair = next[swapSlot.roundIndex]?.pairs[swapSlot.pairIndex];
      const secondPair = next[slot.roundIndex]?.pairs[slot.pairIndex];
      if (!firstPair || !secondPair) return current;
      const firstAthlete = swapSlot.side === "a" ? firstPair.atletaA : firstPair.atletaB;
      const secondAthlete = slot.side === "a" ? secondPair.atletaA : secondPair.atletaB;
      if (swapSlot.side === "a") firstPair.atletaA = secondAthlete;
      else firstPair.atletaB = secondAthlete;
      if (slot.side === "a") secondPair.atletaA = firstAthlete;
      else secondPair.atletaB = firstAthlete;

      const affected = new Set([swapSlot.pairIndex, slot.pairIndex]);
      affected.forEach((pairIndex) => {
        const pair = next[slot.roundIndex].pairs[pairIndex];
        Object.assign(pair, assessPair(pair.atletaA, pair.atletaB, { ...config, pesoEstricto: false }, new Set()));
      });
      const round = next[slot.roundIndex];
      round.averageScore = round.pairs.length
        ? Math.round(round.pairs.reduce((total, pair) => total + pair.score, 0) / round.pairs.length)
        : 0;
      return next;
    });
    setSwapSlot(null);
    setError("");
  };

  const copyRounds = async () => {
    if (!rounds.length) return;
    const text = rounds
      .map((round) => [
        `RONDA ${round.number} · ${roundMinutes} MIN`,
        ...round.pairs.map(
          (pair, index) =>
            `${index + 1}. ${pair.atletaA.nombre} × ${pair.atletaB.nombre} · ${pair.technical ? "TÉCNICO" : "NORMAL"} · ${pair.score}%`,
        ),
        ...(round.unmatched.length
          ? [`Sin pareja: ${round.unmatched.map((athlete) => athlete.nombre).join(", ")}`]
          : []),
      ].join("\n"))
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const openPresentation = async () => {
    setPresentation(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // La presentación permanece visible aunque el navegador rechace fullscreen.
    }
  };

  const closePresentation = async () => {
    setPresentation(false);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  };

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 text-white md:p-8">
      <header className="rounded-[28px] border border-white/10 bg-gradient-to-br from-[#11171a] to-[#050607] p-5 shadow-2xl md:p-7">
        <div className="flex items-center gap-2 text-cyan-300">
          <Shuffle className="h-5 w-5" />
          <span className="text-xs font-black uppercase tracking-[.24em]">Seguridad y variedad</span>
        </div>
        <h1 className="mt-2 text-3xl font-black uppercase md:text-5xl">Emparejador de sparring</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/65 md:text-base">
          Crea rondas equilibradas, evita repetir compañeros y conserva siempre la decisión final del entrenador.
        </p>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-950/40 p-4 text-red-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          <p className="flex-1 text-sm font-bold">{error}</p>
          <button type="button" onClick={() => setError("")} aria-label="Cerrar aviso"><X /></button>
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[350px_1fr]">
        <aside className="space-y-4 rounded-[26px] border border-white/10 bg-[#090b0d] p-5 shadow-xl">
          <div className="flex items-center gap-3"><SlidersHorizontal className="text-cyan-300" /><div><h2 className="font-black uppercase">Reglas de emparejamiento</h2><p className="text-xs text-white/45">Configuración de esta sesión</p></div></div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rondas"><input type="number" min="1" max="8" value={roundCount} onChange={(event) => setRoundCount(Number(event.target.value))} className="match-input" /></Field>
            <Field label="Minutos"><input type="number" min="1" max="20" value={roundMinutes} onChange={(event) => setRoundMinutes(Number(event.target.value))} className="match-input" /></Field>
            <Field label="Máx. diferencia kg"><input type="number" min="1" max="40" step="0.5" value={config.diferenciaPesoMaxima} onChange={(event) => setConfig((value) => ({ ...value, diferenciaPesoMaxima: Number(event.target.value) }))} className="match-input" /></Field>
            <Field label="Máx. diferencia nivel"><select value={config.diferenciaNivelMaxima} onChange={(event) => setConfig((value) => ({ ...value, diferenciaNivelMaxima: Number(event.target.value) }))} className="match-input">{[0, 1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
          </div>
          <div className="space-y-2">
            <Toggle checked={config.mismaDisciplina} onChange={(checked) => setConfig((value) => ({ ...value, mismaDisciplina: checked }))} label="Misma disciplina" detail="Impide cruces entre modalidades" />
            <Toggle checked={config.pesoEstricto} onChange={(checked) => setConfig((value) => ({ ...value, pesoEstricto: checked }))} label="Margen de peso obligatorio" detail="Deja fuera parejas que lo superan" />
            <Toggle checked={config.separarMenores} onChange={(checked) => setConfig((value) => ({ ...value, separarMenores: checked }))} label="Separar menores y adultos" detail="Funciona cuando la edad está registrada" />
            <Toggle checked={config.evitarRepeticiones} onChange={(checked) => setConfig((value) => ({ ...value, evitarRepeticiones: checked }))} label="Evitar repeticiones" detail="Penaliza compañeros de rondas previas" />
          </div>
          <button type="button" disabled={selectedAthletes.length < 2} onClick={generate} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 font-black text-[#031014] transition hover:bg-cyan-300 disabled:opacity-40"><Shuffle /> Generar {roundCount} {roundCount === 1 ? "ronda" : "rondas"}</button>
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-500/[.07] p-3 text-xs leading-relaxed text-cyan-100/70"><ShieldCheck className="mb-2 h-5 w-5 text-cyan-300" />El porcentaje indica compatibilidad, no garantiza seguridad. El entrenador debe revisar experiencia, lesiones y conducta antes de iniciar.</div>
        </aside>

        <div className="rounded-[26px] border border-white/10 bg-[#090b0d] p-4 shadow-xl md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">Sede {site}</p><h2 className="text-xl font-black uppercase">Atletas de la sesión</h2><p className="text-xs text-white/45">{selectedAthletes.length} seleccionados · {presentIds.length} registrados en clase activa</p></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!presentIds.length} onClick={selectPresent} className="match-tool-button"><Check /> Usar presentes</button>
              <button type="button" onClick={selectVisible} className="match-tool-button"><Users /> Seleccionar visibles</button>
              <button type="button" onClick={() => void load()} className="match-tool-button"><RefreshCw /> Actualizar</button>
            </div>
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_210px]">
            <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar atleta, disciplina o grado…" className="match-input pl-9" /></label>
            <select value={disciplineFilter} onChange={(event) => setDisciplineFilter(event.target.value)} className="match-input">{disciplines.map((value) => <option key={value}>{value}</option>)}</select>
          </div>

          {loading ? (
            <div className="grid min-h-80 place-items-center text-center font-black text-white/60"><div><Loader2 className="mx-auto mb-3 animate-spin text-cyan-300" />Cargando atletas…</div></div>
          ) : (
            <div className="grid max-h-[520px] grid-cols-2 gap-3 overflow-auto pr-1 md:grid-cols-3 lg:grid-cols-4">
              {visibleAthletes.map((athlete) => {
                const selected = selectedIds.includes(athlete.id);
                const present = presentIds.includes(athlete.id);
                return (
                  <button key={athlete.id} type="button" aria-pressed={selected} onClick={() => toggleAthlete(athlete.id)} className={`relative overflow-hidden rounded-2xl border p-2 text-left text-white transition ${selected ? "border-cyan-300/60 bg-cyan-500/15 ring-2 ring-cyan-400/30" : "border-white/10 bg-black/25 hover:border-white/25"}`}>
                    <AthletePhoto athlete={athlete} className="mb-2 aspect-square w-full rounded-xl" />
                    <strong className="block truncate text-sm">{athlete.nombre}</strong>
                    <p className="truncate text-[10px] text-white/50">{normalizeDiscipline(athlete.disciplina)} · {athlete.grado}</p>
                    <p className="mt-1 text-[10px] font-bold text-white/65">{athlete.peso ? `${athlete.peso} kg` : "Sin peso"} · {athlete.edad ? `${athlete.edad} años` : "Sin edad"}</p>
                    {present && <span className="absolute right-3 top-3 rounded-full bg-emerald-400 px-2 py-1 text-[8px] font-black uppercase text-emerald-950">Presente</span>}
                    {selected && <span className="absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-cyan-400 text-cyan-950"><Check className="h-4 w-4" /></span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedAthletes.length > 0 && (
        <section className="rounded-[26px] border border-white/10 bg-[#090b0d] p-4 md:p-6">
          <div className="mb-4 flex items-center gap-3"><Scale className="text-cyan-300" /><div><h2 className="font-black uppercase">Datos de esta sesión</h2><p className="text-xs text-white/45">Los cambios son temporales y no modifican la ficha del atleta</p></div></div>
          <div className="grid gap-2 lg:grid-cols-2">
            {selectedAthletes.map((athlete) => (
              <article key={athlete.id} className="grid grid-cols-[44px_1fr] gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[44px_1fr_88px_88px_120px_auto] sm:items-end">
                <AthletePhoto athlete={athlete} className="h-11 w-11 rounded-xl" />
                <div className="min-w-0 self-center"><strong className="block truncate text-sm">{athlete.nombre}</strong><p className="truncate text-[10px] text-white/45">{normalizeDiscipline(athlete.disciplina)} · {athlete.grado}</p></div>
                <MiniField label="Peso kg"><input type="number" min="20" max="250" step="0.1" value={athlete.peso ?? ""} onChange={(event) => updateAthlete(athlete.id, "peso", event.target.value ? Number(event.target.value) : null)} className="session-input" /></MiniField>
                <MiniField label="Edad"><input type="number" min="4" max="100" value={athlete.edad ?? ""} onChange={(event) => updateAthlete(athlete.id, "edad", event.target.value ? Number(event.target.value) : null)} className="session-input" /></MiniField>
                <MiniField label="Nivel"><select value={athlete.nivel} onChange={(event) => updateAthlete(athlete.id, "nivel", Number(event.target.value))} className="session-input">{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{levelLabels[value]}</option>)}</select></MiniField>
                <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto sm:self-center">
                  <select value={athlete.intensidad} onChange={(event) => updateAthlete(athlete.id, "intensidad", Number(event.target.value) as SparringIntensity)} className="session-input min-w-28">{([1, 2, 3] as SparringIntensity[]).map((value) => <option key={value} value={value}>{intensityLabels[value]}</option>)}</select>
                  <button type="button" onClick={() => updateAthlete(athlete.id, "soloTecnico", !athlete.soloTecnico)} className={`rounded-xl border px-3 py-2 text-[10px] font-black text-white ${athlete.soloTecnico ? "border-violet-300/40 bg-violet-500/20" : "border-white/10 bg-white/[.04]"}`}>{athlete.soloTecnico ? "Solo técnico" : "Contacto normal"}</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {rounds.length > 0 && currentRound && (
        <section className="rounded-[28px] border border-white/10 bg-[#060809] p-4 shadow-2xl md:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">Resultados · {roundMinutes} minutos por round</p><h2 className="text-2xl font-black uppercase">Rondas de sparring</h2><p className="text-xs text-white/45">Selecciona dos atletas para intercambiarlos manualmente.</p></div>
            <div className="flex gap-2"><button type="button" onClick={() => void copyRounds()} className="match-tool-button">{copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}</button><button type="button" onClick={() => void openPresentation()} className="match-tool-button border-cyan-300/25 bg-cyan-500/10"><Presentation /> Presentar</button></div>
          </div>
          <div className="mb-5 flex gap-2 overflow-auto pb-1">
            {rounds.map((round, index) => <button key={round.number} type="button" onClick={() => { setActiveRound(index); setSwapSlot(null); }} className={`min-w-28 rounded-2xl border px-4 py-3 text-left text-white ${activeRound === index ? "border-cyan-300/45 bg-cyan-500/15" : "border-white/10 bg-white/[.03]"}`}><span className="block text-xs font-black uppercase">Ronda {round.number}</span><span className="text-[10px] text-white/45">{round.averageScore}% promedio</span></button>)}
          </div>
          {swapSlot && <div className="mb-4 flex items-center gap-2 rounded-xl border border-violet-300/25 bg-violet-500/10 p-3 text-xs font-bold text-violet-100"><Shuffle className="h-4 w-4" />Ahora selecciona otro atleta de esta ronda para intercambiarlo.<button type="button" onClick={() => setSwapSlot(null)} className="ml-auto"><X className="h-4 w-4" /></button></div>}
          <div className="grid gap-4 lg:grid-cols-2">
            {currentRound.pairs.map((pair, pairIndex) => (
              <article key={pair.id} className="rounded-[24px] border border-white/10 bg-[#0b0e10] p-3 md:p-4">
                <div className="mb-3 flex items-center justify-between gap-3"><span className="text-[10px] font-black uppercase tracking-[.16em] text-white/40">Tatami {pairIndex + 1} · {pair.technical ? "Round técnico" : "Contacto acordado"}</span><span className={`rounded-full border px-3 py-1 text-xs font-black ${scoreColor(pair.score)}`}>{pair.score}%</span></div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <PairAthlete athlete={pair.atletaA} selected={swapSlot?.roundIndex === activeRound && swapSlot.pairIndex === pairIndex && swapSlot.side === "a"} onClick={() => chooseSwapSlot({ roundIndex: activeRound, pairIndex, side: "a" })} />
                  <span className="text-xs font-black text-white/30">VS</span>
                  <PairAthlete athlete={pair.atletaB} selected={swapSlot?.roundIndex === activeRound && swapSlot.pairIndex === pairIndex && swapSlot.side === "b"} onClick={() => chooseSwapSlot({ roundIndex: activeRound, pairIndex, side: "b" })} />
                </div>
                <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-2">
                  <ul className="space-y-1 text-[10px] text-emerald-100/70">{pair.reasons.slice(0, 4).map((reason) => <li key={reason}>✓ {reason}</li>)}</ul>
                  {pair.warnings.length > 0 && <ul className="space-y-1 text-[10px] text-amber-100/75">{pair.warnings.map((warning) => <li key={warning}>⚠ {warning}</li>)}</ul>}
                </div>
              </article>
            ))}
          </div>
          {currentRound.unmatched.length > 0 && <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4 text-amber-100"><p className="text-xs font-black uppercase">Sin pareja compatible en esta ronda</p><p className="mt-1 text-sm">{currentRound.unmatched.map((athlete) => athlete.nombre).join(", ")}</p></div>}
        </section>
      )}

      {presentation && currentRound && (
        <div className="fixed inset-0 z-[100] overflow-auto bg-black p-4 text-white md:p-8">
          <header className="mb-6 flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.22em] text-cyan-300">Sparring · {roundMinutes} minutos</p><h2 className="text-4xl font-black uppercase md:text-6xl">Ronda {currentRound.number}</h2></div><button type="button" onClick={() => void closePresentation()} className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/10 text-white"><X /></button></header>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {currentRound.pairs.map((pair, index) => <div key={pair.id} className="rounded-[28px] border border-white/15 bg-gradient-to-br from-[#101a1e] to-[#050607] p-5"><div className="mb-4 flex justify-between text-xs font-black uppercase text-white/45"><span>Tatami {index + 1}</span><span className={pair.technical ? "text-violet-300" : "text-emerald-300"}>{pair.technical ? "Técnico" : `${pair.score}%`}</span></div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><PresentedAthlete athlete={pair.atletaA} /><strong className="text-white/30">VS</strong><PresentedAthlete athlete={pair.atletaB} /></div></div>)}
          </div>
        </div>
      )}

      <style jsx global>{`
        .match-input, .session-input { height: 2.65rem; width: 100%; border-radius: .85rem; border: 1px solid rgba(255,255,255,.12); background: #07090b; padding: 0 .75rem; color: white; outline: none; }
        .match-input:focus, .session-input:focus { border-color: rgba(103,232,249,.55); box-shadow: 0 0 0 3px rgba(6,182,212,.1); }
        .match-input option, .session-input option { background: #07090b; color: white; }
        .match-tool-button { display: inline-flex; min-height: 2.55rem; align-items: center; gap: .45rem; border-radius: .8rem; border: 1px solid rgba(255,255,255,.14); background: #080a0c; padding: 0 .75rem; color: white; font-size: .7rem; font-weight: 900; }
        .match-tool-button:disabled { opacity: .35; }
        .match-tool-button svg { width: 1rem; height: 1rem; }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-white/40">{label}</span>{children}</label>;
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[8px] font-black uppercase text-white/35">{label}</span>{children}</label>;
}

function Toggle({ checked, onChange, label, detail }: { checked: boolean; onChange: (value: boolean) => void; label: string; detail: string }) {
  return <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-white transition ${checked ? "border-cyan-300/25 bg-cyan-500/[.09]" : "border-white/10 bg-black/20"}`}><span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-cyan-400" : "bg-white/15"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? "left-6" : "left-1"}`} /></span><span><strong className="block text-xs">{label}</strong><span className="text-[10px] text-white/45">{detail}</span></span></button>;
}

function AthletePhoto({ athlete, className }: { athlete: SparringAthlete; className: string }) {
  return <div className={`relative overflow-hidden border border-white/10 bg-white/[.06] ${className}`}>{athlete.fotoUrl ? <Image src={athlete.fotoUrl} alt={`Foto de ${athlete.nombre}`} fill sizes="180px" unoptimized className="object-cover" /> : <div className="grid h-full place-items-center text-white/35"><UserRound className="h-1/3 w-1/3" /></div>}</div>;
}

function PairAthlete({ athlete, selected, onClick }: { athlete: SparringAthlete; selected: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`min-w-0 rounded-2xl border p-2 text-center text-white transition ${selected ? "border-violet-300 bg-violet-500/20 ring-2 ring-violet-300/30" : "border-white/10 bg-black/25 hover:border-cyan-300/30"}`}><AthletePhoto athlete={athlete} className="mx-auto mb-2 h-16 w-16 rounded-2xl" /><strong className="block truncate text-sm">{athlete.nombre}</strong><span className="text-[10px] text-white/50">{athlete.peso ? `${athlete.peso} kg` : "Sin peso"} · Nv. {athlete.nivel}</span></button>;
}

function PresentedAthlete({ athlete }: { athlete: SparringAthlete }) {
  return <div className="min-w-0"><AthletePhoto athlete={athlete} className="mx-auto mb-3 h-[clamp(5rem,10vw,9rem)] w-[clamp(5rem,10vw,9rem)] rounded-[24px]" /><h3 className="truncate text-[clamp(1rem,2.2vw,2rem)] font-black uppercase">{athlete.nombre}</h3><p className="text-xs text-white/50">{athlete.peso ? `${athlete.peso} kg` : "Sin peso"} · {levelLabels[athlete.nivel]}</p></div>;
}
