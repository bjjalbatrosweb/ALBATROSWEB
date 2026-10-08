export type ChessPlayerIndex = 0 | 1;
export type ChessPosition = "neutral" | "clinch" | "guard" | "half_guard" | "side_control" | "mount" | "back" | "turtle";
export type ChessMoveCategory = "entrada" | "avance" | "control" | "defensa" | "sumision";

export type GrapplingChessMove = {
  id: string;
  label: string;
  category: ChessMoveCategory;
  detail: string;
};

export type GrapplingChessHistory = {
  moveId: string;
  label: string;
  player: ChessPlayerIndex;
  position: ChessPosition;
  at: number;
};

export type GrapplingChessState = {
  players: [string, string];
  turn: ChessPlayerIndex;
  position: ChessPosition;
  top: ChessPlayerIndex | null;
  controller: ChessPlayerIndex | null;
  control: number;
  winner: ChessPlayerIndex | null;
  revision: number;
  history: GrapplingChessHistory[];
};

export const POSITION_LABELS: Record<ChessPosition, string> = {
  neutral: "De pie · posición neutral",
  clinch: "Clinch / agarres",
  guard: "Guardia",
  half_guard: "Media guardia",
  side_control: "Control lateral",
  mount: "Montada",
  back: "Control de espalda",
  turtle: "Tortuga",
};

const MOVES: Record<string, GrapplingChessMove> = {
  derribo: { id: "derribo", label: "Derribo", category: "entrada", detail: "Lleva el combate al suelo y cae dentro de la guardia." },
  clinch: { id: "clinch", label: "Entrar al clinch", category: "entrada", detail: "Consigue agarres antes de atacar el derribo." },
  pull_guard: { id: "pull_guard", label: "Jalar guardia", category: "entrada", detail: "Lleva al rival a tu guardia y comienza a atacar desde abajo." },
  snapdown: { id: "snapdown", label: "Snapdown", category: "entrada", detail: "Rompe postura y obliga al rival a ir a tortuga." },
  takedown_clinch: { id: "takedown_clinch", label: "Derribo desde clinch", category: "entrada", detail: "Finaliza el agarre y cae con ventaja." },
  disengage: { id: "disengage", label: "Romper agarres", category: "defensa", detail: "Regresa a posición neutral." },
  pass_guard: { id: "pass_guard", label: "Pase de guardia", category: "avance", detail: "Supera las piernas y llega a control lateral." },
  force_half: { id: "force_half", label: "Forzar media guardia", category: "avance", detail: "Atrapa una pierna y comienza a liberar la rodilla." },
  sweep: { id: "sweep", label: "Raspado", category: "defensa", detail: "Invierte la posición y queda arriba." },
  stand_up: { id: "stand_up", label: "Levantarse", category: "defensa", detail: "Crea distancia y vuelve de pie." },
  guard_attack: { id: "guard_attack", label: "Ataque desde guardia", category: "control", detail: "Rompe postura y toma la iniciativa desde abajo." },
  half_pass: { id: "half_pass", label: "Pasar media guardia", category: "avance", detail: "Libera la pierna y consolida control lateral." },
  underhook_sweep: { id: "underhook_sweep", label: "Raspado con underhook", category: "defensa", detail: "Gana la batalla del brazo y queda arriba." },
  recover_guard: { id: "recover_guard", label: "Recuperar guardia", category: "defensa", detail: "Inserta rodilla y recupera las piernas." },
  stabilize: { id: "stabilize", label: "Estabilizar posición", category: "control", detail: "Elimina espacio y cierra una salida." },
  mount: { id: "mount", label: "Avanzar a montada", category: "avance", detail: "Aísla la cadera y sube a montada." },
  knee_on_belly: { id: "knee_on_belly", label: "Rodilla al abdomen", category: "control", detail: "Obliga una reacción y aumenta el control." },
  elbow_escape: { id: "elbow_escape", label: "Escape de codo", category: "defensa", detail: "Recupera media guardia desde montada." },
  bridge_escape: { id: "bridge_escape", label: "Puente y giro", category: "defensa", detail: "Desequilibra y regresa a guardia." },
  give_back: { id: "give_back", label: "Girar y dar espalda", category: "defensa", detail: "Evita la montada, pero concede la espalda." },
  take_back: { id: "take_back", label: "Tomar la espalda", category: "avance", detail: "Coloca ganchos y cinturón de seguridad." },
  hand_fight: { id: "hand_fight", label: "Pelear las manos", category: "defensa", detail: "Rompe el agarre principal y abre una salida." },
  turn_in: { id: "turn_in", label: "Girar hacia el rival", category: "defensa", detail: "Quita los ganchos y regresa a guardia." },
  turtle_escape: { id: "turtle_escape", label: "Escape de tortuga", category: "defensa", detail: "Crea espacio y vuelve de pie." },
  breakdown: { id: "breakdown", label: "Romper la tortuga", category: "avance", detail: "Derrumba la base y llega a control lateral." },
  defense_stopped: { id: "defense_stopped", label: "Defensa neutralizada", category: "control", detail: "La salida fue contenida; el control se hace más sólido." },
  armbar: { id: "armbar", label: "Armbar / juji-gatame", category: "sumision", detail: "Brazo aislado y cadera cerrada: finalización sin salida." },
  kata_gatame: { id: "kata_gatame", label: "Kata gatame", category: "sumision", detail: "Brazo y cuello aislados desde control dominante." },
  rear_naked: { id: "rear_naked", label: "Mataleón", category: "sumision", detail: "Cuello expuesto, manos ganadas y espalda asegurada." },
  triangle: { id: "triangle", label: "Triángulo", category: "sumision", detail: "Postura rota, brazo cruzado y ángulo cerrado." },
};

