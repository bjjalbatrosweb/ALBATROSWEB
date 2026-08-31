export const MEMBER_ROLES = ["atleta", "profesor", "staff", "administracion"] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  atleta: "Atleta",
  profesor: "Profesor",
  staff: "Staff",
  administracion: "Administración",
};

export function normalizeMemberRole(value: unknown): MemberRole {
  if (typeof value !== "string") return "atleta";
  const normalized = value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return MEMBER_ROLES.includes(normalized as MemberRole)
    ? (normalized as MemberRole)
    : "atleta";
}

export function isBillableAthlete(value: unknown) {
  return normalizeMemberRole(value) === "atleta";
}

export function isPaymentExempt(value: unknown) {
  return !isBillableAthlete(value);
}

