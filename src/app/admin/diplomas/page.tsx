"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  Check,
  ChevronDown,
  Eye,
  ImageIcon,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";

import { useFirestore, useUser } from "@/firebase";
import {
  CERTIFICATE_TEMPLATES,
  CERTIFICATE_THEME_LABELS,
  certificateFolio,
  defaultCertificateData,
  formatCertificateDate,
  type CertificateData,
  type CertificateTheme,
  type CertificateType,
} from "@/lib/certificate-builder";

type AthleteDocument = {
  nombre?: string;
  fotoUrl?: string;
  imagenUrl?: string;
  disciplina?: string;
  grado?: string;
  activo?: boolean;
};

type Athlete = {
  id: string;
  nombre: string;
  fotoUrl: string;
  disciplina: string;
  grado: string;
};

const MAX_BATCH = 30;

const themeStyles: Record<CertificateTheme, { border: string; accent: string; soft: string; seal: string }> = {
  dorado: { border: "border-amber-600", accent: "text-amber-700", soft: "bg-amber-50", seal: "bg-amber-600" },
  azul: { border: "border-blue-700", accent: "text-blue-800", soft: "bg-blue-50", seal: "bg-blue-700" },
  rojo: { border: "border-red-700", accent: "text-red-800", soft: "bg-red-50", seal: "bg-red-700" },
  verde: { border: "border-emerald-700", accent: "text-emerald-800", soft: "bg-emerald-50", seal: "bg-emerald-700" },
};

