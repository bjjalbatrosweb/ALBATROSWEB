"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  CalendarDays,
  Check,
  ChevronRight,
  Dumbbell,
  Gauge,
  History,
  ListChecks,
  Loader2,
  Medal,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useFirestore, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  DISCIPLINE_CONFIGS,
  findRankVisual,
  getDisciplineConfig,
  rankBackground,
  resolveDisciplineId,
  type DisciplineId,
  type RankVisual,
} from "@/lib/taekwondo-grades";

type View = "actuales" | "asignar";
type Filter = "todos" | "asignados" | "sin-grado";
type DisciplineFilter = "todas" | DisciplineId;

type DisciplineProgress = {
  disciplina: DisciplineId;
  disciplinaNombre: string;
  grado: string;
  detalle?: string;
  rangoId: string;
  rangoNombre: string;
  color: string;
  colorSecundario?: string;
  fechaAscenso: string;
};

type Promotion = {
  fecha: string;
  grado: string;
  disciplina?: DisciplineId | string;
  disciplinaNombre?: string;
  detalle?: string;
  cinta?: string;
  rango?: string;
  color?: string;
  colorSecundario?: string;
};

type Student = {
  id: string;
  nombre: string;
  sede?: string;
  disciplina?: string;
  grado?: string;
  fechaPromocion?: string;
  fotoUrl?: string;
  imagenUrl?: string;
  cintaTaekwondo?: {
    id?: string;
    nombre?: string;
    color?: string;
    colorSecundario?: string;
  };
  cintaJiujitsu?: {
    id?: string;
    nombre?: string;
    color?: string;
    colorSecundario?: string;
  };
  nivelKickMma?: {
    id?: string;
    nombre?: string;
    color?: string;
    colorSecundario?: string;
  };
  gradosPorDisciplina?: Partial<Record<DisciplineId, DisciplineProgress>>;
  historialPromociones?: Promotion[];
};

const DISCIPLINE_ICONS = {
  taekwondo: Award,
  jiujitsu: Swords,
  "kick-mma": Dumbbell,
} satisfies Record<DisciplineId, typeof Award>;

