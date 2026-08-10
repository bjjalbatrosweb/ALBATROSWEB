"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { doc, onSnapshot } from "firebase/firestore";
import {
  Award,
  Check,
  Crown,
  FileCheck2,
  Grid2X2,
  LayoutList,
  Loader2,
  Maximize2,
  Minimize2,
  PenTool,
  Save,
  ShieldAlert,
  Star,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useFirestore } from "@/firebase";
import type { ExamCriterion } from "@/lib/taekwondo-exam";

type Participant = {
  id: string;
  nombre: string;
  fotoUrl?: string;
  grupo: string;
  idExamen: string;
  gradoActual: string;
  gradoAscenso: string;
  cintaColor?: string;
  cintaColorSecundario?: string;
  posicion?: { x: number; y: number };
};

type JudgePublic = {
  id: string;
  nombre: string;
  grado: string;
  foto?: string;
  finalizado?: boolean;
};

type SheetStatus = {
  estado?: "iniciado" | "completo";
  mejorExamen?: boolean;
  promedio?: number;
};

type PublicSession = {
  examenId: string;
  nombre: string;
  sede: string;
  fecha: string;
  estado: "registro_sinodales" | "evaluacion" | "finalizado";
  participantes: Participant[];
  criterios: ExamCriterion[];
  criteriosPorGrupo: Record<string, string[]>;
  sinodales: Record<string, JudgePublic>;
  estadoHojas?: Record<string, Record<string, SheetStatus>>;
  mostrarFaltantes?: Record<string, boolean>;
  promedioGeneral?: number;
  promedioAcademia?: number;
};

type JudgeProfile = {
  nombre: string;
  grado: string;
  foto: string;
  firma: string;
};

type EvaluationSheet = {
  calificaciones?: Record<string, number>;
  observaciones?: string;
  mejorExamen?: boolean;
  completa?: boolean;
};

