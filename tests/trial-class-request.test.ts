import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyTrialClassForm,
  prepareTrialClassRequest,
  trialClassTimes,
} from "../src/lib/trial-class-request";

test("prepara una solicitud pública válida y normaliza el teléfono", () => {
  const form = createEmptyTrialClassForm();
  form.nombre = "  Andrea Pérez  ";
  form.telefono = "+52 (999) 123-4567";
  form.horario = trialClassTimes(form.disciplina)[0];

  const result = prepareTrialClassRequest(form, "web");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.nombre, "Andrea Pérez");
    assert.equal(result.data.telefono, "529991234567");
    assert.equal(result.data.origen, "web");
  }
});

test("rechaza nombres, teléfonos y horarios inventados", () => {
  const form = createEmptyTrialClassForm();
  assert.equal(prepareTrialClassRequest(form, "web").ok, false);

  form.nombre = "Axel";
  form.telefono = "9991234567";
  form.horario = "Cualquier hora";
  assert.equal(prepareTrialClassRequest(form, "web").ok, false);
});
