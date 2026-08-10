export type DisciplineId = "taekwondo" | "jiujitsu" | "kick-mma";

export type RankVisual = {
  id: string;
  nombre: string;
  color: string;
  colorSecundario?: string;
  avanzado?: boolean;
};

export type DisciplineConfig = {
  id: DisciplineId;
  nombre: string;
  nombreCorto: string;
  descripcion: string;
  selector: "Cinta" | "Nivel";
  detalle: string;
  rangos: RankVisual[];
  grados: string[];
};

export const TAEKWONDO_BELTS: RankVisual[] = [
  { id: "blanca", nombre: "Blanca", color: "#F8FAFC" },
  { id: "amarilla", nombre: "Amarilla", color: "#FACC15" },
  {
    id: "amarilla-avanzada",
    nombre: "Amarilla avanzada",
    color: "#FACC15",
    colorSecundario: "#F97316",
    avanzado: true,
  },
  { id: "naranja", nombre: "Naranja", color: "#F97316" },
  {
    id: "naranja-avanzada",
    nombre: "Naranja avanzada",
    color: "#F97316",
    colorSecundario: "#22C55E",
    avanzado: true,
  },
  { id: "verde", nombre: "Verde", color: "#22C55E" },
  {
    id: "verde-avanzada",
    nombre: "Verde avanzada",
    color: "#22C55E",
    colorSecundario: "#2563EB",
    avanzado: true,
  },
  { id: "azul", nombre: "Azul", color: "#2563EB" },
  {
    id: "azul-avanzada",
    nombre: "Azul avanzada",
    color: "#2563EB",
    colorSecundario: "#7C3AED",
    avanzado: true,
  },
  { id: "morada", nombre: "Morada", color: "#7C3AED" },
  {
    id: "morada-avanzada",
    nombre: "Morada avanzada",
    color: "#7C3AED",
    colorSecundario: "#92400E",
    avanzado: true,
  },
  { id: "cafe", nombre: "Café", color: "#92400E" },
  {
    id: "cafe-avanzada",
    nombre: "Café avanzada",
    color: "#92400E",
    colorSecundario: "#DC2626",
    avanzado: true,
  },
  { id: "roja", nombre: "Roja", color: "#DC2626" },
  {
    id: "roja-avanzada",
    nombre: "Roja avanzada",
    color: "#DC2626",
    colorSecundario: "#09090B",
    avanzado: true,
  },
  {
    id: "poom",
    nombre: "Poom (roja/negra)",
    color: "#DC2626",
    colorSecundario: "#09090B",
    avanzado: true,
  },
  { id: "negra", nombre: "Negra", color: "#09090B" },
];

export const TAEKWONDO_GRADES = [
  ...Array.from({ length: 10 }, (_, index) => `${10 - index}° Kup`),
  ...Array.from({ length: 4 }, (_, index) => `${index + 1}° Poom`),
  ...Array.from({ length: 10 }, (_, index) => `${index + 1}° Dan`),
];

export const JIUJITSU_BELTS: RankVisual[] = [
  { id: "blanca", nombre: "Blanca", color: "#F8FAFC" },
  { id: "gris", nombre: "Gris infantil", color: "#94A3B8" },
  { id: "amarilla", nombre: "Amarilla infantil", color: "#FACC15" },
  { id: "naranja", nombre: "Naranja infantil", color: "#F97316" },
  { id: "verde", nombre: "Verde infantil", color: "#22C55E" },
  { id: "azul", nombre: "Azul", color: "#2563EB" },
  { id: "morada", nombre: "Morada", color: "#7C3AED" },
  { id: "cafe", nombre: "Café", color: "#92400E" },
  { id: "negra", nombre: "Negra", color: "#09090B" },
  {
    id: "coral-negra-roja",
    nombre: "Coral negra/roja",
    color: "#09090B",
    colorSecundario: "#DC2626",
    avanzado: true,
  },
  {
    id: "coral-roja-blanca",
    nombre: "Coral roja/blanca",
    color: "#DC2626",
    colorSecundario: "#F8FAFC",
    avanzado: true,
  },
  {
    id: "roja",
    nombre: "Roja",
    color: "#DC2626",
    avanzado: true,
  },
];

export const JIUJITSU_GRADES = [
  "Sin franjas",
  "1 franja",
  "2 franjas",
  "3 franjas",
  "4 franjas",
  ...Array.from({ length: 10 }, (_, index) => `${index + 1}° grado`),
];

export const KICK_MMA_LEVELS: RankVisual[] = [
  { id: "inicial-1", nombre: "Inicial 1", color: "#94A3B8" },
  { id: "inicial-2", nombre: "Inicial 2", color: "#CBD5E1" },
  { id: "fundamentos", nombre: "Fundamentos", color: "#38BDF8" },
  { id: "intermedio-1", nombre: "Intermedio 1", color: "#2563EB" },
  { id: "intermedio-2", nombre: "Intermedio 2", color: "#7C3AED" },
  { id: "avanzado", nombre: "Avanzado", color: "#F97316" },
  { id: "competidor", nombre: "Competidor", color: "#DC2626" },
  {
    id: "elite",
    nombre: "Élite",
    color: "#EAB308",
    colorSecundario: "#09090B",
    avanzado: true,
  },
  {
    id: "instructor",
    nombre: "Instructor",
    color: "#09090B",
    colorSecundario: "#DC2626",
    avanzado: true,
  },
];

export const DISCIPLINE_CONFIGS: DisciplineConfig[] = [
  {
    id: "taekwondo",
    nombre: "Taekwondo",
    nombreCorto: "TKD",
    descripcion: "Cinta y grado Kup, Poom o Dan",
    selector: "Cinta",
    detalle: "Grado Kup, Poom o Dan",
    rangos: TAEKWONDO_BELTS,
    grados: TAEKWONDO_GRADES,
  },
  {
    id: "jiujitsu",
    nombre: "Jiu-Jitsu",
    nombreCorto: "BJJ",
    descripcion: "Cinta, franjas y grados avanzados",
    selector: "Cinta",
    detalle: "Franja o grado",
    rangos: JIUJITSU_BELTS,
    grados: JIUJITSU_GRADES,
  },
  {
    id: "kick-mma",
    nombre: "Kick / MMA",
    nombreCorto: "KICK MMA",
    descripcion: "Nivel técnico y competitivo interno",
    selector: "Nivel",
    detalle: "Nivel",
    rangos: KICK_MMA_LEVELS,
    grados: [],
  },
];

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getDisciplineConfig(id: DisciplineId) {
  return DISCIPLINE_CONFIGS.find((discipline) => discipline.id === id)!;
}

export function resolveDisciplineId(value: unknown): DisciplineId | null {
  const normalized = normalize(value);
  if (normalized.includes("tae") || normalized === "tkd") return "taekwondo";
  if (normalized.includes("jiu") || normalized.includes("bjj"))
    return "jiujitsu";
  if (normalized.includes("kick") || normalized.includes("mma"))
    return "kick-mma";
  return null;
}

export function findRankVisual(discipline: DisciplineId, ...values: unknown[]) {
  const config = getDisciplineConfig(discipline);
  const normalizedValues = values.map(normalize).filter(Boolean);
  return (
    config.rangos.find((rank) =>
      normalizedValues.some(
        (value) => value === rank.id || value.includes(normalize(rank.nombre)),
      ),
    ) || null
  );
}

export function rankBackground(rank: RankVisual) {
  if (!rank.colorSecundario) return rank.color;
  return `linear-gradient(90deg, ${rank.color} 0 42%, ${rank.colorSecundario} 42% 58%, ${rank.color} 58% 100%)`;
}
