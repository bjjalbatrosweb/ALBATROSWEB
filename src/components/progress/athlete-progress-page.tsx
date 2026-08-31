"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { Activity, LibraryBig, Loader2, Network } from "lucide-react";

import { useFirestore, useUser } from "@/firebase";
import type { HydrationSession } from "@/lib/hydration";
import { normalizeSkillDiscipline, type PhysicalAssessment, type PhysicalGoals, type SkillProgress, type WellnessCheckin } from "@/lib/athlete-progress";
import { cn } from "@/lib/utils";
import { normalizeRepertoireProgress } from "@/lib/athlete-repertoire";
import { PhysicalHistory } from "./physical-history";
import { RepertoireView } from "./repertoire-view";
import { SkillTreeView } from "./skill-tree-view";

type Data = {
  nombre: string;
  disciplina: string;
  habilidadesTecnicas: SkillProgress;
  repertorioTecnico: SkillProgress;
  historialFisico: PhysicalAssessment[];
  historialHidratacion: HydrationSession[];
  metasFisicas?: PhysicalGoals;
  bienestar: WellnessCheckin[];
};

export function AthleteProgressPage({ mode }: { mode: "skills" | "physical" }) {
  const db = useFirestore();
  const { user } = useUser();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [skillSection, setSkillSection] = useState<"arbol" | "repertorio">("arbol");

  useEffect(() => {
    void (async () => {
      if (!db || !user) return;
      try {
        const profile = await getDoc(doc(db, "usuarios", user.uid));
        const alumnoId = String(profile.data()?.alumnoId || "");
        if (!alumnoId) throw new Error("Tu cuenta todavía no está vinculada con un expediente de atleta.");
        const [athlete, wellness] = await Promise.all([
          getDoc(doc(db, "Alumnos", alumnoId)),
          mode === "physical" ? getDocs(query(collection(db, "BienestarAtletas"), where("alumnoId", "==", alumnoId))) : Promise.resolve(null),
        ]);
        if (!athlete.exists()) throw new Error("No se encontró tu expediente.");
        const value = athlete.data();
        const bienestar = (wellness?.docs || []).map((item) => item.data() as WellnessCheckin).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.fecha || "")).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 45);
        setData({
          nombre: String(value.nombre || "Atleta"),
          disciplina: String(value.habilidadesDisciplina || value.disciplina || ""),
          habilidadesTecnicas: (value.habilidadesTecnicas || {}) as SkillProgress,
          repertorioTecnico: normalizeRepertoireProgress((value.repertorioTecnico || {}) as SkillProgress),
          historialFisico: Array.isArray(value.historialFisico) ? value.historialFisico : [],
          historialHidratacion: Array.isArray(value.historialHidratacion) ? value.historialHidratacion : [],
          metasFisicas: (value.metasFisicas || {}) as PhysicalGoals,
          bienestar,
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo cargar la información.");
      }
    })();
  }, [db, user, mode]);

  if (error) return <main className="p-8 text-white"><p className="rounded-xl bg-red-500/15 p-4 text-red-200">{error}</p></main>;
  if (!data) return <main className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-cyan-300" /></main>;

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white md:p-8">
      <header className="mb-6"><p className="flex items-center gap-2 text-sm font-bold text-cyan-300">{mode === "skills" ? <Network className="h-4 w-4" /> : <Activity className="h-4 w-4" />} {data.nombre}</p><h1 className="text-3xl font-black">{mode === "skills" ? "Mis habilidades" : "Mi estado físico"}</h1><p className="text-slate-400">{mode === "skills" ? "Consulta el árbol y el repertorio actualizado por tu profesor." : "Consulta mediciones, recuperación, evolución y metas personales."}</p></header>
      {mode === "skills" ? (
        <>
          <nav className="mb-5 grid gap-2 rounded-2xl border border-white/10 bg-black/30 p-2 sm:grid-cols-2" aria-label="Apartados de habilidades">
            <button type="button" onClick={() => setSkillSection("arbol")} className={cn("flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black", skillSection === "arbol" ? "bg-amber-400 text-slate-950" : "text-slate-400")}><Network className="h-4 w-4" /> Árbol técnico</button>
            <button type="button" onClick={() => setSkillSection("repertorio")} className={cn("flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black", skillSection === "repertorio" ? "bg-cyan-400 text-slate-950" : "text-slate-400")}><LibraryBig className="h-4 w-4" /> Repertorio</button>
          </nav>
          {skillSection === "arbol" ? <SkillTreeView discipline={normalizeSkillDiscipline(data.disciplina)} progress={data.habilidadesTecnicas} /> : <RepertoireView progress={data.repertorioTecnico} />}
        </>
      ) : <PhysicalHistory records={data.historialFisico} goals={data.metasFisicas} wellness={data.bienestar} hydration={data.historialHidratacion} />}
    </main>
  );
}
