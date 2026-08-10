export type BracketAthlete = {
  id: string;
  nombre: string;
  fotoUrl: string;
  disciplina: string;
  grado: string;
};

export type BracketMatch = {
  id: string;
  redId: string | null;
  blueId: string | null;
  winnerId: string | null;
  automaticWinner?: boolean;
};

export type BracketRound = {
  id: string;
  label: string;
  matches: BracketMatch[];
};

export type TournamentBracket = {
  id: string;
  nombre: string;
  categoria: string;
  tatami: string;
  competidores: BracketAthlete[];
  rounds: BracketRound[];
  creadoEn: string;
  actualizadoEn: string;
};

function nextPowerOfTwo(value: number) {
  let result = 2;
  while (result < value) result *= 2;
  return Math.min(16, result);
}

function roundLabel(roundIndex: number, roundCount: number) {
  const remaining = roundCount - roundIndex;
  if (remaining === 1) return "Final";
  if (remaining === 2) return "Semifinales";
  if (remaining === 3) return "Cuartos de final";
  return `Ronda ${roundIndex + 1}`;
}

function normalizeRounds(rounds: BracketRound[]) {
  const normalized = rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({ ...match })),
  }));

  for (let roundIndex = 0; roundIndex < normalized.length; roundIndex += 1) {
    const round = normalized[roundIndex];
    let previous: BracketMatch[] = [];
    if (roundIndex > 0) {
      previous = normalized[roundIndex - 1].matches;
      round.matches.forEach((match, matchIndex) => {
        match.redId = previous[matchIndex * 2]?.winnerId || null;
        match.blueId = previous[matchIndex * 2 + 1]?.winnerId || null;
        if (match.winnerId !== match.redId && match.winnerId !== match.blueId) {
          match.winnerId = null;
        }
      });
    }
    round.matches.forEach((match, matchIndex) => {
      const sourcesReady =
        roundIndex === 0 ||
        [previous[matchIndex * 2], previous[matchIndex * 2 + 1]].every(
          (source) => source && (Boolean(source.winnerId) || (!source.redId && !source.blueId)),
        );
      if (match.redId && match.blueId && match.automaticWinner) {
        match.winnerId = null;
        match.automaticWinner = false;
      }
      if (sourcesReady && match.redId && !match.blueId) {
        match.winnerId = match.redId;
        match.automaticWinner = true;
      }
      if (sourcesReady && !match.redId && match.blueId) {
        match.winnerId = match.blueId;
        match.automaticWinner = true;
      }
      if (!match.redId && !match.blueId) {
        match.winnerId = null;
        match.automaticWinner = false;
      }
    });
  }
  return normalized;
}

export function shuffleAthletes(athletes: BracketAthlete[], random = Math.random) {
  const shuffled = [...athletes];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function createTournamentBracket(input: {
  name: string;
  category: string;
  mat: string;
  athletes: BracketAthlete[];
}): TournamentBracket {
  const athletes = input.athletes.slice(0, 16);
  if (athletes.length < 2) throw new Error("Selecciona al menos dos competidores.");
  const bracketSize = nextPowerOfTwo(athletes.length);
  const roundCount = Math.log2(bracketSize);
  const rounds: BracketRound[] = [];
  const firstMatches: BracketMatch[] = [];
  const slots: Array<BracketAthlete | null> = [];
  let byes = bracketSize - athletes.length;
  athletes.forEach((athlete) => {
    slots.push(athlete);
    if (byes > 0) {
      slots.push(null);
      byes -= 1;
    }
  });

  for (let index = 0; index < bracketSize / 2; index += 1) {
    firstMatches.push({
      id: `r0-m${index}`,
      redId: slots[index * 2]?.id || null,
      blueId: slots[index * 2 + 1]?.id || null,
      winnerId: null,
      automaticWinner: false,
    });
  }
  rounds.push({ id: "round-0", label: roundLabel(0, roundCount), matches: firstMatches });

  for (let roundIndex = 1; roundIndex < roundCount; roundIndex += 1) {
    const matchCount = bracketSize / 2 ** (roundIndex + 1);
    rounds.push({
      id: `round-${roundIndex}`,
      label: roundLabel(roundIndex, roundCount),
      matches: Array.from({ length: matchCount }, (_, matchIndex) => ({
        id: `r${roundIndex}-m${matchIndex}`,
        redId: null,
        blueId: null,
        winnerId: null,
        automaticWinner: false,
      })),
    });
  }

  const now = new Date().toISOString();
  return {
    id: `bracket-${Date.now()}`,
    nombre: input.name.trim() || "Torneo",
    categoria: input.category.trim(),
    tatami: input.mat.trim(),
    competidores: athletes,
    rounds: normalizeRounds(rounds),
    creadoEn: now,
    actualizadoEn: now,
  };
}

export function selectBracketWinner(
  bracket: TournamentBracket,
  roundIndex: number,
  matchIndex: number,
  athleteId: string,
) {
  const rounds = bracket.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({ ...match })),
  }));
  const match = rounds[roundIndex]?.matches[matchIndex];
  if (!match || (athleteId !== match.redId && athleteId !== match.blueId)) return bracket;
  match.winnerId = athleteId;
  match.automaticWinner = false;
  return { ...bracket, rounds: normalizeRounds(rounds), actualizadoEn: new Date().toISOString() };
}

export function bracketPodium(bracket: TournamentBracket) {
  const finalRound = bracket.rounds.at(-1);
  const final = finalRound?.matches[0];
  const championId = final?.winnerId || null;
  const runnerUpId = championId
    ? final?.redId === championId
      ? final.blueId
      : final?.redId || null
    : null;
  const semifinal = bracket.rounds.length >= 2 ? bracket.rounds.at(-2) : null;
  const bronzeIds = (semifinal?.matches || [])
    .map((match) => {
      if (!match.winnerId) return null;
      return match.redId === match.winnerId ? match.blueId : match.redId;
    })
    .filter((value): value is string => Boolean(value));
  return { championId, runnerUpId, bronzeIds };
}

export function bracketProgress(bracket: TournamentBracket) {
  const matches = bracket.rounds.flatMap((round) => round.matches);
  const playable = matches.filter((match) => match.redId && match.blueId);
  const finished = playable.filter((match) => match.winnerId).length;
  return playable.length ? Math.round((finished / playable.length) * 100) : 0;
}
