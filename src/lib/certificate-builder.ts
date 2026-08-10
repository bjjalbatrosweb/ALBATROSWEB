export type CertificateType = "grado" | "participacion" | "competencia" | "reconocimiento";
export type CertificateTheme = "dorado" | "azul" | "rojo" | "verde";

export type CertificateTemplate = {
  id: CertificateType;
  label: string;
  title: string;
  introduction: string;
  reason: string;
};

export type CertificateData = {
  type: CertificateType;
  theme: CertificateTheme;
  title: string;
  introduction: string;
  reason: string;
  discipline: string;
  grade: string;
  event: string;
  date: string;
  coach: string;
  secondSigner: string;
  folioPrefix: string;
  showPhoto: boolean;
};

export const CERTIFICATE_TEMPLATES: CertificateTemplate[] = [
  {
    id: "grado",
    label: "Promoción de grado",
    title: "Diploma de promoción",
    introduction: "La Academia Albatros reconoce a",
    reason: "por demostrar la preparación, disciplina y constancia requeridas para su promoción.",
  },
  {
    id: "participacion",
    label: "Participación",
    title: "Constancia de participación",
    introduction: "La Academia Albatros otorga la presente constancia a",
    reason: "por su valiosa participación y compromiso durante la actividad.",
  },
  {
    id: "competencia",
    label: "Resultado competitivo",
    title: "Reconocimiento deportivo",
    introduction: "La Academia Albatros reconoce a",
    reason: "por su destacada participación, esfuerzo y representación en competencia.",
  },
  {
    id: "reconocimiento",
    label: "Reconocimiento especial",
    title: "Reconocimiento",
    introduction: "La Academia Albatros reconoce a",
    reason: "por su constancia, actitud y contribución positiva a la comunidad.",
  },
];

export const CERTIFICATE_THEME_LABELS: Record<CertificateTheme, string> = {
  dorado: "Dorado clásico",
  azul: "Azul deportivo",
  rojo: "Rojo competitivo",
  verde: "Verde logro",
};

export function certificateTemplate(type: CertificateType) {
  return CERTIFICATE_TEMPLATES.find((template) => template.id === type) || CERTIFICATE_TEMPLATES[0];
}

export function defaultCertificateData(reference = new Date()): CertificateData {
  const template = certificateTemplate("grado");
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, "0");
  const day = String(reference.getDate()).padStart(2, "0");
  return {
    type: template.id,
    theme: "dorado",
    title: template.title,
    introduction: template.introduction,
    reason: template.reason,
    discipline: "",
    grade: "",
    event: "",
    date: `${year}-${month}-${day}`,
    coach: "",
    secondSigner: "",
    folioPrefix: `ALB-${year}`,
    showPhoto: true,
  };
}

export function certificateFolio(prefix: string, index: number) {
  const safePrefix = prefix.trim().replace(/\s+/g, "-").toUpperCase() || "ALB";
  return `${safePrefix}-${String(index + 1).padStart(3, "0")}`;
}

export function formatCertificateDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

