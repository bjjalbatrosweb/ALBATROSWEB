const ACHIEVEMENTS = [
  { name: "Primer paso", target: 1 },
  { name: "Atleta constante", target: 10 },
  { name: "Disciplina de acero", target: 25 },
  { name: "Guerrero ALBATROS", target: 50 },
  { name: "Constancia de élite", target: 100 },
] as const;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function mondayForDay(dayKey: string) {
  if (!DAY_KEY.test(dayKey)) return dayKey;
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export type KioskActiveClass = {
  disciplina: string;
  tema: string;
} | null;

export type KioskWelcome = {
  asistenciasSemana: number;
  totalAsistencias: number;
  claseActiva: KioskActiveClass;
  siguienteLogro: {
    nombre: string;
    meta: number;
    faltan: number;
    completado: boolean;
  };
};

export function buildKioskWelcome(
  attendanceDays: string[],
  todayKey: string,
  activeClass: KioskActiveClass,
): KioskWelcome {
  const days = new Set(
    attendanceDays.filter((day) => DAY_KEY.test(day) && day <= todayKey),
  );
  if (DAY_KEY.test(todayKey)) days.add(todayKey);

  const monday = mondayForDay(todayKey);
  const weekly = Array.from(days).filter(
    (day) => day >= monday && day <= todayKey,
  ).length;
  const total = days.size;
  const next = ACHIEVEMENTS.find((achievement) => total < achievement.target);
  const last = ACHIEVEMENTS[ACHIEVEMENTS.length - 1];

  return {
    asistenciasSemana: weekly,
    totalAsistencias: total,
    claseActiva: activeClass,
    siguienteLogro: next
      ? {
          nombre: next.name,
          meta: next.target,
          faltan: next.target - total,
          completado: false,
        }
      : {
          nombre: last.name,
          meta: last.target,
          faltan: 0,
          completado: true,
        },
  };
}
