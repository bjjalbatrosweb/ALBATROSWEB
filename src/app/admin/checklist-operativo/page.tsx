"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardCopy,
  Clock3,
  LockKeyhole,
  Plus,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import {
  OPERATIONAL_TEMPLATES,
  buildShiftHandoffSummary,
  canCloseChecklist,
  checklistProgress,
  completeChecklist,
  createOperationalChecklist,
  pendingCriticalTasks,
  toggleOperationalTask,
  type OperationalChecklist,
  type OperationalTemplateId,
} from "@/lib/operational-checklist";

const STORAGE_PREFIX = "albatros-operational-checklist-v1:";

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function storageKey(checklist: OperationalChecklist) {
  return `${STORAGE_PREFIX}${encodeURIComponent(checklist.site)}:${checklist.id}`;
}

function formatTime(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function readHistory(site: string) {
  const records: OperationalChecklist[] = [];
  const sitePrefix = `${STORAGE_PREFIX}${encodeURIComponent(site)}:`;

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(sitePrefix)) continue;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? "null");
      if (parsed?.id && Array.isArray(parsed.tasks)) records.push(parsed);
    } catch {
      // Un registro local incompleto no debe bloquear el resto del historial.
    }
  }

  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export default function OperationalChecklistPage() {
  const [site, setSite] = useState("SEDE");
  const [date, setDate] = useState(localDate);
  const [template, setTemplate] =
    useState<OperationalTemplateId>("apertura");
  const [responsible, setResponsible] = useState("");
  const [shift, setShift] = useState("Matutino");
  const [checklist, setChecklist] = useState<OperationalChecklist | null>(null);
  const [history, setHistory] = useState<OperationalChecklist[]>([]);
  const [customTask, setCustomTask] = useState("");
  const [customCritical, setCustomCritical] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const selectedSite = window.localStorage.getItem("userSede") || "SEDE";
    setSite(selectedSite);
    setHistory(readHistory(selectedSite));
  }, []);

  useEffect(() => {
    if (!checklist) return;
    window.localStorage.setItem(storageKey(checklist), JSON.stringify(checklist));
    setHistory(readHistory(checklist.site));
  }, [checklist]);

  const progress = useMemo(
    () => (checklist ? checklistProgress(checklist) : null),
    [checklist],
  );
  const criticalPending = useMemo(
    () => (checklist ? pendingCriticalTasks(checklist).length : 0),
    [checklist],
  );

  function startChecklist() {
    if (!responsible.trim()) {
      setMessage("Escribe el nombre de la persona responsable.");
      return;
    }
    setChecklist(
      createOperationalChecklist({ template, date, site, responsible, shift }),
    );
    setMessage("Checklist iniciado y guardado en este dispositivo.");
  }

  function updateChecklist(patch: Partial<OperationalChecklist>) {
    setChecklist((current) => (current ? { ...current, ...patch } : current));
  }

  function toggleTask(taskId: string) {
    setChecklist((current) =>
      current
        ? toggleOperationalTask(current, taskId, current.responsible)
        : current,
    );
    setMessage("");
  }

  function addTask() {
    const title = customTask.trim();
    if (!title || !checklist) return;
    updateChecklist({
      tasks: [
        ...checklist.tasks,
        {
          id: `custom-${Date.now()}`,
          title,
          critical: customCritical,
          completed: false,
        },
      ],
    });
    setCustomTask("");
    setCustomCritical(false);
  }

  function closeChecklist() {
    if (!checklist) return;
    if (!canCloseChecklist(checklist)) {
      setMessage(
        `Faltan ${criticalPending} tareas críticas. Complétalas antes de cerrar.`,
      );
      return;
    }
    setChecklist(completeChecklist(checklist));
    setMessage("Turno cerrado. El resumen quedó listo para entregar.");
  }

  async function copySummary() {
    if (!checklist) return;
    try {
      await navigator.clipboard.writeText(buildShiftHandoffSummary(checklist));
      setMessage("Resumen copiado al portapapeles.");
    } catch {
      setMessage("No se pudo copiar. Revisa el permiso del navegador.");
    }
  }

  function loadRecord(record: OperationalChecklist) {
    setChecklist(record);
    setResponsible(record.responsible);
    setShift(record.shift);
    setDate(record.date);
    setTemplate(record.template);
    setMessage("Registro cargado.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="min-h-screen bg-[#090a0d] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#17191f] to-[#101116] p-6 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                <ShieldCheck className="h-4 w-4" /> Operación · {site}
              </p>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Apertura, cierre y entrega de turno
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-medium text-white/65 sm:text-base">
                Confirma tareas críticas, documenta incidencias y deja un resumen
                claro al siguiente responsable.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-right">
              <p className="text-xs font-black uppercase tracking-wider text-emerald-200">
                Hoy
              </p>
              <p className="text-lg font-black text-white">{localDate()}</p>
            </div>
          </div>
        </header>

        {!checklist ? (
          <section className="grid gap-5 rounded-3xl border border-white/10 bg-[#17181d] p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-black text-white">Nuevo checklist</h2>
              <p className="mt-1 text-sm text-white/60">
                Elige la operación y registra quién entrega el turno.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-white">
                Fecha
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-12 rounded-xl border border-white/15 bg-[#090a0d] px-4 text-base text-white outline-none focus:border-emerald-400"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-white">
                Turno
                <select
                  value={shift}
                  onChange={(event) => setShift(event.target.value)}
                  className="h-12 rounded-xl border border-white/15 bg-[#090a0d] px-4 text-base text-white outline-none focus:border-emerald-400"
                >
                  <option>Matutino</option>
                  <option>Vespertino</option>
                  <option>Nocturno</option>
                  <option>Evento</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-white md:col-span-2">
                Responsable
                <input
                  value={responsible}
                  onChange={(event) => setResponsible(event.target.value)}
                  placeholder="Nombre de quien realiza el checklist"
                  className="h-12 rounded-xl border border-white/15 bg-[#090a0d] px-4 text-base text-white placeholder:text-white/35 outline-none focus:border-emerald-400"
                />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {OPERATIONAL_TEMPLATES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTemplate(item.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    template === item.id
                      ? "border-emerald-400 bg-emerald-400/15"
                      : "border-white/10 bg-[#0e0f13] hover:border-white/25"
                  }`}
                >
                  <p className="font-black text-white">{item.name}</p>
                  <p className="mt-1 text-sm text-white/55">{item.description}</p>
                  <p className="mt-3 text-xs font-bold text-emerald-300">
                    {item.tasks.length} tareas
                  </p>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={startChecklist}
              className="h-12 rounded-xl bg-emerald-400 px-5 font-black text-[#07110d] transition hover:bg-emerald-300"
            >
              Iniciar checklist
            </button>
          </section>
        ) : (
          <>
            <section className="grid gap-4 rounded-3xl border border-white/10 bg-[#17181d] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-black text-white">
                      {checklist.title}
                    </h2>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                        checklist.status === "completed"
                          ? "bg-emerald-400 text-[#07110d]"
                          : "bg-amber-300 text-[#1a1200]"
                      }`}
                    >
                      {checklist.status === "completed" ? "Cerrado" : "En curso"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-white/60">
                    {checklist.date} · {checklist.shift} · {checklist.responsible}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setChecklist(null);
                    setMessage("");
                  }}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm font-black text-white hover:bg-white/10"
                >
                  Nuevo checklist
                </button>
              </div>

              {progress && (
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div>
                    <div className="mb-2 flex justify-between text-sm font-bold text-white">
                      <span>Avance</span>
                      <span>{progress.percentage}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-400 transition-all"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/[0.06] px-4 py-3 text-center">
                    <p className="text-xl font-black text-white">
                      {progress.completed}/{progress.total}
                    </p>
                    <p className="text-xs font-bold text-white/50">completadas</p>
                  </div>
                  <div
                    className={`rounded-xl px-4 py-3 text-center ${
                      criticalPending
                        ? "bg-red-500/15 text-red-200"
                        : "bg-emerald-400/15 text-emerald-200"
                    }`}
                  >
                    <p className="text-xl font-black">{criticalPending}</p>
                    <p className="text-xs font-bold">críticas pendientes</p>
                  </div>
                </div>
              )}
            </section>

            <section className="grid gap-3">
              {checklist.tasks.map((task) => (
                <article
                  key={task.id}
                  className={`flex gap-4 rounded-2xl border p-4 transition ${
                    task.completed
                      ? "border-emerald-400/20 bg-emerald-400/[0.07]"
                      : task.critical
                        ? "border-red-400/25 bg-red-500/[0.07]"
                        : "border-white/10 bg-[#17181d]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    disabled={checklist.status === "completed"}
                    aria-label={task.completed ? "Marcar pendiente" : "Marcar completa"}
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      task.completed
                        ? "border-emerald-300 bg-emerald-400 text-[#07110d]"
                        : "border-white/25 bg-[#090a0d] text-white"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {task.completed ? <Check className="h-5 w-5" /> : null}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`font-bold ${
                          task.completed ? "text-white/55 line-through" : "text-white"
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.critical && (
                        <span className="rounded-full bg-red-400 px-2 py-0.5 text-[10px] font-black uppercase text-[#240505]">
                          Crítica
                        </span>
                      )}
                    </div>
                    {task.completed && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-300">
                        <Clock3 className="h-3.5 w-3.5" /> {task.completedBy} · {formatTime(task.completedAt)}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </section>

            {checklist.status === "active" && (
              <section className="grid gap-3 rounded-2xl border border-dashed border-white/20 bg-[#111217] p-4 md:grid-cols-[1fr_auto_auto] md:items-end">
                <label className="grid gap-2 text-sm font-bold text-white">
                  Agregar tarea personalizada
                  <input
                    value={customTask}
                    onChange={(event) => setCustomTask(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") addTask();
                    }}
                    placeholder="Ej. revisar área infantil"
                    className="h-11 rounded-xl border border-white/15 bg-[#090a0d] px-4 text-white placeholder:text-white/35 outline-none focus:border-emerald-400"
                  />
                </label>
                <label className="flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-[#090a0d] px-4 text-sm font-bold text-white">
                  <input
                    type="checkbox"
                    checked={customCritical}
                    onChange={(event) => setCustomCritical(event.target.checked)}
                    className="h-4 w-4 accent-red-400"
                  />
                  Crítica
                </label>
                <button
                  type="button"
                  onClick={addTask}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 font-black text-[#090a0d]"
                >
                  <Plus className="h-4 w-4" /> Agregar
                </button>
              </section>
            )}

            <section className="grid gap-4 rounded-3xl border border-white/10 bg-[#17181d] p-5 sm:p-6 lg:grid-cols-3">
              <label className="grid gap-2 text-sm font-black text-white">
                Incidencias
                <textarea
                  value={checklist.incidents}
                  disabled={checklist.status === "completed"}
                  onChange={(event) => updateChecklist({ incidents: event.target.value })}
                  placeholder="Fallas, accidentes o situaciones relevantes"
                  className="min-h-32 rounded-xl border border-white/15 bg-[#090a0d] p-3 font-medium text-white placeholder:text-white/35 outline-none focus:border-red-300 disabled:opacity-70"
                />
              </label>
              <label className="grid gap-2 text-sm font-black text-white">
                Para el siguiente turno
                <textarea
                  value={checklist.nextShift}
                  disabled={checklist.status === "completed"}
                  onChange={(event) => updateChecklist({ nextShift: event.target.value })}
                  placeholder="Pendientes, avisos y seguimiento"
                  className="min-h-32 rounded-xl border border-white/15 bg-[#090a0d] p-3 font-medium text-white placeholder:text-white/35 outline-none focus:border-amber-300 disabled:opacity-70"
                />
              </label>
              <label className="grid gap-2 text-sm font-black text-white">
                Notas generales
                <textarea
                  value={checklist.notes}
                  disabled={checklist.status === "completed"}
                  onChange={(event) => updateChecklist({ notes: event.target.value })}
                  placeholder="Observaciones adicionales"
                  className="min-h-32 rounded-xl border border-white/15 bg-[#090a0d] p-3 font-medium text-white placeholder:text-white/35 outline-none focus:border-emerald-300 disabled:opacity-70"
                />
              </label>
            </section>

            <section className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-[#111217] p-4">
              <button
                type="button"
                onClick={copySummary}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 font-black text-white hover:bg-white/10 sm:flex-none"
              >
                <ClipboardCopy className="h-5 w-5" /> Copiar entrega
              </button>
              {checklist.status === "active" ? (
                <button
                  type="button"
                  onClick={closeChecklist}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 font-black sm:flex-none ${
                    criticalPending
                      ? "bg-red-500 text-white"
                      : "bg-emerald-400 text-[#07110d]"
                  }`}
                >
                  {criticalPending ? (
                    <LockKeyhole className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                  Cerrar turno
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => updateChecklist({ status: "active", completedAt: undefined })}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 font-black text-[#1a1200] sm:flex-none"
                >
                  <RotateCcw className="h-5 w-5" /> Reabrir
                </button>
              )}
              {message && (
                <p className="flex w-full items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-3 text-sm font-bold text-white">
                  {criticalPending && checklist.status === "active" ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
                  ) : (
                    <ClipboardCheck className="h-4 w-4 shrink-0 text-emerald-300" />
                  )}
                  {message}
                </p>
              )}
            </section>
          </>
        )}

        {message && !checklist && (
          <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100">
            {message}
          </p>
        )}

        <section className="grid gap-3 rounded-3xl border border-white/10 bg-[#17181d] p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-black text-white">Historial en este dispositivo</h2>
            <p className="mt-1 text-sm text-white/55">
              Registros de {site}. Se conservan en este navegador.
            </p>
          </div>
          {history.length === 0 ? (
            <p className="rounded-xl bg-[#090a0d] p-4 text-sm font-bold text-white/55">
              Todavía no hay checklists guardados para esta sede.
            </p>
          ) : (
            <div className="grid gap-2">
              {history.slice(0, 14).map((record) => {
                const recordProgress = checklistProgress(record);
                return (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => loadRecord(record)}
                    className="grid gap-2 rounded-xl border border-white/10 bg-[#0d0e12] p-4 text-left transition hover:border-emerald-400/40 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                  >
                    <span>
                      <span className="block font-black text-white">{record.title}</span>
                      <span className="text-sm font-medium text-white/55">
                        {record.date} · {record.shift} · {record.responsible}
                      </span>
                    </span>
                    <span className="text-sm font-black text-white">
                      {recordProgress.completed}/{recordProgress.total}
                    </span>
                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase ${
                        record.status === "completed"
                          ? "bg-emerald-400/20 text-emerald-200"
                          : "bg-amber-300/20 text-amber-100"
                      }`}
                    >
                      {record.status === "completed" ? "Cerrado" : "En curso"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
