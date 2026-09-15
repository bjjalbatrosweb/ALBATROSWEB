"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { SUBMISSION_REPERTOIRE } from "@/lib/submission-curriculum";
import { TAKEDOWN_REPERTOIRE } from "@/lib/takedown-curriculum";

type BoardKind = "submissions" | "takedowns";
type RankingBoards = Record<BoardKind, Record<string, string[]>>;
type DraggedTechnique = { kind: BoardKind; tier: string; name: string };

const BOARD_CONFIG: Record<BoardKind, { label: string; singular: string; detail: string; tiers: string[] }> = {
  submissions: {
    label: "Sumisiones",
    singular: "sumisión",
    detail: "Ordena controles y finalizaciones de S a E.",
    tiers: ["S", "A", "B", "C", "D", "E"],
  },
  takedowns: {
    label: "Derribes",
    singular: "derribe",
    detail: "Clasifica entradas y proyecciones de S a C.",
    tiers: ["S", "A", "B", "C"],
  },
};

const TIER_STYLE: Record<string, { stripe: string; glow: string; badge: string }> = {
  S: { stripe: "from-rose-500 via-red-400 to-orange-300", glow: "shadow-rose-500/10", badge: "border-rose-300/35 bg-rose-400/15 text-rose-100" },
  A: { stripe: "from-orange-500 via-amber-400 to-yellow-300", glow: "shadow-orange-500/10", badge: "border-orange-300/35 bg-orange-400/15 text-orange-100" },
  B: { stripe: "from-yellow-400 via-lime-300 to-emerald-300", glow: "shadow-yellow-500/10", badge: "border-yellow-300/35 bg-yellow-400/15 text-yellow-50" },
  C: { stripe: "from-emerald-400 via-teal-300 to-cyan-300", glow: "shadow-emerald-500/10", badge: "border-emerald-300/35 bg-emerald-400/15 text-emerald-50" },
  D: { stripe: "from-cyan-400 via-sky-400 to-blue-500", glow: "shadow-cyan-500/10", badge: "border-cyan-300/35 bg-cyan-400/15 text-cyan-50" },
  E: { stripe: "from-violet-400 via-purple-500 to-fuchsia-500", glow: "shadow-violet-500/10", badge: "border-violet-300/35 bg-violet-400/15 text-violet-50" },
};

function defaultBoards(): RankingBoards {
  return {
    submissions: {
      S: [], A: [], B: [], C: [], D: [],
      E: [...SUBMISSION_REPERTOIRE],
    },
    takedowns: {
      S: [], A: [], B: [],
      C: [...TAKEDOWN_REPERTOIRE],
    },
  };
}

function normalizeBoards(value: unknown): RankingBoards {
  const defaults = defaultBoards();
  if (!value || typeof value !== "object") return defaults;
  const source = value as Partial<RankingBoards>;
  const result = defaultBoards();
  (["submissions", "takedowns"] as BoardKind[]).forEach((kind) => {
    const seen = new Set<string>();
    const submissionAliases: Record<string, string> = {
      "mata león": "Mataleón",
      anaconda: "Anaconda / Anakonda",
      ezequiel: "Ezekiel",
      armbar: "Armbar / Juji-gatame",
      aquiles: "Aquiles / Foot lock",
      "palanca de tobillo": "Aquiles / Foot lock",
      "knee bar": "Kneebar",
      "arm triangle / kata gatame": "Kata-gatame",
    };
    const takedownAliases: Record<string, string> = {
      "sode tsurikomi goshi": "Sode tsurikomi",
      "sasae tsurikomi ashi": "Sasae tsurikomi",
      "head and arm (o-goshi)": "Head and arm / O-goshi",
      ducks: "Duck under",
      "single led": "Single leg",
      "bouble leg": "Double leg",
      "kani basani": "Kani basami",
    };
    const retired = new Set(["americana", "estrangulación de solapa"]);
    BOARD_CONFIG[kind].tiers.forEach((tier) => {
      const raw = source[kind]?.[tier];
      result[kind][tier] = Array.isArray(raw)
        ? raw.map((item) => {
            const clean = String(item || "").trim().slice(0, 60);
            const aliases = kind === "submissions" ? submissionAliases : takedownAliases;
            return aliases[clean.toLocaleLowerCase("es")] || clean;
          }).filter((item) => {
            const key = item.toLocaleLowerCase("es");
            if (!item || seen.has(key) || (kind === "submissions" && retired.has(key))) return false;
            seen.add(key);
            return true;
          })
        : [];
    });
    const lowestTier = BOARD_CONFIG[kind].tiers.at(-1) || "C";
    Object.values(defaults[kind]).flat().forEach((name) => {
      const key = name.toLocaleLowerCase("es");
      if (seen.has(key)) return;
      result[kind][lowestTier].push(name);
      seen.add(key);
    });
  });
  return result;
}