function localDateInput(date = new Date()) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(value?: string) {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function legacyRankValue(student: Student, discipline: DisciplineId) {
  if (discipline === "taekwondo") {
    return (
      student.cintaTaekwondo?.id ||
      student.cintaTaekwondo?.nombre ||
      student.grado
    );
  }
  if (discipline === "jiujitsu") {
    return (
      student.cintaJiujitsu?.id ||
      student.cintaJiujitsu?.nombre ||
      student.grado
    );
  }
  return (
    student.nivelKickMma?.id || student.nivelKickMma?.nombre || student.grado
  );
}

function getStudentProgress(
  student: Student,
  discipline: DisciplineId,
): DisciplineProgress | null {
  const stored = student.gradosPorDisciplina?.[discipline];
  if (stored?.grado || stored?.rangoNombre) return stored;

  const primaryDiscipline =
    resolveDisciplineId(student.disciplina) ||
    (student.cintaJiujitsu
      ? "jiujitsu"
      : student.nivelKickMma
        ? "kick-mma"
        : "taekwondo");
  if (primaryDiscipline !== discipline) return null;

  const rank = findRankVisual(
    discipline,
    legacyRankValue(student, discipline),
    student.grado,
  );
  if (!student.grado && !rank) return null;
  const config = getDisciplineConfig(discipline);
  return {
    disciplina: discipline,
    disciplinaNombre: config.nombre,
    grado: student.grado || rank?.nombre || "Sin grado",
    rangoId: rank?.id || "sin-rango",
    rangoNombre: rank?.nombre || config.selector + " sin registrar",
    color: rank?.color || "#52525B",
    colorSecundario: rank?.colorSecundario,
    fechaAscenso: student.fechaPromocion || "",
  };
}

function allStudentProgress(student: Student) {
  return DISCIPLINE_CONFIGS.map((discipline) =>
    getStudentProgress(student, discipline.id),
  ).filter((progress): progress is DisciplineProgress => Boolean(progress));
}

function RankMark({
  rank,
  compact = false,
}: {
  rank: RankVisual;
  compact?: boolean;
}) {
  return (
    <span
      className={`block shrink-0 border border-white/20 shadow-[0_8px_22px_rgba(0,0,0,.35)] ${
        compact ? "h-4 w-14 rounded-md" : "h-12 w-full rounded-xl"
      }`}
      style={{ background: rankBackground(rank) }}
    />
  );
}

function ProgressMark({ progress }: { progress: DisciplineProgress }) {
  const rank: RankVisual = {
    id: progress.rangoId,
    nombre: progress.rangoNombre,
    color: progress.color,
    colorSecundario: progress.colorSecundario,
  };
  return <RankMark rank={rank} compact />;
}

export default function GradosPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [sede, setSede] = useState("MMA");
  const [students, setStudents] = useState<Student[]>([]);
  const [view, setView] = useState<View>("actuales");
  const [currentSearch, setCurrentSearch] = useState("");
  const [assignSearch, setAssignSearch] = useState("");
  const [currentFilter, setCurrentFilter] = useState<Filter>("todos");
  const [disciplineFilter, setDisciplineFilter] =
    useState<DisciplineFilter>("todas");
  const [selectedId, setSelectedId] = useState("");
  const [discipline, setDiscipline] = useState<DisciplineId>("taekwondo");
  const [rankId, setRankId] = useState("");
  const [gradeDetail, setGradeDetail] = useState("");
  const [promotionDate, setPromotionDate] = useState(localDateInput());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSede(localStorage.getItem("userSede") || "MMA");
  }, []);

  const loadStudents = useCallback(async () => {
    if (!firestore || !sede) return;
    setLoading(true);
    try {
      const snapshot = await getDocs(
        query(collection(firestore, "Alumnos"), where("sede", "==", sede)),
      );
      const loaded = (
        snapshot.docs.map((student) => ({
          id: student.id,
          ...student.data(),
        })) as Student[]
      )
        .filter((student) => Boolean(student.nombre))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      setStudents(loaded);
      setSelectedId((current) =>
        loaded.some((student) => student.id === current)
          ? current
          : (loaded[0]?.id ?? ""),
      );
    } catch (error) {
      console.error("No fue posible cargar los grados:", error);
      toast({
        variant: "destructive",
        title: "No se pudieron cargar los alumnos",
        description: "Revisa tu conexión e inténtalo de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  }, [firestore, sede, toast]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedId) ?? null,
    [selectedId, students],
  );
  const disciplineConfig = getDisciplineConfig(discipline);

  useEffect(() => {
    if (!selectedStudent) {
      setRankId("");
      setGradeDetail("");
      return;
    }
    const progress = getStudentProgress(selectedStudent, discipline);
    const currentRank =
      disciplineConfig.rangos.find((rank) => rank.id === progress?.rangoId) ||
      findRankVisual(
        discipline,
        progress?.rangoNombre,
        legacyRankValue(selectedStudent, discipline),
      );
    setRankId(currentRank?.id || "");
    setGradeDetail(
      progress?.detalle ||
        disciplineConfig.grados.find((item) => item === progress?.grado) ||
        "",
    );
    setPromotionDate(progress?.fechaAscenso || localDateInput());
  }, [discipline, disciplineConfig, selectedStudent]);

  const selectedRank = useMemo(
    () => disciplineConfig.rangos.find((rank) => rank.id === rankId) ?? null,
    [disciplineConfig.rangos, rankId],
  );

  const currentMonth = localDateInput().slice(0, 7);
  const metrics = useMemo(() => {
    const progress = students.flatMap(allStudentProgress);
    const assignedStudents = students.filter(
      (student) => allStudentProgress(student).length > 0,
    ).length;
    return {
      total: students.length,
      assigned: assignedStudents,
      withoutGrade: students.length - assignedStudents,
      promoted: progress.filter((item) =>
        item.fechaAscenso?.startsWith(currentMonth),
      ).length,
    };
  }, [currentMonth, students]);

  const visibleCurrentStudents = useMemo(() => {
    const term = currentSearch.trim().toLocaleLowerCase("es");
    return students.filter((student) => {
      const progress =
        disciplineFilter === "todas"
          ? allStudentProgress(student)
          : [getStudentProgress(student, disciplineFilter)].filter(Boolean);
      const hasGrade = progress.length > 0;
      const matchesFilter =
        currentFilter === "todos" ||
        (currentFilter === "asignados" && hasGrade) ||
        (currentFilter === "sin-grado" && !hasGrade);
      const searchText = [
        student.nombre,
        student.disciplina,
        ...allStudentProgress(student).flatMap((item) => [
          item.disciplinaNombre,
          item.grado,
          item.rangoNombre,
        ]),
      ]
        .join(" ")
        .toLocaleLowerCase("es");
      return matchesFilter && (!term || searchText.includes(term));
    });
  }, [currentFilter, currentSearch, disciplineFilter, students]);

  const assignmentStudents = useMemo(() => {
    const term = assignSearch.trim().toLocaleLowerCase("es");
    return students.filter(
      (student) =>
        !term ||
        [student.nombre, student.disciplina, student.grado]
          .join(" ")
          .toLocaleLowerCase("es")
          .includes(term),
    );
  }, [assignSearch, students]);

  const openAssignment = (student: Student, selected?: DisciplineId) => {
    setSelectedId(student.id);
    setDiscipline(
      selected || resolveDisciplineId(student.disciplina) || "taekwondo",
    );
    setView("asignar");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const savePromotion = async () => {
    const requiresDetail = disciplineConfig.grados.length > 0;
    if (!firestore || !user || !selectedStudent || !selectedRank) {
      toast({
        variant: "destructive",
        title: "Faltan datos",
        description: `Selecciona alumno, disciplina y ${disciplineConfig.selector.toLocaleLowerCase("es")}.`,
      });
      return;
    }
    if ((requiresDetail && !gradeDetail) || !promotionDate) {
      toast({
        variant: "destructive",
        title: "Faltan datos",
        description: `Selecciona ${disciplineConfig.detalle.toLocaleLowerCase("es")} y fecha de ascenso.`,
      });
      return;
    }
    if (promotionDate > localDateInput()) {
      toast({
        variant: "destructive",
        title: "Fecha no válida",
        description: "La fecha de ascenso no puede estar en el futuro.",
      });
      return;
    }

    const displayGrade =
      discipline === "taekwondo"
        ? gradeDetail
        : discipline === "jiujitsu"
          ? gradeDetail && gradeDetail !== "Sin franjas"
            ? `${selectedRank.nombre} · ${gradeDetail}`
            : selectedRank.nombre
          : selectedRank.nombre;
    const progress: DisciplineProgress = {
      disciplina: discipline,
      disciplinaNombre: disciplineConfig.nombre,
      grado: displayGrade,
      ...(gradeDetail ? { detalle: gradeDetail } : {}),
      rangoId: selectedRank.id,
      rangoNombre: selectedRank.nombre,
      color: selectedRank.color,
      ...(selectedRank.colorSecundario
        ? { colorSecundario: selectedRank.colorSecundario }
        : {}),
      fechaAscenso: promotionDate,
    };
    const promotion: Promotion = {
      fecha: promotionDate,
      grado: displayGrade,
      disciplina: discipline,
      disciplinaNombre: disciplineConfig.nombre,
      ...(gradeDetail ? { detalle: gradeDetail } : {}),
      ...(disciplineConfig.selector === "Cinta"
        ? { cinta: selectedRank.nombre }
        : {}),
      rango: selectedRank.nombre,
      color: selectedRank.color,
      ...(selectedRank.colorSecundario
        ? { colorSecundario: selectedRank.colorSecundario }
        : {}),
    };
    const alreadyExists = (selectedStudent.historialPromociones || []).some(
      (entry) =>
        entry.fecha === promotion.fecha &&
        entry.grado === promotion.grado &&
        resolveDisciplineId(entry.disciplina) === discipline,
    );
    if (alreadyExists) {
      toast({
        title: "Registro ya existente",
        description: "Ese progreso y fecha ya aparecen en el historial.",
      });
      return;
    }

    setSaving(true);
    try {
      const batch = writeBatch(firestore);
      const studentRef = doc(firestore, "Alumnos", selectedStudent.id);
      const movementRef = doc(collection(firestore, "MovimientosAdmin"));
      const primaryDiscipline = resolveDisciplineId(selectedStudent.disciplina);
      const updateLegacy =
        !selectedStudent.disciplina || primaryDiscipline === discipline;
      const rankRecord = {
        id: selectedRank.id,
        nombre: selectedRank.nombre,
        color: selectedRank.color,
        ...(selectedRank.colorSecundario
          ? { colorSecundario: selectedRank.colorSecundario }
          : {}),
      };
      const updates = {
        [`gradosPorDisciplina.${discipline}`]: progress,
        historialPromociones: arrayUnion(promotion),
        actualizadoEn: serverTimestamp(),
        ...(updateLegacy
          ? {
              disciplina: disciplineConfig.nombre,
              grado: displayGrade,
              fechaPromocion: promotionDate,
            }
          : {}),
        ...(discipline === "taekwondo"
          ? { cintaTaekwondo: rankRecord }
          : discipline === "jiujitsu"
            ? { cintaJiujitsu: rankRecord }
            : { nivelKickMma: rankRecord }),
      };

      batch.update(studentRef, updates);
      batch.set(movementRef, {
        accion: "ascenso_grado",
        alumnoId: selectedStudent.id,
        alumnoNombre: selectedStudent.nombre,
        sede,
        detalle: `${disciplineConfig.nombre} · ${displayGrade} · ${promotionDate}`,
        actorUid: user.uid,
        actorEmail: user.email || "sin-correo",
        creadoEn: serverTimestamp(),
      });
      await batch.commit();

      setStudents((current) =>
        current.map((student) => {
          if (student.id !== selectedStudent.id) return student;
          const updateLegacy =
            !student.disciplina ||
            resolveDisciplineId(student.disciplina) === discipline;
          return {
            ...student,
            ...(updateLegacy
              ? {
                  disciplina: disciplineConfig.nombre,
                  grado: displayGrade,
                  fechaPromocion: promotionDate,
                }
              : {}),
            gradosPorDisciplina: {
              ...(student.gradosPorDisciplina || {}),
              [discipline]: progress,
            },
            ...(discipline === "taekwondo"
              ? { cintaTaekwondo: rankRecord }
              : discipline === "jiujitsu"
                ? { cintaJiujitsu: rankRecord }
                : { nivelKickMma: rankRecord }),
            historialPromociones: [
              ...(student.historialPromociones || []),
              promotion,
            ],
          };
        }),
      );
      toast({
        title: "Progreso actualizado",
        description: `${selectedStudent.nombre} · ${disciplineConfig.nombre} · ${displayGrade}.`,
      });
      setView("actuales");
      setDisciplineFilter(discipline);
    } catch (error) {
      console.error("No fue posible guardar el grado:", error);
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: "No se realizó ningún cambio. Inténtalo de nuevo.",
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedHistory = useMemo(() => {
    if (!selectedStudent) return [];
    const primary = resolveDisciplineId(selectedStudent.disciplina);
    return [...(selectedStudent.historialPromociones || [])]
      .filter((entry) => {
        const entryDiscipline = resolveDisciplineId(entry.disciplina);
        return (
          entryDiscipline === discipline ||
          (!entryDiscipline && primary === discipline)
        );
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [discipline, selectedStudent]);

  return (
    <main className="min-h-screen bg-[#07080b] px-4 py-5 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1720px] space-y-6">
        <header className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,.2),transparent_35%),linear-gradient(135deg,rgba(27,27,31,.98),rgba(8,9,12,.98))] p-6 shadow-2xl sm:p-8">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-red-600/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.18em] text-red-300">
                <Medal className="h-4 w-4" /> Desarrollo de atletas
              </span>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
                Grados y progresión
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-zinc-300 sm:text-base">
                Cintas de Taekwondo y Jiu-Jitsu, niveles de Kick/MMA e historial
                de ascensos en un solo lugar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-zinc-200">
                Sede: <span className="text-white">{sede}</span>
              </span>
              <Button
                type="button"
                onClick={() => void loadStudents()}
                disabled={loading}
                className="rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              >
                <RefreshCw className={loading ? "animate-spin" : ""} />
                Actualizar
              </Button>
            </div>
          </div>

          <div className="relative mt-7 grid gap-2 rounded-2xl border border-white/10 bg-black/35 p-1.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setView("actuales")}
              className={`flex min-h-14 items-center justify-center gap-3 rounded-xl px-5 text-sm font-black transition ${
                view === "actuales"
                  ? "bg-white text-zinc-950 shadow-xl"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <ListChecks className="h-5 w-5" /> Grados actuales
              <span
                className={`rounded-full px-2.5 py-1 text-xs ${
                  view === "actuales"
                    ? "bg-zinc-950 text-white"
                    : "bg-white/10 text-zinc-300"
                }`}
              >
                {metrics.assigned}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setView("asignar")}
              className={`flex min-h-14 items-center justify-center gap-3 rounded-xl px-5 text-sm font-black transition ${
                view === "asignar"
                  ? "bg-red-600 text-white shadow-xl shadow-red-950/40"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <PlusCircle className="h-5 w-5" /> Asignar o actualizar grado
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Alumnos", metrics.total, UsersRound, "text-white"],
            ["Con progreso", metrics.assigned, ShieldCheck, "text-emerald-300"],
            ["Sin registro", metrics.withoutGrade, UserRound, "text-amber-300"],
            ["Ascensos del mes", metrics.promoted, Sparkles, "text-red-300"],
          ].map(([label, value, Icon, color]) => {
            const MetricIcon = Icon as typeof UserRound;
            return (
              <article
                key={String(label)}
                className="rounded-3xl border border-white/10 bg-white/[.045] p-5 shadow-xl backdrop-blur-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-[.14em] text-zinc-400">
                    {String(label)}
                  </span>
                  <MetricIcon className={`h-5 w-5 ${String(color)}`} />
                </div>
                <p className={`mt-4 text-4xl font-black ${String(color)}`}>
                  {String(value)}
                </p>
              </article>
            );
          })}
        </section>

        {view === "actuales" ? (
          <section className="space-y-5">
            <div className="rounded-[28px] border border-white/10 bg-white/[.045] p-4 shadow-xl backdrop-blur-xl sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
                    Consulta rápida
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-white">
                    Grados actuales de los alumnos
                  </h2>
                </div>
                <Button
                  type="button"
                  onClick={() => setView("asignar")}
                  className="h-11 rounded-2xl bg-red-600 px-5 font-black text-white hover:bg-red-500 hover:text-white"
                >
                  <PlusCircle /> Registrar un grado
                </Button>
              </div>
              <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(280px,1fr)_auto]">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={currentSearch}
                    onChange={(event) => setCurrentSearch(event.target.value)}
                    placeholder="Buscar alumno, cinta, grado o disciplina"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 pl-12 pr-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-red-500/60"
                  />
                </div>
                <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-black/30 p-1.5">
                  {(
                    [
                      ["todos", "Todos"],
                      ["asignados", "Con grado"],
                      ["sin-grado", "Sin grado"],
                    ] as Array<[Filter, string]>
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCurrentFilter(value)}
                      className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${
                        currentFilter === value
                          ? "bg-white text-zinc-950"
                          : "text-zinc-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["todas", "Todas", Gauge],
                  ...DISCIPLINE_CONFIGS.map((item) => [
                    item.id,
                    item.nombre,
                    DISCIPLINE_ICONS[item.id],
                  ]),
                ].map(([id, label, Icon]) => {
                  const DisciplineIcon = Icon as typeof Award;
                  return (
                    <button
                      key={String(id)}
                      type="button"
                      onClick={() =>
                        setDisciplineFilter(id as DisciplineFilter)
                      }
                      className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition ${
                        disciplineFilter === id
                          ? "border-red-500/50 bg-red-500/15 text-white"
                          : "border-white/10 bg-black/20 text-zinc-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <DisciplineIcon className="h-4 w-4" /> {String(label)}
                    </button>
                  );
                })}
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-80 items-center justify-center rounded-[28px] border border-white/10 bg-white/[.03] text-zinc-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando
                alumnos…
              </div>
            ) : visibleCurrentStudents.length === 0 ? (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-[28px] border border-dashed border-white/15 bg-white/[.03] px-6 text-center">
                <Award className="h-10 w-10 text-zinc-600" />
                <h3 className="mt-4 text-xl font-black text-white">
                  No hay resultados
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Cambia la disciplina, el filtro o el texto de búsqueda.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {visibleCurrentStudents.map((student) => {
                  const progresses =
                    disciplineFilter === "todas"
                      ? allStudentProgress(student)
                      : [getStudentProgress(student, disciplineFilter)].filter(
                          (item): item is DisciplineProgress => Boolean(item),
                        );
                  return (
                    <article
                      key={student.id}
                      className="group overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(145deg,rgba(28,28,32,.96),rgba(11,12,15,.98))] shadow-xl transition hover:-translate-y-0.5 hover:border-white/20"
                    >
                      <div className="flex items-center gap-4 border-b border-white/10 p-5">
                        <Avatar className="h-16 w-16 border border-white/15 bg-zinc-900">
                          <AvatarImage
                            src={student.fotoUrl || student.imagenUrl}
                            alt={student.nombre}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-zinc-800 font-black text-white">
                            {initials(student.nombre)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-xl font-black text-white">
                            {student.nombre}
                          </h3>
                          <p className="mt-1 text-sm text-zinc-400">
                            {progresses.length
                              ? `${progresses.length} disciplina${progresses.length === 1 ? "" : "s"} registrada${progresses.length === 1 ? "" : "s"}`
                              : "Sin grado registrado"}
                          </p>
                        </div>
                      </div>
                      <div className="min-h-40 space-y-2 p-4">
                        {progresses.length ? (
                          progresses.map((progress) => {
                            const Icon = DISCIPLINE_ICONS[progress.disciplina];
                            return (
                              <button
                                key={progress.disciplina}
                                type="button"
                                onClick={() =>
                                  openAssignment(student, progress.disciplina)
                                }
                                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-left transition hover:border-red-500/30 hover:bg-red-500/[.07]"
                              >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[.07] text-zinc-200">
                                  <Icon className="h-5 w-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.13em] text-zinc-500">
                                    {progress.disciplinaNombre}
                                    <ProgressMark progress={progress} />
                                  </span>
                                  <span className="mt-1 block truncate font-black text-white">
                                    {progress.grado}
                                  </span>
                                  <span className="text-xs text-zinc-400">
                                    {progress.rangoNombre} ·{" "}
                                    {formatDate(progress.fechaAscenso)}
                                  </span>
                                </span>
                                <ChevronRight className="h-5 w-5 text-zinc-600" />
                              </button>
                            );
                          })
                        ) : (
                          <div className="flex min-h-28 flex-col items-center justify-center text-center">
                            <Award className="h-7 w-7 text-zinc-600" />
                            <p className="mt-2 text-sm font-bold text-white">
                              Sin registro en esta disciplina
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="p-4 pt-0">
                        <button
                          type="button"
                          onClick={() =>
                            openAssignment(
                              student,
                              disciplineFilter === "todas"
                                ? undefined
                                : disciplineFilter,
                            )
                          }
                          className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white/[.07] text-sm font-black text-white transition hover:bg-red-600"
                        >
                          <PlusCircle className="h-4 w-4" />
                          {progresses.length
                            ? "Actualizar grado"
                            : "Asignar grado"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[minmax(330px,.72fr)_minmax(0,1.45fr)]">
            <aside className="h-fit overflow-hidden rounded-[28px] border border-white/10 bg-white/[.045] shadow-2xl backdrop-blur-xl xl:sticky xl:top-4">
              <div className="border-b border-white/10 p-5">
                <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
                  Paso 1
                </p>
                <h2 className="mt-1 text-xl font-black text-white">
                  Selecciona al alumno
                </h2>
                <div className="relative mt-4">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={assignSearch}
                    onChange={(event) => setAssignSearch(event.target.value)}
                    placeholder="Buscar alumno"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 pl-12 pr-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-red-500/60"
                  />
                </div>
              </div>
              <div className="max-h-[680px] space-y-2 overflow-y-auto p-3">
                {loading ? (
                  <div className="flex min-h-56 items-center justify-center text-zinc-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando…
                  </div>
                ) : (
                  assignmentStudents.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => setSelectedId(student.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        selectedId === student.id
                          ? "border-red-500/50 bg-red-500/10"
                          : "border-transparent bg-black/20 hover:border-white/10 hover:bg-white/[.06]"
                      }`}
                    >
                      <Avatar className="h-14 w-14 border border-white/15 bg-zinc-900">
                        <AvatarImage
                          src={student.fotoUrl || student.imagenUrl}
                          alt={student.nombre}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-zinc-800 font-black text-white">
                          {initials(student.nombre)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-black text-white">
                          {student.nombre}
                        </span>
                        <span className="mt-1 block text-xs text-zinc-400">
                          {allStudentProgress(student).length} registros
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 text-zinc-600" />
                    </button>
                  ))
                )}
              </div>
            </aside>

            {!selectedStudent ? (
              <div className="flex min-h-[560px] items-center justify-center rounded-[28px] border border-dashed border-white/15 bg-white/[.03] p-8 text-center">
                <div>
                  <UserRound className="mx-auto h-12 w-12 text-zinc-600" />
                  <h2 className="mt-4 text-2xl font-black text-white">
                    Selecciona un alumno
                  </h2>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(27,27,31,.96),rgba(10,11,14,.98))] p-5 shadow-2xl sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20 border-2 border-red-500/35 bg-zinc-900">
                        <AvatarImage
                          src={
                            selectedStudent.fotoUrl || selectedStudent.imagenUrl
                          }
                          alt={selectedStudent.nombre}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-zinc-800 text-xl font-black text-white">
                          {initials(selectedStudent.nombre)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
                          Asignar progreso
                        </p>
                        <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">
                          {selectedStudent.nombre}
                        </h2>
                        <p className="mt-1 text-sm text-zinc-400">
                          Puede conservar grados distintos en cada disciplina.
                        </p>
                      </div>
                    </div>
                    <span className="w-fit rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-300">
                      <ShieldCheck className="mr-2 inline h-4 w-4" /> Auditable
                    </span>
                  </div>
                </article>

                <article className="rounded-[28px] border border-white/10 bg-white/[.045] p-5 shadow-xl backdrop-blur-xl sm:p-6">
                  <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
                    Paso 2
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-white">
                    Elige la disciplina
                  </h3>
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {DISCIPLINE_CONFIGS.map((item) => {
                      const Icon = DISCIPLINE_ICONS[item.id];
                      const active = discipline === item.id;
                      const current = getStudentProgress(
                        selectedStudent,
                        item.id,
                      );
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDiscipline(item.id)}
                          className={`relative rounded-2xl border p-4 text-left transition ${
                            active
                              ? "border-red-500/50 bg-red-500/12 shadow-lg shadow-red-950/25"
                              : "border-white/10 bg-black/25 hover:border-white/25 hover:bg-white/[.05]"
                          }`}
                        >
                          <span
                            className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                              active
                                ? "bg-red-600 text-white"
                                : "bg-white/[.07] text-zinc-300"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="mt-4 block font-black text-white">
                            {item.nombre}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-zinc-400">
                            {current
                              ? `Actual: ${current.grado}`
                              : item.descripcion}
                          </span>
                          {active && (
                            <Check className="absolute right-4 top-4 h-5 w-5 text-red-300" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </article>

                <article className="rounded-[28px] border border-white/10 bg-white/[.045] p-5 shadow-xl backdrop-blur-xl sm:p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
                        Paso 3
                      </p>
                      <h3 className="mt-1 text-2xl font-black text-white">
                        {disciplineConfig.selector} y grado
                      </h3>
                    </div>
                    <span className="text-sm font-bold text-zinc-400">
                      {disciplineConfig.nombre} · {disciplineConfig.descripcion}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {disciplineConfig.rangos.map((rank) => {
                      const active = rank.id === rankId;
                      return (
                        <button
                          key={rank.id}
                          type="button"
                          onClick={() => setRankId(rank.id)}
                          className={`relative rounded-2xl border p-3 text-left transition ${
                            active
                              ? "border-red-400 bg-red-500/10 ring-2 ring-red-500/15"
                              : "border-white/10 bg-black/25 hover:border-white/25 hover:bg-white/[.05]"
                          }`}
                        >
                          <RankMark rank={rank} />
                          <span className="mt-3 flex items-center justify-between gap-2 text-sm font-black text-white">
                            {rank.nombre}
                            {active && (
                              <Check className="h-4 w-4 text-red-300" />
                            )}
                          </span>
                          {rank.avanzado && (
                            <span className="mt-1 block text-[10px] font-black uppercase tracking-wider text-amber-300">
                              Avanzada
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_1.1fr]">
                    {disciplineConfig.grados.length > 0 ? (
                      <label className="block">
                        <span className="text-xs font-black uppercase tracking-[.14em] text-zinc-400">
                          {disciplineConfig.detalle}
                        </span>
                        <select
                          value={gradeDetail}
                          onChange={(event) =>
                            setGradeDetail(event.target.value)
                          }
                          className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#0b0c10] px-4 text-sm font-bold text-white outline-none focus:border-red-500/60"
                        >
                          <option value="">Selecciona una opción</option>
                          {disciplineConfig.grados.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div>
                        <span className="text-xs font-black uppercase tracking-[.14em] text-zinc-400">
                          Nivel seleccionado
                        </span>
                        <div className="mt-2 flex h-12 items-center rounded-2xl border border-white/10 bg-black/25 px-4 text-sm font-black text-white">
                          {selectedRank?.nombre || "Selecciona un nivel"}
                        </div>
                      </div>
                    )}
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-[.14em] text-zinc-400">
                        Fecha de ascenso
                      </span>
                      <div className="relative mt-2">
                        <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="date"
                          value={promotionDate}
                          max={localDateInput()}
                          onChange={(event) =>
                            setPromotionDate(event.target.value)
                          }
                          className="h-12 w-full rounded-2xl border border-white/10 bg-[#0b0c10] pl-12 pr-4 text-sm font-bold text-white [color-scheme:dark] outline-none focus:border-red-500/60"
                        />
                      </div>
                    </label>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <span className="text-xs font-black uppercase tracking-[.14em] text-zinc-400">
                        Vista previa
                      </span>
                      <div className="mt-3 flex items-center gap-3">
                        {selectedRank ? (
                          <span className="w-24">
                            <RankMark rank={selectedRank} compact />
                          </span>
                        ) : (
                          <span className="h-4 w-24 rounded bg-zinc-800" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-black text-white">
                            {discipline === "taekwondo"
                              ? gradeDetail || "Grado pendiente"
                              : discipline === "jiujitsu"
                                ? selectedRank?.nombre || "Cinta pendiente"
                                : selectedRank?.nombre || "Nivel pendiente"}
                          </p>
                          <p className="truncate text-xs text-zinc-400">
                            {disciplineConfig.nombre}
                            {gradeDetail ? ` · ${gradeDetail}` : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => void savePromotion()}
                    disabled={
                      saving ||
                      !selectedRank ||
                      (disciplineConfig.grados.length > 0 && !gradeDetail)
                    }
                    className="mt-6 h-14 w-full rounded-2xl bg-red-600 text-base font-black text-white shadow-lg shadow-red-950/40 hover:bg-red-500 hover:text-white"
                  >
                    {saving ? <Loader2 className="animate-spin" /> : <Award />}
                    {saving ? "Guardando…" : "Guardar grado o nivel"}
                  </Button>
                </article>

                <article className="rounded-[28px] border border-white/10 bg-white/[.04] p-5 shadow-xl backdrop-blur-xl sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.14em] text-red-300">
                        {disciplineConfig.nombre}
                      </p>
                      <h3 className="mt-1 text-2xl font-black text-white">
                        Historial de esta disciplina
                      </h3>
                    </div>
                    <History className="h-6 w-6 text-zinc-500" />
                  </div>
                  {selectedHistory.length === 0 ? (
                    <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/20 p-7 text-center">
                      <p className="font-bold text-white">
                        Sin ascensos registrados en {disciplineConfig.nombre}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-2">
                      {selectedHistory.map((entry, index) => {
                        const rank = findRankVisual(
                          discipline,
                          entry.rango,
                          entry.cinta,
                          entry.grado,
                        );
                        return (
                          <div
                            key={`${entry.fecha}-${entry.grado}-${index}`}
                            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4"
                          >
                            <span className="w-20">
                              {rank ? (
                                <RankMark rank={rank} compact />
                              ) : (
                                <span className="block h-4 w-full rounded bg-zinc-700" />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-black text-white">
                                {entry.grado}
                              </p>
                              <p className="truncate text-xs text-zinc-400">
                                {entry.rango ||
                                  entry.cinta ||
                                  disciplineConfig.nombre}
                              </p>
                            </div>
                            <time className="text-right text-xs font-bold text-zinc-400 sm:text-sm">
                              {formatDate(entry.fecha)}
                            </time>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
