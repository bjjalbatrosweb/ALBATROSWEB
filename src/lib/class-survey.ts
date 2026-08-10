export const SURVEY_QUESTIONS = [
  { key: "classQuality", label: "Calidad de la clase" },
  { key: "instructor", label: "Atención del profesor" },
  { key: "intensity", label: "Intensidad adecuada" },
  { key: "facilities", label: "Instalaciones y equipo" },
] as const;

export type SurveyQuestionKey = (typeof SURVEY_QUESTIONS)[number]["key"];

export type ClassSurvey = {
  id: string;
  site: string;
  className: string;
  discipline: string;
  instructorName: string;
  active: boolean;
  responseCount: number;
  averages: Record<SurveyQuestionKey, number> & { recommendation: number };
  comments: Array<{ text: string; at: string }>;
  createdAt: string | null;
  expiresAt: string | null;
};

export function surveyAverage(sum: unknown, responses: unknown) {
  const total = Math.max(0, Number(sum) || 0);
  const count = Math.max(0, Number(responses) || 0);
  return count === 0 ? 0 : Math.round((total / count) * 10) / 10;
}

export function surveyOverall(survey: ClassSurvey) {
  const values = SURVEY_QUESTIONS.map(({ key }) => survey.averages[key]).filter(
    (value) => value > 0,
  );
  return values.length === 0
    ? 0
    : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}
