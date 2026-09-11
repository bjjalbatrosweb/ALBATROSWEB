export type GameParticipant = { id: string; nombre: string; invitado?: boolean };
export type GamePreference = { participantId: string; objetivos: string[]; nota?: string };
export type GameChallengeStatus = "pendiente" | "aceptado" | "rechazado";
export type GamePvpChallenge = {
  id: string; tournamentId: string; weekKey: string; sede: string;
  challengerId: string; challengerName: string; challengedId: string; challengedName: string;
  status: GameChallengeStatus; createdAtMs: number; respondedAtMs?: number;
};
export type GameMatch = {
  id: string; round: number; area: number; a: GameParticipant; b: GameParticipant;
  solicitada: boolean; solicitudMutua: boolean; acceptedChallengeIds?: string[];
  sumision?: string; derribe?: string; estado?: "pendiente" | "en_curso" | "completado"; winnerId?: string;
};
export type GameCardChallenge = { derribe: string; sumision: string };
export type GamePrivateCard = { participantId: string; retos: Record<string, GameCardChallenge> };
export type GameStanding = GameParticipant & { wins: number; fights: number; sent: number; accepted: number; declined: number; points: number };
export type GameLeaderboards = { weekKey: string; challengers: GameStanding[]; bravest: GameStanding[]; victorious: GameStanding[]; mvp: GameStanding[] };

export const GAME_POINTS = { challengeSent: 1, challengeAccepted: 2, challengeDeclined: -1, fightCompleted: 1, victory: 5 } as const;
export const GAME_SUBMISSIONS = ["Armbar", "Triángulo", "Mataleón", "Kimura", "Guillotina", "Americana", "Estrangulación de solapa"];
export const GAME_TAKEDOWNS = ["Harai goshi", "Uchi mata", "O-soto-gari", "Tani otoshi", "Ippon seoi nage", "Ashi barai", "Kata guruma"];

function hash(value: string) { return [...value].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 7); }
function pairKey(a: string, b: string) { return [a, b].sort().join("::"); }
function technicalChallenge(seedValue: string) { const seed = hash(seedValue); return { derribe: GAME_TAKEDOWNS[seed % GAME_TAKEDOWNS.length], sumision: GAME_SUBMISSIONS[(seed >>> 4) % GAME_SUBMISSIONS.length] }; }

export function getGameWeekKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  const local = new Date(
    Date.UTC(Number(value("year")), Number(value("month")) - 1, Number(value("day"))),
  );
  const day = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() - day + 1);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

export function gameChallengeId(tournamentId: string, challengerId: string, challengedId: string) {
  const safe = (value: string) => value.replaceAll("/", "_").slice(0, 160);
  return `${safe(tournamentId)}--${safe(challengerId)}--${safe(challengedId)}`;
}

export function createGameChallenge(tournamentId: string, sede: string, challenger: GameParticipant, challenged: GameParticipant, now = new Date()): GamePvpChallenge {
  if (!tournamentId || !sede || !challenger.id || !challenged.id || challenger.id === challenged.id) throw new Error("El desafío PvP no tiene participantes válidos.");
  return {
    id: gameChallengeId(tournamentId, challenger.id, challenged.id), tournamentId, weekKey: getGameWeekKey(now), sede,
    challengerId: challenger.id, challengerName: challenger.nombre.slice(0, 120), challengedId: challenged.id, challengedName: challenged.nombre.slice(0, 120),
    status: "pendiente", createdAtMs: now.getTime(),
  };
}

type Candidate = { a: GameParticipant; b: GameParticipant; score: number; mutual: boolean; requested: boolean; acceptedChallengeIds: string[] };

