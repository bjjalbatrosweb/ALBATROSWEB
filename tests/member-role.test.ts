import assert from "node:assert/strict";
import test from "node:test";

import { isBillableAthlete, isPaymentExempt, normalizeMemberRole } from "../src/lib/member-role";

test("los registros antiguos siguen siendo atletas", () => {
  assert.equal(normalizeMemberRole(undefined), "atleta");
  assert.equal(isBillableAthlete(undefined), true);
});

test("profesor, staff y administración quedan exentos", () => {
  for (const role of ["profesor", "staff", "administracion"]) {
    assert.equal(isPaymentExempt(role), true);
    assert.equal(isBillableAthlete(role), false);
  }
});

test("normaliza etiquetas sin aceptar roles inventados", () => {
  assert.equal(normalizeMemberRole("Administración"), "administracion");
  assert.equal(normalizeMemberRole("otro"), "atleta");
});
