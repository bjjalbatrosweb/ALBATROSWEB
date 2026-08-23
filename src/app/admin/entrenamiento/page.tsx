"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Copy,
  Dices,
  Dumbbell,
  Expand,
  GripVertical,
  Layers3,
  ListChecks,
  Plus,
  Pause,
  Play,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Trash2,
  Users,
  WandSparkles,
} from "lucide-react";

import {
  TRAINING_PHASE_LABELS,
  eligibleExercises,
  generateTrainingPlan,
  type TrainingDiscipline,
  type TrainingExercise,
  type TrainingFocus,
  type TrainingLevel,
  type TrainingBlock,
  type TrainingPlan,
  TRAINING_EXERCISES,
} from "@/data/training-tools";

type View = "generador" | "constructor" | "entrenador" | "ruleta";
type EquipmentFilter = TrainingExercise["equipment"] | "cualquiera";
type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
  };
};

const PLAN_STORAGE_KEY = "albatros-training-plan-v1";
const TEMPLATE_STORAGE_KEY = "albatros-training-templates-v1";
const disciplineOptions: TrainingDiscipline[] = ["BJJ", "MMA", "Taekwondo", "Funcional"];
const levelLabels: Record<TrainingLevel, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};
const focusLabels: Record<TrainingFocus, string> = {
  tecnica: "Técnica",
  fisico: "Físico",
  sparring: "Sparring",
  mixto: "Mixto",
};
const equipmentLabels: Record<EquipmentFilter, string> = {
  cualquiera: "Cualquier material",
  ninguno: "Sin material",
  pareja: "Compañero",
  costal: "Costal",
  paletas: "Paletas / peto",
  balon: "Balón",
  dummy: "Dummy",
};

