export type GameParticipant = { id: string; nombre: string; invitado?: boolean };
export type GamePreference = { participantId: string; objetivos: string[]; nota?: string };
export type GameMatch = { id: string; round: number; area: number; a: GameParticipant; b: GameParticipant; solicitada: boolean; solicitudMutua: boolean; sumision?: string; derribe?: string; estado?: "pendiente" | "en_curso" | "completado"; winnerId?: string };

export const GAME_SUBMISSIONS = ["Armbar", "Triángulo", "Mataleón", "Kimura", "Guillotina", "Americana", "Estrangulación de solapa"];
export const GAME_TAKEDOWNS = ["Harai goshi", "Uchi mata", "O-soto-gari", "Tani otoshi", "Ippon seoi nage", "Ashi barai", "Kata guruma"];

function hash(value: string) { return [...value].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 7); }
function pairKey(a: string, b: string) { return [a, b].sort().join("::"); }

export function buildGameSchedule(participants: GameParticipant[], preferences: GamePreference[], areas: number, challengeEnabled: boolean): GameMatch[] {
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
      matches.push({ id: `${round}-${area}-${seed}`, round, area, a: edge.a, b: edge.b, solicitada: edge.requested, solicitudMutua: edge.mutual, estado: "pendiente", ...(challengeEnabled ? { sumision: GAME_SUBMISSIONS[seed % GAME_SUBMISSIONS.length], derribe: GAME_TAKEDOWNS[(seed >>> 3) % GAME_TAKEDOWNS.length] } : {}) });
      used.add(edge.a.id); used.add(edge.b.id); scheduledIndexes.push(index); area += 1;
    }
    if (scheduledIndexes.length === 0) break;
    for (let index = scheduledIndexes.length - 1; index >= 0; index -= 1) pending.splice(scheduledIndexes[index], 1);
    round += 1;
  }
  return matches;
}
