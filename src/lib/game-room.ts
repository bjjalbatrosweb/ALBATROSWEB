export type GameParticipant = { id: string; nombre: string; invitado?: boolean };
export type GamePreference = { participantId: string; objetivos: string[]; nota?: string };
export type GameMatch = { id: string; round: number; area: number; a: GameParticipant; b: GameParticipant; solicitada: boolean; solicitudMutua: boolean; sumision?: string; derribe?: string; estado?: "pendiente" | "en_curso" | "completado"; winnerId?: string };
export type GameCardChallenge = { derribe: string; sumision: string };
export type GamePrivateCard = { participantId: string; retos: Record<string, GameCardChallenge> };
export type GameStanding = GameParticipant & { wins: number; fights: number; points: number };

export const GAME_SUBMISSIONS = ["Armbar", "Triángulo", "Mataleón", "Kimura", "Guillotina", "Americana", "Estrangulación de solapa"];
export const GAME_TAKEDOWNS = ["Harai goshi", "Uchi mata", "O-soto-gari", "Tani otoshi", "Ippon seoi nage", "Ashi barai", "Kata guruma"];

function hash(value: string) { return [...value].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 7); }
function pairKey(a: string, b: string) { return [a, b].sort().join("::"); }

export function buildGameSchedule(participants: GameParticipant[], preferences: GamePreference[], areas: number, challengeEnabled: boolean): GameMatch[] {
  void challengeEnabled;
  const unique = [...new Map(participants.map((item) => [item.id, item])).values()];
  if (unique.length < 2) return [];
  const wishes = new Map(preferences.map((item) => [item.participantId, new Set(item.objetivos)]));
  const candidates: Array<{ a: GameParticipant; b: GameParticipant; score: number; mutual: boolean; requested: boolean }> = [];
  for (let i = 0; i < unique.length; i += 1) for (let j = i + 1; j < unique.length; j += 1) {
    const a = unique[i]; const b = unique[j];
    const ab = wishes.get(a.id)?.has(b.id) === true; const ba = wishes.get(b.id)?.has(a.id) === true;
    const tie = (hash(pairKey(a.id, b.id)) % 1000) / 1000;
    if (ab || ba) candidates.push({ a, b, mutual: ab && ba, requested: true, score: (ab && ba ? 200 : 100) + tie });
  }
  candidates.sort((left, right) => right.score - left.score);
  const matches: GameMatch[] = []; const pending = [...candidates];
  const maxAreas = Math.max(1, Math.min(12, Math.floor(areas || 1)));
  let round = 1;
  while (pending.length > 0) {
    const used = new Set<string>(); let area = 1;
    const scheduledIndexes: number[] = [];
    for (let index = 0; index < pending.length; index += 1) {
      const edge = pending[index];
      if (area > maxAreas || used.has(edge.a.id) || used.has(edge.b.id)) continue;
      const seed = hash(`${round}:${edge.a.id}:${edge.b.id}`);
      matches.push({ id: `${round}-${area}-${seed}`, round, area, a: edge.a, b: edge.b, solicitada: edge.requested, solicitudMutua: edge.mutual, estado: "pendiente" });
      used.add(edge.a.id); used.add(edge.b.id); scheduledIndexes.push(index); area += 1;
    }
    if (scheduledIndexes.length === 0) break;
    for (let index = scheduledIndexes.length - 1; index >= 0; index -= 1) pending.splice(scheduledIndexes[index], 1);
    round += 1;
  }
  return matches;
}

export function buildPrivateGameCards(schedule: GameMatch[], participants: GameParticipant[], enabled: boolean): GamePrivateCard[] {
  return participants.map((participant) => {
    const retos: Record<string, GameCardChallenge> = {};
    if (enabled) for (const match of schedule) {
      if (match.a.id !== participant.id && match.b.id !== participant.id) continue;
      const seed = hash(`${match.id}:${participant.id}:private`);
      retos[match.id] = { derribe: GAME_TAKEDOWNS[seed % GAME_TAKEDOWNS.length], sumision: GAME_SUBMISSIONS[(seed >>> 4) % GAME_SUBMISSIONS.length] };
    }
    return { participantId: participant.id, retos };
  });
}

export function calculateGameStandings(participants: GameParticipant[], schedule: GameMatch[]): GameStanding[] {
  return participants.map((participant) => {
    const completed = schedule.filter((match) => (match.a.id === participant.id || match.b.id === participant.id) && match.estado === "completado");
    const wins = completed.filter((match) => match.winnerId === participant.id).length;
    return { ...participant, wins, fights: completed.length, points: wins * 3 + completed.length };
  }).sort((a, b) => b.points - a.points || b.wins - a.wins || a.nombre.localeCompare(b.nombre, "es"));
}

export function getMaxGameRound(schedule: GameMatch[]): number {
  return schedule.reduce((maximum, match) => Math.max(maximum, match.round), 0);
}

export function startGameRound(schedule: GameMatch[], round: number): GameMatch[] {
  return schedule.map((match) => ({
    ...match,
    estado: match.round < round ? "completado" : match.round === round ? "en_curso" : "pendiente",
  }));
}

export function completeGameRound(schedule: GameMatch[], round: number): GameMatch[] {
  return schedule.map((match) => match.round === round ? { ...match, estado: "completado" } : match);
}

export function finalizeGameSchedule(schedule: GameMatch[]): GameMatch[] {
  return schedule.map((match) => ({ ...match, estado: "completado" }));
}
