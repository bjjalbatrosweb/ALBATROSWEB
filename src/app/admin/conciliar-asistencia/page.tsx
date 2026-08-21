"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Save,
  Search,
  TriangleAlert,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFirestore, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { reconcileAttendance } from "@/lib/attendance-reconciliation";

type Site = "MMA" | "CAUCEL" | "JUAN_PABLO";

type ActiveClass = {
  claseId: string;
  sede: Site;
  disciplina: string;
  tema: string;
  tipo: string;
  profesorNombre?: string;
  inicio?: Timestamp;
};

type Student = {
  id: string;
  nombre: string;
  estado?: string;
  disciplina?: string;
};

type Attendance = {
  id: string;
  alumnoId: string;
  nombre: string;
  dispositivo?: string;
  fecha?: Timestamp;
};

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0))];
}

function isActiveStudent(student: Student) {
  const status = String(student.estado || "activo").trim().toLowerCase();
  return !["inactivo", "baja", "suspendido", "eliminado"].includes(status);
}

export default function AttendanceReconciliationPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const dirtyRef = useRef(false);
  const [site, setSite] = useState<Site>("MMA");
  const [activeClass, setActiveClass] = useState<ActiveClass | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const savedSite = localStorage.getItem("userSede");
    if (["MMA", "CAUCEL", "JUAN_PABLO"].includes(savedSite || "")) {
      setSite(savedSite as Site);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(firestore, "ClasesActivas", site),
      (snapshot) => {
        const next = snapshot.exists() ? (snapshot.data() as ActiveClass) : null;
        setActiveClass(next);
        if (!next) {
          dirtyRef.current = false;
          setSelectedIds([]);
          setSavedIds([]);
          setAttendance([]);
        }
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsubscribe;
  }, [firestore, site]);

  useEffect(() => {
    const studentsQuery = query(
      collection(firestore, "Alumnos"),
      where("sede", "==", site),
    );
    return onSnapshot(studentsQuery, (snapshot) => {
      const next = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as Omit<Student, "id">) }))
        .filter(isActiveStudent)
        .sort((left, right) => left.nombre.localeCompare(right.nombre, "es"));
      setStudents(next);
    });
  }, [firestore, site]);

  useEffect(() => {
    if (!activeClass?.claseId) return;
    dirtyRef.current = false;
    const unsubscribe = onSnapshot(
      doc(firestore, "Clases", activeClass.claseId),
      (snapshot) => {
        const ids = normalizeIds(snapshot.data()?.verificacionPresentesIds);
        setSavedIds(ids);
        if (!dirtyRef.current) setSelectedIds(ids);
      },
    );
    return unsubscribe;
  }, [activeClass?.claseId, firestore]);

  useEffect(() => {
    if (!activeClass?.claseId) return;
    const attendanceQuery = query(
      collection(firestore, "AsistenciasClase"),
      where("claseId", "==", activeClass.claseId),
    );
    return onSnapshot(attendanceQuery, (snapshot) => {
      const next = snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<Attendance, "id">),
      }));
      next.sort(
        (left, right) =>
          (left.fecha?.toMillis?.() || 0) - (right.fecha?.toMillis?.() || 0),
      );
      setAttendance(next);
    });
  }, [activeClass?.claseId, firestore]);

  const attendanceByStudent = useMemo(() => {
    const map = new Map<string, Attendance>();
    attendance.forEach((item) => {
      if (item.alumnoId && !map.has(item.alumnoId)) map.set(item.alumnoId, item);
    });
    return map;
  }, [attendance]);

  const comparison = useMemo(
    () => reconcileAttendance(selectedIds, [...attendanceByStudent.keys()]),
    [attendanceByStudent, selectedIds],
  );

  const studentsById = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students],
  );

  const visibleStudents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    if (!term) return students;
    return students.filter((student) =>
      `${student.nombre} ${student.disciplina || ""}`
        .toLocaleLowerCase("es")
        .includes(term),
    );
  }, [search, students]);

  const dirty = useMemo(() => {
    const current = [...selectedIds].sort();
    const saved = [...savedIds].sort();
    return current.length !== saved.length || current.some((id, index) => id !== saved[index]);
  }, [savedIds, selectedIds]);

  const toggleStudent = (studentId: string) => {
    dirtyRef.current = true;
    setSelectedIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
  };

  const saveRoster = async () => {
    if (!activeClass || !user || saving) return;
    setSaving(true);
    try {
      await updateDoc(doc(firestore, "Clases", activeClass.claseId), {
        verificacionPresentesIds: selectedIds,
        verificacionActualizadaEn: serverTimestamp(),
        verificacionActualizadaPor: user.uid,
        verificacionActualizadaPorEmail: user.email || "",
      });
      setSavedIds(selectedIds);
      dirtyRef.current = false;
      toast({
        title: "Conteo guardado",
        description: `${selectedIds.length} personas marcadas físicamente en clase.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="grid min-h-[55vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!activeClass) {
    return (
      <div className="space-y-6">
        <Header site={site} />
        <Card className="border-amber-400/25 bg-amber-500/[0.05]">
          <CardContent className="grid min-h-72 place-items-center p-8 text-center">
            <div className="max-w-lg">
              <TriangleAlert className="mx-auto h-12 w-12 text-amber-400" />
              <h2 className="mt-4 text-2xl font-black">No hay una clase activa</h2>
              <p className="mt-2 text-sm text-muted-foreground">Inicia la sesión desde Control de clase. La conciliación usará únicamente las asistencias RFID, NFC o manuales registradas durante esa clase.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header site={site} />

      <Card className="border-emerald-500/25 bg-emerald-500/[0.04]">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge className="bg-emerald-600">Clase en curso</Badge>
            <h2 className="mt-3 text-2xl font-black">{activeClass.disciplina} · {activeClass.tema}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{activeClass.tipo} · {activeClass.profesorNombre || "Profesor"}{activeClass.inicio?.toDate ? ` · inició ${activeClass.inicio.toDate().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => { dirtyRef.current = false; setSelectedIds(savedIds); }}><RefreshCw className="mr-2 h-4 w-4" /> Descartar</Button>
            <Button type="button" disabled={!dirty || saving} onClick={() => void saveRoster()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar conteo</Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Presentes físicos" value={selectedIds.length} icon={Users} tone="sky" />
        <SummaryCard label="Coinciden" value={comparison.matched.length} icon={CheckCircle2} tone="emerald" />
        <SummaryCard label="Sin pasar asistencia" value={comparison.presentWithoutRecord.length} icon={TriangleAlert} tone="amber" />
        <SummaryCard label="Registro sin marcar presente" value={comparison.recordedWithoutPresence.length} icon={UserX} tone="rose" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-sky-500" /> Conteo visual del profesor</CardTitle>
            <p className="text-sm text-muted-foreground">Marca a quienes ves físicamente en esta clase. Esto no crea ni elimina una asistencia oficial.</p>
          </CardHeader>
          <CardContent>
            <label className="relative block"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar alumno…" className="pl-10" /></label>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => { dirtyRef.current = true; setSelectedIds(students.map((student) => student.id)); }}>Marcar todos</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { dirtyRef.current = true; setSelectedIds([...attendanceByStudent.keys()]); }}>Marcar los registrados</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { dirtyRef.current = true; setSelectedIds([]); }}>Limpiar</Button>
            </div>
            <div className="mt-4 max-h-[620px] divide-y overflow-y-auto rounded-xl border">
              {visibleStudents.map((student) => {
                const selected = selectedIds.includes(student.id);
                const recorded = attendanceByStudent.get(student.id);
                return (
                  <button key={student.id} type="button" onClick={() => toggleStudent(student.id)} aria-pressed={selected} className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition ${selected ? "bg-sky-500/10" : "hover:bg-muted/50"}`}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${selected ? "border-sky-500 bg-sky-500 text-white" : "border-border"}`}>{selected && <Check className="h-4 w-4" />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-black">{student.nombre}</span><span className="block truncate text-xs text-muted-foreground">{student.disciplina || "Atleta"}</span></span>
                    {recorded && <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">Registró {recorded.dispositivo || "asistencia"}</Badge>}
                  </button>
                );
              })}
              {visibleStudents.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">No hay alumnos en este filtro.</p>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <DifferenceCard title="Presentes sin asistencia" description="Están físicamente, pero no pasaron RFID/NFC ni fueron registrados manualmente." ids={comparison.presentWithoutRecord} students={studentsById} attendance={attendanceByStudent} tone="amber" />
          <DifferenceCard title="Registro sin presencia marcada" description="Tienen asistencia registrada, pero aún no fueron marcados en el conteo visual." ids={comparison.recordedWithoutPresence} students={studentsById} attendance={attendanceByStudent} tone="rose" />
          <DifferenceCard title="Coincidencias" description="El conteo físico y el registro de asistencia coinciden." ids={comparison.matched} students={studentsById} attendance={attendanceByStudent} tone="emerald" />
        </div>
      </div>
    </div>
  );
}

function Header({ site }: { site: Site }) {
  return <header><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-sky-500"><ClipboardCheck className="h-4 w-4" /> Control cruzado · {site.replace("_", " ")}</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Conciliar asistencia</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Compara el conteo físico del profesor contra RFID, NFC y registros manuales de la clase activa.</p></header>;
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Users; tone: "sky" | "emerald" | "amber" | "rose" }) {
  const colors = { sky: "border-sky-500/25 bg-sky-500/[0.05] text-sky-500", emerald: "border-emerald-500/25 bg-emerald-500/[0.05] text-emerald-500", amber: "border-amber-500/25 bg-amber-500/[0.05] text-amber-500", rose: "border-rose-500/25 bg-rose-500/[0.05] text-rose-500" }[tone];
  return <Card className={colors}><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-black uppercase tracking-wide text-muted-foreground">{label}</p><strong className="mt-2 block text-4xl font-black text-foreground">{value}</strong></div><Icon className="h-8 w-8" /></CardContent></Card>;
}

function DifferenceCard({ title, description, ids, students, attendance, tone }: { title: string; description: string; ids: string[]; students: Map<string, Student>; attendance: Map<string, Attendance>; tone: "amber" | "rose" | "emerald" }) {
  const colors = { amber: "border-amber-500/25 bg-amber-500/[0.04]", rose: "border-rose-500/25 bg-rose-500/[0.04]", emerald: "border-emerald-500/25 bg-emerald-500/[0.04]" }[tone];
  return <Card className={colors}><CardHeader><CardTitle className="flex items-center justify-between gap-3"><span>{title}</span><Badge variant="outline">{ids.length}</Badge></CardTitle><p className="text-xs leading-relaxed text-muted-foreground">{description}</p></CardHeader><CardContent>{ids.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Sin diferencias en este grupo.</p> : <div className="divide-y rounded-xl border">{ids.map((id) => { const student = students.get(id); const record = attendance.get(id); return <div key={id} className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="truncate font-black">{student?.nombre || record?.nombre || "Alumno no encontrado"}</p><p className="truncate text-xs text-muted-foreground">{record ? `${record.dispositivo || "Asistencia"}${record.fecha?.toDate ? ` · ${record.fecha.toDate().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : ""}` : "Sin registro durante la clase"}</p></div></div>; })}</div>}</CardContent></Card>;
}
