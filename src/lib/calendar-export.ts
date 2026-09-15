type CalendarReservation = {
  id: string;
  name: string;
  discipline: string;
  teacher?: string;
  site: string;
  startsAt: string;
};

function escapeCalendarText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function calendarTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("La fecha de la clase no es válida.");
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function reservationCalendarFile(
  reservation: CalendarReservation,
  createdAt = new Date(),
) {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(reservation.id)) {
    throw new Error("La clase no tiene un identificador válido.");
  }
  const summary = escapeCalendarText(
    `${reservation.discipline} · ${reservation.name}`.slice(0, 160),
  );
  const detail = escapeCalendarText(
    [
      reservation.teacher ? `Profesor: ${reservation.teacher}` : "",
      "Reserva confirmada en Albatros.",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const site = escapeCalendarText(reservation.site.replace(/_/g, " "));
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Albatros//Agenda del atleta//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${reservation.id}@albatros`,
    `DTSTAMP:${calendarTimestamp(createdAt)}`,
    `DTSTART:${calendarTimestamp(reservation.startsAt)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${detail}`,
    `LOCATION:${site}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  return {
    filename: `clase-albatros-${reservation.id}.ics`,
    content,
  };
}

