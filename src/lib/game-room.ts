export type GameParticipant = { id: string; nombre: string; invitado?: boolean };
export type GamePreference = { participantId: string; objetivos: string[]; nota?: string };
export type GameMatch = { id: string; round: number; area: number; a: GameParticipant; b: GameParticipant; solicitada: boolean; solicitudMutua: boolean; sumision?: string; derribe?: string };

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
    candidates.push({ a, b, mutual: ab && ba, requested: ab || ba, score: (ab && ba ? 200 : ab || ba ? 100 : 0) + tie });
  }
  candidates.sort((left, right) => right.score - left.score);
  const matches: GameMatch[] = []; const usedPairs = new Set<string>(); const appearances = new Map(unique.map((p) => [p.id, 0]));
  const maxAreas = Math.max(1, Math.min(12, Math.floor(areas || 1)));
  const targetRounds = Math.max(1, Math.ceil(unique.length / 2));
  for (let round = 1; round <= targetRounds; round += 1) {
    const used = new Set<string>(); let area = 1;
    const ordered = [...candidates].sort((x, y) => {
      const repeatX = usedPairs.has(pairKey(x.a.id, x.b.id)) ? 1000 : 0; const repeatY = usedPairs.has(pairKey(y.a.id, y.b.id)) ? 1000 : 0;
      const loadX = (appearances.get(x.a.id) || 0) + (appearances.get(x.b.id) || 0); const loadY = (appearances.get(y.a.id) || 0) + (appearances.get(y.b.id) || 0);
      return (y.score - repeatY - loadY * 4) - (x.score - repeatX - loadX * 4);
    });
    for (const edge of ordered) {
      if (area > maxAreas || used.has(edge.a.id) || used.has(edge.b.id) || usedPairs.has(pairKey(edge.a.id, edge.b.id))) continue;
      const seed = hash(`${round}:${edge.a.id}:${edge.b.id}`);
      matches.push({ id: `${round}-${area}-${seed}`, round, area, a: edge.a, b: edge.b, solicitada: edge.requested, solicitudMutua: edge.mutual, ...(challengeEnabled ? { sumision: GAME_SUBMISSIONS[seed % GAME_SUBMISSIONS.length], derribe: GAME_TAKEDOWNS[(seed >>> 3) % GAME_TAKEDOWNS.length] } : {}) });
      used.add(edge.a.id); used.add(edge.b.id); usedPairs.add(pairKey(edge.a.id, edge.b.id)); area += 1;
      appearances.set(edge.a.id, (appearances.get(edge.a.id) || 0) + 1); appearances.set(edge.b.id, (appearances.get(edge.b.id) || 0) + 1);
    }
  }
  return matches;
}
