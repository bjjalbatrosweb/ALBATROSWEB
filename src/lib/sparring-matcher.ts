export type SparringIntensity = 1 | 2 | 3;

export type SparringAthlete = {
  id: string;
  nombre: string;
  fotoUrl: string;
  disciplina: string;
  grado: string;
  peso: number | null;
  edad: number | null;
  nivel: number;
  intensidad: SparringIntensity;
  soloTecnico: boolean;
};

export type SparringConfig = {
  mismaDisciplina: boolean;
  separarMenores: boolean;
  pesoEstricto: boolean;
  diferenciaPesoMaxima: number;
  diferenciaNivelMaxima: number;
  evitarRepeticiones: boolean;
};

export type PairAssessment = {
  compatible: boolean;
  score: number;
  reasons: string[];
  warnings: string[];
  technical: boolean;
};

export type SparringPair = PairAssessment & {
  id: string;
  atletaA: SparringAthlete;
  atletaB: SparringAthlete;
};

export type SparringRound = {
  number: number;
  pairs: SparringPair[];
  unmatched: SparringAthlete[];
  averageScore: number;
};

export function normalizeDiscipline(value: string) {
  const normalized = String(value || "").toLocaleLowerCase("es");
  if (/jiu|bjj|grappling/.test(normalized)) return "BJJ";
  if (/tae|tkd/.test(normalized)) return "Taekwondo";
  if (/mma|kick|box|muay/.test(normalized)) return "MMA";
  if (/func|acond|fitness/.test(normalized)) return "Funcional";
  return value.trim() || "Sin disciplina";
}

export function estimateLevel(grade: string) {
  const value = String(grade || "").toLocaleLowerCase("es");
  if (/negra|black|avanz|profesional/.test(value)) return 5;
  if (/marr[oó]n|brown|roja|red/.test(value)) return 4;
  if (/morada|purple|azul|blue|intermedio/.test(value)) return 3;
  if (/verde|green|amarilla|yellow|naranja|orange/.test(value)) return 2;
  return 1;
}

export function calculateAge(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const birthDate = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 4 && age <= 100 ? age : null;
}

export function pairingKey(a: SparringAthlete, b: SparringAthlete) {
  return [a.id, b.id].sort().join("::");
}

