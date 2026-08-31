import assert from "node:assert/strict";
import test from "node:test";

import {
  athleteBadgeCount,
  getPrimaryAthleteBadge,
  isAthleteBadgeId,
  normalizeAthleteBadgeIds,
} from "../src/lib/athlete-badges";

test("normaliza insignias válidas, elimina duplicados y conserva el orden del catálogo", () => {
  assert.deepEqual(
    normalizeAthleteBadgeIds(["oro", "bronce", "oro", "desconocida"]),
    ["bronce", "oro"],
  );
});

test("elige como insignia principal el nivel más alto asignado", () => {
  assert.equal(getPrimaryAthleteBadge(["bronce", "oro"])?.id, "oro");
  assert.equal(getPrimaryAthleteBadge(["bronce", "plata"])?.id, "plata");
  assert.equal(getPrimaryAthleteBadge([]), null);
});

test("acepta registros antiguos con una propiedad id", () => {
  assert.deepEqual(
    normalizeAthleteBadgeIds([{ id: "plata" }, { id: "oro" }, null]),
    ["plata", "oro"],
  );
});

test("rechaza formatos inválidos y cuenta solo insignias conocidas", () => {
  assert.deepEqual(normalizeAthleteBadgeIds("oro"), []);
  assert.equal(athleteBadgeCount(["plata", "plata", "otra"]), 1);
  assert.equal(isAthleteBadgeId("bronce"), true);
  assert.equal(isAthleteBadgeId("diamante"), false);
});
