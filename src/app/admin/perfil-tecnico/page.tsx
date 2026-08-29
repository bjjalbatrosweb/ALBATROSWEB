"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  Clipboard,
  Dumbbell,
  ExternalLink,
  Link2,
  Loader2,
  Power,
  Printer,
  RefreshCw,
  Ruler,
  Save,
  Share2,
  Shield,
  Sparkles,
  Swords,
  Target,
  UserRound,
  Weight,
} from "lucide-react";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { useFirestore, useUser } from "@/firebase";
import {
  buildCombatStyleReport,
  buildPublicCombatStyleSnapshot,
  combatStyleShareText,
  COMBAT_STYLE_PROFILE_VERSION,
  DEFAULT_COMBAT_STYLE_PROFILE,
  validateCombatStyleProfile,
  type BodyBand,
  type BuildBand,
  type CapacityBand,
  type CombatStyleProfile,
  type GenderOption,
  type HeightBand,
  type StanceOption,
  type StyleRecommendation,
  type SubmissionRecommendation,
  type WidthBand,
} from "@/lib/combat-style-profile";

type AthleteDocument = {
  nombre?: string;
  disciplina?: string;
  grado?: string;
  activo?: boolean;
  pesoActual?: number;
  historialFisico?: Array<Record<string, unknown>>;
};

type Athlete = {
  id: string;
  nombre: string;
  disciplina: string;
  grado: string;
  peso?: number;
  altura?: number;
  cintura?: number;
  cadera?: number;
  muslo?: number;
  genero?: GenderOption;
};

type StoredProfile = Partial<CombatStyleProfile> & { actualizadoEn?: Timestamp };
type Step = 1 | 2 | 3;

const heightOptions: Array<[HeightBand, string]> = [["baja", "Baja"], ["media", "Media"], ["alta", "Alta"]];
const bodyOptions: Array<[BodyBand, string]> = [["corta", "Corto/a"], ["media", "Medio/a"], ["larga", "Largo/a"]];
const widthOptions: Array<[WidthBand, string]> = [["estrecha", "Estrecho/a"], ["media", "Medio/a"], ["ancha", "Ancho/a"]];
const capacityOptions: Array<[CapacityBand, string]> = [["por_desarrollar", "Por desarrollar"], ["media", "Media"], ["destacada", "Destacada"]];
const buildOptions: Array<[BuildBand, string]> = [["compacta", "Compacta"], ["equilibrada", "Equilibrada"], ["longilinea", "Longilínea"], ["robusta", "Robusta"]];
const genderOptions: Array<[GenderOption, string]> = [["mujer", "Mujer"], ["hombre", "Hombre"], ["otro", "Otro"], ["sin_especificar", "Sin especificar"]];
const stanceOptions: Array<[StanceOption, string]> = [["diestra", "Diestra"], ["zurda", "Zurda"], ["cambiante", "Cambiante"], ["sin_definir", "Sin definir"]];
const experienceOptions = [["inicial", "Inicial"], ["intermedia", "Intermedia"], ["avanzada", "Avanzada"]] as const;
const objectives = [
  ["derribar", "Derribar"], ["controlar", "Controlar"], ["barrer", "Barrer"], ["finalizar", "Finalizar"],
  ["distancia", "Manejar distancia"], ["presionar", "Presionar"], ["defender", "Defender y responder"],
] as const;

const profileKeys = [
  "genero", "estatura", "alturaCm", "pesoKg", "envergaduraCm", "cinturaCm", "caderaCm", "musloCm",
  "complexion", "torso", "brazos", "piernas", "hombros", "cintura", "cadera", "gluteos", "muslos", "manos",
  "movilidad", "explosividad", "resistencia", "agarre", "equilibrio", "velocidad", "controlCorporal",
  "experiencia", "guardia", "objetivos", "restricciones", "notas",
] as const;

