"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  CreditCard,
  Loader2,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type Student = {
  id: string;
  nombre: string;
  fotoUrl: string;
  gradoActual: string;
  gradoAscenso: string | null;
  bloqueado: boolean;
};

type Exam = {
  id: string;
  nombre: string;
  fecha: string;
  sede: string;
  precio: number;
};

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

function RegistrationForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [exam, setExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [examId, setExamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    nombre: string;
    gradoActual: string;
    gradoAscenso: string;
    precio: number;
    idExamen: string;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setError("El enlace de inscripción no incluye un código válido.");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    void fetch(
      `/api/taekwondo/examen/registro?token=${encodeURIComponent(token)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.mensaje || "No fue posible abrir el examen.");
        setExam(data.examen);
        setStudents(data.alumnos || []);
      })
      .catch((requestError) => {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        )
          return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No fue posible abrir el examen.",
        );
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [token]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedId) || null,
    [selectedId, students],
  );
  const filteredStudents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    if (term.length < 2) return [];
    return students
      .filter((student) =>
        student.nombre.toLocaleLowerCase("es").includes(term),
      )
      .slice(0, 12);
  }, [search, students]);

  const submit = async () => {
    if (!selectedStudent || !group.trim() || !examId.trim()) {
      setError("Selecciona tu nombre y completa grupo e ID del examen.");
      return;
    }
    if (selectedStudent.bloqueado) {
      setError(
        "Tu profesor debe registrar primero tu grado actual en Atletas → Grados.",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/taekwondo/examen/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          alumnoId: selectedStudent.id,
          grupo: group,
          idExamen: examId,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.mensaje || "No se pudo completar la inscripción.");
      setSuccess(data.solicitud);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo completar la inscripción.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07080b] text-zinc-300">
        <Loader2 className="mr-3 h-6 w-6 animate-spin" /> Abriendo inscripción…
      </main>
    );
  }

  if (!exam || (error && !students.length)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07080b] p-5 text-zinc-100">
        <div className="max-w-lg rounded-[28px] border border-red-500/25 bg-red-500/10 p-8 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-red-300" />
          <h1 className="mt-4 text-2xl font-black text-white">
            Inscripción no disponible
          </h1>
          <p className="mt-2 text-zinc-300">{error}</p>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,197,94,.16),transparent_35%),#07080b] p-5 text-zinc-100">
        <div className="w-full max-w-xl rounded-[30px] border border-emerald-400/25 bg-white/[.055] p-7 text-center shadow-2xl backdrop-blur-xl sm:p-10">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
            <CheckCircle2 className="h-10 w-10" />
          </span>
          <p className="mt-6 text-xs font-black uppercase tracking-[.18em] text-emerald-300">
            Solicitud generada
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">
            Ya estás inscrito
          </h1>
          <p className="mt-2 text-zinc-300">{success.nombre}</p>
          <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
            {[
              ["ID de examen", success.idExamen],
              ["Ascenso", `${success.gradoActual} → ${success.gradoAscenso}`],
              ["Pago solicitado", money(success.precio)],
              ["Estado", "Pendiente de aprobación"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-black/25 p-4"
              >
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                  {label}
                </p>
                <p className="mt-1 font-black text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,.18),transparent_35%),#07080b] px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-[30px] border border-white/10 bg-white/[.05] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.16em] text-red-300">
            <Award className="h-4 w-4" /> Examen de Taekwondo
          </span>
          <h1 className="mt-4 text-3xl font-black text-white sm:text-5xl">
            {exam.nombre}
          </h1>
          <p className="mt-3 text-zinc-300">
            {exam.sede} · {exam.fecha || "Fecha por confirmar"} ·{" "}
            {money(exam.precio)}
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <article className="rounded-[28px] border border-white/10 bg-white/[.045] p-5 shadow-xl sm:p-6">
            <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
              Paso 1
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              Busca tu nombre
            </h2>
            <div className="relative mt-5">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Escribe al menos dos letras"
                className="h-14 w-full rounded-2xl border border-white/10 bg-black/35 pl-12 pr-4 text-white outline-none placeholder:text-zinc-500 focus:border-red-500/60"
              />
            </div>
            <div className="mt-3 max-h-[450px] space-y-2 overflow-y-auto">
              {search.trim().length < 2 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
                  Tus resultados aparecerán aquí.
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
                  No encontramos ese nombre.
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => setSelectedId(student.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                      selectedId === student.id
                        ? "border-red-500/50 bg-red-500/10"
                        : "border-white/5 bg-black/20 hover:border-white/15"
                    }`}
                  >
                    <Avatar className="h-14 w-14 border border-white/15 bg-zinc-900">
                      <AvatarImage
                        src={student.fotoUrl}
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
                      <span
                        className={`mt-1 block text-xs ${student.bloqueado ? "text-red-300" : "text-zinc-400"}`}
                      >
                        {student.bloqueado
                          ? "Sin grado válido para ascenso"
                          : `${student.gradoActual} → ${student.gradoAscenso}`}
                      </span>
                    </span>
                    <ArrowRight className="h-5 w-5 text-zinc-600" />
                  </button>
                ))
              )}
            </div>
          </article>

          <article className="h-fit rounded-[28px] border border-white/10 bg-white/[.045] p-5 shadow-xl sm:p-6">
            <p className="text-xs font-black uppercase tracking-[.16em] text-red-300">
              Paso 2
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              Datos del examen
            </h2>
            {selectedStudent ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center gap-3">
                  <UserRound className="h-5 w-5 text-red-300" />
                  <div>
                    <p className="font-black text-white">
                      {selectedStudent.nombre}
                    </p>
                    <p className="text-xs text-zinc-400">Sede {exam.sede}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-white/[.05] p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                      Grado actual
                    </p>
                    <p className="mt-1 font-black text-white">
                      {selectedStudent.gradoActual || "No registrado"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-red-500/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-red-300">
                      Ascenso
                    </p>
                    <p className="mt-1 font-black text-white">
                      {selectedStudent.gradoAscenso || "Bloqueado"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm text-zinc-500">
                Selecciona tu nombre primero.
              </div>
            )}
            <label className="mt-5 block">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Grupo
              </span>
              <input
                value={group}
                onChange={(event) => setGroup(event.target.value)}
                maxLength={50}
                placeholder="Ej. Grupo A · infantiles"
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-white outline-none placeholder:text-zinc-500 focus:border-red-500/60"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                ID del examen
              </span>
              <input
                value={examId}
                onChange={(event) =>
                  setExamId(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9_-]/g, ""),
                  )
                }
                maxLength={30}
                placeholder="Ej. TKD-024"
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 font-mono text-white outline-none placeholder:text-zinc-500 focus:border-red-500/60"
              />
            </label>
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-emerald-400/15 bg-emerald-400/[.07] p-4">
              <span className="flex items-center gap-2 font-bold text-emerald-200">
                <CreditCard className="h-5 w-5" /> Solicitud de pago
              </span>
              <strong className="text-xl text-white">
                {money(exam.precio)}
              </strong>
            </div>
            {error && students.length > 0 && (
              <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-bold text-red-200">
                {error}
              </p>
            )}
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={saving || !selectedStudent || selectedStudent.bloqueado}
              className="mt-5 h-14 w-full rounded-2xl bg-red-600 text-base font-black text-white hover:bg-red-500 hover:text-white"
            >
              {saving ? <Loader2 className="animate-spin" /> : <Award />}
              {saving ? "Generando solicitud…" : "Inscribirme y solicitar pago"}
            </Button>
          </article>
        </section>
      </div>
    </main>
  );
}

export default function ExamRegistrationPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#07080b] text-zinc-300">
          <Loader2 className="mr-3 h-6 w-6 animate-spin" /> Preparando…
        </main>
      }
    >
      <RegistrationForm />
    </Suspense>
  );
}
