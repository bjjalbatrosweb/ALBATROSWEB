import assert from "node:assert/strict";
import test from "node:test";

import {
  athletePersonalProfileError,
  normalizeAthletePersonalProfile,
  parseAthletePersonalProfile,
} from "../src/lib/athlete-personal-profile";

test("el perfil personal reutiliza la última evaluación sin inventar datos", () => {
  const profile = normalizeAthletePersonalProfile(
    {},
    {
      gender: "femenino",
      weightKg: 62.5,
      heightCm: 168,
      age: 22,
    },
  );

  assert.deepEqual(profile, {
    gender: "female",
    weightKg: 62.5,
    heightCm: 168,
    age: 22,
    activityLevel: 1.55,
    goal: "maintain",
  });
  assert.equal(normalizeAthletePersonalProfile({}).weightKg, 0);
  assert.equal(normalizeAthletePersonalProfile({}).heightCm, 0);
  assert.equal(normalizeAthletePersonalProfile({}).age, 0);
});

test("las preferencias guardadas prevalecen sobre el expediente oficial", () => {
  const profile = normalizeAthletePersonalProfile(
    {
      gender: "male",
      weightKg: 80,
      heightCm: 180,
      age: 30,
      activityLevel: 1.725,
      goal: "gain",
    },
    { gender: "mujer", weightKg: 60, heightCm: 160, age: 20 },
  );

  assert.equal(profile.gender, "male");
  assert.equal(profile.weightKg, 80);
  assert.equal(profile.heightCm, 180);
  assert.equal(profile.age, 30);
  assert.equal(profile.activityLevel, 1.725);
  assert.equal(profile.goal, "gain");
});

test("el perfil rechaza valores imposibles antes de escribir", () => {
  const valid = {
    gender: "female",
    weightKg: 55,
    heightCm: 160,
    age: 18,
    activityLevel: 1.55,
    goal: "maintain",
  };

  assert.equal(athletePersonalProfileError(valid), "");
  assert.match(
    athletePersonalProfileError({ ...valid, weightKg: 500 }),
    /peso debe estar entre 15 y 250/i,
  );
  assert.match(
    athletePersonalProfileError({ ...valid, age: 18.5 }),
    /número entero/i,
  );
  assert.match(
    athletePersonalProfileError({ ...valid, activityLevel: 9 }),
    /nivel de actividad válido/i,
  );
  assert.deepEqual(parseAthletePersonalProfile(valid), valid);
});
