const TIME_ZONE = "America/Merida";

function datePartsInTimeZone(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function paymentPeriod(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function effectiveDueDay(rawDueDay, parts) {
  const dueDay = Math.min(31, Math.max(1, Math.trunc(Number(rawDueDay) || 1)));
  return Math.min(dueDay, lastDayOfMonth(parts.year, parts.month));
}

function paymentPeriodFromDate(value) {
  const date = value?.toDate?.() || (value instanceof Date ? value : null);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const parts = datePartsInTimeZone(date);
  return paymentPeriod(parts);
}

function isPaidForPeriod(student, paidStudentIds, period) {
  const lastPaymentPeriod = paymentPeriodFromDate(student.fechaUltimoPago);
  const legacyPaidRecord =
    student.estadoPago === "Pagado" &&
    !student.periodoUltimoPago &&
    !lastPaymentPeriod;

  return (
    paidStudentIds.has(student.id) ||
    String(student.periodoUltimoPago || "") === period ||
    lastPaymentPeriod === period ||
    legacyPaidRecord
  );
}

function isOverdueStudent(student, paidStudentIds, parts) {
  if (student.activo === false || isPaidForPeriod(student, paidStudentIds, paymentPeriod(parts))) {
    return false;
  }

  return parts.day > effectiveDueDay(student.diaPago, parts);
}

function reminderPayload(student, parts) {
  const firstName = String(student.nombre || "Atleta").trim().split(/\s+/)[0] || "Atleta";
  const period = paymentPeriod(parts);
  return {
    title: "Pago pendiente · ALBATROS",
    body: `Hola ${firstName}, tu mensualidad está pendiente. Abre Mi Academia para consultar los detalles.`,
    url: "/mi-academia",
    tag: `pago-${period}`,
    period,
    dueDay: effectiveDueDay(student.diaPago, parts),
  };
}

export {
  TIME_ZONE,
  datePartsInTimeZone,
  effectiveDueDay,
  isOverdueStudent,
  isPaidForPeriod,
  paymentPeriod,
  paymentPeriodFromDate,
  reminderPayload,
};