export default function CertificatesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [site, setSite] = useState("MMA");
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState("");
  const [search, setSearch] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("Todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<CertificateData>(() => defaultCertificateData());

  useEffect(() => {
    setSite(localStorage.getItem("userSede") || "MMA");
  }, []);

  useEffect(() => {
    if (!data.coach && user?.email) setData((current) => ({ ...current, coach: user.email || "" }));
  }, [data.coach, user?.email]);

  const loadAthletes = useCallback(async () => {
    if (!firestore || !site) return;
    setLoading(true);
    setError("");
    try {
      const snapshot = await getDocs(query(collection(firestore, "Alumnos"), where("sede", "==", site)));
      const loaded = snapshot.docs
        .filter((record) => (record.data() as AthleteDocument).activo !== false)
        .map((record) => {
          const athlete = record.data() as AthleteDocument;
          return {
            id: record.id,
            nombre: String(athlete.nombre || "Atleta"),
            fotoUrl: String(athlete.fotoUrl || athlete.imagenUrl || ""),
            disciplina: String(athlete.disciplina || ""),
            grado: String(athlete.grado || ""),
          } satisfies Athlete;
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      setAthletes(loaded);
      setPreviewId((current) => current && loaded.some((athlete) => athlete.id === current) ? current : loaded[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los atletas.");
    } finally {
      setLoading(false);
    }
  }, [firestore, site]);

  useEffect(() => {
    void loadAthletes();
  }, [loadAthletes]);

  const disciplines = useMemo(() => ["Todas", ...new Set(athletes.map((athlete) => athlete.disciplina || "Sin disciplina"))], [athletes]);
  const visibleAthletes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return athletes.filter((athlete) => {
      const matchesDiscipline = disciplineFilter === "Todas" || (athlete.disciplina || "Sin disciplina") === disciplineFilter;
      return matchesDiscipline && (!term || `${athlete.nombre} ${athlete.disciplina} ${athlete.grado}`.toLocaleLowerCase("es").includes(term));
    });
  }, [athletes, disciplineFilter, search]);
  const selectedAthletes = selectedIds.map((id) => athletes.find((athlete) => athlete.id === id)).filter((athlete): athlete is Athlete => Boolean(athlete));
  const previewAthlete = athletes.find((athlete) => athlete.id === previewId) || selectedAthletes[0] || athletes[0] || null;

  const updateData = <K extends keyof CertificateData>(key: K, value: CertificateData[K]) => {
    setData((current) => ({ ...current, [key]: value }));
  };

  const applyTemplate = (type: CertificateType) => {
    const template = CERTIFICATE_TEMPLATES.find((entry) => entry.id === type) || CERTIFICATE_TEMPLATES[0];
    setData((current) => ({ ...current, type, title: template.title, introduction: template.introduction, reason: template.reason }));
  };

  const toggleAthlete = (athlete: Athlete) => {
    setPreviewId(athlete.id);
    setSelectedIds((current) => {
      if (current.includes(athlete.id)) return current.filter((id) => id !== athlete.id);
      if (current.length >= MAX_BATCH) return current;
      return [...current, athlete.id];
    });
  };

  const toggleVisible = () => {
    const visibleIds = visibleAthletes.slice(0, MAX_BATCH).map((athlete) => athlete.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter((id) => !visibleIds.includes(id)) : [...new Set([...selectedIds, ...visibleIds])].slice(0, MAX_BATCH));
  };

  const printCertificates = () => {
    if (selectedAthletes.length === 0) {
      setError("Selecciona al menos un atleta antes de imprimir.");
      return;
    }
    setError("");
    window.setTimeout(() => window.print(), 50);
  };

  return (
    <main className="min-h-screen bg-[#07090d] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="certificate-editor mx-auto max-w-[1600px] space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,.2),transparent_36%),linear-gradient(135deg,#17120a,#090b11)] p-6 shadow-2xl sm:p-8"><div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end"><div><p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.24em] text-amber-300"><Award className="h-4 w-4" /> Comunicación · {site}</p><h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Diplomas y reconocimientos</h1><p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">Diseña constancias individuales o por lote y guárdalas como PDF desde la ventana de impresión.</p></div><button onClick={printCertificates} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 font-black text-slate-950 hover:bg-amber-300"><Printer className="h-5 w-5" /> Imprimir / guardar PDF ({selectedAthletes.length})</button></div></header>
        {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-red-400/30 bg-red-950/50 p-4 text-red-100"><span>{error}</span><button onClick={() => setError("")} aria-label="Cerrar"><X className="h-4 w-4" /></button></div>}

        <div className="grid gap-6 2xl:grid-cols-[380px_430px_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#11141b]"><div className="border-b border-white/10 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-sky-300">Destinatarios</p><h2 className="font-black text-white">Selecciona atletas</h2></div><span className="rounded-xl bg-white/10 px-3 py-2 text-sm font-black text-white">{selectedAthletes.length}/{MAX_BATCH}</span></div><div className="mt-4 flex gap-2"><label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" /></label><button onClick={() => void loadAthletes()} aria-label="Actualizar" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[.05]"><RefreshCw className="h-4 w-4" /></button></div><select value={disciplineFilter} onChange={(event) => setDisciplineFilter(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/50 px-3 font-bold text-white outline-none">{disciplines.map((item) => <option key={item}>{item}</option>)}</select><button onClick={toggleVisible} className="mt-2 min-h-10 w-full rounded-xl border border-white/15 bg-white/[.04] text-sm font-bold text-white">Seleccionar / quitar visibles</button></div><div className="max-h-[760px] space-y-1 overflow-y-auto p-2">{loading ? <div className="grid min-h-56 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-amber-300" /></div> : visibleAthletes.map((athlete) => { const selected = selectedIds.includes(athlete.id); return <button key={athlete.id} onClick={() => toggleAthlete(athlete)} onMouseEnter={() => setPreviewId(athlete.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${selected ? "border-amber-300/50 bg-amber-500/15" : "border-transparent bg-white/[.02] hover:border-white/10 hover:bg-white/[.05]"}`}><AthletePhoto athlete={athlete} className="h-12 w-12 rounded-xl" /><span className="min-w-0 flex-1"><span className="block truncate font-black text-white">{athlete.nombre}</span><span className="block truncate text-xs text-slate-400">{athlete.disciplina || "Sin disciplina"}{athlete.grado ? ` · ${athlete.grado}` : ""}</span></span><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${selected ? "bg-amber-400 text-slate-950" : "border border-white/15 text-slate-400"}`}>{selected ? <Check className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}</span></button>; })}</div></section>

          <section className="space-y-6"><div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-300"><Sparkles className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Plantilla</p><h2 className="font-black text-white">Tipo de reconocimiento</h2></div></div><div className="mt-4 grid grid-cols-2 gap-2">{CERTIFICATE_TEMPLATES.map((template) => <button key={template.id} onClick={() => applyTemplate(template.id)} className={`rounded-xl border p-3 text-left ${data.type === template.id ? "border-amber-300/45 bg-amber-500/15" : "border-white/10 bg-white/[.035] hover:bg-white/[.07]"}`}><Award className="mb-2 h-5 w-5 text-amber-300" /><span className="block text-sm font-bold text-white">{template.label}</span></button>)}</div></div>
            <div className="rounded-[1.75rem] border border-white/10 bg-[#11141b] p-5"><p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Contenido</p><div className="mt-4 space-y-4"><SelectField label="Diseño" value={data.theme} onChange={(value) => updateData("theme", value as CertificateTheme)} options={CERTIFICATE_THEME_LABELS} /><Field label="Título" value={data.title} onChange={(value) => updateData("title", value)} placeholder="Diploma de promoción" /><Field label="Texto introductorio" value={data.introduction} onChange={(value) => updateData("introduction", value)} placeholder="La Academia reconoce a" /><TextField label="Motivo" value={data.reason} onChange={(value) => updateData("reason", value)} placeholder="Por su esfuerzo..." /><div className="grid grid-cols-2 gap-3"><Field label="Disciplina" value={data.discipline} onChange={(value) => updateData("discipline", value)} placeholder="Vacío: usar ficha" /><Field label="Grado / resultado" value={data.grade} onChange={(value) => updateData("grade", value)} placeholder="Cinturón azul" /></div><Field label="Evento" value={data.event} onChange={(value) => updateData("event", value)} placeholder="Seminario / torneo" /><DateField label="Fecha" value={data.date} onChange={(value) => updateData("date", value)} /><div className="grid grid-cols-2 gap-3"><Field label="Firma principal" value={data.coach} onChange={(value) => updateData("coach", value)} placeholder="Coach" /><Field label="Segunda firma" value={data.secondSigner} onChange={(value) => updateData("secondSigner", value)} placeholder="Director/a" /></div><Field label="Prefijo de folio" value={data.folioPrefix} onChange={(value) => updateData("folioPrefix", value)} placeholder="ALB-2026" /><label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-black/25 p-3"><span className="flex items-center gap-2 text-sm font-bold text-white"><ImageIcon className="h-4 w-4 text-sky-300" /> Mostrar fotografía</span><input type="checkbox" checked={data.showPhoto} onChange={(event) => updateData("showPhoto", event.target.checked)} className="h-5 w-5 accent-amber-400" /></label></div></div></section>

              <section className="min-w-0 rounded-[1.75rem] border border-white/10 bg-[#11141b] p-4 sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Vista previa</p><h2 className="font-black text-white">Resultado del diploma</h2></div><Eye className="h-5 w-5 text-emerald-300" /></div>{previewAthlete ? <div className="overflow-x-auto rounded-2xl bg-black/35 p-3"><div className="mx-auto min-w-[760px]"><CertificateSheet athlete={previewAthlete} data={data} folio={certificateFolio(data.folioPrefix, Math.max(0, selectedAthletes.findIndex((athlete) => athlete.id === previewAthlete.id)))} site={site} /></div></div> : <div className="grid min-h-96 place-items-center rounded-2xl border border-dashed border-white/15 text-center"><div><Users className="mx-auto h-10 w-10 text-slate-500" /><p className="mt-3 font-bold text-white">No hay atletas disponibles.</p></div></div>}<p className="mt-4 text-center text-xs text-slate-400">Al imprimir, cada atleta seleccionado ocupará una página horizontal.</p></section>
        </div>
      </div>

      <div className="certificate-print-root hidden print:block">{selectedAthletes.map((athlete, index) => <div key={athlete.id} className="certificate-print-page"><CertificateSheet athlete={athlete} data={data} folio={certificateFolio(data.folioPrefix, index)} site={site} /></div>)}</div>
      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body { background: white !important; }
          .certificate-editor, body > next-route-announcer { display: none !important; }
          .certificate-print-root { display: block !important; }
          .certificate-print-page { width: 297mm; height: 210mm; break-after: page; page-break-after: always; overflow: hidden; }
          .certificate-print-page:last-child { break-after: auto; page-break-after: auto; }
          .certificate-sheet { width: 297mm !important; height: 210mm !important; min-width: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
        }
      `}</style>
    </main>
  );
}

function CertificateSheet({ athlete, data, folio, site }: { athlete: Athlete; data: CertificateData; folio: string; site: string }) {
  const theme = themeStyles[data.theme];
  const discipline = data.discipline.trim() || athlete.disciplina;
  const grade = data.grade.trim() || (data.type === "grado" ? athlete.grado : "");
  return <article className={`certificate-sheet relative aspect-[1.414/1] w-full overflow-hidden border-[10px] bg-[#fffdf8] p-3 text-slate-900 shadow-2xl ${theme.border}`}><div className={`relative flex h-full flex-col items-center justify-between border-2 p-7 text-center ${theme.border} ${theme.soft}`}><div className={`absolute left-6 top-6 h-20 w-20 rounded-full border opacity-20 ${theme.border}`} /><div className={`absolute bottom-6 right-6 h-28 w-28 rotate-45 border opacity-15 ${theme.border}`} />
    <header className="relative z-10"><p className={`text-sm font-black uppercase tracking-[.36em] ${theme.accent}`}>Academia Albatros</p><div className={`mx-auto mt-3 h-1 w-32 rounded-full ${theme.seal}`} /><h2 className="mt-5 font-serif text-4xl font-black uppercase tracking-wide text-slate-950">{data.title}</h2></header>
    <div className="relative z-10 flex w-full max-w-4xl flex-col items-center"><p className="text-lg font-medium text-slate-700">{data.introduction}</p>{data.showPhoto && <div className={`relative mt-4 h-24 w-24 overflow-hidden rounded-full border-4 bg-white ${theme.border}`}>{athlete.fotoUrl ? <Image src={athlete.fotoUrl} alt={`Foto de ${athlete.nombre}`} fill sizes="100px" unoptimized className="object-cover" /> : <div className="grid h-full place-items-center text-slate-400"><UserRound className="h-10 w-10" /></div>}</div>}<h3 className={`mt-3 font-serif text-4xl font-black ${theme.accent}`}>{athlete.nombre}</h3><div className={`mt-2 h-px w-96 max-w-full ${theme.seal}`} /><p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-700">{data.reason}</p>{(discipline || grade || data.event) && <p className="mt-4 text-lg font-black text-slate-900">{[discipline, grade, data.event].filter(Boolean).join(" · ")}</p>}</div>
    <footer className="relative z-10 w-full"><p className="mb-5 text-sm text-slate-600">Expedido el {formatCertificateDate(data.date)}</p><div className="mx-auto grid max-w-3xl grid-cols-2 gap-16"><Signature name={data.coach} fallback="Coach responsable" /><Signature name={data.secondSigner} fallback="Dirección de academia" /></div><div className="mt-5 flex items-end justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500"><span>Sede {site}</span><span className={`grid h-12 w-12 place-items-center rounded-full text-xl font-black text-white ${theme.seal}`}>A</span><span>Folio {folio}</span></div></footer>
  </div></article>;
}

function Signature({ name, fallback }: { name: string; fallback: string }) { return <div className="text-center"><div className="h-px bg-slate-600" /><p className="mt-2 text-sm font-black text-slate-900">{name || fallback}</p></div>; }
function AthletePhoto({ athlete, className }: { athlete: Athlete; className: string }) { return <span className={`relative shrink-0 overflow-hidden border border-white/10 bg-white/[.06] ${className}`}>{athlete.fotoUrl ? <Image src={athlete.fotoUrl} alt={`Foto de ${athlete.nombre}`} fill sizes="120px" unoptimized className="object-cover" /> : <span className="grid h-full place-items-center text-slate-400"><UserRound className="h-1/2 w-1/2" /></span>}</span>; }
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" /></label>; }
function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="w-full resize-y rounded-xl border border-white/15 bg-black/40 p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" /></label>; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white outline-none [color-scheme:dark] focus:border-amber-400" /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string> }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span><span className="relative block"><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full appearance-none rounded-xl border border-white/15 bg-black/50 px-3 pr-10 text-sm font-bold text-white outline-none focus:border-amber-400">{Object.entries(options).map(([option, labelText]) => <option key={option} value={option}>{labelText}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" /></span></label>; }