function scheduleCandidates(candidates: Candidate[], areas: number) {
  const pending = [...candidates].sort((left, right) => right.score - left.score);
  const matches: GameMatch[] = [];
  const maxAreas = Math.max(1, Math.min(12, Math.floor(areas || 1)));
  let round = 1;
  while (pending.length > 0) {
    const used = new Set<string>(); const scheduledIndexes: number[] = []; let area = 1;
    for (let index = 0; index < pending.length; index += 1) {
      const edge = pending[index];
      if (area > maxAreas || used.has(edge.a.id) || used.has(edge.b.id)) continue;
      const seed = hash(`${round}:${edge.a.id}:${edge.b.id}`);
      matches.push({ id: `${round}-${area}-${seed}`, round, area, a: edge.a, b: edge.b, solicitada: edge.requested, solicitudMutua: edge.mutual, acceptedChallengeIds: edge.acceptedChallengeIds, ...technicalChallenge(`${round}:${edge.a.id}:${edge.b.id}:public`), estado: "pendiente" });
      used.add(edge.a.id); used.add(edge.b.id); scheduledIndexes.push(index); area += 1;
    }
    if (scheduledIndexes.length === 0) break;
    for (let index = scheduledIndexes.length - 1; index >= 0; index -= 1) pending.splice(scheduledIndexes[index], 1);
    round += 1;
  }
  return matches;
}

export function buildGameSchedule(participants: GameParticipant[], preferences: GamePreference[], areas: number, challengeEnabled: boolean): GameMatch[] {
  void challengeEnabled;
  const unique = [...new Map(participants.map((item) => [item.id, item])).values()];
  if (unique.length < 2) return [];
  const wishes = new Map(preferences.map((item) => [item.participantId, new Set(item.objetivos)])); const candidates: Candidate[] = [];
  for (let i = 0; i < unique.length; i += 1) for (let j = i + 1; j < unique.length; j += 1) {
    const a = unique[i]; const b = unique[j]; const ab = wishes.get(a.id)?.has(b.id) === true; const ba = wishes.get(b.id)?.has(a.id) === true;
    if (!ab && !ba) continue;
    candidates.push({ a, b, mutual: ab && ba, requested: true, acceptedChallengeIds: [], score: (ab && ba ? 200 : 100) + (hash(pairKey(a.id, b.id)) % 1000) / 1000 });
  }
  return scheduleCandidates(candidates, areas);
}

export function buildPvpGameSchedule(participants: GameParticipant[], challenges: GamePvpChallenge[], areas: number): GameMatch[] {
  const unique = [...new Map(participants.map((item) => [item.id, item])).values()]; const people = new Map(unique.map((item) => [item.id, item]));
  const byPair = new Map<string, GamePvpChallenge[]>();
  challenges.filter((item) => item.status === "aceptado" && people.has(item.challengerId) && people.has(item.challengedId)).forEach((item) => { const key = pairKey(item.challengerId, item.challengedId); byPair.set(key, [...(byPair.get(key) || []), item]); });
  const candidates: Candidate[] = [];
  for (const pair of byPair.values()) {
    const first = pair[0]; const a = people.get(first.challengerId); const b = people.get(first.challengedId); if (!a || !b) continue;
    const mutual = new Set(pair.map((item) => `${item.challengerId}->${item.challengedId}`)).size > 1;
    candidates.push({ a, b, mutual, requested: true, acceptedChallengeIds: pair.map((item) => item.id), score: (mutual ? 200 : 100) + (hash(pairKey(a.id, b.id)) % 1000) / 1000 });
  }
  return scheduleCandidates(candidates, areas);
}

export function buildPrivateGameCards(schedule: GameMatch[], participants: GameParticipant[], enabled: boolean): GamePrivateCard[] {
  return participants.map((participant) => {
    const retos: Record<string, GameCardChallenge> = {};
    if (enabled) for (const match of schedule) if (match.a.id === participant.id || match.b.id === participant.id) retos[match.id] = technicalChallenge(`${match.id}:${participant.id}:private`);
    return { participantId: participant.id, retos };
  });
}

