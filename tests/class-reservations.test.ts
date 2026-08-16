import assert from "node:assert/strict";
import test from "node:test";
import { availablePlaces, canReserve, normalizeCapacity } from "../src/lib/class-reservations.ts";

test("valida cupos y nunca devuelve lugares negativos", () => {
  assert.equal(normalizeCapacity("20"), 20);
  assert.equal(availablePlaces(20, 25), 0);
  assert.throws(() => normalizeCapacity(0));
});

test("solo permite reservar clases publicadas, futuras y con cupo", () => {
  const now = new Date("2026-08-16T12:00:00Z");
  assert.equal(canReserve({ status: "publicada", capacity: 20, reserved: 19, startsAt: new Date("2026-08-16T13:00:00Z") }, now).allowed, true);
  assert.equal(canReserve({ status: "cerrada", capacity: 20, reserved: 0, startsAt: new Date("2026-08-16T13:00:00Z") }, now).allowed, false);
  assert.equal(canReserve({ status: "publicada", capacity: 20, reserved: 20, startsAt: new Date("2026-08-16T13:00:00Z") }, now).allowed, false);
});
