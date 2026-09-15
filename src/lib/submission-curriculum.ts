export type SubmissionModule = {
  id: "fundamentos" | "intermedio" | "avanzado";
  label: string;
  level: string;
  description: string;
  safety: string;
  techniques: readonly string[];
};

export const SUBMISSION_MODULES: readonly SubmissionModule[] = [
  {
    id: "fundamentos",
    label: "Módulo 1 · Fundamentos",
    level: "Básico",
    description: "Finalizaciones esenciales, controles reconocibles y mecánicas que construyen la base del repertorio.",
    safety: "Practicar entrada, control y liberación inmediata antes de añadir resistencia.",
    techniques: [
      "Mataleón",
      "Guillotina",
      "Triángulo",
      "Ezekiel",
      "Armbar / Juji-gatame",
      "Kimura",
    ],
  },
  {
    id: "intermedio",
    label: "Módulo 2 · Encadenamientos",
    level: "Intermedio",
    description: "Ataques que requieren transiciones, aislamiento preciso y lectura de la defensa del compañero.",
    safety: "Priorizar posición y control; las articulaciones pequeñas exigen aplicación lenta y supervisada.",
    techniques: [
      "Anaconda / Anakonda",
      "D'Arce",
      "Omoplata",
      "Wrist lock",
      "Aquiles / Foot lock",
      "Von Flue",
      "Kata-gatame",
      "Baseball choke",
    ],
  },
  {
    id: "avanzado",
    label: "Módulo 3 · Especialización",
    level: "Avanzado",
    description: "Llaves de pierna, compresiones y variantes modernas para atletas con control técnico consolidado.",
    safety: "Solo con autorización del profesor y reglas compatibles con edad, grado y torneo; liberar ante el tap sin demora.",
    techniques: [
      "Heel hook",
      "Kneebar",
      "Toe hold",
      "Calf slicer",
      "Bicep slicer",
      "Buggy choke",
      "Gogoplata",
      "Baroplata",
      "Karikoplata",
      "Aoki lock",
    ],
  },
] as const;

export const SUBMISSION_REPERTOIRE = SUBMISSION_MODULES.flatMap((module) => [...module.techniques]);