export default function TechnicalRankingPage() {
  const [boards, setBoards] = useState<RankingBoards>(defaultBoards), [active, setActive] = useState<BoardKind>("submissions"), [search, setSearch] = useState(""), [draft, setDraft] = useState(""), [ready, setReady] = useState(false), [site, setSite] = useState("MMA"), [dragged, setDragged] = useState<DraggedTechnique | null>(null), [overTier, setOverTier] = useState(""), [recent, setRecent] = useState("");
  const recentTimer = useRef<number | null>(null);
  const storageKey = `albatros-technical-ranking-v1:${site}`;

  useEffect(() => {
    const selectedSite = localStorage.getItem("userSede") || "MMA";
    setSite(selectedSite);
    try {
      const raw = localStorage.getItem(`albatros-technical-ranking-v1:${selectedSite}`);
      if (raw) setBoards(normalizeBoards(JSON.parse(raw)));
    } catch { setBoards(defaultBoards()); }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => localStorage.setItem(storageKey, JSON.stringify(boards)), 180);
    return () => window.clearTimeout(timer);
  }, [boards, ready, storageKey]);
  useEffect(() => () => { if (recentTimer.current) window.clearTimeout(recentTimer.current); }, []);

  const flash = useCallback((name: string) => {
    setRecent(name);
    if (recentTimer.current) window.clearTimeout(recentTimer.current);
    recentTimer.current = window.setTimeout(() => setRecent(""), 420);
  }, []);
  const findTier = useCallback((kind: BoardKind, name: string) => BOARD_CONFIG[kind].tiers.find((tier) => boards[kind][tier].includes(name)) || "", [boards]);
  const move = useCallback((kind: BoardKind, name: string, targetTier: string, before = "") => {
    if (!BOARD_CONFIG[kind].tiers.includes(targetTier)) return;
    setBoards((current) => {
      const next: RankingBoards = {
        submissions: Object.fromEntries(Object.entries(current.submissions).map(([tier, names]) => [tier, [...names]])),
        takedowns: Object.fromEntries(Object.entries(current.takedowns).map(([tier, names]) => [tier, [...names]])),
      };
      BOARD_CONFIG[kind].tiers.forEach((tier) => { next[kind][tier] = next[kind][tier].filter((item) => item !== name); });
      const insertion = before ? next[kind][targetTier].indexOf(before) : -1;
      if (insertion >= 0) next[kind][targetTier].splice(insertion, 0, name);
      else next[kind][targetTier].push(name);
      return next;
    });
    flash(name);
  }, [flash]);
  const moveStep = useCallback((kind: BoardKind, name: string, direction: -1 | 1) => {
    const tiers = BOARD_CONFIG[kind].tiers, currentTier = findTier(kind, name), index = tiers.indexOf(currentTier), target = tiers[index + direction];
    if (target) move(kind, name, target);
  }, [findTier, move]);
  const remove = useCallback((kind: BoardKind, name: string) => {
    setBoards((current) => ({ ...current, [kind]: Object.fromEntries(Object.entries(current[kind]).map(([tier, names]) => [tier, names.filter((item) => item !== name)])) }));
  }, []);
  const add = () => {
    const name = draft.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!name) return;
    const exists = BOARD_CONFIG[active].tiers.some((tier) => boards[active][tier].some((item) => item.localeCompare(name, "es", { sensitivity: "base" }) === 0));
    if (exists) { flash(name); return; }
    move(active, name, BOARD_CONFIG[active].tiers.at(-1) || "C");
    setDraft("");
  };
  const reset = () => {
    if (!window.confirm("¿Restaurar las técnicas iniciales de ambos rankings?")) return;
    setBoards(defaultBoards()); setSearch(""); setDraft("");
  };
  const total = useMemo(() => BOARD_CONFIG[active].tiers.reduce((sum, tier) => sum + boards[active][tier].length, 0), [active, boards]);
  const query = search.trim().toLocaleLowerCase("es");
  const config = BOARD_CONFIG[active];

  return <main className="min-h-screen overflow-hidden bg-[#07080d] p-4 text-white sm:p-6 lg:p-8">
    <style jsx global>{`@keyframes tier-pop{0%{transform:scale(.88) rotate(-1deg);opacity:.45}65%{transform:scale(1.04) rotate(.4deg);opacity:1}100%{transform:scale(1) rotate(0)}}@keyframes tier-shine{0%{transform:translateX(-140%)}100%{transform:translateX(240%)}}@media(prefers-reduced-motion:reduce){.tier-motion,.tier-shine{animation:none!important;transition:none!important}}`}</style>
    <div className="mx-auto max-w-[1700px] space-y-6">
      <header className="relative overflow-hidden rounded-[2.4rem] border border-white/10 bg-[radial-gradient(circle_at_12%_0%,rgba(244,63,94,.2),transparent_30%),radial-gradient(circle_at_86%_10%,rgba(34,211,238,.16),transparent_34%),linear-gradient(135deg,#171019,#090b12_70%)] p-6 shadow-2xl sm:p-9">
        <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[42px] border-white/[.035]"/>
        <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.25em] text-rose-300"><Trophy className="h-4 w-4"/> Ranking técnico</p><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-7xl">Tu tier list de combate</h1><p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-lg">Arrastra cada cubo al peldaño que representa su utilidad para tu academia. El orden se guarda automáticamente en este dispositivo y sede.</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-100">GUARDADO AUTOMÁTICO</span><span className="rounded-full border border-white/10 bg-white/[.05] px-4 py-2 text-xs font-black text-slate-300">SEDE {site.replaceAll("_", " ")}</span></div></div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center"><div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[.035] p-2">{(["submissions","takedowns"] as BoardKind[]).map((kind)=>{const selected=active===kind;return <button key={kind} onClick={()=>{setActive(kind);setSearch("")}} className={`tier-motion relative min-h-16 overflow-hidden rounded-xl border px-4 text-left transition duration-300 ${selected?'border-rose-300/30 bg-gradient-to-r from-rose-500/20 to-cyan-500/10 shadow-lg':'border-transparent text-slate-500 hover:bg-white/[.05] hover:text-white'}`}><b className="block text-base sm:text-lg">{BOARD_CONFIG[kind].label}</b><span className="text-xs">{BOARD_CONFIG[kind].tiers.length} peldaños</span>{selected&&<span className="tier-shine absolute inset-y-0 w-16 -skew-x-12 bg-white/[.06] [animation:tier-shine_1.2s_ease-out_1]"/>}</button>})}</div><button onClick={reset} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[.04] px-5 font-bold text-slate-300 transition hover:border-red-300/25 hover:text-red-200"><RotateCcw className="h-4 w-4"/>Restaurar</button></section>

      <section className="grid gap-3 rounded-[2rem] border border-white/10 bg-[#0d1017] p-4 sm:grid-cols-[1fr_1fr_auto] sm:p-5"><label className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder={`Buscar ${config.singular}…`} className="h-14 w-full rounded-2xl border border-white/10 bg-black/25 pl-12 pr-4 font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35"/></label><label className="relative"><Plus className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"/><input value={draft} maxLength={60} onChange={(event)=>setDraft(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter")add()}} placeholder={`Agregar ${config.singular}…`} className="h-14 w-full rounded-2xl border border-white/10 bg-black/25 pl-12 pr-4 font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-rose-300/35"/></label><button disabled={!draft.trim()} onClick={add} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white px-6 font-black text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35"><Plus className="h-5 w-5"/>Agregar</button></section>

      <section className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-[#0b0d13] shadow-2xl"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.07] p-5 sm:p-6"><div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">{config.label}</p><h2 className="mt-1 text-2xl font-black">{config.detail}</h2></div><span className="rounded-full border border-white/10 bg-white/[.05] px-4 py-2 text-sm font-black text-slate-300">{total} técnicas</span></div><div className="space-y-2 p-2 sm:p-4">{config.tiers.map((tier,tierIndex)=>{const style=TIER_STYLE[tier],names=boards[active][tier].filter((name)=>!query||name.toLocaleLowerCase("es").includes(query));return <div key={tier} onDragOver={(event)=>{event.preventDefault();setOverTier(tier)}} onDragLeave={()=>setOverTier((value)=>value===tier?"":value)} onDrop={(event)=>{event.preventDefault();if(dragged?.kind===active)move(active,dragged.name,tier);setDragged(null);setOverTier("")}} className={`tier-motion grid min-h-28 grid-cols-[78px_1fr] overflow-hidden rounded-2xl border transition duration-300 sm:grid-cols-[104px_1fr] ${overTier===tier?'scale-[1.01] border-white/35 bg-white/[.08]':'border-white/[.07] bg-white/[.025]'}`}><div className={`relative grid place-items-center overflow-hidden bg-gradient-to-br ${style.stripe}`}><span className="absolute inset-0 bg-black/10"/><b className="relative text-4xl font-black text-slate-950 drop-shadow-sm sm:text-5xl">{tier}</b></div><div className="flex min-w-0 flex-wrap content-center gap-2 p-3 sm:p-4">{names.map((name)=>{const currentTier=findTier(active,name);return <article key={name} draggable onDragStart={(event)=>{event.dataTransfer.effectAllowed="move";setDragged({kind:active,tier:currentTier,name})}} onDragEnd={()=>{setDragged(null);setOverTier("")}} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();event.stopPropagation();if(dragged?.kind===active)move(active,dragged.name,tier,name);setDragged(null);setOverTier("")}} className={`tier-motion group relative flex min-h-16 min-w-[180px] max-w-full items-center gap-2 overflow-hidden rounded-2xl border bg-gradient-to-br from-white/[.105] to-white/[.035] p-2 pl-3 shadow-xl backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[.13] ${style.glow} ${recent===name?'[animation:tier-pop_.4s_ease-out_1] border-white/35':''}`}><GripVertical className="h-5 w-5 shrink-0 cursor-grab text-white/25 group-hover:text-white/60"/><b className="min-w-0 flex-1 break-words text-sm text-white sm:text-base">{name}</b><div className="flex shrink-0 gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><button disabled={tierIndex===0} onClick={()=>moveStep(active,name,-1)} className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.07] text-white transition hover:bg-white/15 disabled:opacity-20" aria-label={`Subir ${name}`}><ArrowUp className="h-4 w-4"/></button><button disabled={tierIndex===config.tiers.length-1} onClick={()=>moveStep(active,name,1)} className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.07] text-white transition hover:bg-white/15 disabled:opacity-20" aria-label={`Bajar ${name}`}><ArrowDown className="h-4 w-4"/></button><button onClick={()=>remove(active,name)} className="grid h-9 w-9 place-items-center rounded-xl bg-red-400/[.08] text-red-200 transition hover:bg-red-400/20" aria-label={`Eliminar ${name}`}><X className="h-4 w-4"/></button></div></article>})}{!names.length&&<div className={`flex min-h-16 flex-1 items-center justify-center rounded-2xl border border-dashed px-4 text-center text-sm ${overTier===tier?'border-white/30 text-white':'border-white/10 text-slate-600'}`}>{query?"Sin coincidencias en este peldaño":"Arrastra cubos aquí"}</div>}</div></div>})}</div></section>

      <footer className="grid gap-3 sm:grid-cols-3"><Info icon={GripVertical} title="Arrastra" detail="Mueve cualquier cubo entre peldaños."/><Info icon={ArrowUp} title="También con botones" detail="Útil en celular y para accesibilidad."/><Info icon={Shield} title="Privado por sede" detail="El orden queda en este dispositivo."/></footer>
    </div>
  </main>;
}

function Info({icon:Icon,title,detail}:{icon:typeof Sparkles;title:string;detail:string}){return <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[.07] text-cyan-200"><Icon className="h-5 w-5"/></span><span><b className="block text-sm text-white">{title}</b><small className="text-slate-500">{detail}</small></span></div>}
