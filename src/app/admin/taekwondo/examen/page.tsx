"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  Award,
  Check,
  ClipboardCheck,
  Crown,
  Eye,
  FileClock,
  Grip,
  History,
  LayoutList,
  Loader2,
  LockKeyhole,
  PenLine,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Star,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  createExamToken,
  DEFAULT_EXAM_CRITERIA,
  normalizeExamText,
  type ExamCriterion,
  type ExamState,
} from "@/lib/taekwondo-exam";

type Exam = {
  id: string;
  nombre: string;
  sede: string;
  fecha: string;
  precio: number;
  estado: ExamState;
  grupos: string[];
  registroToken: string;
  evaluacionToken: string;
  criterios: ExamCriterion[];
  criteriosPorGrupo: Record<string, string[]>;
  promedioGeneral?: number;
  promedioAcademia?: number;
  creadoEn?: { seconds?: number };
};

type RequestRecord = {
  id: string;
  alumnoId: string;
  alumnoNombre: string;
  fotoUrl?: string;
  grupo: string;
  idExamen: string;
  gradoActual: string;
  gradoAscenso: string;
  cintaNombre?: string;
  precio: number;
  estado: string;
  posicion?: { x: number; y: number };
  cintaColor?: string;
  cintaColorSecundario?: string;
  creadoEn?: { seconds?: number };
};

type JudgeRecord = {
  id: string;
  nombre: string;
  grado: string;
  foto?: string;
  firma?: string;
  finalizado?: boolean;
  calificacionGeneral?: number;
  calificacionAcademia?: number;
};

type EvaluationRecord = {
  id: string;
  alumnoNombre: string;
  alumnoId: string;
  sinodalNombre: string;
  sinodalId: string;
  grupo: string;
  idExamen: string;
  gradoActual: string;
  gradoAscenso: string;
  promedio: number;
  observaciones?: string;
  mejorExamen?: boolean;
  completa?: boolean;
};

type Tab = "sesiones" | "solicitudes" | "organizar" | "criterios" | "historial";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

function stateLabel(state: ExamState) {
  return {
    inscripciones: "Inscripciones abiertas",
    registro_sinodales: "Registro de sinodales",
    evaluacion: "Evaluación activa",
    finalizado: "Finalizado",
  }[state];
}

function beltBackground(primary?: string, secondary?: string) {
  const first = primary || "#DC2626";
  return secondary
    ? `linear-gradient(90deg, ${first} 0 42%, ${secondary} 42% 58%, ${first} 58% 100%)`
    : first;
}

function TeacherGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    if (pin !== "4826") {
      setError("PIN incorrecto.");
      setPin("");
      return;
    }
    sessionStorage.setItem("taekwondoExamTeacher:v1", "unlocked");
    onUnlock();
  };
  return (
    <main className="flex min-h-[75vh] items-center justify-center bg-[#07080b] p-5 text-zinc-100">
      <section className="w-full max-w-md rounded-[30px] border border-white/10 bg-white/[.05] p-7 text-center shadow-2xl backdrop-blur-xl">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10 text-red-300">
          <LockKeyhole className="h-10 w-10" />
        </span>
        <p className="mt-6 text-xs font-black uppercase tracking-[.18em] text-red-300">
          Modo profesor
        </p>
        <h1 className="mt-2 text-3xl font-black text-white">
          Control de examen
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Ingresa el PIN para continuar.
        </p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(event) =>
            setPin(event.target.value.replace(/\D/g, "").slice(0, 4))
          }
          onKeyDown={(event) => event.key === "Enter" && submit()}
          placeholder="••••"
          className="mt-6 h-16 w-full rounded-2xl border border-white/10 bg-black/35 text-center text-3xl font-black tracking-[.45em] text-white outline-none placeholder:text-zinc-700 focus:border-red-500/60"
        />
        {error && (
          <p className="mt-3 text-sm font-bold text-red-300">{error}</p>
        )}
        <Button
          type="button"
          onClick={submit}
          disabled={pin.length !== 4}
          className="mt-5 h-14 w-full rounded-2xl bg-red-600 text-base font-black text-white hover:bg-red-500 hover:text-white"
        >
          <ShieldCheck /> Entrar como profesor
        </Button>
      </section>
    </main>
  );
}

