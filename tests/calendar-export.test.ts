import assert from "node:assert/strict";
import test from "node:test";

import { reservationCalendarFile } from "../src/lib/calendar-export";

test("exporta una reserva confirmada con fecha UTC y texto escapado", () => {
  const file = reservationCalendarFile(
    {
      id: "clase_123",
      name: "Guardia, pases; control",
      discipline: "Jiu-Jitsu",
      teacher: "Coach\nAlbatros",
      site: "JUAN_PABLO",
      startsAt: "2026-09-14T23:30:00.000Z",
    },
    new Date("2026-09-14T12:00:00.000Z"),
  );
  assert.equal(file.filename, "clase-albatros-clase_123.ics");
  assert.match(file.content, /DTSTART:20260914T233000Z/);
  assert.match(file.content, /SUMMARY:Jiu-Jitsu · Guardia\\, pases\\; control/);
  assert.match(file.content, /LOCATION:JUAN PABLO/);
  assert.match(file.content, /Coach\\nAlbatros/);
});

test("rechaza identificadores y fechas que no pueden exportarse", () => {
  assert.throws(
    () => reservationCalendarFile({ id: "../invalida", name: "Clase", discipline: "MMA", site: "MMA", startsAt: "2026-09-14T20:00:00Z" }),
    /identificador válido/i,
  );
  assert.throws(
    () => reservationCalendarFile({ id: "valida", name: "Clase", discipline: "MMA", site: "MMA", startsAt: "fecha-inválida" }),
    /fecha.*válida/i,
  );
});

