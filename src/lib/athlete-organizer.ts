export type OrganizerMode = "fair" | "random" | "weight" | "same-level" | "mentor" | "discipline";
export type OddMode = "trio" | "active-rest" | "floater";
export type OrganizerRuleKind = "avoid" | "prefer" | "keep";

export type OrganizerAthlete = {
  id: string;
  nombre: string;
  disciplina: string;
  grado: string;
  peso: number | null;
  edad: number | null;
  nivel: number;
};

export type OrganizerRule = {
  id: string;
  a: string;
  b: string;
  kind: OrganizerRuleKind;
  strength: number;
  maxConsecutive: number;
};

export type OrganizerHistoryRound = {
  id: string;
  createdAt: string;
  groups: string[][];
};

export type OrganizerSafety = {
  enabled: boolean;
  maxWeightDifference: number;
  maxAgeDifference: number;
  separateMinors: boolean;
};

export type GeneratedGroup = {
  members: string[];
  assignment?: "active-rest" | "floater";
  warnings: string[];
};

export const organizerModeLabels: Record<OrganizerMode, string> = {
  fair: "Rotación justa",
  random: "Aleatorio",
  weight: "Peso semejante",
  "same-level": "Mismo nivel",
  mentor: "Avanzado + principiante",
  discipline: "Misma disciplina",
};

export const oddModeLabels: Record<OddMode, string> = {
  trio: "Crear un trío",
  "active-rest": "Descanso activo",
  floater: "Atleta comodín",
};

export const ruleKindLabels: Record<OrganizerRuleKind, string> = {
  avoid: "Nunca emparejar",
  prefer: "Favorecer pareja",
  keep: "Mantener juntos",
};

export function organizerPairKey(a: string, b: string) {
  return [a, b].sort().join("::");
}

export function calculateOrganizerAge(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value !== "string" || !value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  if (today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())) age -= 1;
  return age >= 0 && age <= 110 ? age : null;
}

export function estimateOrganizerLevel(grade: string) {
  const value = String(grade || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/negra|black|avanz|profesional|dan/.test(value)) return 5;
  if (/marron|brown|roja|red/.test(value)) return 4;
  if (/morada|purple|azul|blue|intermedio/.test(value)) return 3;
  if (/verde|green|amarilla|yellow|naranja|orange/.test(value)) return 2;
  return 1;
}

function pairsInGroup(ids: string[]) {
  const result: Array<[string, string]> = [];
  for (let first = 0; first < ids.length; first += 1) {
    for (let second = first + 1; second < ids.length; second += 1) result.push([ids[first], ids[second]]);
  }
  return result;
}

function frequencyMap(history: OrganizerHistoryRound[]) {
  const result = new Map<string, number>();
  history.forEach((round) => round.groups.forEach((group) => pairsInGroup(group).forEach(([a, b]) => {
    const key = organizerPairKey(a, b);
    result.set(key, (result.get(key) || 0) + 1);
  })));
  return result;
}

function consecutiveCount(history: OrganizerHistoryRound[], a: string, b: string) {
  const key = organizerPairKey(a, b);
  let count = 0;
  for (const round of history) {
    const present = round.groups.some((group) => pairsInGroup(group).some(([x, y]) => organizerPairKey(x, y) === key));
    if (!present) break;
    count += 1;
  }
  return count;
}

function matchingRule(rules: OrganizerRule[], a: string, b: string) {
  const key = organizerPairKey(a, b);
  return rules.find((rule) => organizerPairKey(rule.a, rule.b) === key);
}

export function safetyWarnings(members: OrganizerAthlete[], safety: OrganizerSafety) {
  if (!safety.enabled || members.length < 2) return [];
  const warnings = new Set<string>();
  pairsInGroup(members.map((athlete) => athlete.id)).forEach(([aId, bId]) => {
    const a = members.find((athlete) => athlete.id === aId);
    const b = members.find((athlete) => athlete.id === bId);
    if (!a || !b) return;
    if (a.peso && b.peso) {
      const difference = Math.abs(a.peso - b.peso);
      if (difference > safety.maxWeightDifference) warnings.add(`Diferencia de peso: ${difference.toFixed(1)} kg`);
    }
    if (a.edad !== null && b.edad !== null) {
      const difference = Math.abs(a.edad - b.edad);
      if (difference > safety.maxAgeDifference) warnings.add(`Diferencia de edad: ${difference} años`);
      if (safety.separateMinors && (a.edad < 18) !== (b.edad < 18)) warnings.add("Combina menor y adulto");
    }
  });
  return [...warnings];
}