const formatClock = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, "0")}`;

function playBell() {
  navigator.vibrate?.([120, 80, 120]);
  try {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.45);
    window.setTimeout(() => void context.close(), 600);
  } catch {
    // La vibración sigue disponible cuando el navegador bloquea Web Audio.
  }
}

export default function TrainingToolsPage() {
  const [view, setView] = useState<View>("generador");
  const [discipline, setDiscipline] = useState<TrainingDiscipline>("BJJ");
  const [focus, setFocus] = useState<TrainingFocus>("mixto");
  const [level, setLevel] = useState<TrainingLevel>("principiante");
  const [duration, setDuration] = useState(60);
  const [groupSize, setGroupSize] = useState(12);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [copied, setCopied] = useState(false);
  const [builderSearch, setBuilderSearch] = useState("");
  const [builderPhase, setBuilderPhase] = useState<TrainingBlock["phase"] | "todas">("todas");
  const [templates, setTemplates] = useState<TrainingPlan[]>([]);
  const [templateMessage, setTemplateMessage] = useState("");

  const [currentBlock, setCurrentBlock] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [wallClock, setWallClock] = useState("--:--");

  const [rouletteDiscipline, setRouletteDiscipline] = useState<TrainingDiscipline>("BJJ");
  const [rouletteFocus, setRouletteFocus] = useState<TrainingFocus>("mixto");
  const [rouletteLevel, setRouletteLevel] = useState<TrainingLevel>("principiante");
  const [equipment, setEquipment] = useState<EquipmentFilter>("cualquiera");
  const [rouletteResult, setRouletteResult] = useState<TrainingExercise | null>(null);
  const [rouletteHistory, setRouletteHistory] = useState<string[]>([]);
  const [spinning, setSpinning] = useState(false);
  const spinTimer = useRef<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(PLAN_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as TrainingPlan;
        if (Array.isArray(parsed.blocks) && parsed.blocks.length) {
          setPlan(parsed);
          setSecondsLeft(parsed.blocks[0].minutes * 60);
        }
      } catch {
        localStorage.removeItem(PLAN_STORAGE_KEY);
      }
    }
    const storedTemplates = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (storedTemplates) {
      try {
        const parsed = JSON.parse(storedTemplates) as TrainingPlan[];
        if (Array.isArray(parsed)) setTemplates(parsed.filter((item) => Array.isArray(item.blocks)).slice(0, 8));
      } catch {
        localStorage.removeItem(TEMPLATE_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (plan) localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);

  useEffect(() => {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  }, [templates]);

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

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(
      () => setSecondsLeft((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!running || secondsLeft !== 0 || !plan) return;
    playBell();
    if (currentBlock < plan.blocks.length - 1) {
      const next = currentBlock + 1;
      setCurrentBlock(next);
      setSecondsLeft(plan.blocks[next].minutes * 60);
    } else {
      setRunning(false);
    }
  }, [currentBlock, plan, running, secondsLeft]);

  useEffect(() => {
    if (!running) return;
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = await (navigator as WakeLockNavigator).wakeLock?.request("screen") || null;
      } catch {
        lock = null;
      }
    };
    void request();
    return () => void lock?.release();
  }, [running]);

  useEffect(
    () => () => {
      if (spinTimer.current !== null) window.clearInterval(spinTimer.current);
    },
    [],
  );

  const current = plan?.blocks[currentBlock] || null;
  const progress = useMemo(() => {
    if (!plan || !current) return 0;
    const completed = plan.blocks
      .slice(0, currentBlock)
      .reduce((total, block) => total + block.minutes * 60, 0);
    const activeElapsed = current.minutes * 60 - secondsLeft;
    return Math.max(0, Math.min(100, ((completed + activeElapsed) / (plan.duration * 60)) * 100));
  }, [current, currentBlock, plan, secondsLeft]);

  const createPlan = () => {
    const next = generateTrainingPlan({ discipline, focus, level, duration, groupSize });
    setPlan(next);
    setCurrentBlock(0);
    setSecondsLeft(next.blocks[0].minutes * 60);
    setRunning(false);
  };

  const builderExercises = useMemo(() => {
    const query = builderSearch.trim().toLocaleLowerCase("es");
    return TRAINING_EXERCISES.filter((exercise) => {
      const disciplineMatches = exercise.disciplines.includes("Todas") || exercise.disciplines.includes(discipline);
      const levelMatches = exercise.levels.includes(level);
      const focusMatches = focus === "mixto" || exercise.focuses.includes(focus) || exercise.focuses.includes("mixto");
      const phaseMatches = builderPhase === "todas" || exercise.phases.includes(builderPhase);
      const searchMatches = !query || `${exercise.title} ${exercise.instruction}`.toLocaleLowerCase("es").includes(query);
      return disciplineMatches && levelMatches && focusMatches && phaseMatches && searchMatches;
    });
  }, [builderPhase, builderSearch, discipline, focus, level]);

  const emptyVisualPlan = (): TrainingPlan => ({
    id: `visual-${Date.now()}`,
    createdAt: new Date().toISOString(),
    title: `${discipline} · clase personalizada`,
    discipline,
    focus,
    level,
    duration: 0,
    groupSize: Math.max(1, Math.round(groupSize)),
    blocks: [],
  });

  const commitBlocks = (blocks: TrainingBlock[], source = plan) => {
    const base = source || emptyVisualPlan();
    const next = { ...base, duration: blocks.reduce((total, block) => total + block.minutes, 0), blocks };
    setPlan(next);
    setRunning(false);
    setCurrentBlock((index) => Math.max(0, Math.min(index, blocks.length - 1)));
    if (blocks.length) setSecondsLeft(blocks[Math.max(0, Math.min(currentBlock, blocks.length - 1))].minutes * 60);
    else setSecondsLeft(0);
  };

  const addExercise = (exercise: TrainingExercise, at = plan?.blocks.length ?? 0) => {
    const base = plan || emptyVisualPlan();
    const block: TrainingBlock = {
      id: `${Date.now()}-${exercise.id}-${Math.random().toString(36).slice(2, 6)}`,
      phase: builderPhase !== "todas" && exercise.phases.includes(builderPhase) ? builderPhase : exercise.phases[0],
      title: exercise.title,
      instruction: exercise.instruction,
      minutes: 5,
      equipment: exercise.equipment,
    };
    const blocks = [...base.blocks];
    blocks.splice(Math.max(0, Math.min(at, blocks.length)), 0, block);
    commitBlocks(blocks, base);
  };

  const addCustomBlock = () => {
    const base = plan || emptyVisualPlan();
    commitBlocks([...base.blocks, { id: `custom-${Date.now()}`, phase: "tecnica", title: "Nuevo bloque", instruction: "Describe la dinámica, progresión y criterio de seguridad.", minutes: 5, equipment: "ninguno" }], base);
  };

  const updateBlock = (id: string, patch: Partial<TrainingBlock>) => {
    if (!plan) return;
    commitBlocks(plan.blocks.map((block) => block.id === id ? { ...block, ...patch, minutes: patch.minutes === undefined ? block.minutes : Math.max(1, Math.min(60, Math.round(patch.minutes))) } : block));
  };

  const removeBlock = (id: string) => {
    if (!plan) return;
    commitBlocks(plan.blocks.filter((block) => block.id !== id));
  };

  const duplicateBlock = (id: string) => {
    if (!plan) return;
    const index = plan.blocks.findIndex((block) => block.id === id);
    if (index < 0) return;
    const blocks = [...plan.blocks];
    blocks.splice(index + 1, 0, { ...plan.blocks[index], id: `${Date.now()}-${plan.blocks[index].id}` });
    commitBlocks(blocks);
  };

  const moveVisualBlock = (id: string, direction: -1 | 1) => {
    if (!plan) return;
    const index = plan.blocks.findIndex((block) => block.id === id), next = index + direction;
    if (index < 0 || next < 0 || next >= plan.blocks.length) return;
    const blocks = [...plan.blocks];
    [blocks[index], blocks[next]] = [blocks[next], blocks[index]];
    commitBlocks(blocks);
  };

  const dropOnTimeline = (event: React.DragEvent, at: number) => {
    event.preventDefault();
    const exerciseId = event.dataTransfer.getData("application/x-training-exercise");
    const blockId = event.dataTransfer.getData("application/x-training-block");
    if (exerciseId) {
      const exercise = TRAINING_EXERCISES.find((item) => item.id === exerciseId);
      if (exercise) addExercise(exercise, at);
      return;
    }
    if (!blockId || !plan) return;
    const from = plan.blocks.findIndex((block) => block.id === blockId);
    if (from < 0) return;
    const blocks = [...plan.blocks], [moved] = blocks.splice(from, 1);
    blocks.splice(Math.max(0, Math.min(at > from ? at - 1 : at, blocks.length)), 0, moved);
    commitBlocks(blocks);
  };

  const saveTemplate = () => {
    if (!plan?.blocks.length) return;
    const saved = { ...plan, id: `template-${Date.now()}`, createdAt: new Date().toISOString(), blocks: plan.blocks.map((block) => ({ ...block })) };
    setTemplates((items) => [saved, ...items].slice(0, 8));
    setTemplateMessage("Plantilla guardada en este dispositivo.");
    window.setTimeout(() => setTemplateMessage(""), 2200);
  };

  const loadTemplate = (template: TrainingPlan) => {
    const loaded = { ...template, id: `visual-${Date.now()}`, createdAt: new Date().toISOString(), blocks: template.blocks.map((block, index) => ({ ...block, id: `${Date.now()}-${index}-${block.id}` })) };
    setPlan(loaded);
    setDiscipline(loaded.discipline);
    setFocus(loaded.focus);
    setLevel(loaded.level);
    setGroupSize(loaded.groupSize);
    setCurrentBlock(0);
    setSecondsLeft((loaded.blocks[0]?.minutes || 0) * 60);
  };

  const openTrainer = () => {
    if (!plan) createPlan();
    setView("entrenador");
  };

  const selectBlock = (index: number) => {
    if (!plan?.blocks[index]) return;
    setRunning(false);
    setCurrentBlock(index);
    setSecondsLeft(plan.blocks[index].minutes * 60);
  };

  const copyPlan = async () => {
    if (!plan) return;
    const text = [
      `${plan.title} · ${plan.duration} min · ${levelLabels[plan.level]}`,
      `Grupo: ${plan.groupSize} atletas`,
      "",
      ...plan.blocks.map(
        (block, index) =>
          `${index + 1}. ${block.minutes} min · ${TRAINING_PHASE_LABELS[block.phase]} · ${block.title}\n${block.instruction}`,
      ),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const roulettePool = useMemo(
    () =>
      eligibleExercises({
        discipline: rouletteDiscipline,
        focus: rouletteFocus,
        level: rouletteLevel,
        equipment,
      }),
    [equipment, rouletteDiscipline, rouletteFocus, rouletteLevel],
  );

  useEffect(() => {
    setRouletteResult(null);
  }, [equipment, rouletteDiscipline, rouletteFocus, rouletteLevel]);

  const spin = () => {
    if (spinning || roulettePool.length === 0) return;
    const pool = roulettePool;
    setSpinning(true);
    let ticks = 0;
    spinTimer.current = window.setInterval(() => {
      ticks += 1;
      setRouletteResult(pool[Math.floor(Math.random() * pool.length)]);
      if (ticks < 22) return;
      if (spinTimer.current !== null) window.clearInterval(spinTimer.current);
      const fresh = pool.filter((exercise) => !rouletteHistory.slice(0, 4).includes(exercise.id));
      const source = fresh.length ? fresh : pool;
      const selected = source[Math.floor(Math.random() * source.length)];
      setRouletteResult(selected);
      setRouletteHistory((history) => [selected.id, ...history.filter((id) => id !== selected.id)].slice(0, 6));
      setSpinning(false);
      playBell();
    }, 70);
  };

  const moveBlock = (direction: -1 | 1) => {
    if (!plan) return;
    selectBlock(Math.max(0, Math.min(plan.blocks.length - 1, currentBlock + direction)));
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen?.();
      }
    } catch {
      // El entrenador sigue funcionando si la TV no expone esta API.
    }
  };

  const tabs: Array<{ id: View; label: string; icon: typeof WandSparkles }> = [
    { id: "generador", label: "Generador", icon: WandSparkles },
    { id: "constructor", label: "Constructor visual", icon: Layers3 },
    { id: "entrenador", label: "Modo entrenador", icon: TimerReset },
    { id: "ruleta", label: "Ruleta", icon: Dices },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 text-white md:p-8">
      <header className="rounded-[28px] border border-white/10 bg-gradient-to-br from-[#101417] to-[#050607] p-5 shadow-2xl md:p-7">
        <div className="flex items-center gap-2 text-emerald-300">
          <Dumbbell className="h-5 w-5" />
          <span className="text-xs font-black uppercase tracking-[.24em]">Herramientas de entrenamiento</span>
        </div>
        <h1 className="mt-2 text-3xl font-black uppercase md:text-5xl">Laboratorio de clases</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/65 md:text-base">
          Planea una sesión, ejecútala con cronómetro y resuelve bloqueos creativos con una ruleta segura para cada disciplina.
        </p>
      </header>

      <nav className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="Herramientas de entrenamiento">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`min-h-14 rounded-2xl border px-2 text-xs font-black text-white transition sm:text-sm ${
              view === id
                ? "border-emerald-300/50 bg-emerald-500/20 shadow-[0_0_32px_rgba(52,211,153,.12)]"
                : "border-white/10 bg-[#090b0d] hover:border-white/25 hover:bg-white/[.06]"
            }`}
          >
            <Icon className="mx-auto mb-1 h-4 w-4" /> {label}
          </button>
        ))}
      </nav>

      {view === "generador" && (
        <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <div className="rounded-[26px] border border-white/10 bg-[#090b0d] p-5 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><Sparkles /></span>
              <div><h2 className="font-black uppercase">Crear sesión</h2><p className="text-xs text-white/70">Sin claves ni conexión externa</p></div>
            </div>
            <div className="space-y-4">
              <Field label="Disciplina">
                <select value={discipline} onChange={(event) => setDiscipline(event.target.value as TrainingDiscipline)} className="field-select">
                  {disciplineOptions.map((value) => <option key={value}>{value}</option>)}
                </select>
              </Field>
              <Field label="Objetivo principal">
                <select value={focus} onChange={(event) => setFocus(event.target.value as TrainingFocus)} className="field-select">
                  {(Object.keys(focusLabels) as TrainingFocus[]).map((value) => <option key={value} value={value}>{focusLabels[value]}</option>)}
                </select>
              </Field>
              <Field label="Nivel del grupo">
                <select value={level} onChange={(event) => setLevel(event.target.value as TrainingLevel)} className="field-select">
                  {(Object.keys(levelLabels) as TrainingLevel[]).map((value) => <option key={value} value={value}>{levelLabels[value]}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Duración">
                  <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="field-select">
                    {[45, 60, 75, 90, 120].map((value) => <option key={value} value={value}>{value} min</option>)}
                  </select>
                </Field>
                <Field label="Atletas">
                  <div className="relative"><Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" /><input type="number" min="1" max="80" value={groupSize} onChange={(event) => setGroupSize(Number(event.target.value))} className="field-input pl-9" /></div>
                </Field>
              </div>
              <button type="button" onClick={createPlan} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 font-black text-[#03100b] transition hover:bg-emerald-400 active:scale-[.98]">
                <WandSparkles /> {plan ? "Generar otra versión" : "Generar clase"}
              </button>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-[#090b0d] p-4 shadow-xl md:p-6">
            {plan ? (
              <>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">Plan listo · {plan.duration} minutos</p><h2 className="text-2xl font-black uppercase">{plan.title}</h2><p className="text-sm text-white/70">{levelLabels[plan.level]} · {plan.groupSize} atletas · {plan.blocks.length} bloques</p></div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void copyPlan()} className="tool-button">{copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}</button>
                    <button type="button" onClick={openTrainer} className="tool-button border-violet-300/30 bg-violet-500/15"><Play /> Entrenar</button>
                  </div>
                </div>
                <div className="space-y-3">
                  {plan.blocks.map((block, index) => (
                    <article key={block.id} className="grid grid-cols-[auto_1fr] gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 md:grid-cols-[64px_1fr_auto] md:items-center md:p-4">
                      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-500/10 text-center"><strong className="text-xl leading-none">{block.minutes}</strong><span className="text-[8px] font-black uppercase text-emerald-200">min</span></div>
                      <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.18em] text-white/70">{index + 1} · {TRAINING_PHASE_LABELS[block.phase]}</p><h3 className="font-black text-white">{block.title}</h3><p className="mt-1 text-sm leading-relaxed text-white/60">{block.instruction}</p></div>
                      <span className="col-start-2 rounded-full border border-white/10 bg-white/[.05] px-3 py-1 text-[10px] font-bold text-white/70 md:col-start-auto">{equipmentLabels[block.equipment]}</span>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="grid min-h-[520px] place-items-center text-center"><div><ListChecks className="mx-auto mb-4 h-12 w-12 text-white/70" /><h2 className="text-xl font-black uppercase text-white">Configura tu clase</h2><p className="mx-auto mt-2 max-w-sm text-sm text-white/70">El generador distribuirá exactamente el tiempo entre activación, técnica, aplicación, acondicionamiento y cierre.</p></div></div>
            )}
          </div>
        </section>
      )}

      {view === "constructor" && (
        <section className="space-y-5">
          <div className="grid min-w-0 gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
            <aside className="h-fit min-w-0 rounded-[26px] border border-white/10 bg-[#090b0d] p-4 shadow-xl xl:sticky xl:top-24">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Biblioteca</p><h2 className="text-xl font-black">Bloques disponibles</h2></div><span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-200">{builderExercises.length}</span></div>
              <div className="relative mt-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"/><input value={builderSearch} onChange={(event)=>setBuilderSearch(event.target.value)} className="field-input pl-9" placeholder="Buscar ejercicio…" aria-label="Buscar ejercicios"/></div>
              <div className="mt-3 grid grid-cols-2 gap-2"><select value={discipline} onChange={(event)=>setDiscipline(event.target.value as TrainingDiscipline)} className="field-select" aria-label="Disciplina del constructor">{disciplineOptions.map((value)=><option key={value}>{value}</option>)}</select><select value={level} onChange={(event)=>setLevel(event.target.value as TrainingLevel)} className="field-select" aria-label="Nivel del constructor">{(Object.keys(levelLabels) as TrainingLevel[]).map((value)=><option key={value} value={value}>{levelLabels[value]}</option>)}</select></div>
              <select value={focus} onChange={(event)=>setFocus(event.target.value as TrainingFocus)} className="field-select mt-2" aria-label="Objetivo del constructor">{(Object.keys(focusLabels) as TrainingFocus[]).map((value)=><option key={value} value={value}>{focusLabels[value]}</option>)}</select>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{(["todas",...Object.keys(TRAINING_PHASE_LABELS)] as Array<"todas"|TrainingBlock["phase"]>).map((phase)=><button key={phase} type="button" onClick={()=>setBuilderPhase(phase)} className={`shrink-0 rounded-full border px-3 py-2 text-[9px] font-black uppercase ${builderPhase===phase?'border-cyan-300/35 bg-cyan-500/15 text-cyan-200':'border-white/10 bg-black/20 text-white/45'}`}>{phase==="todas"?"Todas":TRAINING_PHASE_LABELS[phase]}</button>)}</div>
              <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">{builderExercises.map((exercise)=><article key={exercise.id} draggable onDragStart={(event)=>{event.dataTransfer.effectAllowed="copy";event.dataTransfer.setData("application/x-training-exercise",exercise.id)}} className="group cursor-grab rounded-2xl border border-white/[.08] bg-black/25 p-3 transition hover:border-cyan-300/25 hover:bg-cyan-500/[.05] active:cursor-grabbing"><div className="flex items-start gap-3"><GripVertical className="mt-1 h-4 w-4 shrink-0 text-white/20"/><div className="min-w-0 flex-1"><h3 className="text-sm font-black text-white">{exercise.title}</h3><p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/45">{exercise.instruction}</p><div className="mt-2 flex flex-wrap gap-1"><span className="builder-tag">{equipmentLabels[exercise.equipment]}</span><span className="builder-tag">Intensidad {exercise.intensity}/3</span></div></div><button type="button" onClick={()=>addExercise(exercise)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400 text-slate-950 transition hover:scale-105" aria-label={`Agregar ${exercise.title}`}><Plus className="h-4 w-4"/></button></div></article>)}</div>
            </aside>

            <div className="min-w-0 rounded-[26px] border border-white/10 bg-[#090b0d] p-4 shadow-xl md:p-6">
              <header className="flex flex-col justify-between gap-4 border-b border-white/[.07] pb-5 lg:flex-row lg:items-end"><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">Lienzo de clase</p>{plan?<input value={plan.title} onChange={(event)=>setPlan({...plan,title:event.target.value.slice(0,80)})} className="mt-1 w-full border-0 bg-transparent text-2xl font-black text-white outline-none placeholder:text-white/25" aria-label="Nombre de la clase"/>:<h2 className="mt-1 text-2xl font-black">Clase nueva</h2>}<p className="mt-1 text-xs text-white/45">Arrastra ejercicios aquí o agrégalos con el botón +. Todo se guarda en este dispositivo.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>{const fresh=emptyVisualPlan();setPlan(fresh);setCurrentBlock(0);setSecondsLeft(0)}} className="tool-button"><Plus/>Nueva</button><button type="button" onClick={addCustomBlock} className="tool-button"><Layers3/>Bloque libre</button><button type="button" onClick={saveTemplate} disabled={!plan?.blocks.length} className="tool-button disabled:opacity-35"><Save/>Plantilla</button><button type="button" onClick={openTrainer} disabled={!plan?.blocks.length} className="tool-button border-emerald-300/30 bg-emerald-500/15 disabled:opacity-35"><Play/>Presentar</button></div></header>

              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"><div className="rounded-2xl border border-white/[.08] bg-black/20 p-4"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-black uppercase tracking-wider text-white/45">Duración construida</span><b className={`text-2xl ${plan?.duration===duration?'text-emerald-300':(plan?.duration||0)>duration?'text-amber-300':'text-white'}`}>{plan?.duration||0} min</b></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><i className={`block h-full rounded-full ${(plan?.duration||0)>duration?'bg-amber-400':'bg-emerald-400'}`} style={{width:`${Math.min(100,(plan?.duration||0)/duration*100)}%`}}/></div><p className="mt-2 text-[10px] text-white/40">{!plan?.duration?"Agrega el primer bloque.":plan.duration===duration?"La clase coincide exactamente con el objetivo.":plan.duration<duration?`Faltan ${duration-plan.duration} minutos para el objetivo.`:`Supera el objetivo por ${plan.duration-duration} minutos.`}</p></div><Field label="Objetivo"><select value={duration} onChange={(event)=>setDuration(Number(event.target.value))} className="field-select min-w-32">{[30,45,60,75,90,120].map((value)=><option key={value} value={value}>{value} min</option>)}</select></Field></div>

              <div className="mt-5 space-y-2">{plan?.blocks.map((block,index)=><div key={block.id}><div onDragOver={(event)=>{event.preventDefault();event.dataTransfer.dropEffect="move"}} onDrop={(event)=>dropOnTimeline(event,index)} className="group grid h-3 place-items-center"><i className="h-1 w-full rounded-full bg-transparent transition group-hover:bg-cyan-300/40"/></div><article draggable onDragStart={(event)=>{event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("application/x-training-block",block.id)}} className="grid min-w-0 gap-3 rounded-2xl border border-white/[.09] bg-black/25 p-3 md:grid-cols-[auto_minmax(0,1fr)_110px] md:p-4"><div className="flex items-center gap-1 md:flex-col"><GripVertical className="h-5 w-5 cursor-grab text-white/25"/><button type="button" onClick={()=>moveVisualBlock(block.id,-1)} disabled={index===0} className="builder-icon" aria-label="Subir bloque"><ChevronUp/></button><button type="button" onClick={()=>moveVisualBlock(block.id,1)} disabled={index===plan.blocks.length-1} className="builder-icon" aria-label="Bajar bloque"><ChevronDown/></button></div><div className="min-w-0"><div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)]"><select value={block.phase} onChange={(event)=>updateBlock(block.id,{phase:event.target.value as TrainingBlock["phase"]})} className="builder-control text-[10px] font-black uppercase">{(Object.keys(TRAINING_PHASE_LABELS) as TrainingBlock["phase"][]).map((phase)=><option key={phase} value={phase}>{TRAINING_PHASE_LABELS[phase]}</option>)}</select><input value={block.title} onChange={(event)=>updateBlock(block.id,{title:event.target.value.slice(0,90)})} className="builder-control font-black" aria-label={`Título del bloque ${index+1}`}/></div><textarea value={block.instruction} onChange={(event)=>updateBlock(block.id,{instruction:event.target.value.slice(0,500)})} rows={2} className="builder-control mt-2 min-h-16 resize-y py-2 text-xs leading-relaxed" aria-label={`Instrucciones del bloque ${index+1}`}/><div className="mt-2 flex flex-wrap gap-2"><select value={block.equipment} onChange={(event)=>updateBlock(block.id,{equipment:event.target.value as TrainingBlock["equipment"]})} className="builder-control h-9 w-auto min-w-40 text-[10px]">{(Object.keys(equipmentLabels) as EquipmentFilter[]).filter((value)=>value!=="cualquiera").map((value)=><option key={value} value={value}>{equipmentLabels[value]}</option>)}</select><button type="button" onClick={()=>duplicateBlock(block.id)} className="builder-mini"><Copy/>Duplicar</button><button type="button" onClick={()=>removeBlock(block.id)} className="builder-mini text-rose-300"><Trash2/>Eliminar</button></div></div><label className="rounded-2xl border border-emerald-300/15 bg-emerald-500/[.07] p-3 text-center"><span className="block text-[9px] font-black uppercase text-emerald-200">Minutos</span><input type="number" min="1" max="60" value={block.minutes} onChange={(event)=>updateBlock(block.id,{minutes:Number(event.target.value)})} className="mt-1 w-full bg-transparent text-center font-mono text-2xl font-black text-white outline-none"/></label></article></div>)}<div onDragOver={(event)=>{event.preventDefault();event.dataTransfer.dropEffect="copy"}} onDrop={(event)=>dropOnTimeline(event,plan?.blocks.length||0)} className={`grid min-h-28 place-items-center rounded-2xl border border-dashed p-5 text-center transition ${plan?.blocks.length?'border-white/10 bg-white/[.015]':'border-cyan-300/25 bg-cyan-500/[.04]'}`}><div><Plus className="mx-auto h-7 w-7 text-cyan-300/60"/><p className="mt-2 text-sm font-black text-white/60">{plan?.blocks.length?"Suelta aquí para agregar al final":"Arrastra aquí tu primer ejercicio"}</p><p className="mt-1 text-[10px] text-white/35">También puedes crear un bloque libre.</p></div></div></div>
            </div>
          </div>

          <section className="rounded-[26px] border border-white/10 bg-[#090b0d] p-4 md:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-300">Reutiliza tu trabajo</p><h2 className="mt-1 text-xl font-black">Plantillas guardadas</h2><p className="mt-1 text-xs text-white/45">Hasta ocho clases en este dispositivo.</p></div>{templateMessage&&<span className="rounded-full bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-200">{templateMessage}</span>}</div>{templates.length?<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{templates.map((template)=><article key={template.id} className="rounded-2xl border border-white/[.08] bg-black/20 p-4"><p className="text-[9px] font-black uppercase tracking-wider text-violet-300">{template.discipline} · {template.duration} min</p><h3 className="mt-1 line-clamp-2 min-h-10 font-black">{template.title}</h3><p className="mt-1 text-xs text-white/40">{template.blocks.length} bloques · {levelLabels[template.level]}</p><div className="mt-4 grid grid-cols-[1fr_auto] gap-2"><button type="button" onClick={()=>loadTemplate(template)} className="min-h-10 rounded-xl bg-violet-400 px-3 text-xs font-black text-violet-950">Cargar</button><button type="button" onClick={()=>setTemplates((items)=>items.filter((item)=>item.id!==template.id))} className="builder-icon text-rose-300" aria-label={`Eliminar plantilla ${template.title}`}><Trash2/></button></div></article>)}</div>:<div className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/35">Cuando termines una clase, presiona “Plantilla” para conservarla.</div>}</section>
        </section>
      )}

      {view === "entrenador" && (
        <section className="rounded-[28px] border border-white/10 bg-[#050708] p-3 shadow-2xl md:p-6">
          {plan && current ? (
            <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
              <div className="relative flex min-h-[620px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-[#10191a] to-black p-5 text-center md:p-8">
                <div className="flex items-center justify-between gap-3 text-white">
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200">Bloque {currentBlock + 1} de {plan.blocks.length}</span>
                  <span className="flex items-center gap-2 font-mono text-sm font-black tabular-nums text-white/65"><Clock3 className="h-4 w-4 text-emerald-300" /> {wallClock}</span>
                  <button type="button" onClick={() => void toggleFullscreen()} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/[.06] text-white hover:bg-white/10" aria-label="Alternar pantalla completa"><Expand /></button>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center py-6">
                  <p className="text-xs font-black uppercase tracking-[.24em] text-emerald-300">{TRAINING_PHASE_LABELS[current.phase]}</p>
                  <h2 className="mt-3 max-w-4xl text-3xl font-black uppercase text-white md:text-6xl">{current.title}</h2>
                  <strong className={`my-5 font-mono text-[clamp(5rem,17vw,13rem)] font-black leading-none tabular-nums ${secondsLeft <= 10 ? "text-red-300" : "text-white"}`}>{formatClock(secondsLeft)}</strong>
                  <p className="max-w-3xl text-base leading-relaxed text-white/70 md:text-xl">{current.instruction}</p>
                  <span className="mt-5 rounded-full border border-white/10 bg-white/[.05] px-4 py-2 text-xs font-bold text-white/60">Material: {equipmentLabels[current.equipment]}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-[width] duration-1000" style={{ width: `${progress}%` }} /></div>
                <div className="mt-5 grid grid-cols-[auto_1fr_auto] gap-3">
                  <button type="button" disabled={currentBlock === 0} onClick={() => moveBlock(-1)} className="trainer-side-button"><ChevronLeft /></button>
                  <button type="button" onClick={() => setRunning((value) => !value)} className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-emerald-500 text-lg font-black text-[#03100b] hover:bg-emerald-400"><span className="grid h-10 w-10 place-items-center rounded-full bg-black/15">{running ? <Pause /> : <Play />}</span>{running ? "Pausar" : secondsLeft === current.minutes * 60 ? "Iniciar bloque" : "Continuar"}</button>
                  <button type="button" disabled={currentBlock === plan.blocks.length - 1} onClick={() => moveBlock(1)} className="trainer-side-button"><ChevronRight /></button>
                </div>
                <button type="button" onClick={() => selectBlock(currentBlock)} className="mx-auto mt-3 flex items-center gap-2 text-xs font-black text-white/70 hover:text-white"><RotateCcw className="h-4 w-4" /> Reiniciar bloque</button>
              </div>

              <aside className="rounded-[24px] border border-white/10 bg-[#0a0c0e] p-4">
                <div className="mb-4 flex items-center gap-3"><ShieldCheck className="text-emerald-300" /><div><h3 className="font-black uppercase">Ruta de la clase</h3><p className="text-xs text-white/70">{Math.round(progress)}% completado</p></div></div>
                <div className="space-y-2">
                  {plan.blocks.map((block, index) => (
                    <button key={block.id} type="button" onClick={() => selectBlock(index)} className={`w-full rounded-2xl border p-3 text-left text-white transition ${index === currentBlock ? "border-emerald-300/40 bg-emerald-500/12" : index < currentBlock ? "border-white/10 bg-white/[.04] opacity-60" : "border-white/10 bg-black/20 hover:bg-white/[.04]"}`}>
                      <div className="flex items-center justify-between gap-3"><span className="text-[9px] font-black uppercase tracking-wider text-white/70">{TRAINING_PHASE_LABELS[block.phase]}</span><span className="font-mono text-xs font-black text-emerald-200">{block.minutes} min</span></div><p className="mt-1 truncate text-sm font-black">{block.title}</p>
                    </button>
                  ))}
                </div>
              </aside>
            </div>
          ) : (
            <div className="grid min-h-[520px] place-items-center text-center"><div><TimerReset className="mx-auto mb-4 h-12 w-12 text-white/70" /><h2 className="text-xl font-black uppercase">No hay una clase preparada</h2><p className="mt-2 text-sm text-white/70">Genera una sesión para activar el cronómetro del entrenador.</p><button type="button" onClick={() => setView("generador")} className="mt-5 rounded-2xl bg-emerald-500 px-5 py-3 font-black text-[#03100b]">Ir al generador</button></div></div>
          )}
        </section>
      )}

      {view === "ruleta" && (
        <section className="grid gap-5 xl:grid-cols-[340px_1fr]">
          <div className="rounded-[26px] border border-white/10 bg-[#090b0d] p-5">
            <div className="mb-5 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-500/15 text-orange-300"><Dices /></span><div><h2 className="font-black uppercase">Filtros de ruleta</h2><p className="text-xs text-white/70">Evita ejercicios incompatibles</p></div></div>
            <div className="space-y-4">
              <Field label="Disciplina"><select value={rouletteDiscipline} onChange={(event) => setRouletteDiscipline(event.target.value as TrainingDiscipline)} className="field-select">{disciplineOptions.map((value) => <option key={value}>{value}</option>)}</select></Field>
              <Field label="Objetivo"><select value={rouletteFocus} onChange={(event) => setRouletteFocus(event.target.value as TrainingFocus)} className="field-select">{(Object.keys(focusLabels) as TrainingFocus[]).map((value) => <option key={value} value={value}>{focusLabels[value]}</option>)}</select></Field>
              <Field label="Nivel"><select value={rouletteLevel} onChange={(event) => setRouletteLevel(event.target.value as TrainingLevel)} className="field-select">{(Object.keys(levelLabels) as TrainingLevel[]).map((value) => <option key={value} value={value}>{levelLabels[value]}</option>)}</select></Field>
              <Field label="Material disponible"><select value={equipment} onChange={(event) => setEquipment(event.target.value as EquipmentFilter)} className="field-select">{(Object.keys(equipmentLabels) as EquipmentFilter[]).map((value) => <option key={value} value={value}>{equipmentLabels[value]}</option>)}</select></Field>
              <p className="rounded-xl border border-white/10 bg-white/[.04] p-3 text-xs text-white/70"><strong className="text-white">{roulettePool.length}</strong> ejercicios compatibles. La ruleta evita los cuatro resultados más recientes.</p>
            </div>
          </div>

          <div className="relative grid min-h-[600px] place-items-center overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(249,115,22,.14),transparent_58%),#050607] p-5 text-center">
            <div className={`w-full max-w-3xl transition duration-150 ${spinning ? "scale-[.97] blur-[1px]" : "scale-100"}`}>
              <div className="mx-auto mb-5 grid h-24 w-24 place-items-center rounded-full border-4 border-orange-300/30 bg-orange-500/15 text-orange-200 shadow-[0_0_70px_rgba(249,115,22,.18)]"><Dices className={`h-11 w-11 ${spinning ? "animate-spin" : ""}`} /></div>
              {rouletteResult ? (
                <><p className="text-xs font-black uppercase tracking-[.22em] text-orange-300">{rouletteDiscipline} · intensidad {rouletteResult.intensity}/3</p><h2 className="mt-3 text-3xl font-black uppercase text-white md:text-6xl">{rouletteResult.title}</h2><p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70 md:text-xl">{rouletteResult.instruction}</p><div className="mt-5 flex flex-wrap justify-center gap-2"><span className="roulette-tag">{equipmentLabels[rouletteResult.equipment]}</span>{rouletteResult.phases.map((phase) => <span key={phase} className="roulette-tag">{TRAINING_PHASE_LABELS[phase]}</span>)}</div></>
              ) : (
                <><p className="text-xs font-black uppercase tracking-[.22em] text-orange-300">Lista para girar</p><h2 className="mt-3 text-3xl font-black uppercase text-white md:text-5xl">¿Qué hacemos ahora?</h2><p className="mx-auto mt-4 max-w-xl text-white/70">La elección se hace únicamente entre ejercicios adecuados para tus filtros.</p></>
              )}
              <button type="button" disabled={spinning || roulettePool.length === 0} onClick={spin} className="mx-auto mt-8 flex min-h-16 min-w-56 items-center justify-center gap-3 rounded-full bg-orange-500 px-8 text-lg font-black text-[#170701] shadow-[0_12px_50px_rgba(249,115,22,.25)] transition hover:bg-orange-400 active:scale-[.98] disabled:opacity-50"><Dices /> {spinning ? "Girando…" : roulettePool.length ? "Girar ruleta" : "Sin opciones"}</button>
            </div>
          </div>
        </section>
      )}

      <style jsx global>{`
        .field-select, .field-input { height: 2.75rem; width: 100%; border-radius: .9rem; border: 1px solid rgba(255,255,255,.12); background: #07090b; padding: 0 .8rem; color: white; outline: none; }
        .field-select:focus, .field-input:focus { border-color: rgba(110,231,183,.55); box-shadow: 0 0 0 3px rgba(16,185,129,.1); }
        .field-select option { background: #07090b; color: white; }
        .tool-button { display: inline-flex; min-height: 2.6rem; align-items: center; gap: .45rem; border-radius: .85rem; border: 1px solid rgba(255,255,255,.15); background: #080a0c; padding: 0 .8rem; color: white; font-size: .75rem; font-weight: 900; }
        .tool-button svg { width: 1rem; height: 1rem; }
        .trainer-side-button { display: grid; min-height: 4rem; min-width: 3.5rem; place-items: center; border-radius: 1rem; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); color: white; }
        .trainer-side-button:disabled { opacity: .25; }
        .roulette-tag { border-radius: 999px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); padding: .45rem .8rem; color: rgba(255,255,255,.7); font-size: .68rem; font-weight: 800; }
        .builder-tag { border-radius: 999px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); padding: .25rem .5rem; color: rgba(255,255,255,.45); font-size: .55rem; font-weight: 800; }
        .builder-control { min-height: 2.5rem; width: 100%; min-width: 0; border-radius: .75rem; border: 1px solid rgba(255,255,255,.1); background: #07090b; padding: 0 .7rem; color: white; outline: none; }
        .builder-control:focus { border-color: rgba(103,232,249,.45); box-shadow: 0 0 0 3px rgba(34,211,238,.08); }
        .builder-control option { background: #07090b; color: white; }
        .builder-icon { display: grid; height: 2.25rem; width: 2.25rem; flex-shrink: 0; place-items: center; border-radius: .7rem; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); color: rgba(255,255,255,.65); }
        .builder-icon:disabled { opacity: .2; }
        .builder-icon svg { height: .9rem; width: .9rem; }
        .builder-mini { display: inline-flex; min-height: 2.25rem; align-items: center; gap: .35rem; border-radius: .7rem; border: 1px solid rgba(255,255,255,.09); background: rgba(255,255,255,.035); padding: 0 .65rem; font-size: .62rem; font-weight: 800; }
        .builder-mini svg { height: .8rem; width: .8rem; }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[.14em] text-white/70">{label}</span>{children}</label>;
}
