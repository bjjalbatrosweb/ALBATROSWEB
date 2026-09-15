export type TakedownModule = {
  id: "fundamentos" | "intermedio" | "avanzado";
  label: string;
  level: string;
  description: string;
  safety: string;
  techniques: readonly string[];
};

export const TAKEDOWN_MODULES: readonly TakedownModule[] = [
  {
    id: "fundamentos",
    label: "Módulo 1 · Fundamentos",
    level: "Básico",
    description: "Entradas directas, control de distancia y proyecciones base para aprender a llevar el combate al suelo.",
    safety: "Practicar primero la caída, el control de la cabeza y la finalización estable sin soltar al compañero.",
    techniques: [
      "O-soto-gari",
      "Ashi barai",
      "Sasae tsurikomi",
      "Single leg",
      "Double leg",
      "Outside trip",
      "Body lock",
      "Hip toss",
      "Snapdown",
    ],
  },
  {
    id: "intermedio",
    label: "Módulo 2 · Encadenamientos",
    level: "Intermedio",
    description: "Cambios de dirección, agarres y reacciones que enlazan judo, lucha y control de clinch.",
    safety: "Controlar la velocidad, respetar el área de caída y no proyectar si el compañero perdió la postura de seguridad.",
    techniques: [
      "Harai goshi",
      "Uchi mata",
      "Tani otoshi",
      "Ippon seoi nage",
      "Sode tsurikomi",
      "Kata guruma",
      "O-guruma",
      "Bomber",
      "High crotch",
      "Ankle pick",
      "Back trip",
      "Head and arm / O-goshi",
      "Duck under",
      "Arm drag",
      "Slide by",
    ],
  },
  {
    id: "avanzado",
    label: "Módulo 3 · Alto riesgo",
    level: "Avanzado",
    description: "Proyecciones que requieren dominio de caídas, control corporal y conocimiento del reglamento aplicable.",
    safety: "Suplex y Kani basami solo se practican con autorización y supervisión directa; Kani basami está prohibido en numerosos reglamentos.",
    techniques: ["Suplex", "Kani basami"],
  },
] as const;

export const TAKEDOWN_REPERTOIRE = TAKEDOWN_MODULES.flatMap((module) => [...module.techniques]);
