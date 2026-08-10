export type TeamMode = "equilibrado" | "aleatorio";

export type TeamAthlete = {
  id: string;
  nombre: string;
  fotoUrl: string;
  disciplina: string;
  grado: string;
  peso: number | null;
};

export type TrainingTeam = {
  id: string;
  nombre: string;
  color: TeamColor;
  athleteIds: string[];
  estacion: string;
};

export type TeamColor = "rojo" | "azul" | "verde" | "amarillo" | "violeta" | "naranja";

export type TeamBoard = {
  id: string;
  titulo: string;
  mode: TeamMode;
  atletas: TeamAthlete[];
  equipos: TrainingTeam[];
  estaciones: string[];
  rotation: number;
  roundSeconds: number;
  creadoEn: string;
};

export const TEAM_COLOR_LABELS: Record<TeamColor, string> = {
  rojo: "Rojo",
  azul: "Azul",
  verde: "Verde",
  amarillo: "Amarillo",
  violeta: "Violeta",
  naranja: "Naranja",
};

export const DEFAULT_STATIONS = [
  "Técnica",
  "Sparring",
  "Acondicionamiento",
  "Movilidad",
  "Reacción",
  "Descanso activo",
];

const COLORS: TeamColor[] = ["rojo", "azul", "verde", "amarillo", "violeta", "naranja"];

export function gradeScore(grade: string) {
  const value = grade.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const levels: Array<[string[], number]> = [
    [["negro", "negra", "black"], 8],
    [["marron", "cafe", "brown"], 7],
    [["morado", "morada", "purple"], 6],
    [["azul", "blue"], 5],
    [["verde", "green"], 4],
    [["naranja", "orange"], 3],
    [["amarillo", "amarilla", "yellow"], 2],
    [["blanco", "blanca", "white"], 1],
  ];
  return levels.find(([names]) => names.some((name) => value.includes(name)))?.[1] || 3;
}

export function athleteStrength(athlete: TeamAthlete) {
  const weightFactor = athlete.peso ? Math.min(12, Math.max(0, athlete.peso / 10)) : 6;
  return gradeScore(athlete.grado) * 10 + weightFactor;
}

export function shuffleTeamAthletes(athletes: TeamAthlete[], random = Math.random) {
  const shuffled = [...athletes];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function createTeamBoard(input: {
  title: string;
  athletes: TeamAthlete[];
  teamCount: number;
  mode: TeamMode;
  stations: string[];
  roundMinutes: number;
  random?: () => number;
}): TeamBoard {
  const teamCount = Math.max(2, Math.min(6, Math.round(input.teamCount)));
  if (input.athletes.length < teamCount) throw new Error("Selecciona al menos un atleta por equipo.");
  const stations = input.stations.map((station) => station.trim()).filter(Boolean).slice(0, 6);
  while (stations.length < teamCount) stations.push(`Estación ${stations.length + 1}`);
  const teams: TrainingTeam[] = Array.from({ length: teamCount }, (_, index) => ({
    id: `team-${index}`,
    nombre: `Equipo ${TEAM_COLOR_LABELS[COLORS[index]]}`,
    color: COLORS[index],
    athleteIds: [],
    estacion: stations[index],
  }));
  const random = input.random || Math.random;
  const ordered = input.mode === "aleatorio"
    ? shuffleTeamAthletes(input.athletes, random)
    : shuffleTeamAthletes(input.athletes, random).sort((a, b) => athleteStrength(b) - athleteStrength(a));
  const strengthByTeam = Array.from({ length: teamCount }, () => 0);

  ordered.forEach((athlete, index) => {
    let target = index % teamCount;
    if (input.mode === "equilibrado") {
      const minimumSize = Math.min(...teams.map((team) => team.athleteIds.length));
      target = teams
        .map((team, teamIndex) => ({ teamIndex, size: team.athleteIds.length, strength: strengthByTeam[teamIndex] }))
        .filter((team) => team.size === minimumSize)
        .sort((a, b) => a.strength - b.strength)[0].teamIndex;
    }
    teams[target].athleteIds.push(athlete.id);
    strengthByTeam[target] += athleteStrength(athlete);
  });

  return {
    id: `teams-${Date.now()}`,
    titulo: input.title.trim() || "Actividad por equipos",
    mode: input.mode,
    atletas: input.athletes,
    equipos: teams,
    estaciones: stations,
    rotation: 0,
    roundSeconds: Math.max(30, Math.min(3600, Math.round(input.roundMinutes * 60))),
    creadoEn: new Date().toISOString(),
  };
}

export function rotateTeamStations(board: TeamBoard, direction: -1 | 1 = 1) {
  const count = board.equipos.length;
  const rotation = (board.rotation + direction + count) % count;
  return {
    ...board,
    rotation,
    equipos: board.equipos.map((team, index) => ({
      ...team,
      estacion: board.estaciones[(index + rotation) % count] || `Estación ${index + 1}`,
    })),
  };
}

export function teamStrengths(board: TeamBoard) {
  const athletes = new Map(board.atletas.map((athlete) => [athlete.id, athlete]));
  return board.equipos.map((team) =>
    Number(team.athleteIds.reduce((total, id) => total + athleteStrength(athletes.get(id) || { id, nombre: "", fotoUrl: "", disciplina: "", grado: "", peso: null }), 0).toFixed(1)),
  );
}

export function teamBalanceSpread(board: TeamBoard) {
  const strengths = teamStrengths(board);
  return strengths.length ? Number((Math.max(...strengths) - Math.min(...strengths)).toFixed(1)) : 0;
}

export function formatRoundTime(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

