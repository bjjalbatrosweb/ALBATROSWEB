"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, CheckCircle2, ClipboardCheck, Loader2, Search, TriangleAlert, UserRound, Users, XCircle } from "lucide-react";
import { collection, onSnapshot, query, Timestamp, where } from "firebase/firestore";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFirestore } from "@/firebase";

type Site = "MMA" | "CAUCEL" | "JUAN_PABLO";
type Student = { id: string; nombre: string; estado?: string; disciplina?: string; fotoUrl?: string };
type Attendance = { id: string; alumnoId: string; dispositivo?: string; fecha?: Timestamp };

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function isActiveStudent(student: Student) {
  const status = String(student.estado || "activo").trim().toLowerCase();
  return !["inactivo", "baja", "suspendido", "eliminado"].includes(status);
}

export default function AttendanceReconciliationPage() {
  const firestore = useFirestore();
  const [site, setSite] = useState<Site>("MMA");
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [compared, setCompared] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(true);

  useEffect(() => {
    const savedSite = localStorage.getItem("userSede");
    if (["MMA", "CAUCEL", "JUAN_PABLO"].includes(savedSite || "")) setSite(savedSite as Site);
  }, []);

  useEffect(() => {
    setLoadingStudents(true);
    const studentsQuery = query(collection(firestore, "Alumnos"), where("sede", "==", site));
    return onSnapshot(studentsQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as Omit<Student, "id">) }))
        .filter(isActiveStudent)
        .sort((left, right) => left.nombre.localeCompare(right.nombre, "es"));
      setStudents(rows);
      setLoadingStudents(false);
    }, () => setLoadingStudents(false));
  }, [firestore, site]);

  useEffect(() => {
    setLoadingAttendance(true);
    const attendanceQuery = query(
      collection(firestore, "Asistencias"),
      where("sede", "==", site),
      where("fecha", ">=", Timestamp.fromDate(startOfToday())),
    );
    return onSnapshot(attendanceQuery, (snapshot) => {
      setAttendance(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Attendance, "id">) })));
      setLoadingAttendance(false);
    }, () => setLoadingAttendance(false));
  }, [firestore, site]);

  const attendanceByStudent = useMemo(() => {
    const map = new Map<string, Attendance>();
    attendance.forEach((item) => { if (item.alumnoId && !map.has(item.alumnoId)) map.set(item.alumnoId, item); });
    return map;
  }, [attendance]);

  const visibleStudents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    if (!term) return students;
    return students.filter((student) => `${student.nombre} ${student.disciplina || ""}`.toLocaleLowerCase("es").includes(term));
  }, [search, students]);

  const results = useMemo(() => ({
    registered: selectedIds.filter((id) => attendanceByStudent.has(id)),
    missing: selectedIds.filter((id) => !attendanceByStudent.has(id)),
  }), [attendanceByStudent, selectedIds]);

  const toggleStudent = (studentId: string) => {
    setCompared(false);
    setSelectedIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]);
  };

  const loading = loadingStudents || loadingAttendance;
  const todayLabel = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-sky-500"><ClipboardCheck className="h-4 w-4" /> Sede {site.replace("_", " ")}</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Comparar asistencia</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Toca las tarjetas de quienes están en clase y después presiona Comparar. Se revisarán las asistencias manuales y ESP32 de hoy.</p>
        </div>
        <Badge variant="outline" className="w-fit capitalize">{todayLabel}</Badge>
      </header>

      <Card className="border-sky-500/20 bg-sky-500/[0.04]">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            <Counter label="Seleccionados" value={selectedIds.length} tone="sky" />
            {compared && <Counter label="Con asistencia" value={results.registered.length} tone="green" />}
            {compared && <Counter label="Sin asistencia" value={results.missing.length} tone="red" />}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => { setSelectedIds([]); setCompared(false); }} disabled={selectedIds.length === 0}>Limpiar</Button>
            <Button type="button" onClick={() => setCompared(true)} disabled={selectedIds.length === 0 || loading} className="min-w-36 font-black">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />} Comparar
            </Button>
          </div>
        </CardContent>
      </Card>

      <label className="relative block max-w-xl"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar alumno…" className="pl-10" /></label>

      {loadingStudents ? (
        <div className="grid min-h-80 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : visibleStudents.length === 0 ? (
        <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed text-center text-muted-foreground"><div><Users className="mx-auto h-10 w-10 opacity-40" /><p className="mt-3 font-bold">No hay alumnos en esta sede o búsqueda.</p></div></div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleStudents.map((student) => {
            const selected = selectedIds.includes(student.id);
            const record = attendanceByStudent.get(student.id);
            const success = compared && selected && Boolean(record);
            const missing = compared && selected && !record;
            return (
              <button key={student.id} type="button" onClick={() => toggleStudent(student.id)} aria-pressed={selected} className={`relative flex min-h-28 items-center gap-4 overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition-all ${success ? "border-emerald-400 bg-emerald-500/20 ring-2 ring-emerald-400/30" : missing ? "border-red-400 bg-red-500/20 ring-2 ring-red-400/30" : selected ? "border-sky-400 bg-sky-500/20 ring-2 ring-sky-400/30" : "border-border bg-card hover:border-sky-400/50 hover:bg-sky-500/[0.05]"}`}>
                <span className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border ${selected ? "border-current/30 bg-black/10" : "bg-muted"}`}>
                  {student.fotoUrl ? <Image src={student.fotoUrl} alt="" width={64} height={64} unoptimized className="h-full w-full object-cover" /> : <UserRound className="h-8 w-8 text-muted-foreground" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-black">{student.nombre}</span>
                  <span className="mt-1 block truncate text-xs font-bold text-muted-foreground">{student.disciplina || "Atleta"}</span>
                  {success && <span className="mt-2 flex items-center gap-1 text-xs font-black text-emerald-600 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Asistencia registrada</span>}
                  {missing && <span className="mt-2 flex items-center gap-1 text-xs font-black text-red-600 dark:text-red-300"><XCircle className="h-4 w-4" /> No registró asistencia</span>}
                  {selected && !compared && <span className="mt-2 flex items-center gap-1 text-xs font-black text-sky-600 dark:text-sky-300"><Check className="h-4 w-4" /> Está en clase</span>}
                </span>
                {missing && <TriangleAlert className="absolute right-3 top-3 h-5 w-5 text-red-500" />}
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: "sky" | "green" | "red" }) {
  const classes = { sky: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300", green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300", red: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300" }[tone];
  return <span className={`rounded-xl border px-4 py-2 ${classes}`}><strong className="text-xl font-black">{value}</strong><span className="ml-2 text-xs font-black uppercase tracking-wide">{label}</span></span>;
}
