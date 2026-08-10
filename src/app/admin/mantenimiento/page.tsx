"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCopy,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  XCircle,
} from "lucide-react";

import {
  buildMaintenanceSummary,
  createMaintenanceAsset,
  maintenanceStats,
  maintenanceUrgency,
  registerMaintenanceInspection,
  seedMaintenanceAssets,
  type MaintenanceAsset,
  type MaintenanceCondition,
  type MaintenanceUrgency,
} from "@/lib/preventive-maintenance";

const STORAGE_PREFIX = "albatros-maintenance-v1:";

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

const urgencyLabels: Record<MaintenanceUrgency, string> = {
  "out-of-service": "Fuera de servicio",
  overdue: "Atrasado",
  "due-soon": "Próximo",
  current: "Al corriente",
};

const urgencyStyles: Record<MaintenanceUrgency, string> = {
  "out-of-service": "border-red-400/40 bg-red-500/15 text-red-100",
  overdue: "border-orange-400/40 bg-orange-500/15 text-orange-100",
  "due-soon": "border-amber-300/40 bg-amber-300/15 text-amber-100",
  current: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
};

function urgencyOrder(value: MaintenanceUrgency) {
  return { "out-of-service": 0, overdue: 1, "due-soon": 2, current: 3 }[value];
}