export function calculatePvpStandings(participants: GameParticipant[], challenges: GamePvpChallenge[], schedules: GameMatch[][]): GameStanding[] {
  const people = new Map<string, GameParticipant>(); participants.forEach((item) => people.set(item.id, item));
  challenges.forEach((item) => { if (!people.has(item.challengerId)) people.set(item.challengerId, { id: item.challengerId, nombre: item.challengerName }); if (!people.has(item.challengedId)) people.set(item.challengedId, { id: item.challengedId, nombre: item.challengedName }); });
  const matches = new Map<string, GameMatch>(); schedules.flat().forEach((match) => matches.set(match.id, match));
  return [...people.values()].map((participant) => {
    const sent = challenges.filter((item) => item.challengerId === participant.id).length;
    const accepted = challenges.filter((item) => item.challengedId === participant.id && item.status === "aceptado").length;
    const declined = challenges.filter((item) => item.challengedId === participant.id && item.status === "rechazado").length;
    const completed = [...matches.values()].filter((match) => match.estado === "completado" && (match.a.id === participant.id || match.b.id === participant.id));
    const wins = completed.filter((match) => match.winnerId === participant.id).length; const fights = completed.length;
    const points = sent * GAME_POINTS.challengeSent + accepted * GAME_POINTS.challengeAccepted + declined * GAME_POINTS.challengeDeclined + fights * GAME_POINTS.fightCompleted + wins * GAME_POINTS.victory;
    return { ...participant, sent, accepted, declined, wins, fights, points };
  }).sort((a, b) => b.points - a.points || b.wins - a.wins || b.accepted - a.accepted || b.sent - a.sent || a.nombre.localeCompare(b.nombre, "es"));
}

export function calculateGameStandings(participants: GameParticipant[], schedule: GameMatch[]): GameStanding[] { return calculatePvpStandings(participants, [], [schedule]); }

export function buildWeeklyGameLeaderboards(participants: GameParticipant[], challenges: GamePvpChallenge[], schedules: GameMatch[][], weekKey = getGameWeekKey()): GameLeaderboards {
  const standings = calculatePvpStandings(participants, challenges.filter((item) => item.weekKey === weekKey), schedules);
  const active = standings.filter((item) => item.sent + item.accepted + item.declined + item.fights > 0);
  return {
    weekKey,
    challengers: [...active].sort((a, b) => b.sent - a.sent || b.points - a.points || a.nombre.localeCompare(b.nombre, "es")),
    bravest: [...active].sort((a, b) => b.accepted - a.accepted || a.declined - b.declined || b.points - a.points || a.nombre.localeCompare(b.nombre, "es")),
    victorious: [...active].sort((a, b) => b.wins - a.wins || b.fights - a.fights || b.points - a.points || a.nombre.localeCompare(b.nombre, "es")),
    mvp: [...active].sort((a, b) => b.points - a.points || b.wins - a.wins || b.accepted - a.accepted || b.sent - a.sent || a.nombre.localeCompare(b.nombre, "es")),
  };
}

export function getMaxGameRound(schedule: GameMatch[]) { return schedule.reduce((maximum, match) => Math.max(maximum, match.round), 0); }
export function gameTimestampMillis(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return Number((value as { toMillis: () => number }).toMillis()) || 0;
  }
  return 0;
}
export function startGameRound(schedule: GameMatch[], round: number): GameMatch[] { return schedule.map((match) => ({ ...match, estado: match.round < round ? "completado" : match.round === round ? "en_curso" : "pendiente" })); }
export function completeGameRound(schedule: GameMatch[], round: number): GameMatch[] { return schedule.map((match) => match.round === round ? { ...match, estado: "completado" } : match); }
export function isGameScheduleComplete(schedule: GameMatch[]) { return schedule.length > 0 && schedule.every((match) => match.estado === "completado"); }
export function finalizeGameSchedule(schedule: GameMatch[]): GameMatch[] { return schedule.map((match) => ({ ...match })); }
