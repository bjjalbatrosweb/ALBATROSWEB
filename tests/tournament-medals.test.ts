import assert from "node:assert/strict";
import test from "node:test";

import {
  getAssignedTournamentMedals,
  normalizeTournamentMedalIds,
  TOURNAMENT_MEDALS,
  tournamentMedalCount,
} from "../src/lib/tournament-medals";

test("el catálogo conserva las medallas originales y el paquete dorado", () => {
  assert.equal(TOURNAMENT_MEDALS.length, 10);
  assert.deepEqual(
    TOURNAMENT_MEDALS.map((medal) => medal.id),
    [
      "federacion-jiu-jitsu",
      "universidad-autonoma-yucatan",
      "adcc-open-mexico",
      "open-no-gi-redonda",
      "open-no-gi-geometrica",
      "famm",
      "ajp-tour",
      "wbc-world-champion",
      "wsl-rojo-negro",
      "on-coespe-2020",
    ],
  );
});

test("normaliza medallas, elimina duplicados y rechaza identificadores inventados", () => {
  assert.deepEqual(
    normalizeTournamentMedalIds([
      "universidad-autonoma-yucatan",
      "inventada",
      "federacion-jiu-jitsu",
      "federacion-jiu-jitsu",
    ]),
    ["federacion-jiu-jitsu", "universidad-autonoma-yucatan"],
  );
});

test("acepta el formato legado con id y resuelve solo las medallas asignadas", () => {
  const assigned = getAssignedTournamentMedals([{ id: "federacion-jiu-jitsu" }]);
  assert.equal(assigned.length, 1);
  assert.equal(assigned[0].nombreCorto, "Federación de Jiu Jitsu");
  assert.equal(tournamentMedalCount([{ id: "federacion-jiu-jitsu" }]), 1);
});