export default function MaintenancePage() {
  const today = localDate();
  const [site, setSite] = useState("SEDE");
  const [assets, setAssets] = useState<MaintenanceAsset[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<"all" | MaintenanceUrgency>("all");
  const [category, setCategory] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectionDate, setInspectionDate] = useState(today);
  const [condition, setCondition] =
    useState<MaintenanceCondition>("operational");
  const [responsible, setResponsible] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Instalaciones");
  const [newFrequency, setNewFrequency] = useState(30);
  const [newCritical, setNewCritical] = useState(false);
  const [newDue, setNewDue] = useState(today);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const selectedSite = window.localStorage.getItem("userSede") || "SEDE";
    const key = `${STORAGE_PREFIX}${encodeURIComponent(selectedSite)}`;
    const stored = window.localStorage.getItem(key);
    let nextAssets: MaintenanceAsset[];
    try {
      const parsed = stored ? JSON.parse(stored) : null;
      nextAssets = Array.isArray(parsed) ? parsed : seedMaintenanceAssets(today);
    } catch {
      nextAssets = seedMaintenanceAssets(today);
    }
    setSite(selectedSite);
    setAssets(nextAssets);
    setReady(true);
  }, [today]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${encodeURIComponent(site)}`,
      JSON.stringify(assets),
    );
  }, [assets, ready, site]);

  const stats = useMemo(() => maintenanceStats(assets, today), [assets, today]);
  const categories = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.category))).sort(),
    [assets],
  );
  const visibleAssets = useMemo(
    () =>
      assets
        .filter((asset) => {
          const urgency = maintenanceUrgency(asset, today);
          return (
            (filter === "all" || urgency === filter) &&
            (category === "all" || asset.category === category)
          );
        })
        .sort((a, b) => {
          const priority =
            urgencyOrder(maintenanceUrgency(a, today)) -
            urgencyOrder(maintenanceUrgency(b, today));
          if (priority !== 0) return priority;
          if (a.critical !== b.critical) return a.critical ? -1 : 1;
          return a.nextInspection.localeCompare(b.nextInspection);
        }),
    [assets, category, filter, today],
  );

  function openInspection(asset: MaintenanceAsset) {
    setSelectedId(asset.id);
    setInspectionDate(today);
    setCondition(asset.condition);
    setResponsible(asset.responsible);
    setInspectionNotes(asset.notes === "Pendiente de primera revisión." ? "" : asset.notes);
    setMessage("");
  }

  function saveInspection() {
    const asset = assets.find((candidate) => candidate.id === selectedId);
    if (!asset) return;
    try {
      const updated = registerMaintenanceInspection(asset, {
        date: inspectionDate,
        condition,
        responsible,
        notes: inspectionNotes,
      });
      setAssets((current) =>
        current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
      );
      setSelectedId(null);
      setMessage(`Revisión de ${asset.name} guardada.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
    }
  }

  function addAsset() {
    try {
      const asset = createMaintenanceAsset({
        name: newName,
        category: newCategory,
        frequencyDays: newFrequency,
        critical: newCritical,
        nextInspection: newDue,
      });
      setAssets((current) => [...current, asset]);
      setNewName("");
      setNewCritical(false);
      setShowNew(false);
      setMessage(`${asset.name} agregado al plan de mantenimiento.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo agregar.");
    }
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(buildMaintenanceSummary(assets, site, today));
      setMessage("Resumen de mantenimiento copiado.");
    } catch {
      setMessage("No se pudo copiar. Revisa el permiso del navegador.");
    }
  }

  return (
    <main className="min-h-screen bg-[#08090c] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1c22] via-[#111319] to-[#0c1815] p-6 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                <Wrench className="h-4 w-4" /> Operaciones · {site}
              </p>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Mantenimiento preventivo
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-medium text-white/65 sm:text-base">
                Anticipa fallas, controla revisiones y marca inmediatamente lo que
                no debe seguir en uso.
              </p>
            </div>
            <button
              type="button"
              onClick={copySummary}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] px-4 font-black text-white hover:bg-white/10"
            >
              <ClipboardCopy className="h-5 w-5" /> Copiar resumen
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Estado saludable", value: `${stats.healthy}%`, icon: ShieldCheck, style: "text-emerald-300" },
            { label: "Al corriente", value: stats.current, icon: CheckCircle2, style: "text-emerald-300" },
            { label: "Próximos 7 días", value: stats.dueSoon, icon: CalendarClock, style: "text-amber-200" },
            { label: "Atrasados", value: stats.overdue, icon: AlertTriangle, style: "text-orange-300" },
            { label: "Fuera de servicio", value: stats.outOfService, icon: XCircle, style: "text-red-300" },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className="rounded-2xl border border-white/10 bg-[#17181d] p-4">
                <Icon className={`h-5 w-5 ${card.style}`} />
                <p className="mt-3 text-3xl font-black text-white">{card.value}</p>
                <p className="text-xs font-bold uppercase tracking-wide text-white/50">{card.label}</p>
              </article>
            );
          })}
        </section>

        <section className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-[#15161b] p-4">
          <label className="grid min-w-48 flex-1 gap-1.5 text-xs font-black uppercase tracking-wide text-white/60">
            Estado
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as typeof filter)}
              className="h-11 rounded-xl border border-white/15 bg-[#090a0d] px-3 text-sm font-bold normal-case tracking-normal text-white outline-none focus:border-emerald-400"
            >
              <option value="all">Todos</option>
              <option value="out-of-service">Fuera de servicio</option>
              <option value="overdue">Atrasados</option>
              <option value="due-soon">Próximos</option>
              <option value="current">Al corriente</option>
            </select>
          </label>
          <label className="grid min-w-48 flex-1 gap-1.5 text-xs font-black uppercase tracking-wide text-white/60">
            Categoría
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 rounded-xl border border-white/15 bg-[#090a0d] px-3 text-sm font-bold normal-case tracking-normal text-white outline-none focus:border-emerald-400"
            >
              <option value="all">Todas</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setShowNew((value) => !value)}
            className="mt-auto flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 font-black text-[#07110d] sm:flex-none"
          >
            <Plus className="h-5 w-5" /> Agregar equipo o área
          </button>
        </section>

        {showNew && (
          <section className="grid gap-4 rounded-3xl border border-emerald-400/20 bg-[#151a18] p-5 md:grid-cols-2 lg:grid-cols-5">
            <label className="grid gap-2 text-sm font-bold text-white lg:col-span-2">
              Equipo o área
              <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ej. Extintor recepción" className="h-11 rounded-xl border border-white/15 bg-[#08090c] px-3 text-white placeholder:text-white/35 outline-none focus:border-emerald-400" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-white">
              Categoría
              <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className="h-11 rounded-xl border border-white/15 bg-[#08090c] px-3 text-white outline-none focus:border-emerald-400" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-white">
              Frecuencia (días)
              <input type="number" min="1" value={newFrequency} onChange={(event) => setNewFrequency(Number(event.target.value))} className="h-11 rounded-xl border border-white/15 bg-[#08090c] px-3 text-white outline-none focus:border-emerald-400" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-white">
              Primera revisión
              <input type="date" value={newDue} onChange={(event) => setNewDue(event.target.value)} className="h-11 rounded-xl border border-white/15 bg-[#08090c] px-3 text-white outline-none focus:border-emerald-400" />
            </label>
            <label className="flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-[#08090c] px-3 text-sm font-bold text-white">
              <input type="checkbox" checked={newCritical} onChange={(event) => setNewCritical(event.target.checked)} className="h-4 w-4 accent-red-400" /> Crítico para operar
            </label>
            <button type="button" onClick={addAsset} className="h-11 rounded-xl bg-white px-4 font-black text-[#08090c] md:col-span-2 lg:col-span-4">Guardar en el plan</button>
          </section>
        )}

        {message && (
          <p className="rounded-xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm font-bold text-sky-100">{message}</p>
        )}

        <section className="grid gap-3">
          {visibleAssets.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-[#15161b] p-6 text-center font-bold text-white/55">No hay elementos con estos filtros.</p>
          ) : visibleAssets.map((asset) => {
            const urgency = maintenanceUrgency(asset, today);
            const selected = selectedId === asset.id;
            return (
              <article key={asset.id} className={`rounded-2xl border ${urgencyStyles[urgency]} p-4 sm:p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-white">{asset.name}</h2>
                      {asset.critical && <span className="rounded-full bg-red-400 px-2 py-0.5 text-[10px] font-black uppercase text-[#250505]">Crítico</span>}
                      <span className="rounded-full border border-current/20 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase">{urgencyLabels[urgency]}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-white/60">{asset.category} · cada {asset.frequencyDays} días</p>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                      <p><span className="block text-xs font-black uppercase text-white/40">Última revisión</span><span className="font-bold text-white">{asset.lastInspection || "Sin revisión"}</span></p>
                      <p><span className="block text-xs font-black uppercase text-white/40">Próxima revisión</span><span className="font-bold text-white">{asset.nextInspection}</span></p>
                      <p><span className="block text-xs font-black uppercase text-white/40">Responsable</span><span className="font-bold text-white">{asset.responsible || "Sin asignar"}</span></p>
                    </div>
                    {asset.notes && <p className="mt-3 rounded-lg bg-black/20 px-3 py-2 text-sm font-medium text-white/70">{asset.notes}</p>}
                  </div>
                  <button type="button" onClick={() => selected ? setSelectedId(null) : openInspection(asset)} className="flex h-11 items-center gap-2 rounded-xl bg-white px-4 font-black text-[#090a0d]">
                    <Wrench className="h-4 w-4" /> {selected ? "Cancelar" : "Registrar revisión"}
                  </button>
                </div>

                {selected && (
                  <div className="mt-5 grid gap-4 border-t border-white/15 pt-5 md:grid-cols-2 lg:grid-cols-4">
                    <label className="grid gap-2 text-sm font-bold text-white">Fecha<input type="date" value={inspectionDate} onChange={(event) => setInspectionDate(event.target.value)} className="h-11 rounded-xl border border-white/15 bg-[#08090c] px-3 text-white outline-none focus:border-emerald-400" /></label>
                    <label className="grid gap-2 text-sm font-bold text-white">Condición<select value={condition} onChange={(event) => setCondition(event.target.value as MaintenanceCondition)} className="h-11 rounded-xl border border-white/15 bg-[#08090c] px-3 text-white outline-none focus:border-emerald-400"><option value="operational">Operativo</option><option value="attention">Necesita atención</option><option value="out-of-service">Fuera de servicio</option></select></label>
                    <label className="grid gap-2 text-sm font-bold text-white lg:col-span-2">Responsable<input value={responsible} onChange={(event) => setResponsible(event.target.value)} placeholder="Nombre de quien revisó" className="h-11 rounded-xl border border-white/15 bg-[#08090c] px-3 text-white placeholder:text-white/35 outline-none focus:border-emerald-400" /></label>
                    <label className="grid gap-2 text-sm font-bold text-white md:col-span-2 lg:col-span-4">Resultado y acciones<textarea value={inspectionNotes} onChange={(event) => setInspectionNotes(event.target.value)} placeholder="Qué se encontró, qué se corrigió o qué falta" className="min-h-24 rounded-xl border border-white/15 bg-[#08090c] p-3 text-white placeholder:text-white/35 outline-none focus:border-emerald-400" /></label>
                    <button type="button" onClick={saveInspection} className="h-11 rounded-xl bg-emerald-400 px-5 font-black text-[#07110d] md:col-span-2 lg:col-span-4">Guardar revisión y programar la siguiente</button>
                  </div>
                )}

                {asset.inspections.length > 0 && (
                  <details className="mt-4 border-t border-white/10 pt-3">
                    <summary className="cursor-pointer text-sm font-black text-white/70">Historial ({asset.inspections.length})</summary>
                    <div className="mt-3 grid gap-2">
                      {asset.inspections.slice(0, 5).map((inspection) => (
                        <div key={inspection.id} className="rounded-lg bg-black/20 px-3 py-2 text-sm text-white/70">
                          <p className="font-bold text-white">{inspection.date} · {inspection.responsible}</p>
                          <p>{inspection.condition === "operational" ? "Operativo" : inspection.condition === "attention" ? "Necesita atención" : "Fuera de servicio"}{inspection.notes ? ` · ${inspection.notes}` : ""}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </article>
            );
          })}
        </section>

        <aside className="flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-50">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">Un elemento marcado como fuera de servicio permanecerá en alerta roja hasta que una nueva revisión confirme que vuelve a estar operativo.</p>
        </aside>
      </div>
    </main>
  );
}