export function assessPair(
  a: SparringAthlete,
  b: SparringAthlete,
  config: SparringConfig,
  previousPairs: Set<string> = new Set(),
): PairAssessment {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 100;
  const disciplineA = normalizeDiscipline(a.disciplina);
  const disciplineB = normalizeDiscipline(b.disciplina);

  if (config.mismaDisciplina && disciplineA !== disciplineB) {
    return { compatible: false, score: 0, reasons, warnings: ["Disciplinas distintas"], technical: false };
  }
  if (disciplineA === disciplineB) reasons.push(`Misma disciplina: ${disciplineA}`);
  else {
    score -= 24;
    warnings.push("Cruce entre disciplinas");
  }

  const levelDifference = Math.abs(a.nivel - b.nivel);
  if (levelDifference > config.diferenciaNivelMaxima) {
    return { compatible: false, score: 0, reasons, warnings: ["Diferencia de nivel excesiva"], technical: false };
  }
  score -= levelDifference * 13;
  reasons.push(levelDifference === 0 ? "Nivel equivalente" : `Diferencia de nivel: ${levelDifference}`);

  if (a.peso && b.peso) {
    const weightDifference = Math.abs(a.peso - b.peso);
    if (config.pesoEstricto && weightDifference > config.diferenciaPesoMaxima) {
      return { compatible: false, score: 0, reasons, warnings: [`Diferencia de ${weightDifference.toFixed(1)} kg`], technical: false };
    }
    const weightPenalty = Math.min(35, (weightDifference / Math.max(1, config.diferenciaPesoMaxima)) * 28);
    score -= weightPenalty;
    reasons.push(`Diferencia de peso: ${weightDifference.toFixed(1)} kg`);
    if (weightDifference > config.diferenciaPesoMaxima) warnings.push("Supera el margen de peso configurado");
  } else {
    score -= 8;
    warnings.push("Falta registrar un peso");
  }

  if (config.separarMenores && a.edad !== null && b.edad !== null) {
    const oneIsMinor = (a.edad < 18) !== (b.edad < 18);
    if (oneIsMinor) {
      return { compatible: false, score: 0, reasons, warnings: ["No mezcla menores con adultos"], technical: false };
    }
    const ageDifference = Math.abs(a.edad - b.edad);
    if (a.edad < 18 && ageDifference > 3) score -= 20;
    else if (ageDifference > 12) score -= 8;
    reasons.push(`Diferencia de edad: ${ageDifference} años`);
  } else if (a.edad === null || b.edad === null) {
    warnings.push("Edad no registrada");
  }

  const intensityDifference = Math.abs(a.intensidad - b.intensidad);
  score -= intensityDifference * 12;
  reasons.push(intensityDifference === 0 ? "Misma intensidad" : "Ajustar intensidad antes del round");

  const technical = a.soloTecnico || b.soloTecnico;
  if (technical) {
    reasons.push("Round técnico y controlado");
    if (a.soloTecnico !== b.soloTecnico) score -= 5;
  }

  if (previousPairs.has(pairingKey(a, b))) {
    score -= config.evitarRepeticiones ? 32 : 10;
    warnings.push("Pareja repetida");
  }

  return {
    compatible: true,
    score: Math.max(25, Math.min(100, Math.round(score))),
    reasons,
    warnings,
    technical,
  };
}

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function buildRound(
  athletes: SparringAthlete[],
  config: SparringConfig,
  previousPairs: Set<string>,
  number: number,
) {
  let bestPairs: SparringPair[] = [];
  let bestUnmatched: SparringAthlete[] = athletes;
  let bestValue = -Infinity;
  const attempts = Math.max(40, Math.min(120, athletes.length * 4));

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const remaining = shuffled(athletes);
    const pairs: SparringPair[] = [];
    const unmatched: SparringAthlete[] = [];

    while (remaining.length) {
      const athlete = remaining.shift();
      if (!athlete) break;
      const options = remaining
        .map((candidate) => ({ candidate, assessment: assessPair(athlete, candidate, config, previousPairs) }))
        .filter((option) => option.assessment.compatible)
        .sort((a, b) => b.assessment.score - a.assessment.score);

      if (!options.length) {
        unmatched.push(athlete);
        continue;
      }

      const optionWindow = options.slice(0, Math.min(3, options.length));
      const selected = optionWindow[Math.floor(Math.random() * optionWindow.length)];
      const partnerIndex = remaining.findIndex((candidate) => candidate.id === selected.candidate.id);
      remaining.splice(partnerIndex, 1);
      pairs.push({
        id: `${number}-${athlete.id}-${selected.candidate.id}`,
        atletaA: athlete,
        atletaB: selected.candidate,
        ...selected.assessment,
      });
    }

    const totalScore = pairs.reduce((total, pair) => total + pair.score, 0);
    const value = pairs.length * 1000 + totalScore - unmatched.length * 300;
    if (value > bestValue) {
      bestValue = value;
      bestPairs = pairs;
      bestUnmatched = unmatched;
    }
  }

  return {
    number,
    pairs: bestPairs,
    unmatched: bestUnmatched,
    averageScore: bestPairs.length
      ? Math.round(bestPairs.reduce((total, pair) => total + pair.score, 0) / bestPairs.length)
      : 0,
  } satisfies SparringRound;
}

export function generateSparringRounds(
  athletes: SparringAthlete[],
  config: SparringConfig,
  roundCount: number,
) {
  const previousPairs = new Set<string>();
  const rounds: SparringRound[] = [];
  const safeRoundCount = Math.max(1, Math.min(8, Math.round(roundCount)));

  for (let number = 1; number <= safeRoundCount; number += 1) {
    const round = buildRound(athletes, config, previousPairs, number);
    rounds.push(round);
    round.pairs.forEach((pair) => previousPairs.add(pairingKey(pair.atletaA, pair.atletaB)));
  }

  return rounds;
}
