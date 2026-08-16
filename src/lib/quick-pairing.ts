export type QuickProfile = {
  id: string;
  name: string;
  kind: "athlete" | "guest" | "coach";
};

export type QuickPair = { id: string; left: QuickProfile; right: QuickProfile };

export function normalizedPairName(value: string) {
  return value.trim().toLocaleLowerCase("es-MX").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function forbiddenQuickPair(left: QuickProfile, right: QuickProfile) {
  const names = new Set([normalizedPairName(left.name), normalizedPairName(right.name)]);
  return names.has("andy") && names.has("lion");
}

function shuffle<T>(values: T[], random: () => number) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function candidateRound(profiles: QuickProfile[], random: () => number, preferCoachKarla: boolean) {
  const remaining = shuffle(profiles, random);
  const pairs: QuickPair[] = [];
  if (preferCoachKarla) {
    const coachIndex = remaining.findIndex((item) => item.kind === "coach");
    const karlaIndex = remaining.findIndex((item) => normalizedPairName(item.name) === "karla");
    if (coachIndex >= 0 && karlaIndex >= 0) {
      const coach = remaining[coachIndex]; const karla = remaining[karlaIndex];
      remaining.splice(Math.max(coachIndex, karlaIndex), 1); remaining.splice(Math.min(coachIndex, karlaIndex), 1);
      pairs.push({ id: `pair-${coach.id}-${karla.id}`, left: coach, right: karla });
    }
  }
  const resting: QuickProfile[] = [];
  while (remaining.length) {
    const left = remaining.shift(); if (!left) break;
    const options = remaining.map((profile, index) => ({ profile, index })).filter(({ profile }) => !forbiddenQuickPair(left, profile));
    if (!options.length) { resting.push(left); continue; }
    const selected = options[Math.floor(random() * options.length)];
    remaining.splice(selected.index, 1);
    pairs.push({ id: `pair-${left.id}-${selected.profile.id}`, left, right: selected.profile });
  }
  return { pairs, resting };
}

export function generateQuickPairs(profiles: QuickProfile[], random: () => number = Math.random) {
  const unique = [...new Map(profiles.map((profile) => [profile.id, profile])).values()];
  const preferCoachKarla = random() < 0.7;
  let best = candidateRound(unique, random, preferCoachKarla);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const candidate = candidateRound(unique, random, preferCoachKarla);
    if (candidate.pairs.length > best.pairs.length) best = candidate;
    if (best.pairs.length === Math.floor(unique.length / 2)) break;
  }
  return { ...best, preferredCoachKarla: preferCoachKarla };
}
