"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { LibraryBig, Network, Save } from "lucide-react";

import { AdminAthletePicker, type ProgressAthlete } from "@/components/progress/admin-athlete-picker";
import { RepertoireView } from "@/components/progress/repertoire-view";
import { SkillTreeView } from "@/components/progress/skill-tree-view";
import { useFirestore } from "@/firebase";
import { SKILL_DISCIPLINES, normalizeSkillDiscipline, type SkillDiscipline, type SkillProgress } from "@/lib/athlete-progress";
import { isBillableAthlete } from "@/lib/member-role";
import { normalizeRepertoireProgress } from "@/lib/athlete-repertoire";
import { cn } from "@/lib/utils";

type SkillSection = "arbol" | "repertorio";
type AthleteWithRepertoire = ProgressAthlete & { repertorio?: SkillProgress };

export default function AdminSkillTreePage() {
  const db = useFirestore();
  const [site, setSite] = useState("MMA");
  const [athletes, setAthletes] = useState<AthleteWithRepertoire[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [section, setSection] = useState<SkillSection>("arbol");
  const [discipline, setDiscipline] = useState<SkillDiscipline>("Jiu-Jitsu");
  const [progress, setProgress] = useState<SkillProgress>({});
  const [repertoire, setRepertoire] = useState<SkillProgress>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setSite(localStorage.getItem("userSede") || "MMA"), []);

  const load = useCallback(async () => {
    if (!db) return;
    const snapshot = await getDocs(query(collection(db, "Alumnos"), where("sede", "==", site)));
    const data = snapshot.docs
      .filter((entry) => entry.data().activo !== false && isBillableAthlete(entry.data().rol))
      .map((entry) => ({
        id: entry.id,
        nombre: String(entry.data().nombre || "Atleta"),
        disciplina: String(entry.data().disciplina || ""),
        habilidades: (entry.data().habilidadesTecnicas || {}) as SkillProgress,
        repertorio: normalizeRepertoireProgress((entry.data().repertorioTecnico || {}) as SkillProgress),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    setAthletes(data);
    setSelectedId((current) => data.some((athlete) => athlete.id === current) ? current : data[0]?.id || "");
  }, [db, site]);

  useEffect(() => { void load(); }, [load]);
  const selected = athletes.find((athlete) => athlete.id === selectedId);

  useEffect(() => {
    if (!selected) return;
    setDiscipline(normalizeSkillDiscipline(selected.disciplina));
    setProgress(selected.habilidades || {});
    setRepertoire(selected.repertorio || {});
    setMessage("");
  }, [selected]);

  async function save() {
    if (!db || !selected) return;
    setSaving(true);
    setMessage("");
    try {
      await updateDoc(doc(db, "Alumnos", selected.id), {
        habilidadesTecnicas: progress,
        habilidadesDisciplina: discipline,
        repertorioTecnico: repertoire,
        habilidadesActualizadasEn: new Date().toISOString(),
      });
      setAthletes((current) => current.map((athlete) => athlete.id === selected.id ? { ...athlete, habilidades: progress, repertorio: repertoire } : athlete));
      setMessage(section === "repertorio" ? "Repertorio guardado. El atleta ya puede consultarlo." : "Progreso guardado. El atleta ya puede verlo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white md:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><p className="flex items-center gap-2 text-sm font-bold text-cyan-300"><Network className="h-4 w-4" /> Seguimiento técnico</p><h1 className="text-3xl font-black">Árbol de habilidades</h1><p className="text-slate-400">Evalúa el árbol por disciplina o el repertorio individual de derribes y sumisiones.</p></div>
        <button onClick={save} disabled={!selected || saving} className="flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 font-black text-slate-950 disabled:opacity-40"><Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar"}</button>
      </header>

      <div className="mb-5 grid gap-4 rounded-2xl border border-white/10 bg-white/[.04] p-4 md:grid-cols-2">
        <AdminAthletePicker athletes={athletes} selectedId={selectedId} onSelect={setSelectedId} />
        <label><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">Disciplina del árbol</span><select value={discipline} onChange={(event) => setDiscipline(event.target.value as SkillDiscipline)} disabled={section === "repertorio"} className="w-full rounded-xl border border-white/15 bg-slate-950 p-3 font-bold disabled:opacity-45">{SKILL_DISCIPLINES.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>

      <nav className="mb-5 grid gap-2 rounded-2xl border border-white/10 bg-black/30 p-2 sm:grid-cols-2" aria-label="Apartados de habilidades">
        <button type="button" onClick={() => setSection("arbol")} className={cn("flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition", section === "arbol" ? "bg-amber-400 text-slate-950 shadow-[0_0_24px_rgba(251,191,36,.2)]" : "text-slate-400 hover:bg-white/5 hover:text-white")}><Network className="h-4 w-4" /> Árbol técnico</button>
        <button type="button" onClick={() => setSection("repertorio")} className={cn("flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition", section === "repertorio" ? "bg-cyan-400 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,.2)]" : "text-slate-400 hover:bg-white/5 hover:text-white")}><LibraryBig className="h-4 w-4" /> Repertorio</button>
      </nav>

      {message && <p className="mb-4 rounded-xl bg-emerald-500/15 p-3 text-emerald-200">{message}</p>}
      {section === "arbol" ? <SkillTreeView discipline={discipline} progress={progress} editable saving={saving} onChange={setProgress} /> : <RepertoireView progress={repertoire} editable saving={saving} onChange={setRepertoire} />}
    </main>
  );
}
