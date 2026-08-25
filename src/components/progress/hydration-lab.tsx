"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, runTransaction } from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  Beaker,
  Check,
  ClipboardCheck,
  CloudSun,
  Droplets,
  Gauge,
  History,
  Info,
  Save,
  ShieldCheck,
  ThermometerSun,
  Trash2,
  TrendingUp,
  Weight,
  type LucideIcon,
} from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import {
  calculateHydration,
  type HydrationResult,
  type HydrationSession,
  type HydrationStatus,
} from "@/lib/hydration";

type Athlete = { id: string; nombre: string; historialHidratacion?: HydrationSession[] };
type Form = Record<string, string>;
type View = "capture" | "report" | "history";
type ProtocolKey = "sameScale" | "dryBody" | "sameClothes" | "allFluids";

const protocolLabels: Record<ProtocolKey, string> = {
  sameScale: "Misma báscula y superficie",
  dryBody: "Piel seca antes del peso final",
  sameClothes: "Misma ropa seca o sin ropa",
  allFluids: "Toda bebida y orina contabilizadas",
};

const urineColors = ["#fff7ae", "#f5e36d", "#e6cc3d", "#d4aa28", "#b98521", "#986222", "#754325", "#563126"];
const newHydrationForm = (): Form => ({
  fecha: new Date().toISOString().slice(0, 10),
  duracionMin: "60",
  ingestaMl: "500",
  orinaMl: "0",
  ambiente: "interior",
  intensidad: "moderada",
  ropa: "uniforme",
  bebida: "agua",
  esfuerzoRpe: "6",
  sedAntes: "3",
  colorOrina: "3",
});
const newProtocol = (): Record<ProtocolKey, boolean> => ({ sameScale: false, dryBody: false, sameClothes: false, allFluids: false });
const contextKey = (value: Pick<HydrationSession, "ambiente" | "intensidad" | "ropa"> | Form) => `${value.ambiente || "sin-ambiente"}|${value.intensidad || "sin-intensidad"}|${value.ropa || "sin-ropa"}`;

const statusCopy: Record<HydrationStatus, { label: string; detail: string; color: string }> = {
  stable: { label: "Balance controlado", detail: "La variación neta permaneció por debajo de 1%.", color: "#2dd4bf" },
  attention: { label: "Atención preventiva", detail: "La pérdida neta quedó entre 1% y menos de 2%.", color: "#fbbf24" },
  high: { label: "Pérdida elevada", detail: "La pérdida neta alcanzó 2% o más.", color: "#fb7185" },
  gain: { label: "Ganancia de masa", detail: "Puede indicar una ingesta superior a las pérdidas.", color: "#c084fc" },
};

