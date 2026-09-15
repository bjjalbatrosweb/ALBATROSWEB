import type { SkillProgress } from "@/lib/athlete-progress";
import { SUBMISSION_REPERTOIRE } from "@/lib/submission-curriculum";
import { TAKEDOWN_REPERTOIRE } from "@/lib/takedown-curriculum";

export const REPERTOIRE_BRANCHES = [
  {
    id: "derribes",
    label: "Derribes",
    description: "Proyecciones de judo y entradas de lucha registradas en el repertorio del equipo.",
    techniques: [...TAKEDOWN_REPERTOIRE],
  },
  {
    id: "sumisiones",
    label: "Sumisiones",
    description: "Estrangulaciones, ataques de brazo y llaves de pierna del repertorio base.",
    techniques: [...SUBMISSION_REPERTOIRE],
  },
] as const;

export const REPERTOIRE_TECHNIQUES = REPERTOIRE_BRANCHES.flatMap((branch) => [
  ...branch.techniques,
]);

const LEGACY_COMBINED_THROW = "Hip toss / head and arm (O-goshi)";

export function normalizeRepertoireProgress(progress: SkillProgress): SkillProgress {
  const normalized = { ...progress };
  const legacyThrowStatus = progress[LEGACY_COMBINED_THROW];
  if (legacyThrowStatus) {
    delete normalized[LEGACY_COMBINED_THROW];
    normalized["Hip toss"] ||= legacyThrowStatus;
    normalized["Head and arm / O-goshi"] ||= legacyThrowStatus;
  }
  const techniqueAliases: Record<string, string> = {
    "Mata león": "Mataleón",
    Anaconda: "Anaconda / Anakonda",
    Ezequiel: "Ezekiel",
    Armbar: "Armbar / Juji-gatame",
    Aquiles: "Aquiles / Foot lock",
    "Knee bar": "Kneebar",
    "Arm triangle / kata gatame": "Kata-gatame",
    "Sode tsurikomi goshi": "Sode tsurikomi",
    "Sasae tsurikomi ashi": "Sasae tsurikomi",
    "Head and arm (O-goshi)": "Head and arm / O-goshi",
    Ducks: "Duck under",
    "Single led": "Single leg",
    "Bouble leg": "Double leg",
    "Kani basani": "Kani basami",
  };
  Object.entries(techniqueAliases).forEach(([legacy, current]) => {
    if (!normalized[legacy]) return;
    normalized[current] ||= normalized[legacy];
    delete normalized[legacy];
  });
  return normalized;
}

export function repertoireSummary(progress: SkillProgress) {
  const total = REPERTOIRE_TECHNIQUES.length;
  const mastered = REPERTOIRE_TECHNIQUES.filter((technique) => progress[technique] === "dominada").length;
  const training = REPERTOIRE_TECHNIQUES.filter((technique) => progress[technique] === "practicando").length;
  return { total, mastered, training, pending: total - mastered - training };
}
