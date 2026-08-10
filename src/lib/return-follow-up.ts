export type ReturnStatus = "activo" | "atencion" | "reconectar" | "ausente" | "sin-registro";
export type FollowUpChannel = "whatsapp" | "llamada" | "nota";
export type FollowUpOutcome = "pendiente" | "contactado" | "regresa" | "sin-respuesta";

export type AttendanceRecord = {
  alumnoId: string;
  date: Date;
};

export type ReturnFollowUp = {
  id: string;
  fecha: string;
  canal: FollowUpChannel;
  resultado: FollowUpOutcome;
  nota: string;
  coach: string;
};

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  activo: "Activo esta semana",
  atencion: "7 a 13 días",
  reconectar: "14 a 29 días",
  ausente: "30 días o más",
  "sin-registro": "Sin visita reciente",
};

export const FOLLOW_UP_CHANNEL_LABELS: Record<FollowUpChannel, string> = {
  whatsapp: "WhatsApp",
  llamada: "Llamada",
  nota: "Nota interna",
};

export const FOLLOW_UP_OUTCOME_LABELS: Record<FollowUpOutcome, string> = {
  pendiente: "Pendiente",
  contactado: "Contactado",
  regresa: "Planea regresar",
  "sin-respuesta": "Sin respuesta",
};

export function daysSince(date: Date | null, reference = new Date()) {
  if (!date || Number.isNaN(date.getTime())) return null;
  const start = new Date(date);
  const end = new Date(reference);
  start.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

export function returnStatus(days: number | null): ReturnStatus {
  if (days === null) return "sin-registro";
  if (days <= 6) return "activo";
  if (days <= 13) return "atencion";
  if (days <= 29) return "reconectar";
  return "ausente";
}

export function latestAttendanceByAthlete(records: AttendanceRecord[]) {
  const latest = new Map<string, Date>();
  records.forEach((record) => {
    if (!record.alumnoId || Number.isNaN(record.date.getTime())) return;
    const current = latest.get(record.alumnoId);
    if (!current || record.date > current) latest.set(record.alumnoId, record.date);
  });
  return latest;
}

export function buildReturnMessage(name: string, days: number | null) {
  const firstName = name.trim().split(/\s+/)[0] || "atleta";
  const absence = days === null
    ? "Hace tiempo que no coincidimos en clase"
    : days <= 13
      ? `Llevamos ${days} días sin verte en clase`
      : `Hace ${days} días que no entrenamos juntos`;
  return `Hola ${firstName}. ${absence} y queríamos saber cómo estás. Cuando estés listo/a, será un gusto recibirte nuevamente en Academia Albatros. ¿Te ayudamos a encontrar un horario para regresar?`;
}

export function normalizeWhatsappPhone(phone: string, countryCode = "52") {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `${countryCode}${digits}`;
  return digits;
}

export function whatsappFollowUpUrl(phone: string, message: string) {
  const normalized = normalizeWhatsappPhone(phone);
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` : "";
}

export function createReturnFollowUp(input: {
  channel: FollowUpChannel;
  outcome: FollowUpOutcome;
  note: string;
  coach: string;
}): ReturnFollowUp {
  const now = new Date();
  return {
    id: `follow-up-${now.getTime()}`,
    fecha: now.toISOString(),
    canal: input.channel,
    resultado: input.outcome,
    nota: input.note.trim(),
    coach: input.coach.trim(),
  };
}

