export type ClaSide = "red" | "blue";
export type ClaIntensity = "inicial" | "tecnica" | "avanzada";
export type ClaRestriction = {
  id: string;
  title: string;
  instruction: string;
  cue: string;
  level: 1 | 2 | 3;
  family: "extremidades" | "posicion" | "ataque" | "defensa" | "movilidad";
};

export const CLA_RESTRICTIONS: ClaRestriction[] = [
  { id: "legs_only", title: "Sólo piernas", instruction: "Usa las piernas para iniciar controles y ataques. Los brazos sólo pueden proteger.", cue: "Piernas activas; brazos defensivos.", level: 2, family: "extremidades" },
  { id: "no_guard", title: "Nada de guardias", instruction: "No cierres ni retengas guardia. Trabaja de pie, tortuga o posiciones superiores.", cue: "Sin guardia.", level: 2, family: "posicion" },
  { id: "no_chokes", title: "Sin estrangulaciones", instruction: "Quedan fuera todas las llaves de asfixia. Busca control o articulaciones seguras.", cue: "No ataques el cuello.", level: 1, family: "ataque" },
  { id: "reverse", title: "Reversa", instruction: "Intercambien inmediatamente la posición actual antes de continuar.", cue: "Cambien posiciones.", level: 1, family: "posicion" },
  { id: "no_joint_locks", title: "Sin llaves articulares", instruction: "No finalices brazos ni piernas. Sólo control posicional o estrangulación técnica.", cue: "Sin palancas articulares.", level: 1, family: "ataque" },
  { id: "position_only", title: "Sólo posición", instruction: "No hay sumisiones durante esta consigna. Avanza y estabiliza posiciones.", cue: "Control antes que finalización.", level: 1, family: "posicion" },
  { id: "escape_only", title: "Sólo escapar", instruction: "Tu objetivo es recuperar guardia, levantarte o salir; no contraataques todavía.", cue: "Defiende y sal.", level: 1, family: "defensa" },
  { id: "sweep_only", title: "Sólo raspados", instruction: "Desde abajo únicamente puedes progresar mediante un raspado limpio.", cue: "Busca invertir la posición.", level: 2, family: "ataque" },
  { id: "no_closed_guard", title: "Guardia siempre abierta", instruction: "No cierres los tobillos. Mantén una guardia activa y móvil.", cue: "Tobillos abiertos.", level: 1, family: "posicion" },
  { id: "one_arm", title: "Un brazo fuera", instruction: "Mantén una mano tocando tu pecho. Trabaja controles con el otro brazo.", cue: "Sólo un brazo ofensivo.", level: 2, family: "extremidades" },
  { id: "weak_side", title: "Lado menos hábil", instruction: "Todos tus avances deben comenzar hacia tu lado menos dominante.", cue: "Ataca por tu lado débil.", level: 2, family: "movilidad" },
  { id: "three_points", title: "Tres apoyos", instruction: "Antes de avanzar debes conservar tres puntos de apoyo estables.", cue: "Base antes de moverte.", level: 1, family: "movilidad" },
  { id: "no_grip_repeat", title: "No repitas agarre", instruction: "Después de soltar un agarre no puedes usar el mismo en la siguiente acción.", cue: "Cambia de agarre.", level: 3, family: "extremidades" },
  { id: "two_step_attack", title: "Ataque en dos pasos", instruction: "Toda finalización debe venir después de un control y un aislamiento visibles.", cue: "Controla, aísla y ataca.", level: 2, family: "ataque" },
  { id: "stand_up_goal", title: "Volver de pie", instruction: "Tu única victoria temporal es crear distancia y levantarte con base.", cue: "Construye base y levántate.", level: 1, family: "defensa" },
  { id: "turtle_route", title: "Ruta por tortuga", instruction: "Tu siguiente transición debe pasar por tortuga, sin quedarte inmóvil.", cue: "Usa tortuga como transición.", level: 2, family: "posicion" },
  { id: "no_strength", title: "Sin fuerza explosiva", instruction: "Trabaja a ritmo técnico: marcos, ángulos y distribución del peso.", cue: "Técnica, no explosión.", level: 1, family: "movilidad" },
  { id: "leg_entry", title: "Entrada a piernas", instruction: "Tu siguiente ataque debe comenzar aislando una pierna, sin finalizar de golpe.", cue: "Primero controla la pierna.", level: 3, family: "ataque" },
  { id: "top_pressure", title: "Presión superior", instruction: "Busca permanecer arriba y cambiar de control sin saltar posiciones.", cue: "Conserva la posición superior.", level: 2, family: "posicion" },
  { id: "frames_only", title: "Sólo marcos", instruction: "Defiende creando estructura y distancia; no abraces ni retengas al rival.", cue: "Crea marcos y espacio.", level: 2, family: "defensa" },
];

const MAX_LEVEL: Record<ClaIntensity, number> = { inicial: 1, tecnica: 2, avanzada: 3 };

export function claRestrictionPool(intensity: ClaIntensity) { return CLA_RESTRICTIONS.filter((item) => item.level <= MAX_LEVEL[intensity]); }

export function pickClaRestrictions(intensity: ClaIntensity, recentIds: string[] = [], random = Math.random): { red: ClaRestriction; blue: ClaRestriction } {
  const pool = claRestrictionPool(intensity); const recent = new Set(recentIds.slice(-6)); let available = pool.filter((item) => !recent.has(item.id));
  if (available.length < 2) available = pool;
  const redIndex = Math.min(available.length - 1, Math.floor(random() * available.length)); const red = available[redIndex]; const bluePool = available.filter((item) => item.id !== red.id && item.family !== red.family);
  const choices = bluePool.length ? bluePool : available.filter((item) => item.id !== red.id); const blueIndex = Math.min(choices.length - 1, Math.floor(random() * choices.length));
  return { red, blue: choices[blueIndex] };
}

export function formatClaTime(seconds: number) { const safe = Math.max(0, Math.floor(seconds)); return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`; }
