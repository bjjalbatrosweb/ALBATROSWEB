export const TRIAL_CLASS_SCHEDULES = [
  {
    discipline: "Jiu-Jitsu",
    times: [
      "Matutino · Lunes, miércoles y viernes · 9:00–10:00 a. m.",
      "Vespertino · Martes, jueves y sábado · 7:00–8:00 p. m.",
    ],
  },
  {
    discipline: "Kick Boxing",
    times: [
      "Matutino · Lunes, miércoles y viernes · 7:00–8:00 a. m.",
      "Vespertino · Martes, jueves y sábado · 8:00–9:00 p. m.",
    ],
  },
  {
    discipline: "MMA",
    times: [
      "Matutino · Lunes, miércoles y viernes · 8:00–9:00 a. m.",
      "Vespertino · Martes, jueves y sábado · 8:00–9:00 p. m.",
      "Vespertino · Martes, jueves y sábado · 9:00–10:00 p. m.",
    ],
  },
] as const;

export type TrialClassDiscipline = (typeof TRIAL_CLASS_SCHEDULES)[number]["discipline"];
export type TrialClassSite = "CAUCEL" | "MMA" | "JUAN_PABLO";
export type TrialClassOrigin = "kiosco" | "web";

export type TrialClassFormData = {
  nombre: string;
  telefono: string;
  disciplina: TrialClassDiscipline;
  horario: string;
  sede: TrialClassSite;
  notas: string;
};

export const EMPTY_TRIAL_CLASS_FORM: TrialClassFormData = {
  nombre: "",
  telefono: "",
  disciplina: "Jiu-Jitsu",
  horario: "",
  sede: "CAUCEL",
  notas: "",
};

export function createEmptyTrialClassForm(): TrialClassFormData {
  return { ...EMPTY_TRIAL_CLASS_FORM };
}

export function trialClassTimes(discipline: string): readonly string[] {
  return TRIAL_CLASS_SCHEDULES.find((item) => item.discipline === discipline)?.times || [];
}

export function prepareTrialClassRequest(
  form: TrialClassFormData,
  origin: TrialClassOrigin,
) {
  const nombre = form.nombre.trim().slice(0, 80);
  const telefono = form.telefono.replace(/\D/g, "").slice(0, 15);
  const horario = form.horario.trim().slice(0, 80);
  const validTimes = trialClassTimes(form.disciplina);

  if (nombre.length < 2) return { ok: false as const, error: "Escribe tu nombre completo." };
  if (telefono.length < 10) return { ok: false as const, error: "Escribe un teléfono válido de al menos 10 dígitos." };
  if (!validTimes.includes(horario)) return { ok: false as const, error: "Selecciona un horario disponible." };

  return {
    ok: true as const,
    data: {
      nombre,
      telefono,
      disciplina: form.disciplina,
      sede: form.sede,
      horario,
      notas: form.notas.trim().slice(0, 300),
      estado: "pendiente" as const,
      origen: origin,
    },
  };
}
