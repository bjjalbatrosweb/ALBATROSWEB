import type { SkillProgress } from "@/lib/athlete-progress";

export const REPERTOIRE_BRANCHES = [
  {
    id: "derribes",
    label: "Derribes",
    description: "Proyecciones de judo y entradas de lucha registradas en el repertorio del equipo.",
    techniques: [
      "Harai goshi",
      "Uchi mata",
      "O-soto-gari",
      "Tani otoshi",
      "Ippon seoi nage",
      "Ashi barai",
      "Sode tsurikomi goshi",
      "Kata guruma",
      "O-guruma",
      "Sasae tsurikomi ashi",
      "Bomber",
      "Single leg",
      "Double leg",
      "Outside trip",
      "High crotch",
      "Ankle pick",
      "Body lock",
      "Back trip",
      "Hip toss",
      "Head and arm (O-goshi)",
    ],
  },
  {
    id: "sumisiones",
    label: "Sumisiones",
    description: "Estrangulaciones, ataques de brazo y llaves de pierna del repertorio base.",
    techniques: [
      "Mata león",
      "Guillotina",
      "Anaconda",
      "D'Arce",
      "Triángulo",
      "Ezequiel",
      "Armbar",
      "Kimura",
      "Americana",
      "Omoplata",
      "Wrist lock",
      "Aquiles",
      "Heel hook",
      "Knee bar",
      "Toe hold",
      "Calf slicer",
      "Bicep slicer",
      "Von Flue",
      "Buggy choke",
      "Arm triangle / kata gatame",
    ],
  },
] as const;

export const REPERTOIRE_TECHNIQUES = REPERTOIRE_BRANCHES.flatMap((branch) => [
  ...branch.techniques,
]);

const LEGACY_COMBINED_THROW = "Hip toss / head and arm (O-goshi)";

export function normalizeRepertoireProgress(progress: SkillProgress): SkillProgress {
  const legacyStatus = progress[LEGACY_COMBINED_THROW];
  if (!legacyStatus) return progress;
  const normalized = { ...progress };
  delete normalized[LEGACY_COMBINED_THROW];
  normalized["Hip toss"] ||= legacyStatus;
  normalized["Head and arm (O-goshi)"] ||= legacyStatus;
  return normalized;
}

export function repertoireSummary(progress: SkillProgress) {
  const total = REPERTOIRE_TECHNIQUES.length;
  const mastered = REPERTOIRE_TECHNIQUES.filter((technique) => progress[technique] === "dominada").length;
  const training = REPERTOIRE_TECHNIQUES.filter((technique) => progress[technique] === "practicando").length;
  return { total, mastered, training, pending: total - mastered - training };
}