export function HydrationLab({ athletes }: { athletes: Athlete[] }) {
  const db = useFirestore();
  const { user } = useUser();
  const [selectedId, setSelectedId] = useState(athletes[0]?.id || "");
  const [view, setView] = useState<View>("capture");
  const [saved, setSaved] = useState<Record<string, HydrationSession[]>>({});
  const [form, setForm] = useState<Form>(() => newHydrationForm());
  const [protocol, setProtocol] = useState<Record<ProtocolKey, boolean>>(() => newProtocol());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!selectedId && athletes[0]?.id) setSelectedId(athletes[0].id);
  }, [athletes, selectedId]);

  useEffect(() => {
    setForm(newHydrationForm());
    setProtocol(newProtocol());
    setView("capture");
    setMessage("");
  }, [selectedId]);

  const update = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
  };

  const calculation = useMemo(() => {
    try {
      return {
        result: calculateHydration({
          durationMin: Number(form.duracionMin),
          preKg: Number(form.pesoAntesKg),
          postKg: Number(form.pesoDespuesKg),
          intakeMl: Number(form.ingestaMl),
          urineMl: Number(form.orinaMl || 0),
        }),
        error: "",
      };
    } catch (error) {
      return { result: undefined, error: error instanceof Error ? error.message : "Revisa los datos." };
    }
  }, [form]);

  const result = calculation.result;
  const selected = athletes.find((item) => item.id === selectedId);
  const history = saved[selectedId] || selected?.historialHidratacion || [];
  const qualityScore = Math.round((Object.values(protocol).filter(Boolean).length / 4) * 100);
  const profile = buildProfile(history, contextKey(form));

  const save = async () => {
    if (!db || !result || !selected) {
      setMessage("Completa atleta, duración, pesos e ingesta.");
      return;
    }
    if (qualityScore < 75) {
      setMessage("Completa al menos tres controles del protocolo antes de guardar.");
      return;
    }
    if (result.sweatLossL < 0 || result.sweatRateLh > 3) {
      setMessage("El resultado no es fisiológicamente utilizable. Repite pesajes, unidades y registro de líquidos.");
      return;
    }
    const optional = (key: string) => (form[key] ? Number(form[key]) : undefined);
    const temperature = optional("temperaturaC"), humidity = optional("humedadPct"), effort = optional("esfuerzoRpe"), thirst = optional("sedAntes"), urineColor = optional("colorOrina");
    if (temperature !== undefined && (temperature < -20 || temperature > 60)) { setMessage("La temperatura debe estar entre -20 y 60 °C."); return; }
    if (humidity !== undefined && (humidity < 0 || humidity > 100)) { setMessage("La humedad debe estar entre 0 y 100%."); return; }
    if (effort !== undefined && (effort < 0 || effort > 10)) { setMessage("El esfuerzo RPE debe estar entre 0 y 10."); return; }
    if (thirst !== undefined && (thirst < 1 || thirst > 8) || urineColor !== undefined && (urineColor < 1 || urineColor > 8)) { setMessage("Sed y color de orina deben estar entre 1 y 8."); return; }
    const session: HydrationSession = {
      id: crypto.randomUUID(),
      fecha: form.fecha,
      schemaVersion: 2,
      protocolVersion: "balance-hidrico-campo-v2",
      contextKey: contextKey(form),
      duracionMin: Number(form.duracionMin),
      pesoAntesKg: Number(form.pesoAntesKg),
      pesoDespuesKg: Number(form.pesoDespuesKg),
      ingestaMl: Number(form.ingestaMl),
      orinaMl: Number(form.orinaMl || 0) || undefined,
      temperaturaC: temperature,
      humedadPct: humidity,
      ambiente: form.ambiente as HydrationSession["ambiente"],
      intensidad: form.intensidad as HydrationSession["intensidad"],
      ropa: form.ropa as HydrationSession["ropa"],
      bebida: form.bebida as HydrationSession["bebida"],
      esfuerzoRpe: effort,
      sedAntes: thirst,
      colorOrina: urineColor,
      notas: form.notas?.trim() || undefined,
      perdidaSudorL: result.sweatLossL,
      tasaSudorLh: result.sweatRateLh,
      cambioMasaPct: result.massChangePct,
      tasaIngestaLh: result.intakeRateLh,
      reposicionPct: result.replacementPct,
      deficitNetoL: result.netDeficitL,
      calidadProtocolo: qualityScore,
      protocolo: { ...protocol },
      registradoPor: user?.email || "personal",
    };
    setSaving(true);
    try {
      const reference = doc(db, "Alumnos", selected.id);
      const next = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) throw new Error("No se encontró el expediente del atleta.");
        const current = Array.isArray(snapshot.data().historialHidratacion) ? snapshot.data().historialHidratacion as HydrationSession[] : [];
        const updated = [session, ...current].slice(0, 80);
        transaction.update(reference, { historialHidratacion: updated });
        return updated;
      });
      setSaved((current) => ({ ...current, [selected.id]: next }));
      setMessage("Sesión guardada y añadida a la referencia personal.");
      setView("report");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const removeSession = async (id: string) => {
    if (!db || !selected || !window.confirm("¿Eliminar esta medición de hidratación?")) return;
    try {
      const reference = doc(db, "Alumnos", selected.id);
      const updated = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) throw new Error("No se encontró el expediente del atleta.");
        const current = Array.isArray(snapshot.data().historialHidratacion) ? snapshot.data().historialHidratacion as HydrationSession[] : [];
        const filtered = current.filter((item) => item.id !== id);
        transaction.update(reference, { historialHidratacion: filtered });
        return filtered;
      });
      setSaved((current) => ({ ...current, [selected.id]: updated }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar.");
    }
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a1119] shadow-[0_30px_100px_rgba(0,0,0,.38)]">
      <header className="relative overflow-hidden border-b border-white/10 px-5 py-6 md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(45,212,191,.17),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(56,189,248,.13),transparent_32%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.24em] text-teal-300">
              <Beaker className="h-4 w-4" /> Hydration performance lab
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">Perfil hídrico de entrenamiento</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
              Convierte el pesaje de campo en una referencia personal por atleta, clase y ambiente.
            </p>
          </div>
          <label className="min-w-64">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Atleta evaluado</span>
            <select className="input" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              <option value="">Selecciona atleta</option>
              {athletes.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="border-b border-white/10 px-4 py-3 md:px-8">
        <nav className="flex gap-2 overflow-x-auto" aria-label="Secciones del laboratorio">
          <Tab active={view === "capture"} onClick={() => setView("capture")} icon={ClipboardCheck}>1. Captura</Tab>
          <Tab active={view === "report"} onClick={() => setView("report")} icon={Gauge}>2. Informe</Tab>
          <Tab active={view === "history"} onClick={() => setView("history")} icon={History}>3. Historial <span className="ml-1 opacity-60">({history.length})</span></Tab>
        </nav>
      </div>

      <div className="p-4 md:p-8">
        {view === "capture" && (
          <CaptureView
            form={form}
            update={update}
            protocol={protocol}
            setProtocol={setProtocol}
            qualityScore={qualityScore}
            result={result}
            error={calculation.error}
            selected={Boolean(selected)}
            saving={saving}
            message={message}
            onSave={() => void save()}
            onReport={() => setView("report")}
          />
        )}
        {view === "report" && <ReportView result={result} qualityScore={qualityScore} profile={profile} onCapture={() => setView("capture")} />}
        {view === "history" && <HistoryView history={history} profile={profile} onDelete={(id) => void removeSession(id)} />}

        <footer className="mt-7 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs leading-relaxed text-slate-500 md:flex-row md:items-start md:justify-between">
          <p className="max-w-3xl">
            Estimación de campo, no diagnóstico: no mide sodio ni composición exacta del sudor. Repite el protocolo en condiciones similares antes de convertir una sesión en pauta habitual.
          </p>
          <div className="flex shrink-0 gap-3">
            <a className="font-bold text-teal-300 hover:underline" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5634236/" target="_blank" rel="noreferrer">Base NATA</a>
            <a className="font-bold text-teal-300 hover:underline" href="https://pubmed.ncbi.nlm.nih.gov/17277604/" target="_blank" rel="noreferrer">Base ACSM</a>
          </div>
        </footer>
      </div>
    </section>
  );
}

