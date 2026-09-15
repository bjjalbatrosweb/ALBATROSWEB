"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Flag, Loader2, Save, Target } from "lucide-react";

import { useUser } from "@/firebase";
import { apiErrorMessage, apiRequest } from "@/lib/api-client";
import {
  weeklyGoalWeekKey,
  type AthleteWeeklyGoal,
  type WeeklyGoalFocus,
} from "@/lib/athlete-weekly-goal";

type GoalResponse = {
  ok?: boolean;
  mensaje?: string;
  weekKey?: string;
  goal?: AthleteWeeklyGoal | null;
  completedSessions?: number;
};

const labels: Record<WeeklyGoalFocus, string> = {
  constancia: "Constancia",
  tecnica: "Técnica",
  acondicionamiento: "Acondicionamiento",
  recuperacion: "Recuperación",
};

function emptyGoal(): AthleteWeeklyGoal {
  return { weekKey: weeklyGoalWeekKey(), focus: "constancia", targetSessions: 3, note: "" };
}

export function WeeklyGoalCard() {
  const { user } = useUser();
  const [goal, setGoal] = useState<AthleteWeeklyGoal>(emptyGoal);
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const { response, data } = await apiRequest<GoalResponse>("/api/meta-semanal", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok || !data.ok) throw new Error(apiErrorMessage(response.status, data.mensaje, "No se pudo cargar tu meta."));
      setGoal(data.goal || { ...emptyGoal(), weekKey: data.weekKey || weeklyGoalWeekKey() });
      setCompleted(Math.max(0, Number(data.completedSessions) || 0));
      setSaved(Boolean(data.goal));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar tu meta.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!user || saving) return;
    setSaving(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const { response, data } = await apiRequest<GoalResponse>("/api/meta-semanal", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(goal),
      });
      if (!response.ok || !data.ok || !data.goal) throw new Error(apiErrorMessage(response.status, data.mensaje, "No se pudo guardar tu meta."));
      setGoal(data.goal);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar tu meta.");
    } finally {
      setSaving(false);
    }
  }

  const progress = Math.min(100, Math.round((completed / goal.targetSessions) * 100));
  const complete = completed >= goal.targetSessions;
  const edit = <K extends keyof AthleteWeeklyGoal>(key: K, value: AthleteWeeklyGoal[K]) => {
    setGoal((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  return <section className="rounded-[2rem] border border-violet-300/15 bg-[radial-gradient(circle_at_90%_0%,rgba(139,92,246,.15),transparent_34%),#12141a] p-5 text-white sm:p-6" aria-busy={loading}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-violet-300"><Target className="h-4 w-4"/>Meta semanal personal</p><h2 className="mt-1 text-2xl font-black">Define una intención alcanzable</h2><p className="mt-1 text-sm text-slate-400">Las asistencias registradas actualizan el avance; no altera evaluaciones oficiales.</p></div><div className={`rounded-full px-3 py-1.5 text-xs font-black ${complete?'bg-emerald-400/15 text-emerald-200':'bg-violet-400/15 text-violet-200'}`}>{complete?'Meta cumplida':`${completed}/${goal.targetSessions} sesiones`}</div></div>{loading?<div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-violet-300"/><span className="sr-only">Cargando meta semanal</span></div>:<><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px]"><label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">Enfoque</span><select value={goal.focus} onChange={(event)=>edit("focus",event.target.value as WeeklyGoalFocus)} className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1016] px-3 text-sm text-white">{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">Sesiones esta semana</span><input type="number" inputMode="numeric" min={1} max={14} value={goal.targetSessions} onChange={(event)=>edit("targetSessions",Math.max(1,Math.min(14,Number(event.target.value)||1)))} className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1016] px-3 text-sm text-white outline-none focus:border-violet-300"/></label><label className="sm:col-span-2"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">Nota opcional</span><textarea value={goal.note} maxLength={160} rows={2} onChange={(event)=>edit("note",event.target.value)} placeholder="Ej. practicar guardia dos veces y dejar un día de recuperación" className="w-full resize-y rounded-xl border border-white/10 bg-[#0d1016] p-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-300"/><small className="block text-right text-slate-600">{goal.note.length}/160</small></label></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Avance de meta semanal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i className={`block h-full transition-all ${complete?'bg-emerald-300':'bg-violet-300'}`} style={{width:`${progress}%`}}/></div>{error&&<p role="alert" className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}<button type="button" onClick={()=>void save()} disabled={saving||saved} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-300 px-5 font-black text-slate-950 disabled:bg-white/10 disabled:text-slate-400">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:saved?<Check className="h-4 w-4"/>:<Save className="h-4 w-4"/>}{saving?'Guardando…':saved?'Meta guardada':'Guardar meta semanal'}</button><p className="mt-3 flex items-start gap-2 text-[10px] leading-4 text-slate-500"><Flag className="mt-0.5 h-3.5 w-3.5 shrink-0"/>La semana comienza el lunes. El contador usa únicamente asistencias confirmadas por la academia.</p></>}</section>;
}
