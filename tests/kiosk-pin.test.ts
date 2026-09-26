import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidKioskPin,
  kioskPinDigest,
  normalizeKioskPin,
} from "../src/lib/kiosk-pin";

test("el PIN de kiosco exige exactamente cuatro dígitos", () => {
  assert.equal(isValidKioskPin("1234"), true);
  assert.equal(isValidKioskPin("0123"), true);
  assert.equal(isValidKioskPin("123"), false);
  assert.equal(isValidKioskPin("12345"), false);
  assert.equal(isValidKioskPin("12a4"), false);
});

test("normaliza espacios sin aceptar otros tipos", () => {
  assert.equal(normalizeKioskPin(" 0427 "), "0427");
  assert.equal(normalizeKioskPin(427), "");
  assert.equal(normalizeKioskPin(null), "");
});

test("el índice del PIN es determinista y no contiene el PIN visible", () => {
  const first = kioskPinDigest("7391");
  const second = kioskPinDigest("7391");
  assert.equal(first, second);
  assert.equal(first.length, 64);
  assert.equal(first.includes("7391"), false);
  assert.notEqual(first, kioskPinDigest("7392"));
});