const PROFILE_KEY = "albatros:sinodal-taekwondo:v1";
const DEVICE_KEY = "albatros:sinodal-device:v1";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function dataUrlFromFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => reject(new Error("La fotografía no es válida."));
      image.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context)
          return reject(new Error("No se pudo preparar la imagen."));
        const crop = Math.min(image.width, image.height);
        const x = (image.width - crop) / 2;
        const y = (image.height - crop) / 2;
        context.drawImage(image, x, y, crop, crop, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function SignatureCanvas({ onChange }: { onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    drawing.current = true;
    const context = canvas.getContext("2d");
    const position = point(event);
    if (!context) return;
    context.beginPath();
    context.moveTo(position.x, position.y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !canvasRef.current) return;
    const context = canvasRef.current.getContext("2d");
    const position = point(event);
    if (!context) return;
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#F4F4F5";
    context.lineTo(position.x, position.y);
    context.stroke();
  };

  const finish = () => {
    if (!drawing.current || !canvasRef.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={720}
        height={220}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        className="h-36 w-full touch-none rounded-2xl border border-white/10 bg-black/35"
      />
      <button
        type="button"
        onClick={clear}
        className="mt-2 text-xs font-black uppercase tracking-wider text-zinc-400 hover:text-white"
      >
        Limpiar firma
      </button>
    </div>
  );
}

function StarRating({
  value,
  onChange,
  disabled = false,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(0)}
        className={`h-9 min-w-9 rounded-lg border px-2 text-xs font-black transition ${
          value === 0
            ? "border-red-400 bg-red-500/20 text-white"
            : "border-white/10 bg-black/25 text-zinc-500 hover:text-white"
        }`}
      >
        0
      </button>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className="rounded-lg p-1 disabled:opacity-50"
          aria-label={`${star} estrellas`}
        >
          <Star
            className={`h-7 w-7 transition ${
              value !== undefined && star <= value
                ? "fill-amber-400 text-amber-400"
                : "text-zinc-600 hover:text-amber-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function EvaluationSheetCard({
  token,
  judgeId,
  participant,
  criteria,
  judge,
  mode,
  onClose,
}: {
  token: string;
  judgeId: string;
  participant: Participant;
  criteria: ExamCriterion[];
  judge: JudgeProfile;
  mode: "completa" | "ventana";
  onClose: () => void;
}) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [observations, setObservations] = useState("");
  const [best, setBest] = useState(false);
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      `/api/taekwondo/examen/evaluacion?token=${encodeURIComponent(token)}&sinodalId=${encodeURIComponent(judgeId)}&alumnoId=${encodeURIComponent(participant.id)}`,
      { signal: controller.signal },
    )
      .then((response) => response.json())
      .then((data) => {
        const evaluation = (data.evaluacion || {}) as EvaluationSheet;
        setRatings(evaluation.calificaciones || {});
        setObservations(evaluation.observaciones || "");
        setBest(evaluation.mejorExamen === true);
        setComplete(evaluation.completa === true);
      })
      .catch(() => setMessage("No se pudo cargar la hoja."))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [judgeId, participant.id, token]);

  const save = async (finish: boolean) => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/taekwondo/examen/evaluacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: finish ? "finalizar_hoja" : "guardar_hoja",
          token,
          sinodalId: judgeId,
          alumnoId: participant.id,
          calificaciones: ratings,
          observaciones: observations,
          mejorExamen: best,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje || "No se pudo guardar.");
      setComplete(data.estado === "completo");
      setMessage(finish ? "Hoja finalizada." : "Avance guardado.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo guardar.",
      );
    } finally {
      setSaving(false);
    }
  };

  const grouped = useMemo(
    () =>
      Object.entries(
        criteria.reduce<Record<string, ExamCriterion[]>>(
          (groups, criterion) => {
            (groups[criterion.categoria] ||= []).push(criterion);
            return groups;
          },
          {},
        ),
      ),
    [criteria],
  );
  const answered = criteria.filter(
    (criterion) => criterion.id in ratings,
  ).length;

  return (
    <article
      className={`flex min-h-0 flex-col overflow-hidden border border-white/15 bg-[#111217] text-zinc-100 shadow-2xl ${
        mode === "completa"
          ? "h-full w-full rounded-none"
          : "max-h-[78vh] rounded-[24px]"
      }`}
    >
      <header className="flex items-center gap-3 border-b border-white/10 bg-black/30 p-4">
        <Avatar className="h-14 w-14 border border-white/15 bg-zinc-900">
          <AvatarImage
            src={participant.fotoUrl}
            alt={participant.nombre}
            className="object-cover"
          />
          <AvatarFallback className="bg-zinc-800 font-black text-white">
            {initials(participant.nombre)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black text-white">
            {participant.nombre}
          </p>
          <p className="truncate text-xs text-zinc-400">
            {participant.grupo} · ID {participant.idExamen} ·{" "}
            {participant.gradoActual} → {participant.gradoAscenso}
          </p>
          <p className="mt-1 truncate text-[11px] font-bold text-zinc-500">
            Sinodal: {judge.nombre} · {judge.grado}
          </p>
        </div>
        {judge.firma && (
          <Image
            src={judge.firma}
            alt={`Firma de ${judge.nombre}`}
            width={120}
            height={44}
            unoptimized
            className="hidden h-11 w-28 rounded-lg bg-white/[.04] object-contain p-1 sm:block"
          />
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/10 p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-zinc-400">
            <Loader2 className="mr-2 animate-spin" /> Cargando hoja…
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                  Progreso
                </p>
                <p className="mt-1 font-black text-white">
                  {answered} de {criteria.length} criterios
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBest((value) => !value)}
                disabled={complete}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-black transition ${
                  best
                    ? "border-amber-400/50 bg-amber-400/15 text-amber-200"
                    : "border-white/10 bg-white/[.05] text-zinc-300 hover:text-white"
                }`}
              >
                <Crown
                  className={`h-5 w-5 ${best ? "fill-amber-400 text-amber-400" : ""}`}
                />{" "}
                Mejor examen
              </button>
            </div>
            {grouped.map(([category, categoryCriteria]) => (
              <section key={category}>
                <h3 className="mb-2 text-xs font-black uppercase tracking-[.16em] text-red-300">
                  {category}
                </h3>
                <div className="space-y-2">
                  {categoryCriteria.map((criterion) => (
                    <div
                      key={criterion.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="max-w-xl">
                          <p className="font-black text-white">
                            {criterion.nombre}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                            {criterion.descripcion}
                          </p>
                        </div>
                        <StarRating
                          value={ratings[criterion.id]}
                          disabled={complete}
                          onChange={(value) =>
                            setRatings((current) => ({
                              ...current,
                              [criterion.id]: value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Observaciones
              </span>
              <textarea
                value={observations}
                onChange={(event) => setObservations(event.target.value)}
                disabled={complete}
                maxLength={1000}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-white outline-none placeholder:text-zinc-600 focus:border-red-500/50 disabled:opacity-60"
                placeholder="Notas técnicas del alumno…"
              />
            </label>
          </div>
        )}
      </div>

      <footer className="flex flex-col gap-3 border-t border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center">
        <p
          className={`min-w-0 flex-1 text-sm font-bold ${message.includes("No") || message.includes("Faltan") ? "text-red-300" : "text-emerald-300"}`}
        >
          {message}
        </p>
        {!complete ? (
          <>
            <Button
              type="button"
              onClick={() => void save(false)}
              disabled={saving}
              className="rounded-xl border border-white/10 bg-white/[.08] text-white hover:bg-white/15 hover:text-white"
            >
              <Save /> Guardar avance
            </Button>
            <Button
              type="button"
              onClick={() => void save(true)}
              disabled={saving}
              className="rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-500 hover:text-white"
            >
              {saving ? <Loader2 className="animate-spin" /> : <FileCheck2 />}{" "}
              Finalizar hoja
            </Button>
          </>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-2 text-sm font-black text-emerald-300">
            <Check className="h-4 w-4" /> Hoja finalizada
          </span>
        )}
      </footer>
    </article>
  );
}

function EvaluationExperience() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const firestore = useFirestore();
  const [session, setSession] = useState<PublicSession | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [profile, setProfile] = useState<JudgeProfile>({
    nombre: "",
    grado: "1° Dan",
    foto: "",
    firma: "",
  });
  const [judgeId, setJudgeId] = useState("");
  const [joining, setJoining] = useState(false);
  const [view, setView] = useState<"lista" | "libre">("lista");
  const [sheetMode, setSheetMode] = useState<"completa" | "ventana">("ventana");
  const [group, setGroup] = useState("todos");
  const [zoom, setZoom] = useState(1);
  const [openSheets, setOpenSheets] = useState<string[]>([]);
  const [localPositions, setLocalPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [finishing, setFinishing] = useState(false);
  const [finishPanel, setFinishPanel] = useState(false);
  const [generalScore, setGeneralScore] = useState<number>();
  const [academyScore, setAcademyScore] = useState<number>();
  const [finishMessage, setFinishMessage] = useState("");

  useEffect(() => {
    try {
      const cached = localStorage.getItem(PROFILE_KEY);
      if (cached) setProfile(JSON.parse(cached) as JudgeProfile);
    } catch {
      localStorage.removeItem(PROFILE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!session || judgeId || !token) return;
    const cachedJudgeId = localStorage.getItem(
      `albatros:sinodal-session:${token}`,
    );
    if (cachedJudgeId && session.sinodales?.[cachedJudgeId]) {
      setJudgeId(cachedJudgeId);
    }
  }, [judgeId, session, token]);

  useEffect(() => {
    if (!firestore || !token) {
      if (!token)
        setSessionError("El enlace no incluye un código de evaluación.");
      return;
    }
    const unsubscribe = onSnapshot(
      doc(firestore, "ExamenEvaluacionPublica", token),
      (snapshot) => {
        if (!snapshot.exists()) {
          setSessionError("La sesión no existe o todavía no fue publicada.");
          return;
        }
        setSession(snapshot.data() as PublicSession);
        setSessionError("");
      },
      () => setSessionError("No se pudo sincronizar la sesión."),
    );
    return unsubscribe;
  }, [firestore, token]);

  const deviceId = useCallback(() => {
    let value = localStorage.getItem(DEVICE_KEY);
    if (!value) {
      value = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(DEVICE_KEY, value);
    }
    return value;
  }, []);

  const join = async () => {
    if (!profile.nombre.trim() || !profile.firma) {
      setSessionError("Completa nombre y firma del sinodal.");
      return;
    }
    setJoining(true);
    setSessionError("");
    try {
      const response = await fetch("/api/taekwondo/examen/evaluacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "unirse",
          token,
          dispositivoId: deviceId(),
          ...profile,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.mensaje || "No fue posible entrar.");
      setJudgeId(data.sinodal.id);
      localStorage.setItem(
        `albatros:sinodal-session:${token}`,
        data.sinodal.id,
      );
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : "No fue posible entrar.",
      );
    } finally {
      setJoining(false);
    }
  };

  const groups = useMemo(
    () =>
      Array.from(
        new Set((session?.participantes || []).map((item) => item.grupo)),
      ).sort(),
    [session?.participantes],
  );
  const participants = useMemo(
    () =>
      (session?.participantes || []).filter(
        (participant) => group === "todos" || participant.grupo === group,
      ),
    [group, session?.participantes],
  );
  const statuses = session?.estadoHojas?.[judgeId] || {};
  const missingVisible = session?.mostrarFaltantes?.[judgeId] === true;

  const criteriaFor = useCallback(
    (participant: Participant) => {
      const all = session?.criterios || [];
      const selected = session?.criteriosPorGrupo?.[participant.grupo];
      if (!selected?.length) return all;
      const ids = new Set(selected);
      return all.filter((criterion) => ids.has(criterion.id));
    },
    [session?.criterios, session?.criteriosPorGrupo],
  );

  const openSheet = (studentId: string) => {
    setOpenSheets((current) => {
      if (sheetMode === "completa") return [studentId];
      if (current.includes(studentId)) return current;
      return [...current.slice(-3), studentId];
    });
  };

  const finishJudge = async () => {
    if (generalScore === undefined || academyScore === undefined) {
      setFinishMessage("Califica el examen y la academia antes de terminar.");
      return;
    }
    setFinishing(true);
    setFinishMessage("");
    try {
      const response = await fetch("/api/taekwondo/examen/evaluacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "finalizar_sinodal",
          token,
          sinodalId: judgeId,
          calificacionGeneral: generalScore,
          calificacionAcademia: academyScore,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje || "No se pudo terminar.");
      setFinishMessage(data.mensaje);
      if (data.examenFinalizado) setFinishPanel(false);
    } catch (error) {
      setFinishMessage(
        error instanceof Error ? error.message : "No se pudo terminar.",
      );
    } finally {
      setFinishing(false);
    }
  };

  if (sessionError && !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07080b] p-5 text-zinc-100">
        <div className="max-w-lg rounded-[28px] border border-red-500/25 bg-red-500/10 p-8 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-red-300" />
          <h1 className="mt-4 text-2xl font-black text-white">
            Evaluación no disponible
          </h1>
          <p className="mt-2 text-zinc-300">{sessionError}</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07080b] text-zinc-300">
        <Loader2 className="mr-3 animate-spin" /> Sincronizando sesión…
      </main>
    );
  }

  if (!judgeId) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,.18),transparent_35%),#07080b] p-4 text-zinc-100 sm:p-8">
        <div className="mx-auto max-w-3xl">
          <header className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.16em] text-red-300">
              <Award className="h-4 w-4" /> Mesa de evaluación
            </span>
            <h1 className="mt-5 text-3xl font-black text-white sm:text-5xl">
              {session.nombre}
            </h1>
            <p className="mt-2 text-zinc-400">
              {session.sede} · {session.fecha}
            </p>
          </header>
          <section className="mt-8 rounded-[30px] border border-white/10 bg-white/[.05] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
              Perfil del sinodal
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              Identifícate en este dispositivo
            </h2>
            {session.estado !== "registro_sinodales" && (
              <p className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm font-bold text-amber-200">
                El registro ya cerró. Usa un dispositivo que se haya unido antes
                de iniciar.
              </p>
            )}
            <div className="mt-6 grid gap-5 sm:grid-cols-[auto_1fr]">
              <label className="group flex h-36 w-36 cursor-pointer items-center justify-center overflow-hidden rounded-3xl border border-dashed border-white/20 bg-black/25">
                {profile.foto ? (
                  <Image
                    src={profile.foto}
                    alt="Sinodal"
                    width={144}
                    height={144}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-center text-zinc-500">
                    <UserRound className="mx-auto h-8 w-8" />
                    <span className="mt-2 block text-xs font-bold">
                      Agregar foto
                    </span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file)
                      void dataUrlFromFile(file).then((foto) =>
                        setProfile((current) => ({ ...current, foto })),
                      );
                  }}
                />
              </label>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                    Nombre completo
                  </span>
                  <input
                    value={profile.nombre}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        nombre: event.target.value,
                      }))
                    }
                    maxLength={80}
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-red-500/60"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                    Grado
                  </span>
                  <select
                    value={profile.grado}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        grado: event.target.value,
                      }))
                    }
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#0b0c10] px-4 font-bold text-white outline-none focus:border-red-500/60"
                  >
                    {Array.from(
                      { length: 10 },
                      (_, index) => `${index + 1}° Dan`,
                    ).map((grade) => (
                      <option key={grade}>{grade}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="mt-6">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Firma para las hojas
              </span>
              {profile.firma ? (
                <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-3">
                  <Image
                    src={profile.firma}
                    alt="Firma del sinodal"
                    width={720}
                    height={112}
                    unoptimized
                    className="h-28 w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setProfile((current) => ({ ...current, firma: "" }))
                    }
                    className="mt-2 text-xs font-black uppercase tracking-wider text-zinc-400 hover:text-white"
                  >
                    Volver a firmar
                  </button>
                </div>
              ) : (
                <div className="mt-2">
                  <SignatureCanvas
                    onChange={(firma) =>
                      setProfile((current) => ({ ...current, firma }))
                    }
                  />
                </div>
              )}
            </div>
            {sessionError && (
              <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-bold text-red-200">
                {sessionError}
              </p>
            )}
            <Button
              type="button"
              onClick={() => void join()}
              disabled={joining || session.estado !== "registro_sinodales"}
              className="mt-6 h-14 w-full rounded-2xl bg-red-600 text-base font-black text-white hover:bg-red-500 hover:text-white"
            >
              {joining ? <Loader2 className="animate-spin" /> : <PenTool />}{" "}
              {joining ? "Registrando…" : "Entrar como sinodal"}
            </Button>
          </section>
        </div>
      </main>
    );
  }

  if (session.estado === "registro_sinodales") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,.16),transparent_35%),#07080b] p-5 text-zinc-100">
        <div className="w-full max-w-xl rounded-[30px] border border-blue-400/20 bg-white/[.05] p-8 text-center shadow-2xl">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-400/15 text-blue-300">
            <Users className="h-10 w-10" />
          </span>
          <h1 className="mt-6 text-3xl font-black text-white">
            Sinodal registrado
          </h1>
          <p className="mt-2 text-zinc-300">
            {profile.nombre} · {profile.grado}
          </p>
          <p className="mt-5 text-sm text-zinc-500">
            Espera a que el profesor cierre el registro e inicie la evaluación.
            Esta pantalla se actualizará automáticamente.
          </p>
          <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-blue-300" />
        </div>
      </main>
    );
  }

  if (session.estado === "finalizado") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,197,94,.16),transparent_35%),#07080b] p-5 text-zinc-100">
        <div className="w-full max-w-xl rounded-[30px] border border-emerald-400/20 bg-white/[.05] p-8 text-center shadow-2xl">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
            <FileCheck2 className="h-10 w-10" />
          </span>
          <h1 className="mt-6 text-3xl font-black text-white">
            Examen finalizado
          </h1>
          <p className="mt-2 text-zinc-300">
            Los resultados quedaron archivados.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-black/25 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                Examen
              </p>
              <p className="mt-1 text-2xl font-black text-white">
                {session.promedioGeneral ?? 0}/5
              </p>
            </div>
            <div className="rounded-2xl bg-black/25 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                Academia
              </p>
              <p className="mt-1 text-2xl font-black text-white">
                {session.promedioAcademia ?? 0}/5
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07080b] p-3 text-zinc-100 sm:p-5">
      <header className="rounded-[26px] border border-white/10 bg-white/[.05] p-4 shadow-xl backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border border-white/15 bg-zinc-900">
              <AvatarImage
                src={profile.foto}
                alt={profile.nombre}
                className="object-cover"
              />
              <AvatarFallback className="bg-zinc-800 font-black text-white">
                {initials(profile.nombre)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-red-300">
                {session.nombre}
              </p>
              <h1 className="text-xl font-black text-white">
                {profile.nombre} · {profile.grado}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
              <button
                type="button"
                onClick={() => setView("lista")}
                className={`rounded-lg p-2 ${view === "lista" ? "bg-white text-zinc-950" : "text-zinc-400"}`}
              >
                <LayoutList className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setView("libre")}
                className={`rounded-lg p-2 ${view === "libre" ? "bg-white text-zinc-950" : "text-zinc-400"}`}
              >
                <Grid2X2 className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                setSheetMode((value) =>
                  value === "completa" ? "ventana" : "completa",
                )
              }
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.06] px-3 text-sm font-black text-white"
            >
              {sheetMode === "completa" ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}{" "}
              Hojas: {sheetMode === "completa" ? "completa" : "ventanas"}
            </button>
            <Button
              type="button"
              onClick={() => setFinishPanel(true)}
              className="rounded-xl bg-red-600 font-black text-white hover:bg-red-500 hover:text-white"
            >
              <FileCheck2 /> Terminar examen
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGroup("todos")}
            className={`rounded-full border px-4 py-2 text-xs font-black ${group === "todos" ? "border-red-500/50 bg-red-500/15 text-white" : "border-white/10 text-zinc-400"}`}
          >
            Todos
          </button>
          {groups.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setGroup(item)}
              className={`rounded-full border px-4 py-2 text-xs font-black ${group === item ? "border-red-500/50 bg-red-500/15 text-white" : "border-white/10 text-zinc-400"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      {view === "lista" ? (
        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {participants.map((participant) => {
            const status = statuses[participant.id];
            const ring =
              status?.estado === "completo"
                ? "border-emerald-400 shadow-emerald-950/40"
                : status?.estado === "iniciado"
                  ? "border-blue-400 shadow-blue-950/40"
                  : missingVisible
                    ? "border-red-500 shadow-red-950/40"
                    : "border-white/10";
            return (
              <button
                key={participant.id}
                type="button"
                onClick={() => openSheet(participant.id)}
                className={`relative flex items-center gap-3 rounded-[22px] border-2 bg-white/[.045] p-4 text-left shadow-xl transition hover:-translate-y-0.5 ${ring}`}
              >
                {status?.mejorExamen && (
                  <span className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-zinc-950 shadow-lg">
                    <Crown className="h-5 w-5 fill-current" />
                  </span>
                )}
                <Avatar className="h-16 w-16 border border-white/15 bg-zinc-900">
                  <AvatarImage
                    src={participant.fotoUrl}
                    alt={participant.nombre}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-zinc-800 font-black text-white">
                    {initials(participant.nombre)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate font-black text-white">
                    {participant.nombre}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-400">
                    {participant.grupo} · ID {participant.idExamen}
                  </span>
                  <span className="mt-1 block text-xs font-bold text-zinc-500">
                    {status?.estado === "completo"
                      ? "Completo"
                      : status?.estado === "iniciado"
                        ? "En evaluación"
                        : "Pendiente"}
                  </span>
                </span>
              </button>
            );
          })}
        </section>
      ) : (
        <section className="mt-4 overflow-auto rounded-[28px] border border-white/10 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px),#0b0c11] bg-[size:42px_42px] p-4 shadow-2xl">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Zoom
            </span>
            <input
              type="range"
              min="0.6"
              max="1.5"
              step="0.1"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </div>
          <div
            className="relative h-[720px] min-w-[1050px] origin-top-left"
            style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }}
          >
            {participants.map((participant, index) => {
              const position = localPositions[participant.id] ||
                participant.posicion || {
                  x: 80 + (index % 6) * 160,
                  y: 70 + Math.floor(index / 6) * 180,
                };
              const status = statuses[participant.id];
              const ring =
                status?.estado === "completo"
                  ? "border-emerald-400"
                  : status?.estado === "iniciado"
                    ? "border-blue-400"
                    : missingVisible
                      ? "border-red-500"
                      : "border-white/15";
              return (
                <button
                  key={participant.id}
                  type="button"
                  draggable
                  onDragEnd={(event) => {
                    const board =
                      event.currentTarget.parentElement?.getBoundingClientRect();
                    if (!board) return;
                    setLocalPositions((current) => ({
                      ...current,
                      [participant.id]: {
                        x: Math.max(
                          0,
                          (event.clientX - board.left) / zoom - 65,
                        ),
                        y: Math.max(0, (event.clientY - board.top) / zoom - 65),
                      },
                    }));
                  }}
                  onDoubleClick={() => openSheet(participant.id)}
                  className="absolute w-32 text-center"
                  style={{ left: position.x, top: position.y }}
                >
                  <span className="relative mx-auto block w-fit">
                    <Avatar
                      className={`h-24 w-24 border-4 bg-zinc-900 shadow-xl ${ring}`}
                    >
                      <AvatarImage
                        src={participant.fotoUrl}
                        alt={participant.nombre}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-zinc-800 text-xl font-black text-white">
                        {initials(participant.nombre)}
                      </AvatarFallback>
                    </Avatar>
                    {status?.mejorExamen && (
                      <span className="absolute -right-2 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-zinc-950">
                        <Crown className="h-4 w-4 fill-current" />
                      </span>
                    )}
                  </span>
                  <span className="mt-2 block truncate text-sm font-black text-white">
                    {participant.nombre}
                  </span>
                  <span className="text-xs text-zinc-400">
                    ID {participant.idExamen}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-xs text-zinc-500">
            Arrastra para acomodar tu vista. Haz doble clic para abrir una hoja.
          </p>
        </section>
      )}

      {openSheets.length > 0 && (
        <div
          className={
            sheetMode === "completa"
              ? "fixed inset-0 z-50 bg-black"
              : "fixed inset-x-3 bottom-3 z-50 grid max-h-[80vh] gap-3 overflow-auto rounded-[28px] bg-black/70 p-3 backdrop-blur-xl md:grid-cols-2"
          }
        >
          {(sheetMode === "completa" ? openSheets.slice(-1) : openSheets).map(
            (studentId) => {
              const participant = session.participantes.find(
                (item) => item.id === studentId,
              );
              if (!participant) return null;
              return (
                <EvaluationSheetCard
                  key={studentId}
                  token={token}
                  judgeId={judgeId}
                  participant={participant}
                  criteria={criteriaFor(participant)}
                  judge={profile}
                  mode={sheetMode === "completa" ? "completa" : "ventana"}
                  onClose={() =>
                    setOpenSheets((current) =>
                      current.filter((id) => id !== studentId),
                    )
                  }
                />
              );
            },
          )}
        </div>
      )}

      {finishPanel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <section className="w-full max-w-xl rounded-[28px] border border-white/15 bg-[#15161b] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
                  Cierre del sinodal
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  Terminar examen
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setFinishPanel(false)}
                className="rounded-xl border border-white/10 p-2 text-zinc-400 hover:text-white"
              >
                <X />
              </button>
            </div>
            <p className="mt-3 text-sm text-zinc-400">
              Solo podrás terminar cuando todas tus hojas estén finalizadas.
            </p>
            <div className="mt-6 space-y-5">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="mb-3 font-black text-white">
                  Calificación general del examen
                </p>
                <StarRating value={generalScore} onChange={setGeneralScore} />
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="mb-3 font-black text-white">
                  Calificación de la academia
                </p>
                <StarRating value={academyScore} onChange={setAcademyScore} />
              </div>
            </div>
            {finishMessage && (
              <p className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3 text-sm font-bold text-zinc-200">
                {finishMessage}
              </p>
            )}
            <Button
              type="button"
              onClick={() => void finishJudge()}
              disabled={finishing}
              className="mt-5 h-14 w-full rounded-2xl bg-red-600 text-base font-black text-white hover:bg-red-500 hover:text-white"
            >
              {finishing ? (
                <Loader2 className="animate-spin" />
              ) : (
                <FileCheck2 />
              )}{" "}
              Validar y terminar
            </Button>
          </section>
        </div>
      )}
    </main>
  );
}

export default function ExamEvaluationPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#07080b] text-zinc-300">
          <Loader2 className="mr-2 animate-spin" /> Preparando evaluación…
        </main>
      }
    >
      <EvaluationExperience />
    </Suspense>
  );
}