function randomWeighted<T>(items: T[], weight: (item: T) => number) {
  const weighted = items.map((item) => ({ item, weight: Math.max(0, weight(item)) })).filter((entry) => entry.weight > 0);
  if (!weighted.length) return null;
  let ticket = Math.random() * weighted.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of weighted) {
    ticket -= entry.weight;
    if (ticket <= 0) return entry.item;
  }
  return weighted.at(-1)?.item || null;
}

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function pairAllowed(a: string, b: string, rules: OrganizerRule[], history: OrganizerHistoryRound[]) {
  const rule = matchingRule(rules, a, b);
  if (rule?.kind === "avoid") return false;
  if (rule?.kind === "prefer" && consecutiveCount(history, a, b) >= Math.max(1, rule.maxConsecutive)) return false;
  return true;
}

function groupAllowed(ids: string[], rules: OrganizerRule[], history: OrganizerHistoryRound[]) {
  return pairsInGroup(ids).every(([a, b]) => pairAllowed(a, b, rules, history));
}

export function generateOrganizerGroups(input: {
  athletes: OrganizerAthlete[];
  rules: OrganizerRule[];
  history: OrganizerHistoryRound[];
  mode: OrganizerMode;
  oddMode: OddMode;
  safety: OrganizerSafety;
}) {
  const { athletes, rules, history, mode, oddMode, safety } = input;
  const byId = new Map(athletes.map((athlete) => [athlete.id, athlete]));
  const frequencies = frequencyMap(history);
  const groupSizeFactor = Math.max(1, Math.pow(athletes.length / 4, 2));
  const groups: GeneratedGroup[] = [];
  const remaining = new Set(athletes.map((athlete) => athlete.id));

  rules.filter((rule) => rule.kind === "keep").forEach((rule) => {
    if (!remaining.has(rule.a) || !remaining.has(rule.b) || !pairAllowed(rule.a, rule.b, rules, history)) return;
    const members = [byId.get(rule.a), byId.get(rule.b)].filter(Boolean) as OrganizerAthlete[];
    groups.push({ members: members.map((item) => item.id), warnings: safetyWarnings(members, safety) });
    remaining.delete(rule.a);
    remaining.delete(rule.b);
  });

  let pool = shuffled([...remaining].map((id) => byId.get(id)).filter(Boolean) as OrganizerAthlete[]);
  if (pool.length % 2 === 1 && oddMode !== "trio") {
    const priorSolo = new Map<string, number>();
    history.forEach((round) => round.groups.filter((group) => group.length === 1).forEach(([id]) => priorSolo.set(id, (priorSolo.get(id) || 0) + 1)));
    pool.sort((a, b) => (priorSolo.get(a.id) || 0) - (priorSolo.get(b.id) || 0));
    const solo = pool.shift();
    if (solo) {
      groups.push({ members: [solo.id], assignment: oddMode, warnings: [] });
    }
    pool = shuffled(pool);
  }

  while (pool.length) {
    if (pool.length === 3 && oddMode === "trio") {
      const trio = pool;
      if (!groupAllowed(trio.map((item) => item.id), rules, history)) return null;
      groups.push({ members: trio.map((item) => item.id), warnings: safetyWarnings(trio, safety) });
      break;
    }

    const anchor = pool.shift();
    if (!anchor) break;
    const partner = randomWeighted(pool.filter((candidate) => pairAllowed(anchor.id, candidate.id, rules, history)), (candidate) => {
      const rule = matchingRule(rules, anchor.id, candidate.id);
      const repeats = frequencies.get(organizerPairKey(anchor.id, candidate.id)) || 0;
      let weight = 1 / (1 + repeats * (rule?.kind === "prefer" ? 0.35 : 2.4));
      if (rule?.kind === "prefer") weight *= 1 + (rule.strength / 20) * groupSizeFactor;
      if (mode === "weight" && anchor.peso && candidate.peso) weight *= 1 / (1 + Math.abs(anchor.peso - candidate.peso) / 5);
      if (mode === "same-level") weight *= 1 / (1 + Math.abs(anchor.nivel - candidate.nivel) * 1.8);
      if (mode === "mentor") weight *= 1 + Math.min(4, Math.abs(anchor.nivel - candidate.nivel)) * 0.85;
      if (mode === "discipline") weight *= anchor.disciplina === candidate.disciplina ? 4 : 0.18;
      if (mode === "fair") weight *= 1 / (1 + repeats * 1.6);
      const warnings = safetyWarnings([anchor, candidate], safety);
      if (warnings.length) weight *= 0.62;
      return weight;
    });
    if (!partner) return null;
    pool.splice(pool.findIndex((candidate) => candidate.id === partner.id), 1);
    groups.push({ members: [anchor.id, partner.id], warnings: safetyWarnings([anchor, partner], safety) });
  }

  return groups;
}

export function rotationStats(history: OrganizerHistoryRound[]) {
  const frequencies = frequencyMap(history);
  const values = [...frequencies.values()];
  const total = values.reduce((sum, value) => sum + value, 0);
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;
  return {
    rounds: history.length,
    uniquePairs: frequencies.size,
    totalPairs: total,
    repeatedPairs: values.filter((value) => value > 1).length,
    fairness: values.length ? Math.max(0, Math.round(100 - (max - min) * 16 - (total - frequencies.size) * 2)) : 100,
  };
}