export default function TaekwondoExamAdminPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [unlocked, setUnlocked] = useState(false);
  const [sede, setSede] = useState("MMA");
  const [tab, setTab] = useState<Tab>("sesiones");
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [judges, setJudges] = useState<JudgeRecord[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("Examen de grados");
  const [date, setDate] = useState("");
  const [price, setPrice] = useState("");
  const [groupsText, setGroupsText] = useState("Grupo A, Grupo B");
  const [configPrice, setConfigPrice] = useState("");
  const [configGroupsText, setConfigGroupsText] = useState("");
  const [organizationView, setOrganizationView] = useState<"lista" | "libre">(
    "lista",
  );
  const [sortMode, setSortMode] = useState<"registro" | "id">("registro");
  const [editingBoard, setEditingBoard] = useState(false);
  const [groupFilter, setGroupFilter] = useState("todos");
  const [zoom, setZoom] = useState(1);
  const [newCriterion, setNewCriterion] = useState({
    categoria: "Personalizado",
    nombre: "",
    descripcion: "",
  });
  const [registrationQr, setRegistrationQr] = useState("");
  const [evaluationQr, setEvaluationQr] = useState("");

  useEffect(() => {
    setSede(localStorage.getItem("userSede") || "MMA");
    setUnlocked(
      sessionStorage.getItem("taekwondoExamTeacher:v1") === "unlocked",
    );
  }, []);

  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === selectedId) || null,
    [exams, selectedId],
  );

  useEffect(() => {
    setConfigPrice(selectedExam ? String(selectedExam.precio) : "");
    setConfigGroupsText(selectedExam?.grupos.join(", ") || "");
  }, [selectedExam]);

  const loadExams = useCallback(async () => {
    if (!firestore || !sede) return;
    setLoading(true);
    try {
      const snapshot = await getDocs(
        query(
          collection(firestore, "ExamenesTaekwondo"),
          where("sede", "==", sede),
        ),
      );
      const loaded = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }) as Exam)
        .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
      setExams(loaded);
      setSelectedId((current) =>
        loaded.some((exam) => exam.id === current)
          ? current
          : loaded[0]?.id || "",
      );
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "No se pudieron cargar los exámenes",
      });
    } finally {
      setLoading(false);
    }
  }, [firestore, sede, toast]);

  const loadExamDetails = useCallback(async () => {
    if (!firestore || !selectedId) {
      setRequests([]);
      setJudges([]);
      setEvaluations([]);
      return;
    }
    try {
      const [requestSnapshot, judgeSnapshot, evaluationSnapshot] =
        await Promise.all([
          getDocs(
            collection(
              firestore,
              "ExamenesTaekwondo",
              selectedId,
              "solicitudes",
            ),
          ),
          getDocs(
            collection(firestore, "ExamenesTaekwondo", selectedId, "sinodales"),
          ),
          getDocs(
            collection(
              firestore,
              "ExamenesTaekwondo",
              selectedId,
              "evaluaciones",
            ),
          ),
        ]);
      setRequests(
        requestSnapshot.docs.map(
          (document) =>
            ({ id: document.id, ...document.data() }) as RequestRecord,
        ),
      );
      setJudges(
        judgeSnapshot.docs.map(
          (document) =>
            ({ id: document.id, ...document.data() }) as JudgeRecord,
        ),
      );
      setEvaluations(
        evaluationSnapshot.docs.map(
          (document) =>
            ({ id: document.id, ...document.data() }) as EvaluationRecord,
        ),
      );
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "No se pudo cargar la sesión seleccionada",
      });
    }
  }, [firestore, selectedId, toast]);

  useEffect(() => {
    if (unlocked) void loadExams();
  }, [loadExams, unlocked]);
  useEffect(() => {
    if (unlocked) void loadExamDetails();
  }, [loadExamDetails, unlocked]);

  useEffect(() => {
    if (!selectedExam || typeof window === "undefined") {
      setRegistrationQr("");
      setEvaluationQr("");
      return;
    }
    const registrationUrl = `${window.location.origin}/taekwondo/examen/inscribirse?token=${selectedExam.registroToken}`;
    const evaluationUrl = `${window.location.origin}/taekwondo/examen/evaluacion?token=${selectedExam.evaluacionToken}`;
    void Promise.all([
      QRCode.toDataURL(registrationUrl, { width: 420, margin: 1 }),
      QRCode.toDataURL(evaluationUrl, { width: 420, margin: 1 }),
    ]).then(([registration, evaluation]) => {
      setRegistrationQr(registration);
      setEvaluationQr(evaluation);
    });
  }, [selectedExam]);

  const createExam = async () => {
    if (!firestore || !name.trim() || !date || Number(price) < 0) {
      toast({
        variant: "destructive",
        title: "Completa nombre, fecha y precio",
      });
      return;
    }
    const groups = groupsText
      .split(",")
      .map((item) => normalizeExamText(item, 50))
      .filter(Boolean);
    if (!groups.length) {
      toast({ variant: "destructive", title: "Agrega al menos un grupo" });
      return;
    }
    setSaving(true);
    try {
      const criteria = DEFAULT_EXAM_CRITERIA;
      const criteriaByGroup = Object.fromEntries(
        groups.map((group) => [group, criteria.map((item) => item.id)]),
      );
      const document = await addDoc(
        collection(firestore, "ExamenesTaekwondo"),
        {
          nombre: normalizeExamText(name, 100),
          sede,
          fecha: date,
          precio: Math.max(0, Number(price) || 0),
          estado: "inscripciones",
          grupos: groups,
          registroToken: createExamToken(),
          evaluacionToken: createExamToken(),
          criterios: criteria,
          criteriosPorGrupo: criteriaByGroup,
          creadoEn: serverTimestamp(),
          actualizadoEn: serverTimestamp(),
        },
      );
      await loadExams();
      setSelectedId(document.id);
      toast({
        title: "Examen creado",
        description: "Las inscripciones quedaron abiertas.",
      });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "No se pudo crear el examen" });
    } finally {
      setSaving(false);
    }
  };

  const updateSelectedExam = async (updates: Record<string, unknown>) => {
    if (!firestore || !selectedExam) return;
    await updateDoc(doc(firestore, "ExamenesTaekwondo", selectedExam.id), {
      ...updates,
      actualizadoEn: serverTimestamp(),
    });
    setExams((current) =>
      current.map((exam) =>
        exam.id === selectedExam.id ? ({ ...exam, ...updates } as Exam) : exam,
      ),
    );
  };

  const saveConfiguration = async () => {
    if (!selectedExam) return;
    const nextPrice = Math.max(
      0,
      Number(configPrice || selectedExam.precio) || 0,
    );
    const nextGroups = configGroupsText
      .split(",")
      .map((item) => normalizeExamText(item, 50))
      .filter(Boolean);
    const groups = nextGroups.length ? nextGroups : selectedExam.grupos;
    const criteriaByGroup = { ...selectedExam.criteriosPorGrupo };
    for (const group of groups)
      criteriaByGroup[group] ||= selectedExam.criterios.map((item) => item.id);
    setSaving(true);
    try {
      await updateSelectedExam({
        precio: nextPrice,
        grupos: groups,
        criteriosPorGrupo: criteriaByGroup,
      });
      toast({ title: "Precio y grupos actualizados" });
    } finally {
      setSaving(false);
    }
  };

  const publishJudgeRegistration = async () => {
    if (!firestore || !selectedExam || !requests.length) {
      toast({
        variant: "destructive",
        title: "Necesitas al menos un alumno inscrito",
      });
      return;
    }
    const participants = requests.map((request, index) => ({
      id: request.alumnoId,
      nombre: request.alumnoNombre,
      fotoUrl: request.fotoUrl || "",
      grupo: request.grupo,
      idExamen: request.idExamen,
      gradoActual: request.gradoActual,
      gradoAscenso: request.gradoAscenso,
      cintaNombre: request.cintaNombre || "",
      cintaColor: request.cintaColor || "#DC2626",
      cintaColorSecundario: request.cintaColorSecundario || "",
      posicion: request.posicion || {
        x: 80 + (index % 6) * 160,
        y: 70 + Math.floor(index / 6) * 180,
      },
    }));
    setSaving(true);
    try {
      await setDoc(
        doc(firestore, "ExamenEvaluacionPublica", selectedExam.evaluacionToken),
        {
          examenId: selectedExam.id,
          nombre: selectedExam.nombre,
          sede: selectedExam.sede,
          fecha: selectedExam.fecha,
          estado: "registro_sinodales",
          participantes: participants,
          criterios: selectedExam.criterios,
          criteriosPorGrupo: selectedExam.criteriosPorGrupo,
          sinodales: {},
          estadoHojas: {},
          mostrarFaltantes: {},
          actualizadoEn: serverTimestamp(),
        },
      );
      await updateSelectedExam({ estado: "registro_sinodales" });
      toast({
        title: "Registro de sinodales abierto",
        description: "Comparte el QR de evaluación.",
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "No se pudo abrir la evaluación",
      });
    } finally {
      setSaving(false);
    }
  };

  const startEvaluation = async () => {
    if (!firestore || !selectedExam) return;
    const judgeSnapshot = await getDocs(
      collection(firestore, "ExamenesTaekwondo", selectedExam.id, "sinodales"),
    );
    const currentJudges = judgeSnapshot.docs.map(
      (document) => ({ id: document.id, ...document.data() }) as JudgeRecord,
    );
    setJudges(currentJudges);
    if (!currentJudges.length) {
      toast({
        variant: "destructive",
        title: "Todavía no hay sinodales registrados",
      });
      return;
    }
    setSaving(true);
    try {
      await updateDoc(
        doc(firestore, "ExamenEvaluacionPublica", selectedExam.evaluacionToken),
        {
          estado: "evaluacion",
          registroCerrado: true,
          actualizadoEn: serverTimestamp(),
        },
      );
      await updateSelectedExam({ estado: "evaluacion" });
      toast({
        title: "Evaluación iniciada",
        description: `${currentJudges.length} sinodales deberán completar todas las hojas.`,
      });
    } finally {
      setSaving(false);
    }
  };

  const removeJudge = async (judge: JudgeRecord) => {
    if (
      !firestore ||
      !selectedExam ||
      selectedExam.estado !== "registro_sinodales"
    )
      return;
    await Promise.all([
      deleteDoc(
        doc(
          firestore,
          "ExamenesTaekwondo",
          selectedExam.id,
          "sinodales",
          judge.id,
        ),
      ),
      updateDoc(
        doc(firestore, "ExamenEvaluacionPublica", selectedExam.evaluacionToken),
        { [`sinodales.${judge.id}`]: deleteField() },
      ),
    ]);
    setJudges((current) => current.filter((item) => item.id !== judge.id));
    toast({ title: "Sinodal retirado de la sesión" });
  };

  const savePosition = async (
    request: RequestRecord,
    position: { x: number; y: number },
  ) => {
    if (!firestore || !selectedExam || !editingBoard) return;
    setRequests((current) =>
      current.map((item) =>
        item.id === request.id ? { ...item, posicion: position } : item,
      ),
    );
    await updateDoc(
      doc(
        firestore,
        "ExamenesTaekwondo",
        selectedExam.id,
        "solicitudes",
        request.id,
      ),
      { posicion: position, actualizadoEn: serverTimestamp() },
    );
  };

  const toggleCriterion = async (group: string, criterionId: string) => {
    if (!selectedExam) return;
    const current = selectedExam.criteriosPorGrupo[group] || [];
    const next = current.includes(criterionId)
      ? current.filter((id) => id !== criterionId)
      : [...current, criterionId];
    await updateSelectedExam({
      criteriosPorGrupo: { ...selectedExam.criteriosPorGrupo, [group]: next },
    });
  };

  const addCriterion = async () => {
    if (!selectedExam || !newCriterion.nombre.trim()) return;
    const criterion: ExamCriterion = {
      id: `custom-${createExamToken().slice(0, 10)}`,
      categoria:
        normalizeExamText(newCriterion.categoria, 60) || "Personalizado",
      nombre: normalizeExamText(newCriterion.nombre, 100),
      descripcion: normalizeExamText(newCriterion.descripcion, 240),
    };
    const criteria = [...selectedExam.criterios, criterion];
    const criteriaByGroup = Object.fromEntries(
      availableGroups.map((group) => [
        group,
        [...(selectedExam.criteriosPorGrupo[group] || []), criterion.id],
      ]),
    );
    await updateSelectedExam({
      criterios: criteria,
      criteriosPorGrupo: criteriaByGroup,
    });
    setNewCriterion({
      categoria: "Personalizado",
      nombre: "",
      descripcion: "",
    });
  };

  const removeCriterion = async (criterionId: string) => {
    if (!selectedExam) return;
    const criteria = selectedExam.criterios.filter(
      (item) => item.id !== criterionId,
    );
    const criteriaByGroup = Object.fromEntries(
      availableGroups.map((group) => [
        group,
        (selectedExam.criteriosPorGrupo[group] || []).filter(
          (id) => id !== criterionId,
        ),
      ]),
    );
    await updateSelectedExam({
      criterios: criteria,
      criteriosPorGrupo: criteriaByGroup,
    });
  };

  const filteredRequests = useMemo(() => {
    const filtered = requests.filter(
      (request) => groupFilter === "todos" || request.grupo === groupFilter,
    );
    return [...filtered].sort((a, b) =>
      sortMode === "id"
        ? a.idExamen.localeCompare(b.idExamen, "es", { numeric: true })
        : Number(a.creadoEn?.seconds || 0) - Number(b.creadoEn?.seconds || 0),
    );
  }, [groupFilter, requests, sortMode]);
  const detectedGroups = useMemo(
    () => Array.from(new Set(requests.map((request) => request.grupo))).sort(),
    [requests],
  );
  const availableGroups = useMemo(
    () =>
      Array.from(
        new Set([...(selectedExam?.grupos || []), ...detectedGroups]),
      ).sort(),
    [detectedGroups, selectedExam?.grupos],
  );

  if (!unlocked) return <TeacherGate onUnlock={() => setUnlocked(true)} />;

  const registrationUrl =
    selectedExam && typeof window !== "undefined"
      ? `${window.location.origin}/taekwondo/examen/inscribirse?token=${selectedExam.registroToken}`
      : "";
  const evaluationUrl =
    selectedExam && typeof window !== "undefined"
      ? `${window.location.origin}/taekwondo/examen/evaluacion?token=${selectedExam.evaluacionToken}`
      : "";

  return (
    <main className="min-h-screen bg-[#07080b] px-4 py-5 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1720px] space-y-6">
        <header className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,.2),transparent_34%),linear-gradient(135deg,rgba(27,27,31,.98),rgba(8,9,12,.98))] p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.18em] text-red-300">
                <Award className="h-4 w-4" /> Taekwondo · Examen
              </span>
              <h1 className="mt-4 text-3xl font-black text-white sm:text-5xl">
                Centro de exámenes
              </h1>
              <p className="mt-3 max-w-3xl text-zinc-300">
                Inscripciones, organización, criterios, evaluación
                multidispositivo e historial.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() =>
                  void Promise.all([loadExams(), loadExamDetails()])
                }
                disabled={loading}
                className="rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              >
                <RefreshCw className={loading ? "animate-spin" : ""} />{" "}
                Actualizar
              </Button>
              <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-black text-white">
                Sede {sede}
              </span>
            </div>
          </div>
          <div className="mt-7 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-red-500/40 bg-red-500/15 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-red-300">
                Profesor
              </p>
              <p className="mt-1 font-black text-white">
                Administración activa
              </p>
            </div>
            {evaluationUrl ? (
              <Link
                href={evaluationUrl}
                target="_blank"
                className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:bg-white/[.06]"
              >
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                  Evaluación
                </p>
                <p className="mt-1 font-black text-white">Abrir modo sinodal</p>
              </Link>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-zinc-600">
                Evaluación
              </div>
            )}
            {registrationUrl ? (
              <Link
                href={registrationUrl}
                target="_blank"
                className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:bg-white/[.06]"
              >
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                  Inscribirse
                </p>
                <p className="mt-1 font-black text-white">
                  Abrir formulario público
                </p>
              </Link>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-zinc-600">
                Inscribirse
              </div>
            )}
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="h-fit overflow-hidden rounded-[26px] border border-white/10 bg-white/[.045] shadow-xl xl:sticky xl:top-4">
            <div className="border-b border-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                Sesión seleccionada
              </p>
              <select
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#0b0c10] px-3 font-bold text-white outline-none"
              >
                <option value="">Selecciona un examen</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.nombre} · {exam.fecha}
                  </option>
                ))}
              </select>
              {selectedExam && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="font-black text-white">
                    {stateLabel(selectedExam.estado)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {money(selectedExam.precio)} · {requests.length} inscritos ·{" "}
                    {judges.length} sinodales
                  </p>
                </div>
              )}
            </div>
            <nav className="space-y-1 p-2">
              {[
                ["sesiones", "Sesión y precio", Settings2],
                ["solicitudes", "Solicitudes", FileClock],
                ["organizar", "Organizar", Grip],
                ["criterios", "Criterios", ClipboardCheck],
                ["historial", "Historial", History],
              ].map(([id, label, Icon]) => {
                const NavIcon = Icon as typeof Settings2;
                return (
                  <button
                    key={String(id)}
                    type="button"
                    onClick={() => setTab(id as Tab)}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-black transition ${tab === id ? "bg-red-600 text-white" : "text-zinc-400 hover:bg-white/[.06] hover:text-white"}`}
                  >
                    <NavIcon className="h-5 w-5" />
                    {String(label)}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0">
            {tab === "sesiones" && (
              <div className="grid gap-6 2xl:grid-cols-2">
                <article className="rounded-[28px] border border-white/10 bg-white/[.045] p-6 shadow-xl">
                  <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
                    Nueva sesión
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-white">
                    Crear examen
                  </h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="sm:col-span-2">
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                        Nombre
                      </span>
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-red-500/60"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                        Fecha
                      </span>
                      <input
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white [color-scheme:dark] outline-none"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                        Precio
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        placeholder="0"
                        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
                      />
                    </label>
                    <label className="sm:col-span-2">
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                        Grupos separados por coma
                      </span>
                      <input
                        value={groupsText}
                        onChange={(event) => setGroupsText(event.target.value)}
                        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
                      />
                    </label>
                  </div>
                  <Button
                    type="button"
                    onClick={() => void createExam()}
                    disabled={saving}
                    className="mt-5 h-14 w-full rounded-2xl bg-red-600 font-black text-white hover:bg-red-500 hover:text-white"
                  >
                    {saving ? <Loader2 className="animate-spin" /> : <Plus />}{" "}
                    Crear y abrir inscripciones
                  </Button>
                </article>
                <article className="rounded-[28px] border border-white/10 bg-white/[.045] p-6 shadow-xl">
                  <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
                    Configuración
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-white">
                    Precio y acceso
                  </h2>
                  {selectedExam ? (
                    <>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <label>
                          <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                            Precio del examen
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={configPrice}
                            onChange={(event) =>
                              setConfigPrice(event.target.value)
                            }
                            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
                          />
                        </label>
                        <label>
                          <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                            Grupos
                          </span>
                          <input
                            value={configGroupsText}
                            onChange={(event) =>
                              setConfigGroupsText(event.target.value)
                            }
                            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none"
                          />
                        </label>
                      </div>
                      <Button
                        type="button"
                        onClick={() => void saveConfiguration()}
                        className="mt-4 rounded-xl border border-white/10 bg-white/[.08] text-white hover:bg-white/15 hover:text-white"
                      >
                        <Save /> Guardar precio y grupos
                      </Button>
                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center">
                          {registrationQr && (
                            <Image
                              src={registrationQr}
                              alt="QR de inscripción"
                              width={176}
                              height={176}
                              unoptimized
                              className="mx-auto h-44 w-44 rounded-xl bg-white p-2"
                            />
                          )}
                          <p className="mt-3 font-black text-white">
                            Inscripción
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              navigator.clipboard.writeText(registrationUrl)
                            }
                            className="mt-2 text-xs font-bold text-red-300"
                          >
                            Copiar enlace
                          </button>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center">
                          {evaluationQr && (
                            <Image
                              src={evaluationQr}
                              alt="QR de evaluación"
                              width={176}
                              height={176}
                              unoptimized
                              className="mx-auto h-44 w-44 rounded-xl bg-white p-2"
                            />
                          )}
                          <p className="mt-3 font-black text-white">
                            Sinodales
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              navigator.clipboard.writeText(evaluationUrl)
                            }
                            className="mt-2 text-xs font-bold text-red-300"
                          >
                            Copiar enlace
                          </button>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-2 sm:grid-cols-2">
                        {selectedExam.estado === "inscripciones" && (
                          <Button
                            type="button"
                            onClick={() => void publishJudgeRegistration()}
                            disabled={saving || !requests.length}
                            className="h-12 rounded-xl bg-blue-600 font-black text-white hover:bg-blue-500 hover:text-white"
                          >
                            <QrCode /> Cerrar inscripción y registrar sinodales
                          </Button>
                        )}
                        {selectedExam.estado === "registro_sinodales" && (
                          <Button
                            type="button"
                            onClick={() => void startEvaluation()}
                            disabled={saving}
                            className="h-12 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-500 hover:text-white"
                          >
                            <UserCheck /> Iniciar evaluación
                          </Button>
                        )}
                      </div>
                      {selectedExam.estado === "registro_sinodales" && (
                        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="flex items-center justify-between">
                            <p className="font-black text-white">
                              Sinodales registrados
                            </p>
                            <button
                              type="button"
                              onClick={() => void loadExamDetails()}
                              className="text-xs font-black uppercase tracking-wider text-red-300"
                            >
                              Actualizar
                            </button>
                          </div>
                          <div className="mt-3 space-y-2">
                            {judges.map((judge) => (
                              <div
                                key={judge.id}
                                className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3"
                              >
                                <Avatar className="h-10 w-10 border border-white/10 bg-zinc-900">
                                  <AvatarImage
                                    src={judge.foto}
                                    alt={judge.nombre}
                                  />
                                  <AvatarFallback className="bg-zinc-800 text-xs font-black text-white">
                                    {initials(judge.nombre)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-black text-white">
                                    {judge.nombre}
                                  </p>
                                  <p className="text-xs text-zinc-500">
                                    {judge.grado}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void removeJudge(judge)}
                                  className="rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-300"
                                  aria-label={`Retirar a ${judge.nombre}`}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            {!judges.length && (
                              <p className="py-3 text-center text-sm text-zinc-500">
                                Esperando que escaneen el QR.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="mt-6 text-zinc-500">
                      Selecciona o crea un examen.
                    </p>
                  )}
                </article>
              </div>
            )}

            {tab === "solicitudes" && (
              <article className="rounded-[28px] border border-white/10 bg-white/[.045] p-5 shadow-xl sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
                      Inscripciones
                    </p>
                    <h2 className="mt-1 text-2xl font-black text-white">
                      Solicitudes de examen
                    </h2>
                  </div>
                  <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white">
                    {requests.length}
                  </span>
                </div>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left">
                    <thead>
                      <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
                        {[
                          "Alumno",
                          "ID",
                          "Grupo",
                          "Grado actual",
                          "Ascenso",
                          "Pago",
                          "Estado",
                        ].map((item) => (
                          <th key={item} className="px-3 py-3">
                            {item}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((request) => (
                        <tr
                          key={request.id}
                          className="border-b border-white/[.06]"
                        >
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-11 w-11 border border-white/10 bg-zinc-900">
                                <AvatarImage
                                  src={request.fotoUrl}
                                  alt={request.alumnoNombre}
                                />
                                <AvatarFallback className="bg-zinc-800 font-black text-white">
                                  {initials(request.alumnoNombre)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-black text-white">
                                {request.alumnoNombre}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-mono font-bold text-white">
                            {request.idExamen}
                          </td>
                          <td className="px-3 py-3 text-zinc-300">
                            {request.grupo}
                          </td>
                          <td className="px-3 py-3 text-zinc-300">
                            {request.gradoActual}
                          </td>
                          <td className="px-3 py-3 font-bold text-red-300">
                            {request.gradoAscenso}
                          </td>
                          <td className="px-3 py-3 font-bold text-emerald-300">
                            {money(request.precio)}
                          </td>
                          <td className="px-3 py-3">
                            <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-300">
                              Pago solicitado
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!requests.length && (
                    <p className="py-16 text-center text-zinc-500">
                      Todavía no hay solicitudes.
                    </p>
                  )}
                </div>
              </article>
            )}

            {tab === "organizar" && (
              <article className="rounded-[28px] border border-white/10 bg-white/[.045] p-4 shadow-xl sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
                      Organización oficial
                    </p>
                    <h2 className="mt-1 text-2xl font-black text-white">
                      Grupos y pizarrón
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex rounded-xl border border-white/10 bg-black/25 p-1">
                      <button
                        type="button"
                        onClick={() => setOrganizationView("lista")}
                        className={`rounded-lg p-2 ${organizationView === "lista" ? "bg-white text-zinc-950" : "text-zinc-400"}`}
                      >
                        <LayoutList />
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrganizationView("libre")}
                        className={`rounded-lg p-2 ${organizationView === "libre" ? "bg-white text-zinc-950" : "text-zinc-400"}`}
                      >
                        <Grip />
                      </button>
                    </div>
                    {organizationView === "libre" && (
                      <button
                        type="button"
                        onClick={() => setEditingBoard((value) => !value)}
                        className={`flex items-center gap-2 rounded-xl border px-4 text-sm font-black ${editingBoard ? "border-red-500/40 bg-red-500/15 text-white" : "border-white/10 bg-black/25 text-zinc-300"}`}
                      >
                        {editingBoard ? <PenLine /> : <Eye />}{" "}
                        {editingBoard ? "Editando" : "Solo vista"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupFilter("todos")}
                    className={`rounded-full border px-4 py-2 text-xs font-black ${groupFilter === "todos" ? "border-red-500/50 bg-red-500/15 text-white" : "border-white/10 text-zinc-400"}`}
                  >
                    Todos
                  </button>
                  {detectedGroups.map((group) => (
                    <button
                      key={group}
                      type="button"
                      onClick={() => setGroupFilter(group)}
                      className={`rounded-full border px-4 py-2 text-xs font-black ${groupFilter === group ? "border-red-500/50 bg-red-500/15 text-white" : "border-white/10 text-zinc-400"}`}
                    >
                      {group}
                    </button>
                  ))}
                </div>
                {organizationView === "lista" ? (
                  <>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSortMode("registro")}
                        className={`rounded-xl px-4 py-2 text-xs font-black ${sortMode === "registro" ? "bg-white text-zinc-950" : "bg-black/25 text-zinc-400"}`}
                      >
                        Orden de inscripción
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortMode("id")}
                        className={`rounded-xl px-4 py-2 text-xs font-black ${sortMode === "id" ? "bg-white text-zinc-950" : "bg-black/25 text-zinc-400"}`}
                      >
                        Orden por ID
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredRequests.map((request, index) => (
                        <div
                          key={request.id}
                          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[.07] font-black text-white">
                            {index + 1}
                          </span>
                          <Avatar className="h-14 w-14 border border-white/15 bg-zinc-900">
                            <AvatarImage
                              src={request.fotoUrl}
                              alt={request.alumnoNombre}
                            />
                            <AvatarFallback className="bg-zinc-800 font-black text-white">
                              {initials(request.alumnoNombre)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-black text-white">
                              {request.alumnoNombre}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {request.grupo} · ID {request.idExamen}
                            </p>
                            <span
                              className="mt-1 block h-2 w-20 rounded-full border border-white/15"
                              style={{
                                background: beltBackground(
                                  request.cintaColor,
                                  request.cintaColorSecundario,
                                ),
                              }}
                              title={request.cintaNombre || "Cinta actual"}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-4 flex items-center gap-3">
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
                        Zoom
                      </span>
                      <input
                        type="range"
                        min="0.6"
                        max="1.5"
                        step="0.1"
                        value={zoom}
                        onChange={(event) =>
                          setZoom(Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="mt-3 overflow-auto rounded-[24px] border border-white/10 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px),#0b0c11] bg-[size:42px_42px]">
                      <div
                        className="relative h-[720px] min-w-[1100px] origin-top-left"
                        style={{
                          transform: `scale(${zoom})`,
                          width: `${100 / zoom}%`,
                        }}
                      >
                        {filteredRequests.map((request, index) => {
                          const position = request.posicion || {
                            x: 80 + (index % 6) * 165,
                            y: 70 + Math.floor(index / 6) * 180,
                          };
                          return (
                            <button
                              key={request.id}
                              type="button"
                              draggable={editingBoard}
                              onDragEnd={(event) => {
                                const board =
                                  event.currentTarget.parentElement?.getBoundingClientRect();
                                if (!board) return;
                                void savePosition(request, {
                                  x: Math.max(
                                    0,
                                    (event.clientX - board.left) / zoom - 65,
                                  ),
                                  y: Math.max(
                                    0,
                                    (event.clientY - board.top) / zoom - 65,
                                  ),
                                });
                              }}
                              className={`absolute w-32 text-center ${editingBoard ? "cursor-grab" : "cursor-default"}`}
                              style={{ left: position.x, top: position.y }}
                            >
                              <Avatar className="mx-auto h-24 w-24 border-4 border-white/15 bg-zinc-900 shadow-xl">
                                <AvatarImage
                                  src={request.fotoUrl}
                                  alt={request.alumnoNombre}
                                  className="object-cover"
                                />
                                <AvatarFallback className="bg-zinc-800 text-xl font-black text-white">
                                  {initials(request.alumnoNombre)}
                                </AvatarFallback>
                              </Avatar>
                              <span
                                className="mx-auto mt-1 block h-2 w-20 rounded-full border border-white/15"
                                style={{
                                  background: beltBackground(
                                    request.cintaColor,
                                    request.cintaColorSecundario,
                                  ),
                                }}
                                title={request.cintaNombre || "Cinta actual"}
                              />
                              <span className="mt-2 block truncate text-sm font-black text-white">
                                {request.alumnoNombre}
                              </span>
                              <span className="text-xs text-zinc-400">
                                ID {request.idExamen}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </article>
            )}

            {tab === "criterios" && selectedExam && (
              <article className="rounded-[28px] border border-white/10 bg-white/[.045] p-5 shadow-xl sm:p-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
                    Rúbrica
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-white">
                    Criterios por grupo
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    Activa únicamente los criterios que verá cada grupo.
                  </p>
                </div>
                <div className="mt-5 space-y-5">
                  {availableGroups.map((group) => (
                    <section
                      key={group}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-black text-white">{group}</h3>
                        <span className="text-xs font-bold text-zinc-500">
                          {(selectedExam.criteriosPorGrupo[group] || []).length}{" "}
                          criterios
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {selectedExam.criterios.map((criterion) => {
                          const active = (
                            selectedExam.criteriosPorGrupo[group] || []
                          ).includes(criterion.id);
                          return (
                            <button
                              key={criterion.id}
                              type="button"
                              onClick={() =>
                                void toggleCriterion(group, criterion.id)
                              }
                              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${active ? "border-emerald-400/25 bg-emerald-400/[.08]" : "border-white/10 bg-black/20 opacity-55"}`}
                            >
                              <span
                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${active ? "bg-emerald-500 text-white" : "bg-white/10 text-zinc-600"}`}
                              >
                                {active && <Check className="h-3.5 w-3.5" />}
                              </span>
                              <span>
                                <span className="block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                                  {criterion.categoria}
                                </span>
                                <span className="mt-1 block text-sm font-black text-white">
                                  {criterion.nombre}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
                <section className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[.05] p-4">
                  <h3 className="font-black text-white">
                    Agregar criterio manual
                  </h3>
                  <div className="mt-3 grid gap-3 lg:grid-cols-[.7fr_1fr_1.4fr_auto]">
                    <input
                      value={newCriterion.categoria}
                      onChange={(event) =>
                        setNewCriterion((current) => ({
                          ...current,
                          categoria: event.target.value,
                        }))
                      }
                      placeholder="Categoría"
                      className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none"
                    />
                    <input
                      value={newCriterion.nombre}
                      onChange={(event) =>
                        setNewCriterion((current) => ({
                          ...current,
                          nombre: event.target.value,
                        }))
                      }
                      placeholder="Criterio"
                      className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none"
                    />
                    <input
                      value={newCriterion.descripcion}
                      onChange={(event) =>
                        setNewCriterion((current) => ({
                          ...current,
                          descripcion: event.target.value,
                        }))
                      }
                      placeholder="Descripción"
                      className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none"
                    />
                    <Button
                      type="button"
                      onClick={() => void addCriterion()}
                      className="rounded-xl bg-red-600 text-white hover:bg-red-500 hover:text-white"
                    >
                      <Plus /> Agregar
                    </Button>
                  </div>
                </section>
                <div className="mt-6">
                  <h3 className="font-black text-white">Catálogo completo</h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {selectedExam.criterios.map((criterion) => (
                      <div
                        key={criterion.id}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black uppercase tracking-wider text-zinc-500">
                            {criterion.categoria}
                          </p>
                          <p className="truncate font-bold text-white">
                            {criterion.nombre}
                          </p>
                        </div>
                        {criterion.id.startsWith("custom-") && (
                          <button
                            type="button"
                            onClick={() => void removeCriterion(criterion.id)}
                            className="rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            )}

            {tab === "historial" && (
              <div className="space-y-6">
                <article className="rounded-[28px] border border-white/10 bg-white/[.045] p-5 shadow-xl sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
                        Alumnos
                      </p>
                      <h2 className="mt-1 text-2xl font-black text-white">
                        Resultados y notas
                      </h2>
                    </div>
                    {selectedExam?.estado === "finalizado" && (
                      <span className="rounded-full bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-300">
                        Archivado
                      </span>
                    )}
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {evaluations.map((evaluation) => (
                      <div
                        key={evaluation.id}
                        className={`relative rounded-2xl border p-4 ${evaluation.mejorExamen ? "border-amber-400/30 bg-amber-400/[.07]" : "border-white/10 bg-black/20"}`}
                      >
                        {evaluation.mejorExamen && (
                          <Crown className="absolute right-4 top-4 h-5 w-5 fill-amber-400 text-amber-400" />
                        )}
                        <p className="font-black text-white">
                          {evaluation.alumnoNombre}
                        </p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {evaluation.grupo} · ID {evaluation.idExamen} ·{" "}
                          {evaluation.sinodalNombre}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <strong className="text-xl text-white">
                            {evaluation.promedio || 0}/5
                          </strong>
                        </div>
                        {evaluation.observaciones && (
                          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                            {evaluation.observaciones}
                          </p>
                        )}
                      </div>
                    ))}
                    {!evaluations.length && (
                      <p className="text-zinc-500">
                        Todavía no hay evaluaciones guardadas.
                      </p>
                    )}
                  </div>
                </article>
                <article className="rounded-[28px] border border-white/10 bg-white/[.045] p-5 shadow-xl sm:p-6">
                  <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
                    Sinodales
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-white">
                    Quién calificó y cuándo
                  </h2>
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {judges.map((judge) => (
                      <div
                        key={judge.id}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"
                      >
                        <Avatar className="h-14 w-14 border border-white/10 bg-zinc-900">
                          <AvatarImage src={judge.foto} alt={judge.nombre} />
                          <AvatarFallback className="bg-zinc-800 font-black text-white">
                            {initials(judge.nombre)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-black text-white">
                            {judge.nombre}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {judge.grado} ·{" "}
                            {judge.finalizado ? "Finalizado" : "En progreso"}
                          </p>
                          <p className="mt-1 text-xs font-bold text-zinc-300">
                            Examen {judge.calificacionGeneral ?? "—"}/5 ·
                            Academia {judge.calificacionAcademia ?? "—"}/5
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