export function createGrapplingChessState(playerOne = "Jugador rojo", playerTwo = "Jugador azul"): GrapplingChessState {
  return { players: [playerOne.trim() || "Jugador rojo", playerTwo.trim() || "Jugador azul"], turn: 0, position: "neutral", top: null, controller: null, control: 0, winner: null, revision: 0, history: [] };
}

function moveList(ids: string[]) { return ids.map((id) => MOVES[id]).filter(Boolean); }
function other(player: ChessPlayerIndex): ChessPlayerIndex { return player === 0 ? 1 : 0; }
function isController(state: GrapplingChessState) { return state.controller === state.turn; }

export function legalGrapplingChessMoves(state: GrapplingChessState): GrapplingChessMove[] {
  if (state.winner !== null) return [];
  if (state.position === "neutral") return moveList(["derribo", "clinch", "pull_guard"]);
  if (state.position === "clinch") return moveList(["takedown_clinch", "snapdown", "disengage"]);
  if (state.position === "guard") {
    if (state.top === state.turn) return moveList(["pass_guard", "force_half", "stabilize"]);
    return moveList(["sweep", "stand_up", "guard_attack", "defense_stopped", ...(isController(state) && state.control >= 3 ? ["triangle"] : [])]);
  }
  if (state.position === "half_guard") {
    if (isController(state)) return moveList(["half_pass", "stabilize"]);
    return moveList(["underhook_sweep", "recover_guard", "defense_stopped"]);
  }
  if (state.position === "side_control") {
    if (isController(state)) return moveList(["mount", "take_back", "knee_on_belly", "stabilize", ...(state.control >= 3 ? ["kata_gatame"] : [])]);
    return moveList(["recover_guard", "turtle_escape", "defense_stopped"]);
  }
  if (state.position === "mount") {
    if (isController(state)) return moveList(["stabilize", "take_back", ...(state.control >= 3 ? ["armbar", "kata_gatame"] : [])]);
    return moveList(["elbow_escape", "bridge_escape", "give_back", "defense_stopped"]);
  }
  if (state.position === "back") {
    if (isController(state)) return moveList(["stabilize", ...(state.control >= 3 ? ["rear_naked"] : [])]);
    return moveList(["hand_fight", "turn_in", "defense_stopped"]);
  }
  if (state.position === "turtle") {
    if (isController(state)) return moveList(["take_back", "breakdown", "stabilize"]);
    return moveList(["turtle_escape", "recover_guard", "defense_stopped"]);
  }
  return [];
}

export function applyGrapplingChessMove(state: GrapplingChessState, moveId: string, at = Date.now()): GrapplingChessState {
  const legal = legalGrapplingChessMoves(state); const move = legal.find((item) => item.id === moveId);
  if (!move) throw new Error("Movimiento no disponible en esta posición.");
  const actor = state.turn; const opponent = other(actor); let next: GrapplingChessState = { ...state, revision: state.revision + 1, history: [...state.history, { moveId, label: move.label, player: actor, position: state.position, at }].slice(-24) };
  const controlBy = (player: ChessPlayerIndex, position: ChessPosition, control: number) => { next = { ...next, controller: player, top: player, position, control: Math.max(0, Math.min(3, control)), turn: other(actor) }; };
  const neutral = () => { next = { ...next, position: "neutral", top: null, controller: null, control: 0, turn: opponent }; };
  if (["armbar", "kata_gatame", "rear_naked", "triangle"].includes(moveId)) return { ...next, winner: actor, control: 3 };
  if (moveId === "derribo") controlBy(actor, "guard", 1);
  else if (moveId === "clinch") controlBy(actor, "clinch", 1);
  else if (moveId === "pull_guard") next = { ...next, position: "guard", top: opponent, controller: actor, control: 1, turn: opponent };
  else if (moveId === "takedown_clinch") controlBy(actor, "guard", 1);
  else if (moveId === "snapdown") controlBy(actor, "turtle", 1);
  else if (moveId === "disengage" || moveId === "stand_up" || moveId === "turtle_escape") neutral();
  else if (moveId === "pass_guard" || moveId === "half_pass" || moveId === "breakdown") controlBy(actor, "side_control", Math.max(2, state.control));
  else if (moveId === "force_half") controlBy(actor, "half_guard", Math.max(1, state.control));
  else if (moveId === "sweep" || moveId === "underhook_sweep") controlBy(actor, "guard", 1);
  else if (moveId === "guard_attack") next = { ...next, position: "guard", top: state.top, controller: actor, control: 2, turn: opponent };
  else if (moveId === "recover_guard") next = { ...next, position: "guard", top: opponent, controller: opponent, control: 1, turn: opponent };
  else if (moveId === "bridge_escape" || moveId === "turn_in") controlBy(actor, "guard", 1);
  else if (moveId === "mount") controlBy(actor, "mount", Math.max(2, state.control));
  else if (moveId === "take_back" || moveId === "give_back") controlBy(moveId === "give_back" ? opponent : actor, "back", Math.max(2, state.control));
  else if (moveId === "elbow_escape") controlBy(actor, "half_guard", 1);
  else if (moveId === "hand_fight") controlBy(opponent, "back", Math.max(1, state.control - 1));
  else if (moveId === "knee_on_belly" || moveId === "stabilize") controlBy(actor, state.position, state.control + 1);
  else if (moveId === "defense_stopped") controlBy(opponent, state.position, state.control + 1);
  return next;
}

export function rouletteGrapplingChessMove(state: GrapplingChessState, random = Math.random): GrapplingChessMove | null {
  const moves = legalGrapplingChessMoves(state); if (!moves.length) return null;
  return moves[Math.min(moves.length - 1, Math.floor(random() * moves.length))];
}
