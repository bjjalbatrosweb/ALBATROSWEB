"use client";

import { Check, CircleDot, Crosshair, LibraryBig, Sparkles } from "lucide-react";

import { nextSkillStatus, type SkillProgress, type SkillStatus } from "@/lib/athlete-progress";
import { REPERTOIRE_BRANCHES, repertoireSummary } from "@/lib/athlete-repertoire";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<SkillStatus, string> = {
  pendiente: "Pendiente",
  practicando: "Practicando",
  dominada: "Dominada",
};

export function RepertoireView({ progress, editable = false, saving = false, onChange }: {
  progress: SkillProgress;
  editable?: boolean;
  saving?: boolean;
  onChange?: (next: SkillProgress) => void;
}) {
  const summary = repertoireSummary(progress);
  const percent = Math.round((summary.mastered / summary.total) * 100);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-[#070b12] text-white shadow-[0_30px_100px_rgba(0,0,0,.55)]">
      <header className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_38%),radial-gradient(circle_at_top_right,rgba(168,85,247,.16),transparent_35%)] px-5 py-7 md:px-8">
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,.18)]">
              <LibraryBig className="h-8 w-8 text-cyan-200" />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.3em] text-cyan-300">Biblioteca técnica</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight">Repertorio</h2>
              <p className="mt-1 text-sm text-slate-400">Derribes y sumisiones disponibles para evaluar individualmente.</p>
            </div>
          </div>
          <div className="min-w-64 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-400">
              <span>Dominio del repertorio</span><span className="text-cyan-200">{summary.mastered}/{summary.total}</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-400 transition-all" style={{ width: `${percent}%` }} /></div>
            <div className="mt-3 flex justify-between text-[11px] font-bold"><span className="text-cyan-300">{summary.training} practicando</span><span className="text-slate-500">{summary.pending} pendientes</span></div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 p-4 md:p-7 xl:grid-cols-2">
        {REPERTOIRE_BRANCHES.map((branch, branchIndex) => (
          <article key={branch.id} className={cn("rounded-3xl border p-4 sm:p-5", branchIndex === 0 ? "border-cyan-400/20 bg-cyan-500/[.045]" : "border-violet-400/20 bg-violet-500/[.045]")}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex gap-3"><span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl border", branchIndex === 0 ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-200" : "border-violet-300/25 bg-violet-400/10 text-violet-200")}>{branchIndex === 0 ? <Crosshair className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}</span><div><h3 className="text-xl font-black">{branch.label}</h3><p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">{branch.description}</p></div></div>
              <span className="shrink-0 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-slate-300">{branch.techniques.filter((item) => progress[item] === "dominada").length}/{branch.techniques.length}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {branch.techniques.map((technique) => {
                const status = progress[technique] || "pendiente";
                return (
                  <button
                    key={technique}
                    type="button"
                    disabled={!editable || saving}
                    onClick={() => onChange?.({ ...progress, [technique]: nextSkillStatus(status) })}
                    className={cn("group flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition disabled:cursor-default", status === "dominada" ? "border-emerald-300/25 bg-emerald-400/10" : status === "practicando" ? "border-cyan-300/25 bg-cyan-400/10" : "border-white/10 bg-white/[.035]", editable && !saving && "hover:-translate-y-0.5 hover:border-white/25")}
                  >
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", status === "dominada" ? "bg-emerald-400 text-emerald-950" : status === "practicando" ? "bg-cyan-400 text-cyan-950" : "bg-white/10 text-slate-400")}>{status === "dominada" ? <Check className="h-5 w-5" /> : status === "practicando" ? <Sparkles className="h-4 w-4" /> : <CircleDot className="h-4 w-4" />}</span>
                    <span className="min-w-0"><b className="block text-sm leading-tight text-slate-100">{technique}</b><small className={cn("mt-1 block text-[10px] font-black uppercase tracking-wider", status === "dominada" ? "text-emerald-300" : status === "practicando" ? "text-cyan-300" : "text-slate-500")}>{STATUS_LABEL[status]}{editable ? " · pulsa para cambiar" : ""}</small></span>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