const bodyLabels = {
  estatura: { baja: "estatura baja", media: "estatura media", alta: "estatura alta" },
  complexion: { compacta: "complexión compacta", equilibrada: "complexión equilibrada", longilinea: "complexión longilínea", robusta: "complexión robusta" },
  cintura: { estrecha: "cintura estrecha", media: "cintura media", ancha: "cintura ancha" },
  gluteos: { estrecha: "glúteos estrechos", media: "glúteos medios", ancha: "glúteos anchos" },
  brazos: { corta: "brazos cortos", media: "brazos medios", larga: "brazos largos" },
  piernas: { corta: "piernas cortas", media: "piernas medias", larga: "piernas largas" },
} as const;

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function latestPhysicalValue(history: AthleteDocument["historialFisico"], key: string) {
  if (!Array.isArray(history)) return undefined;
  for (const record of [...history].reverse()) {
    const value = Number(record?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

function storedProfile(data: StoredProfile, athlete: Athlete): CombatStyleProfile {
  const result = { ...DEFAULT_COMBAT_STYLE_PROFILE } as CombatStyleProfile;
  for (const key of profileKeys) {
    if (data[key] !== undefined) (result as unknown as Record<string, unknown>)[key] = data[key];
  }
  result.pesoKg ??= athlete.peso;
  result.alturaCm ??= athlete.altura;
  result.cinturaCm ??= athlete.cintura;
  result.caderaCm ??= athlete.cadera;
  result.musloCm ??= athlete.muslo;
  result.genero = result.genero || athlete.genero || "sin_especificar";
  result.objetivos = Array.isArray(result.objetivos) ? result.objetivos.slice(0, 4) : [];
  result.restricciones = String(result.restricciones || "");
  result.notas = String(result.notas || "");
  return result;
}

function bodySummary(profile: CombatStyleProfile) {
  const traits: string[] = [bodyLabels.estatura[profile.estatura], bodyLabels.complexion[profile.complexion]];
  if (profile.cintura !== "media") traits.push(bodyLabels.cintura[profile.cintura]);
  if (profile.gluteos !== "media") traits.push(bodyLabels.gluteos[profile.gluteos]);
  if (profile.brazos !== "media") traits.push(bodyLabels.brazos[profile.brazos]);
  if (profile.piernas !== "media") traits.push(bodyLabels.piernas[profile.piernas]);
  return traits.join(" · ");
}

export default function TechnicalProfilePage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [site, setSite] = useState("MMA");
  const [step, setStep] = useState<Step>(1);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<CombatStyleProfile>({ ...DEFAULT_COMBAT_STYLE_PROFILE });
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [includeName, setIncludeName] = useState(false);
  const [includePhysicalProfile, setIncludePhysicalProfile] = useState(false);
  const [linkDays, setLinkDays] = useState(30);
  const [publicLink, setPublicLink] = useState("");
  const [publicToken, setPublicToken] = useState("");
  const [creatingLink, setCreatingLink] = useState(false);
  const [disablingLink, setDisablingLink] = useState(false);
  const [athleteResponse, setAthleteResponse] = useState<"coincide" | "parcial" | "no_coincide" | "">("");
  const [athleteComment, setAthleteComment] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setSite(localStorage.getItem("userSede") || "MMA"), []);

  const loadAthletes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const snapshot = await getDocs(query(collection(firestore, "Alumnos"), where("sede", "==", site)));
      const loaded = snapshot.docs
        .filter(entry => (entry.data() as AthleteDocument).activo !== false)
        .map(entry => {
          const data = entry.data() as AthleteDocument;
          const history = data.historialFisico || [];
          const latestSex = [...history].reverse().find(record => record.sexoCalculo)?.sexoCalculo;
          return {
            id: entry.id,
            nombre: String(data.nombre || "Atleta"),
            disciplina: String(data.disciplina || "Sin disciplina"),
            grado: String(data.grado || "Sin grado"),
            peso: Number(data.pesoActual) > 0 ? Number(data.pesoActual) : latestPhysicalValue(history, "pesoKg"),
            altura: latestPhysicalValue(history, "estaturaCm"),
            cintura: latestPhysicalValue(history, "cinturaCm"),
            cadera: latestPhysicalValue(history, "caderaCm"),
            muslo: latestPhysicalValue(history, "musloCm"),
            genero: latestSex === "femenino" ? "mujer" as const : latestSex === "masculino" ? "hombre" as const : undefined,
          };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      setAthletes(loaded);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar los atletas.");
    } finally {
      setLoading(false);
    }
  }, [firestore, site]);

  useEffect(() => { void loadAthletes(); }, [loadAthletes]);
  const selected = athletes.find(athlete => athlete.id === selectedId);

  useEffect(() => {
    setPublicLink("");
    setPublicToken("");
    setAthleteResponse("");
    setAthleteComment("");
    if (!selectedId) return;
    let active = true;
    const storageKey = `perfil-tecnico-enlace:${site}:${selectedId}`;
    const storedToken = localStorage.getItem(storageKey) || "";
    if (!/^[a-f0-9]{64}$/i.test(storedToken)) return;
    void getDoc(doc(firestore, "PerfilesTecnicosCompartidos", storedToken)).then(snapshot => {
      if (!active || !snapshot.exists()) return;
      const data = snapshot.data() as { activo?: boolean; venceEn?: Timestamp };
      if (data.activo === true && data.venceEn?.toMillis() && data.venceEn.toMillis() > Date.now()) {
        setPublicToken(storedToken);
        setPublicLink(`${window.location.origin}/perfil-tecnico/compartido/${storedToken}`);
      } else localStorage.removeItem(storageKey);
    }).catch(() => localStorage.removeItem(storageKey));
    return () => { active = false; };
  }, [firestore, selectedId, site]);

  useEffect(() => {
    if (!publicToken) return;
    return onSnapshot(doc(firestore, "PerfilesTecnicosCompartidos", publicToken), snapshot => {
      const data = snapshot.data() as { respuestaAtleta?: "coincide" | "parcial" | "no_coincide"; comentarioAtleta?: string } | undefined;
      setAthleteResponse(data?.respuestaAtleta || "");
      setAthleteComment(data?.comentarioAtleta || "");
    }, () => undefined);
  }, [firestore, publicToken]);

  useEffect(() => {
    let active = true;
    if (!selected) {
      setForm({ ...DEFAULT_COMBAT_STYLE_PROFILE });
      setExists(false);
      setLastSaved(null);
      return;
    }
    setProfileLoading(true);
    setError("");
    setMessage("");
    void getDoc(doc(firestore, "PerfilesTecnicosAtletas", selected.id))
      .then(snapshot => {
        if (!active) return;
        const data = snapshot.exists() ? snapshot.data() as StoredProfile : {};
        setForm(storedProfile(data, selected));
        setExists(snapshot.exists());
        setLastSaved(data.actualizadoEn?.toDate?.() || null);
      })
      .catch(reason => active && setError(reason instanceof Error ? reason.message : "No se pudo cargar el perfil técnico."))
      .finally(() => active && setProfileLoading(false));
    return () => { active = false; };
  }, [firestore, selected]);

  const report = useMemo(() => buildCombatStyleReport(form), [form]);
  const validationError = validateCombatStyleProfile(form);

  const update = <K extends keyof CombatStyleProfile>(key: K, value: CombatStyleProfile[K]) => {
    setForm(current => ({ ...current, [key]: value }));
    setMessage("");
  };

  const toggleObjective = (value: string) => {
    const next = form.objetivos.includes(value)
      ? form.objetivos.filter(item => item !== value)
      : form.objetivos.length < 4 ? [...form.objetivos, value] : form.objetivos;
    update("objetivos", next);
  };

  const goTo = (next: Step) => {
    setError("");
    if (validationError && next > step) {
      setError(validationError);
      return;
    }
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    setError(""); setMessage("");
    if (!selected || !user) {
      setError("Selecciona un atleta y comprueba tu sesión antes de enlazar el resultado.");
      return;
    }
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        alumnoId: selected.id,
        alumnoNombre: selected.nombre,
        sede: site,
        restricciones: form.restricciones.trim(),
        notas: form.notas.trim(),
        versionMotor: COMBAT_STYLE_PROFILE_VERSION,
        actualizadoPor: user.uid,
        actualizadoEn: serverTimestamp(),
      };
      for (const key of ["alturaCm", "pesoKg", "envergaduraCm", "cinturaCm", "caderaCm", "musloCm"] as const) {
        payload[key] = form[key] ?? deleteField();
      }
      if (!exists) payload.creadoEn = serverTimestamp();
      await setDoc(doc(firestore, "PerfilesTecnicosAtletas", selected.id), payload, { merge: true });
      setExists(true);
      setLastSaved(new Date());
      setMessage(`Resultado enlazado al expediente de ${selected.nombre}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  const shareText = combatStyleShareText(includeName && selected ? selected.nombre : "Atleta", report, {
    includePhysicalProfile,
    profile: form,
  });
  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setMessage(`Resumen técnico copiado${includePhysicalProfile ? " con la descripción corporal" : " sin el perfil corporal"}. No contiene medidas ni notas privadas.`);
    } catch {
      setError("El navegador no permitió copiar el resumen.");
    }
  };
  const shareResult = async () => {
    if (!navigator.share) { await copyResult(); return; }
    try {
      await navigator.share({ title: "Confirma tu perfil técnico de combate", text: shareText });
      setMessage("Resumen enviado para confirmación, sin medidas ni notas privadas.");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError("No se pudo abrir el menú para compartir.");
    }
  };

  const createPublicLink = async () => {
    setError(""); setMessage("");
    if (!selected || !user) {
      setError("Selecciona un atleta y comprueba tu sesión para crear su enlace individual.");
      return;
    }
    setCreatingLink(true);
    try {
      const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
      const content = buildPublicCombatStyleSnapshot(form, report, {
        includePhysicalProfile,
        athleteName: includeName ? selected.nombre : undefined,
      });
      const expiresAt = new Date(Date.now() + linkDays * 24 * 60 * 60 * 1000);
      await setDoc(doc(firestore, "PerfilesTecnicosCompartidos", token), {
        token,
        sede: site,
        activo: true,
        creadoEn: serverTimestamp(),
        venceEn: Timestamp.fromDate(expiresAt),
        contenido: content,
      });
      setPublicToken(token);
      setPublicLink(`${window.location.origin}/perfil-tecnico/compartido/${token}`);
      localStorage.setItem(`perfil-tecnico-enlace:${site}:${selected.id}`, token);
      setMessage(`Enlace individual creado. Caduca el ${expiresAt.toLocaleDateString("es-MX")}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear el enlace individual.");
    } finally {
      setCreatingLink(false);
    }
  };

  const copyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      setMessage("Enlace individual copiado.");
    } catch {
      setError("El navegador no permitió copiar el enlace.");
    }
  };

  const sharePublicLink = async () => {
    if (!navigator.share) { await copyPublicLink(); return; }
    try {
      await navigator.share({ title: "Tu perfil técnico de combate", text: "Revisa tu perfil y confirma si coincide contigo.", url: publicLink });
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError("No se pudo abrir el menú para compartir el enlace.");
    }
  };

  const disablePublicLink = async () => {
    if (!publicToken) return;
    setDisablingLink(true);
    try {
      await updateDoc(doc(firestore, "PerfilesTecnicosCompartidos", publicToken), { activo: false });
      setPublicLink("");
      setPublicToken("");
      setAthleteResponse("");
      setAthleteComment("");
      if (selectedId) localStorage.removeItem(`perfil-tecnico-enlace:${site}:${selectedId}`);
      setMessage("El enlace individual fue desactivado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo desactivar el enlace.");
    } finally {
      setDisablingLink(false);
    }
  };

  return (
    <main className="min-h-screen bg-black p-4 text-white [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Display','Segoe_UI',sans-serif] sm:p-6 lg:p-8 print:bg-white print:p-0 print:text-black">
      <div className="mx-auto max-w-[1460px] space-y-5">
        <header className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[radial-gradient(circle_at_85%_0%,rgba(10,132,255,.24),transparent_34%),linear-gradient(145deg,rgba(28,28,30,.96),rgba(10,10,12,.98))] p-7 shadow-[0_30px_100px_rgba(0,0,0,.55)] sm:p-11 print:border-slate-200 print:bg-white print:shadow-none">
          <div className="absolute -right-20 -top-28 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
          <p className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-[.22em] text-blue-400"><BrainCircuit className="h-4 w-4" /> Inteligencia técnica</p>
          <h1 className="relative mt-4 max-w-4xl text-4xl font-semibold tracking-[-.045em] sm:text-6xl">Perfil técnico de combate</h1>
          <p className="relative mt-4 max-w-2xl text-sm leading-6 text-[#a1a1a6] print:text-slate-600">Tres pasos. Una lectura clara del atleta y un plan técnico listo para probar en clase.</p>
        </header>

        <nav aria-label="Pasos del perfil técnico" className="grid gap-1.5 rounded-[1.75rem] border border-white/10 bg-[#1c1c1e]/90 p-2 shadow-2xl backdrop-blur-2xl sm:grid-cols-3 print:hidden">
          <StepButton number={1} title="Perfil corporal" detail="Proporciones y medidas" active={step === 1} complete={step > 1} onClick={() => goTo(1)} />
          <StepButton number={2} title="Capacidades" detail="Lo observado en clase" active={step === 2} complete={step > 2} onClick={() => goTo(2)} />
          <StepButton number={3} title="Resultados" detail="Sumisiones y plan técnico" active={step === 3} complete={false} onClick={() => goTo(3)} />
        </nav>

        {(error || message) && <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${error ? "border-red-400/20 bg-red-500/10 text-red-100" : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"}`}>{error ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <Check className="h-5 w-5 shrink-0" />}{error || message}</div>}

        {profileLoading ? <Loading /> : step === 1 ? (
          <StepPanel number="01" eyebrow="Perfil corporal" title="Describe la estructura sin encasillar al atleta" icon={Ruler}>
            <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
              <aside className="space-y-4">
                <div className="rounded-2xl border border-cyan-300/15 bg-cyan-500/[.06] p-4">
                  <label className="text-[10px] font-black uppercase tracking-wider text-cyan-200">Atleta</label>
                  <div className="mt-2 flex gap-2"><select value={selectedId} onChange={event => setSelectedId(event.target.value)} disabled={loading} className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 font-bold text-white"><option value="">Selecciona un atleta</option>{athletes.map(athlete => <option key={athlete.id} value={athlete.id}>{athlete.nombre} · {athlete.disciplina}</option>)}</select><button type="button" onClick={() => void loadAthletes()} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.05]" aria-label="Recargar atletas"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
                  {selected ? <div className="mt-4"><b className="block text-lg">{selected.nombre}</b><span className="text-xs text-slate-400">{selected.disciplina} · {selected.grado}</span><p className="mt-3 text-[10px] text-cyan-200">{exists ? "Perfil ya enlazado" : "Perfil nuevo"}{lastSaved ? ` · ${lastSaved.toLocaleDateString("es-MX")}` : ""}</p></div> : <p className="mt-3 text-xs leading-5 text-slate-500">Puedes explorar sin elegir atleta, pero necesitas uno para guardar.</p>}
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Lectura rápida</p><p className="mt-2 text-sm font-bold leading-6 text-white">{bodySummary(form)}</p><p className="mt-3 text-[10px] leading-5 text-slate-500">Es una descripción, no una valoración estética ni de salud.</p></div>
              </aside>

              <div className="min-w-0 space-y-6">
                <div><SectionHeading title="Base corporal" subtitle="Seis decisiones rápidas; las medidas exactas son opcionales." /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><SelectField label="Género (contexto)" value={form.genero} options={genderOptions} onChange={value => update("genero", value as GenderOption)} /><SelectField label="Estatura percibida" value={form.estatura} options={heightOptions} onChange={value => update("estatura", value as HeightBand)} /><SelectField label="Complexión" value={form.complexion} options={buildOptions} onChange={value => update("complexion", value as BuildBand)} /><SelectField label="Torso" value={form.torso} options={bodyOptions} onChange={value => update("torso", value as BodyBand)} /><SelectField label="Brazos" value={form.brazos} options={bodyOptions} onChange={value => update("brazos", value as BodyBand)} /><SelectField label="Piernas" value={form.piernas} options={bodyOptions} onChange={value => update("piernas", value as BodyBand)} /></div></div>
                <div><SectionHeading title="Forma y distribución" subtitle="Permite describir, por ejemplo, cintura estrecha con cadera o glúteos anchos." /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><SelectField label="Hombros" value={form.hombros} options={widthOptions} onChange={value => update("hombros", value as WidthBand)} /><SelectField label="Cintura" value={form.cintura} options={widthOptions} onChange={value => update("cintura", value as WidthBand)} /><SelectField label="Cadera" value={form.cadera} options={widthOptions} onChange={value => update("cadera", value as WidthBand)} /><SelectField label="Glúteos" value={form.gluteos} options={widthOptions} onChange={value => update("gluteos", value as WidthBand)} /><SelectField label="Muslos" value={form.muslos} options={widthOptions} onChange={value => update("muslos", value as WidthBand)} /><SelectField label="Manos" value={form.manos} options={widthOptions} onChange={value => update("manos", value as WidthBand)} /></div></div>
                <details className="group rounded-2xl border border-white/10 bg-black/20 p-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span><b className="block">Medidas exactas</b><small className="text-slate-500">Opcional · abre solo si las tienes</small></span><ArrowRight className="h-5 w-5 text-slate-500 transition group-open:rotate-90" /></summary><div className="mt-5 grid gap-4 border-t border-white/[.07] pt-5 sm:grid-cols-2 lg:grid-cols-3"><NumberField label="Altura" unit="cm" icon={Ruler} value={form.alturaCm} onChange={value => update("alturaCm", value)} /><NumberField label="Peso" unit="kg" icon={Weight} value={form.pesoKg} onChange={value => update("pesoKg", value)} /><NumberField label="Envergadura" unit="cm" icon={ArrowRight} value={form.envergaduraCm} onChange={value => update("envergaduraCm", value)} /><NumberField label="Cintura" unit="cm" icon={Ruler} value={form.cinturaCm} onChange={value => update("cinturaCm", value)} /><NumberField label="Cadera" unit="cm" icon={Ruler} value={form.caderaCm} onChange={value => update("caderaCm", value)} /><NumberField label="Muslo" unit="cm" icon={Ruler} value={form.musloCm} onChange={value => update("musloCm", value)} /></div>{(report.reachRatio || report.waistHeightRatio || report.waistHipRatio) && <div className="mt-4 grid gap-2 sm:grid-cols-3"><Ratio label="Envergadura/altura" value={report.reachRatio} /><Ratio label="Cintura/altura" value={report.waistHeightRatio} /><Ratio label="Cintura/cadera" value={report.waistHipRatio} /></div>}<p className="mt-3 text-[10px] leading-5 text-slate-500">Las relaciones se muestran como contexto. La interpretación de salud permanece en Estado físico y no modifica directamente el estilo recomendado.</p></details>
              </div>
            </div>
            <StepFooter><span /><NextButton onClick={() => goTo(2)} label="Continuar a capacidades" /></StepFooter>
          </StepPanel>
        ) : step === 2 ? (
          <StepPanel number="02" eyebrow="Capacidades observadas" title="Registra lo que realmente aparece en clase" icon={Dumbbell}>
            <p className="mb-6 max-w-3xl text-sm leading-6 text-slate-400">Usa rounds, drills y pruebas repetidas. “Por desarrollar” identifica una prioridad de trabajo; no reduce el potencial del atleta.</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"><SelectField label="Movilidad" value={form.movilidad} options={capacityOptions} onChange={value => update("movilidad", value as CapacityBand)} /><SelectField label="Explosividad" value={form.explosividad} options={capacityOptions} onChange={value => update("explosividad", value as CapacityBand)} /><SelectField label="Resistencia" value={form.resistencia} options={capacityOptions} onChange={value => update("resistencia", value as CapacityBand)} /><SelectField label="Agarre" value={form.agarre} options={capacityOptions} onChange={value => update("agarre", value as CapacityBand)} /><SelectField label="Equilibrio" value={form.equilibrio} options={capacityOptions} onChange={value => update("equilibrio", value as CapacityBand)} /><SelectField label="Velocidad" value={form.velocidad} options={capacityOptions} onChange={value => update("velocidad", value as CapacityBand)} /><SelectField label="Control corporal" value={form.controlCorporal} options={capacityOptions} onChange={value => update("controlCorporal", value as CapacityBand)} /></div>
            <div className="mt-7 grid gap-4 border-t border-white/[.07] pt-6 sm:grid-cols-2"><SelectField label="Experiencia" value={form.experiencia} options={experienceOptions} onChange={value => update("experiencia", value as CombatStyleProfile["experiencia"])} /><SelectField label="Guardia de striking" value={form.guardia} options={stanceOptions} onChange={value => update("guardia", value as StanceOption)} /></div>
            <SectionHeading title="Objetivos técnicos" subtitle="Elige hasta cuatro para orientar qué probar primero." /><div className="flex flex-wrap gap-2">{objectives.map(([value, label]) => { const active = form.objetivos.includes(value); return <button key={value} type="button" onClick={() => toggleObjective(value)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-xs font-black transition ${active ? "border-cyan-300/45 bg-cyan-400 text-slate-950" : "border-white/10 bg-white/[.04] text-slate-300"}`}>{active && <Check className="h-4 w-4" />}{label}</button>; })}</div>
            <div className="mt-6 grid gap-4 md:grid-cols-2"><TextArea label="Lesiones, dolor o restricciones" value={form.restricciones} onChange={value => update("restricciones", value)} placeholder="Ej. evitar impacto, molestia de rodilla, solo técnica…" /><TextArea label="Notas del coach" value={form.notas} onChange={value => update("notas", value)} placeholder="Preferencias, reacciones o contexto observado…" /></div>
            <StepFooter><BackButton onClick={() => goTo(1)} /><NextButton onClick={() => goTo(3)} label="Generar resultados" /></StepFooter>
          </StepPanel>
        ) : (
          <div className="space-y-5 print:space-y-3">
            <StepPanel number="03" eyebrow="Tu resultado" title="Lo necesario para empezar" icon={Sparkles}>
              <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(135deg,rgba(10,132,255,.18),rgba(255,255,255,.035))] p-5 sm:p-7">
                <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-blue-400">{selected ? selected.nombre : "Perfil sin atleta"}</p><h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{report.qualityLabel}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[#a1a1a6]">{bodySummary(form)}</p></div><span className="rounded-full border border-white/10 bg-white/[.07] px-4 py-2 text-xs font-semibold text-[#d2d2d7]">Validar durante 4 sesiones</span></div>
              </div>

              <SectionHeading title="Plan A por disciplina" subtitle="Una sola ruta principal por área para evitar ruido." />
              <div className="grid gap-3 lg:grid-cols-3"><PrimaryRouteCard title="Grappling" icon={Shield} item={report.grappling[0]} /><PrimaryRouteCard title="Wrestling" icon={Dumbbell} item={report.wrestling[0]} /><PrimaryRouteCard title="Striking" icon={Swords} item={report.striking[0]} /></div>

              <div className="mt-8 flex items-end justify-between gap-3"><SectionHeading title="Sumisiones recomendadas" subtitle="Prioridad, entrada y motivo de la recomendación." /><span className="mb-3 hidden rounded-full bg-blue-500/15 px-3 py-1 text-[10px] font-bold text-blue-300 sm:inline">Top {Math.min(4, report.submissions.length)}</span></div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{report.submissions.slice(0, 4).map((submission, index) => <SubmissionCard key={submission.id} item={submission} number={index + 1} />)}</div>

              <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/[.035] p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-blue-400">Primera sesión</p><h3 className="mt-2 text-xl font-semibold">Qué probar hoy</h3><div className="mt-4 grid gap-3 md:grid-cols-3">{[report.grappling[0], report.wrestling[0], report.striking[0]].map((item, index) => <div key={item.id} className="rounded-2xl bg-black/30 p-4"><span className="text-[10px] font-bold text-[#86868b]">{index + 1}</span><p className="mt-1 text-sm font-semibold">{item.drill}</p></div>)}</div></div>

              <div className="mt-5 rounded-[1.75rem] border border-amber-400/20 bg-amber-500/[.055] p-5 sm:p-6"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/10"><AlertTriangle className="h-5 w-5 text-amber-300" /></div><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-amber-300">Ajuste técnico</p><h3 className="mt-1 text-xl font-semibold">No recomendadas por ahora</h3><p className="mt-1 text-xs leading-5 text-[#86868b]">No son prohibiciones permanentes: son variantes de menor prioridad hasta comprobar alcance, control y seguridad.</p></div></div>{report.deprioritized.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{report.deprioritized.map(item => <article key={item.id} className="rounded-2xl border border-white/[.08] bg-black/25 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">{item.technique}</b><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${item.status === "Evitar por ahora" ? "bg-rose-500/15 text-rose-200" : "bg-amber-400/15 text-amber-200"}`}>{item.status}</span></div><p className="mt-3 text-[11px] leading-5 text-slate-400">{item.reason}</p><div className="mt-3 rounded-xl bg-white/[.04] p-3"><span className="text-[9px] font-bold uppercase tracking-wider text-cyan-300">Mejor alternativa</span><p className="mt-1 text-[11px] leading-5 text-slate-200">{item.alternative}</p></div><p className="mt-3 text-[10px] leading-4 text-[#6e6e73]">Cómo comprobarlo: {item.validation}</p></article>)}</div> : <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-500/[.07] p-4 text-xs leading-5 text-emerald-100">No hay una variante que deba bajarse de prioridad solo con los datos actuales. Mantén la validación técnica normal.</div>}</div>

              <details className="group mt-5 rounded-2xl border border-white/10 bg-white/[.025]"><summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold"><span>Ver rutas alternativas</span><ArrowRight className="h-4 w-4 text-[#86868b] transition group-open:rotate-90" /></summary><div className="grid gap-4 border-t border-white/[.08] p-4 lg:grid-cols-3"><RecommendationColumn title="Grappling" icon={Shield} tone="emerald" items={report.grappling.slice(1)} /><RecommendationColumn title="Wrestling" icon={Dumbbell} tone="amber" items={report.wrestling.slice(1)} /><RecommendationColumn title="Striking" icon={Swords} tone="rose" items={report.striking.slice(1)} /></div></details>
            </StepPanel>

            <section className="grid gap-5 lg:grid-cols-[1fr_420px] print:hidden">
              <Panel title="Validar antes de consolidar" icon={Target}><div className="grid gap-3 sm:grid-cols-2">{report.validationPlan.map((item, index) => <article key={item.session} className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">{index + 1} · {item.session}</p><b className="mt-2 block">{item.task}</b><p className="mt-2 text-xs leading-5 text-slate-400">{item.measure}</p></article>)}</div></Panel>
              <Panel title="Enlazar o compartir" icon={Link2}>
                <button type="button" onClick={() => void save()} disabled={!selected || saving || Boolean(validationError)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-35">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}{exists ? "Actualizar perfil enlazado" : "Guardar en el atleta"}</button>
                {!selected && <p className="mt-2 text-center text-[10px] text-amber-300">Regresa al paso 1 y selecciona un atleta para guardar.</p>}
                <div className="my-4 border-t border-white/[.07]" />
                <div className="space-y-2">
                  <ShareToggle checked={includePhysicalProfile} onChange={setIncludePhysicalProfile} title="Incluir descripción física" detail="Rasgos corporales sin peso ni centímetros" />
                  <ShareToggle checked={includeName} onChange={setIncludeName} title="Incluir nombre del atleta" detail="Desactivado por privacidad" />
                </div>
                <div className={`mt-3 rounded-2xl border p-3 text-[10px] leading-5 ${includePhysicalProfile ? "border-blue-400/20 bg-blue-500/[.08] text-blue-100" : "border-white/[.07] bg-white/[.025] text-[#86868b]"}`}><b className="block text-xs text-white">{includePhysicalProfile ? "Perfil corporal incluido" : "Perfil corporal oculto"}</b>{includePhysicalProfile ? "El atleta podrá responder Sí, Parcialmente o No y señalar qué cambiaría." : "Solo se compartirán sumisiones, rutas y plan técnico."}</div>
                <div className="mt-5 rounded-[1.35rem] border border-blue-400/20 bg-blue-500/[.07] p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-white">Enlace web individual</p><p className="mt-1 text-[10px] leading-4 text-blue-100/65">Ficha visual para revisar y confirmar el perfil.</p></div><span className="rounded-full bg-blue-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-blue-200">Seguro</span></div>
                  {!publicLink ? <>
                    <label className="mt-4 block text-[9px] font-bold uppercase tracking-[.16em] text-[#86868b]">Caducidad</label>
                    <div className="mt-2 grid grid-cols-3 gap-1.5" role="group" aria-label="Caducidad del enlace">
                      {[7, 30, 90].map(days => <button key={days} type="button" onClick={() => setLinkDays(days)} className={`min-h-10 rounded-xl border text-xs font-semibold transition ${linkDays === days ? "border-blue-300 bg-blue-400 text-slate-950" : "border-white/10 bg-black/20 text-slate-300 hover:bg-white/[.06]"}`}>{days} días</button>)}
                    </div>
                    <button type="button" onClick={() => void createPublicLink()} disabled={!selected || !user || creatingLink} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0a84ff] px-4 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(10,132,255,.22)] disabled:cursor-not-allowed disabled:opacity-35">{creatingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}Crear enlace individual</button>
                  </> : <div className="mt-4 space-y-2">
                    <div className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3"><Link2 className="h-4 w-4 shrink-0 text-blue-300" /><input readOnly value={publicLink} aria-label="Enlace individual creado" className="min-w-0 flex-1 bg-transparent text-[10px] text-slate-300 outline-none" /></div>
                    {athleteResponse && <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[.08] p-3 text-[10px] leading-4 text-emerald-100"><b className="block text-xs">Respuesta: {{ coincide: "Coincide", parcial: "Parcialmente", no_coincide: "No coincide" }[athleteResponse]}</b>{athleteComment ? <span className="mt-1 block text-emerald-100/70">“{athleteComment}”</span> : <span className="mt-1 block text-emerald-100/55">Sin comentario adicional.</span>}</div>}
                    <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => void copyPublicLink()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.05] text-[11px] font-semibold"><Clipboard className="h-3.5 w-3.5" />Copiar</button><button type="button" onClick={() => void sharePublicLink()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-500 text-[11px] font-semibold"><Share2 className="h-3.5 w-3.5" />Compartir</button></div>
                    <div className="grid grid-cols-2 gap-2"><a href={publicLink} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 text-[11px] font-semibold"><ExternalLink className="h-3.5 w-3.5" />Vista atleta</a><button type="button" onClick={() => void disablePublicLink()} disabled={disablingLink} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/[.07] text-[11px] font-semibold text-rose-200 disabled:opacity-40">{disablingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}Desactivar</button></div>
                  </div>}
                </div>
                <div className="my-4 flex items-center gap-3"><span className="h-px flex-1 bg-white/[.07]" /><span className="text-[9px] font-bold uppercase tracking-[.18em] text-[#636366]">También como texto</span><span className="h-px flex-1 bg-white/[.07]" /></div>
                <div className="grid gap-2"><button type="button" onClick={() => void shareResult()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[.05] px-4 text-xs font-semibold text-white"><Share2 className="h-4 w-4" />Compartir resumen</button><button type="button" onClick={() => void copyResult()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[.04] text-xs font-semibold"><Clipboard className="h-4 w-4" />Copiar resumen</button></div>
                <button type="button" onClick={() => window.print()} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.04] text-xs font-black"><Printer className="h-4 w-4" />Imprimir resultado</button>
                <p className="mt-3 text-[10px] leading-5 text-slate-500">El enlace usa un identificador aleatorio, caduca y puede desactivarse. Siempre se excluyen peso, medidas exactas, lesiones y notas privadas.</p>
              </Panel>
            </section>

            <details className="rounded-[1.75rem] border border-white/10 bg-white/[.025] p-5 print:hidden"><summary className="flex cursor-pointer list-none items-center justify-between"><span className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-cyan-300" /><span><b className="block">Cómo interpretar el resultado</b><small className="text-slate-500">Límites y base del método</small></span></span><ArrowRight className="h-5 w-5 text-slate-500" /></summary><div className="mt-4 space-y-2 border-t border-white/[.07] pt-4">{report.caveats.map(item => <p key={item} className="flex gap-2 text-xs leading-5 text-slate-400"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />{item}</p>)}</div></details>
            <div className="print:hidden"><BackButton onClick={() => goTo(2)} /></div>
          </div>
        )}
      </div>
    </main>
  );
}

function StepButton({ number, title, detail, active, complete, onClick }: { number: Step; title: string; detail: string; active: boolean; complete: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} aria-current={active ? "step" : undefined} className={`flex min-h-16 items-center gap-3 rounded-[1.25rem] border px-4 text-left transition-all duration-300 ${active ? "border-white/10 bg-white/[.09] shadow-lg" : "border-transparent hover:bg-white/[.04]"}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${active || complete ? "bg-[#0a84ff] text-white shadow-[0_0_24px_rgba(10,132,255,.35)]" : "bg-white/[.06] text-[#86868b]"}`}>{complete ? <Check className="h-4 w-4" /> : number}</span><span><b className="block text-sm font-semibold text-white">{title}</b><small className="text-[10px] text-[#86868b]">{detail}</small></span></button>; }

function StepPanel({ number, eyebrow, title, icon: Icon, children }: { number: string; eyebrow: string; title: string; icon: typeof UserRound; children: ReactNode }) { return <section className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#1c1c1e]/95 shadow-[0_24px_80px_rgba(0,0,0,.45)] backdrop-blur-2xl print:border-slate-200 print:bg-white print:shadow-none"><div className="relative flex items-center gap-3 border-b border-white/[.07] p-5 sm:p-7 print:border-slate-200"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#0a84ff] text-white shadow-[0_0_28px_rgba(10,132,255,.3)]"><Icon className="h-5 w-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-400">{eyebrow}</p><h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2></div><b className="absolute right-6 top-2 text-6xl font-semibold text-white/[.025] print:hidden">{number}</b></div><div className="p-5 sm:p-7">{children}</div></section>; }
function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Target; children: ReactNode }) { return <section className="rounded-[2rem] border border-white/10 bg-[#1c1c1e]/95 p-5 shadow-2xl"><h3 className="flex items-center gap-2 font-semibold"><Icon className="h-5 w-5 text-blue-400" />{title}</h3><div className="mt-4">{children}</div></section>; }
function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) { return <div className="mb-3 mt-7 first:mt-0"><h3 className="font-semibold tracking-tight">{title}</h3><p className="mt-1 text-xs text-[#86868b]">{subtitle}</p></div>; }
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void }) { return <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[#86868b]">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="min-h-12 w-full rounded-2xl border border-white/10 bg-white/[.055] px-4 font-semibold text-white outline-none transition focus:border-blue-400/60 focus:bg-white/[.08]">{options.map(([key, text]) => <option className="bg-[#1c1c1e]" key={key} value={key}>{text}</option>)}</select></label>; }
function NumberField({ label, unit, icon: Icon, value, onChange }: { label: string; unit: string; icon: typeof Ruler; value?: number; onChange: (value?: number) => void }) { return <label><span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span><span className="flex min-h-12 items-center rounded-xl border border-white/10 bg-slate-950 px-3 focus-within:border-cyan-300/60"><Icon className="mr-2 h-4 w-4 text-cyan-300" /><input type="number" min="0" step="0.1" value={value ?? ""} onChange={event => onChange(optionalNumber(event.target.value))} className="min-w-0 flex-1 bg-transparent font-bold text-white outline-none" placeholder="Opcional" /><b className="text-xs text-slate-600">{unit}</b></span></label>; }
function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label><span className="mb-2 flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-400"><span>{label}</span><span>{value.length}/500</span></span><textarea value={value} maxLength={500} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="min-h-28 w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm text-white outline-none placeholder:text-slate-700 focus:border-cyan-300/60" /></label>; }
function Ratio({ label, value }: { label: string; value?: number }) { return <div className="rounded-xl border border-white/[.07] bg-white/[.035] p-3"><span className="text-[9px] font-black uppercase text-slate-500">{label}</span><b className="mt-1 block text-xl">{value?.toFixed(3) || "—"}</b></div>; }
function StepFooter({ children }: { children: ReactNode }) { return <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/[.07] pt-5 print:hidden">{children}</div>; }
function BackButton({ onClick }: { onClick: () => void }) { return <button type="button" onClick={onClick} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 font-black text-slate-300"><ArrowLeft className="h-4 w-4" />Atrás</button>; }
function NextButton({ onClick, label }: { onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#0a84ff] px-6 font-semibold text-white shadow-[0_10px_30px_rgba(10,132,255,.25)] transition hover:bg-[#409cff]">{label}<ArrowRight className="h-4 w-4" /></button>; }
function Loading() { return <div className="flex min-h-80 items-center justify-center gap-3 rounded-[2rem] border border-white/10 bg-[#0d1118] text-slate-400"><Loader2 className="h-5 w-5 animate-spin" />Cargando perfil…</div>; }

function ShareToggle({ checked, onChange, title, detail }: { checked: boolean; onChange: (checked: boolean) => void; title: string; detail: string }) { return <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/[.07] bg-white/[.035] p-3 transition hover:bg-white/[.055]"><span><b className="block text-xs font-semibold text-white">{title}</b><small className="mt-0.5 block text-[10px] text-[#86868b]">{detail}</small></span><span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-[#0a84ff]" : "bg-[#3a3a3c]"}`}><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="peer sr-only" /><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition ${checked ? "left-6" : "left-1"}`} /></span></label>; }

function PrimaryRouteCard({ title, icon: Icon, item }: { title: string; icon: typeof Shield; item: StyleRecommendation }) { return <article className="rounded-[1.6rem] border border-white/10 bg-white/[.045] p-5 transition hover:-translate-y-0.5 hover:bg-white/[.065]"><div className="flex items-center gap-2 text-xs font-semibold text-blue-400"><Icon className="h-4 w-4" />{title}</div><h4 className="mt-3 text-lg font-semibold leading-6 tracking-tight">{item.title}</h4><p className="mt-2 text-xs leading-5 text-[#a1a1a6]">{item.summary}</p><div className="mt-4 flex flex-wrap gap-1.5">{item.techniques.slice(0, 3).map(technique => <span key={technique} className="rounded-full bg-white/[.07] px-2.5 py-1 text-[10px] text-[#d2d2d7]">{technique}</span>)}</div><p className="mt-4 border-t border-white/[.08] pt-4 text-[11px] leading-5 text-[#86868b]">{item.reasons[0]}</p></article>; }

function SubmissionCard({ item, number }: { item: SubmissionRecommendation; number: number }) { return <article className="group rounded-[1.6rem] border border-white/10 bg-[#111113] p-5 transition duration-300 hover:border-blue-400/30 hover:bg-[#16161a]"><div className="flex items-center justify-between"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#0a84ff] text-xs font-semibold text-white">{number}</span><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${item.priority === "Principal" ? "bg-blue-500/15 text-blue-300" : "bg-white/[.07] text-[#a1a1a6]"}`}>{item.priority}</span></div><h4 className="mt-4 text-lg font-semibold tracking-tight">{item.name}</h4><p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">{item.family}</p><dl className="mt-4 space-y-3 text-xs"><div><dt className="font-semibold text-white">Entrada</dt><dd className="mt-1 leading-5 text-[#a1a1a6]">{item.entry}</dd></div><div><dt className="font-semibold text-white">Por qué</dt><dd className="mt-1 leading-5 text-[#a1a1a6]">{item.why}</dd></div></dl><p className="mt-4 rounded-xl bg-amber-400/[.08] p-3 text-[10px] leading-4 text-amber-100/80">{item.caution}</p></article>; }

function RecommendationColumn({ title, icon: Icon, tone, items }: { title: string; icon: typeof Shield; tone: "emerald" | "amber" | "rose"; items: StyleRecommendation[] }) { const styles = { emerald: "border-emerald-300/15 bg-emerald-400/10 text-emerald-300", amber: "border-amber-300/15 bg-amber-400/10 text-amber-300", rose: "border-rose-300/15 bg-rose-400/10 text-rose-300" }[tone]; return <div className="min-w-0"><div className={`mb-3 flex items-center gap-3 rounded-2xl border p-4 ${styles}`}><Icon className="h-6 w-6" /><h3 className="text-lg font-black text-white print:text-black">{title}</h3></div><div className="space-y-3">{items.map((item, index) => <RecommendationCard key={item.id} item={item} primary={index === 0} tone={tone} />)}</div></div>; }
function RecommendationCard({ item, primary, tone }: { item: StyleRecommendation; primary: boolean; tone: "emerald" | "amber" | "rose" }) { const accent = { emerald: "text-emerald-300", amber: "text-amber-300", rose: "text-rose-300" }[tone]; return <details open={primary} className={`group rounded-2xl border bg-black/20 print:bg-white ${primary ? "border-white/20 print:border-slate-400" : "border-white/[.07] print:border-slate-200"}`}><summary className="cursor-pointer list-none p-4"><span className={`text-[9px] font-black uppercase tracking-wider ${accent}`}>{item.level}</span><h4 className="mt-1 text-sm font-black leading-5">{item.title}</h4><p className="mt-2 text-xs leading-5 text-slate-500">{item.summary}</p></summary><div className="space-y-3 border-t border-white/[.06] p-4 text-xs print:border-slate-200"><div><b>Por qué probarlo</b>{item.reasons.map(reason => <p key={reason} className="mt-1 flex gap-2 leading-5 text-slate-500"><span className={accent}>•</span>{reason}</p>)}</div><div className="flex flex-wrap gap-1.5">{item.techniques.map(technique => <span key={technique} className="rounded-lg bg-white/[.05] px-2 py-1 text-[10px] text-slate-300 print:bg-slate-100 print:text-slate-700">{technique}</span>)}</div><p className="rounded-xl bg-cyan-500/[.06] p-3 leading-5"><b>Prueba:</b> {item.drill}</p><p className="rounded-xl bg-amber-500/[.06] p-3 leading-5"><b>Vigilar:</b> {item.watch}</p></div></details>; }