function CaptureView({ form, update, protocol, setProtocol, qualityScore, result, error, selected, saving, message, onSave, onReport }: {
  form: Form;
  update: (key: string, value: string) => void;
  protocol: Record<ProtocolKey, boolean>;
  setProtocol: React.Dispatch<React.SetStateAction<Record<ProtocolKey, boolean>>>;
  qualityScore: number;
  result?: HydrationResult;
  error: string;
  selected: boolean;
  saving: boolean;
  message: string;
  onSave: () => void;
  onReport: () => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <Panel eyebrow="Medición principal" title="Balance de masa de la sesión" icon={Weight}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Peso antes" unit="kg" value={form.pesoAntesKg || ""} set={(value) => update("pesoAntesKg", value)} step="0.05" />
            <Input label="Peso después" unit="kg" value={form.pesoDespuesKg || ""} set={(value) => update("pesoDespuesKg", value)} step="0.05" />
            <Input label="Bebida ingerida" unit="mL" value={form.ingestaMl} set={(value) => update("ingestaMl", value)} step="10" />
            <Input label="Orina durante" unit="mL" value={form.orinaMl} set={(value) => update("orinaMl", value)} step="10" />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Duración" unit="min" value={form.duracionMin} set={(value) => update("duracionMin", value)} step="1" />
            <Input label="Fecha" unit="" value={form.fecha} set={(value) => update("fecha", value)} type="date" />
            <Choice label="Tipo de bebida" value={form.bebida} set={(value) => update("bebida", value)} options={["agua", "electrolitos", "otra"]} />
            <Choice label="Ropa / equipo" value={form.ropa} set={(value) => update("ropa", value)} options={["ligera", "uniforme", "proteccion"]} labels={{ proteccion: "Con protección" }} />
          </div>
        </Panel>

        <Panel eyebrow="Contexto" title="Carga y ambiente" icon={CloudSun}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Temperatura" unit="°C" value={form.temperaturaC || ""} set={(value) => update("temperaturaC", value)} />
            <Input label="Humedad" unit="%" value={form.humedadPct || ""} set={(value) => update("humedadPct", value)} />
            <Choice label="Ambiente" value={form.ambiente} set={(value) => update("ambiente", value)} options={["interior", "exterior"]} />
            <Choice label="Intensidad" value={form.intensidad} set={(value) => update("intensidad", value)} options={["suave", "moderada", "alta"]} />
            <RangeField label="Esfuerzo percibido" value={Number(form.esfuerzoRpe)} min={1} max={10} suffix="/10" set={(value) => update("esfuerzoRpe", String(value))} />
            <RangeField label="Sed antes" value={Number(form.sedAntes)} min={0} max={10} suffix="/10" set={(value) => update("sedAntes", String(value))} />
            <UrineScale value={Number(form.colorOrina)} set={(value) => update("colorOrina", String(value))} />
          </div>
          <textarea className="input mt-5 min-h-20 py-3" placeholder="Notas: pausas, calor, síntomas, cambios de uniforme…" value={form.notas || ""} onChange={(event) => update("notas", event.target.value)} />
        </Panel>
      </div>

      <aside className="space-y-5">
        <div className="rounded-3xl border border-teal-300/15 bg-teal-300/[.05] p-5">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-teal-300">Calidad del protocolo</p><b className="mt-1 block text-3xl">{qualityScore}%</b></div>
            <ScoreRing value={qualityScore} color="#2dd4bf" compact />
          </div>
          <div className="mt-4 space-y-2">
            {(Object.keys(protocolLabels) as ProtocolKey[]).map((key) => (
              <button key={key} type="button" onClick={() => setProtocol((current) => ({ ...current, [key]: !current[key] }))} className="flex w-full items-center gap-3 rounded-xl border border-white/[.07] bg-black/20 p-3 text-left text-xs font-bold text-slate-300">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${protocol[key] ? "border-teal-300 bg-teal-300 text-slate-950" : "border-white/20"}`}>{protocol[key] && <Check className="h-3.5 w-3.5" />}</span>
                {protocolLabels[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[.035] p-5">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Vista previa</p>
          {result ? (
            <>
              <div className="mt-3 flex items-end justify-between"><span className="text-sm text-slate-400">Tasa de sudor</span><b className="text-2xl text-teal-300">{result.sweatRateLh} L/h</b></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-teal-300" style={{ width: `${Math.min(100, Math.max(3, result.controlScore))}%` }} /></div>
              <button type="button" onClick={onReport} className="mt-4 w-full rounded-xl border border-white/10 py-2.5 text-sm font-black hover:bg-white/[.05]">Abrir informe</button>
            </>
          ) : <p className="mt-3 text-sm leading-relaxed text-slate-500">{error || "Completa ambos pesos para obtener la lectura."}</p>}
        </div>

        <button type="button" onClick={onSave} disabled={!result || !selected || saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-300 to-cyan-300 px-5 py-4 font-black text-slate-950 shadow-[0_15px_45px_rgba(45,212,191,.18)] disabled:cursor-not-allowed disabled:opacity-40">
          <Save className="h-4 w-4" />{saving ? "Guardando…" : "Guardar evaluación"}
        </button>
        {message && <p className="rounded-xl border border-sky-300/15 bg-sky-300/[.06] p-3 text-sm text-sky-100">{message}</p>}
      </aside>
    </div>
  );
}

function ReportView({ result, qualityScore, profile, onCapture }: { result?: HydrationResult; qualityScore: number; profile: ReturnType<typeof buildProfile>; onCapture: () => void }) {
  if (!result) return <Empty title="Aún no hay una medición calculable" detail="Captura el peso antes y después, la bebida y la duración para generar el informe." action="Ir a captura" onAction={onCapture} />;
  const status = statusCopy[result.status];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="flex items-center gap-5 rounded-3xl border border-white/10 bg-white/[.035] p-5">
          <ScoreRing value={result.controlScore} color={status.color} />
          <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Control de balance</p><h4 className="mt-1 text-xl font-black" style={{ color: status.color }}>{status.label}</h4><p className="mt-1 text-xs leading-relaxed text-slate-400">{status.detail}</p></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Droplets} label="Sudor estimado" value={`${result.sweatLossL} L`} sub="Balance total de la sesión" />
          <Metric icon={ThermometerSun} label="Tasa observada" value={`${result.sweatRateLh} L/h`} sub="Úsala en condiciones similares" />
          <Metric icon={Weight} label="Cambio corporal" value={`${result.massChangePct}%`} sub={`${result.netMassChangeKg} kg netos`} />
          <Metric icon={Activity} label="Reposición en clase" value={result.replacementPct === null ? "—" : `${result.replacementPct}%`} sub={`${result.intakeRateLh} L/h ingeridos`} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Panel eyebrow="Estrategia individual" title="Plan para una clase similar" icon={ShieldCheck}>
          <div className="grid gap-3 md:grid-cols-3">
            <PlanStep number="01" title="Durante" value={`${result.sweatRateLh} L/h`} detail="Pérdida observada; no es una orden automática de consumo ni debe superarse para ganar peso." />
            <PlanStep number="02" title="Si dura 90 min" value={`${result.projected90MinL} L`} detail="Proyección orientativa si ambiente, ropa e intensidad se mantienen." />
            <PlanStep number="03" title="Después" value={result.netDeficitL > 0 ? `${result.recoveryMinMl}–${result.recoveryMaxMl} mL` : "Sin déficit neto"} detail="Rango de 100–150% del déficit si la recuperación debe completarse en menos de 4 h." />
          </div>
          <div className="mt-4 rounded-2xl border border-teal-300/15 bg-teal-300/[.05] p-4 text-sm leading-relaxed text-slate-300">
            <Info className="mr-2 inline h-4 w-4 text-teal-300" />
            La tasa cambia con clima, intensidad, equipo y aclimatación. Construye referencias separadas y confirma con al menos 3 sesiones comparables.
          </div>
        </Panel>

        <Panel eyebrow="Referencia personal" title="Contra el historial" icon={TrendingUp}>
          {profile.count ? <div className="space-y-4"><Comparison label="Promedio personal" value={`${profile.average} L/h`} /><Comparison label="Sesiones válidas" value={String(profile.count)} /><Comparison label="Variación observada" value={`${profile.min}–${profile.max} L/h`} /><Comparison label="Diferencia actual" value={`${signed(result.sweatRateLh - profile.average)} L/h`} /></div> : <p className="text-sm leading-relaxed text-slate-500">Guarda tres sesiones comparables para formar una referencia personal útil.</p>}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[.03] p-5"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400"><ClipboardCheck className="h-4 w-4 text-teal-300" />Confianza de la lectura</p><div className="mt-4 flex items-center gap-4"><div className="text-4xl font-black">{qualityScore}%</div><p className="text-sm leading-relaxed text-slate-500">{qualityScore >= 75 ? "Protocolo suficientemente consistente para seguimiento de campo." : "Confirma los cuatro controles antes de usar el dato como referencia personal."}</p></div></div>
        <div className="rounded-3xl border border-rose-300/15 bg-rose-300/[.045] p-5"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-rose-200"><AlertTriangle className="h-4 w-4" />Alertas de seguridad</p>{result.warnings.length ? <ul className="mt-3 space-y-2 text-sm text-rose-100">{result.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul> : <p className="mt-3 text-sm text-slate-400">Sin alertas matemáticas en esta medición. Aun así, vigila síntomas y condiciones ambientales.</p>}</div>
      </div>
    </div>
  );
}

function HistoryView({ history, profile, onDelete }: { history: HydrationSession[]; profile: ReturnType<typeof buildProfile>; onDelete: (id: string) => void }) {
  if (!history.length) return <Empty title="Todavía no hay historial" detail="La primera medición guardada aparecerá aquí y comenzará a construir la referencia personal." />;
  const chart = history.slice(0, 8).reverse();
  const maxRate = Math.max(1, ...chart.map((item) => Math.max(0, item.tasaSudorLh)));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3"><Metric icon={Gauge} label="Media personal" value={`${profile.average} L/h`} sub={`${profile.count} sesiones válidas`} /><Metric icon={TrendingUp} label="Rango observado" value={`${profile.min}–${profile.max}`} sub="L/h en registros guardados" /><Metric icon={ShieldCheck} label="Calidad reciente" value={`${history[0]?.calidadProtocolo ?? "—"}%`} sub="Control del último protocolo" /></div>
      <Panel eyebrow="Tendencia" title="Tasa de sudor por sesión" icon={Activity}>
        <div className="flex h-52 items-end gap-2 border-b border-white/10 px-2 pt-6">
          {chart.map((item) => <div key={item.id} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] font-bold text-slate-400 opacity-0 transition group-hover:opacity-100">{item.tasaSudorLh}</span><div className="w-full max-w-14 rounded-t-lg bg-gradient-to-t from-sky-500 to-teal-300 transition hover:brightness-125" style={{ height: `${Math.max(5, (Math.max(0, item.tasaSudorLh) / maxRate) * 140)}px` }} /><span className="max-w-full truncate text-[9px] text-slate-600">{shortDate(item.fecha)}</span></div>)}
        </div>
      </Panel>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{history.map((item) => <article key={item.id} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4"><div className="flex items-start justify-between gap-3"><div><b>{longDate(item.fecha)}</b><p className="mt-1 text-lg font-black text-teal-300">{item.tasaSudorLh} L/h</p></div><button type="button" onClick={() => onDelete(item.id)} className="rounded-lg p-2 text-slate-600 hover:bg-rose-300/10 hover:text-rose-300" aria-label="Eliminar medición"><Trash2 className="h-4 w-4" /></button></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400"><span>{item.cambioMasaPct}% masa</span><span>{item.ingestaMl} mL bebida</span><span>{item.duracionMin} min</span><span>{item.temperaturaC ? `${item.temperaturaC} °C` : "Sin temperatura"}</span></div></article>)}</div>
    </div>
  );
}

function Panel({ eyebrow, title, icon: Icon, children }: { eyebrow: string; title: string; icon: LucideIcon; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-white/[.08] bg-white/[.025] p-5 md:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.05] text-teal-300"><Icon className="h-5 w-5" /></span><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-slate-600">{eyebrow}</p><h4 className="font-black">{title}</h4></div></div>{children}</section>;
}

function Input({ label, unit, value, set, step = "0.1", type = "number" }: { label: string; unit: string; value: string; set: (value: string) => void; step?: string; type?: "number" | "date" }) {
  return <label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><div className="relative"><input type={type} min={type === "number" ? "0" : undefined} step={step} inputMode={type === "number" ? "decimal" : undefined} value={value} onChange={(event) => set(event.target.value)} className={`input font-black ${unit ? "pr-12" : ""}`} />{unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">{unit}</span>}</div></label>;
}

function Choice({ label, value, set, options, labels = {} }: { label: string; value: string; set: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return <label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><select className="input capitalize" value={value} onChange={(event) => set(event.target.value)}>{options.map((option) => <option key={option} value={option}>{labels[option] || option}</option>)}</select></label>;
}

function RangeField({ label, value, min, max, suffix, set }: { label: string; value: number; min: number; max: number; suffix: string; set: (value: number) => void }) {
  return <label className="rounded-xl border border-white/[.07] bg-black/20 p-3"><span className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500"><span>{label}</span><b className="text-teal-300">{value}{suffix}</b></span><input className="mt-3 w-full accent-teal-300" type="range" min={min} max={max} value={value} onChange={(event) => set(Number(event.target.value))} /></label>;
}

function UrineScale({ value, set }: { value: number; set: (value: number) => void }) {
  return <fieldset className="sm:col-span-2"><legend className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">Color de orina previo · orientativo</legend><div className="flex gap-1.5 rounded-xl border border-white/[.07] bg-black/20 p-3">{urineColors.map((color, index) => { const level = index + 1; return <button key={color} type="button" title={`Nivel ${level}`} onClick={() => set(level)} className={`h-8 flex-1 rounded-md transition ${value === level ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-950" : "opacity-70 hover:opacity-100"}`} style={{ backgroundColor: color }}><span className="sr-only">Nivel {level}</span></button>; })}</div></fieldset>;
}

function Tab({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: LucideIcon; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${active ? "bg-teal-300 text-slate-950" : "text-slate-400 hover:bg-white/[.05] hover:text-white"}`}><Icon className="h-4 w-4" />{children}</button>;
}

function Metric({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub: string }) {
  return <div className="rounded-2xl border border-white/[.08] bg-white/[.035] p-4"><span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500"><Icon className="h-4 w-4 text-teal-300" />{label}</span><b className="mt-3 block text-2xl tracking-tight">{value}</b><small className="mt-1 block text-slate-600">{sub}</small></div>;
}

function ScoreRing({ value, color, compact = false }: { value: number; color: string; compact?: boolean }) {
  const size = compact ? "h-16 w-16" : "h-24 w-24";
  return <div className={`relative grid shrink-0 place-items-center rounded-full ${size}`} style={{ background: `conic-gradient(${color} ${Math.max(0, Math.min(100, value)) * 3.6}deg, rgba(255,255,255,.08) 0)` }}><div className="absolute inset-[7px] rounded-full bg-[#0c141d]" /><b className={`relative ${compact ? "text-sm" : "text-xl"}`}>{value}</b></div>;
}

function PlanStep({ number, title, value, detail }: { number: string; title: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-white/[.08] bg-black/20 p-4"><span className="text-[10px] font-black text-teal-300">{number} · {title.toUpperCase()}</span><b className="mt-2 block text-xl">{value}</b><p className="mt-2 text-xs leading-relaxed text-slate-500">{detail}</p></div>;
}

function Comparison({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-white/[.07] pb-3 text-sm last:border-0 last:pb-0"><span className="text-slate-500">{label}</span><b>{value}</b></div>;
}

function Empty({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[.02] p-8 text-center"><div><Droplets className="mx-auto h-10 w-10 text-slate-700" /><h4 className="mt-4 text-xl font-black">{title}</h4><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{detail}</p>{action && onAction && <button type="button" onClick={onAction} className="mt-5 rounded-xl bg-teal-300 px-5 py-2.5 font-black text-slate-950">{action}</button>}</div></div>;
}

function buildProfile(history: HydrationSession[], currentContext: string) {
  const values = history
    .filter((item) => (item.calidadProtocolo || 0) >= 75 && (item.contextKey || contextKey(item)) === currentContext)
    .map((item) => item.tasaSudorLh)
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 3);
  if (!values.length) return { count: 0, average: 0, min: 0, max: 0 };
  const round = (value: number) => Math.round(value * 100) / 100;
  return { count: values.length, average: round(values.reduce((sum, value) => sum + value, 0) / values.length), min: round(Math.min(...values)), max: round(Math.max(...values)) };
}

function signed(value: number) { const rounded = Math.round(value * 100) / 100; return `${rounded > 0 ? "+" : ""}${rounded}`; }
function shortDate(value: string) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }); }
function longDate(value: string) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }); }
