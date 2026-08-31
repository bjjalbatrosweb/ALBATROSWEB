import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAthletePhotoUrl } from "../src/lib/athlete-photo";

test("convierte un enlace compartido de Google Drive en miniatura directa", () => {
  assert.equal(
    normalizeAthletePhotoUrl("https://drive.google.com/file/d/ABC_123/view?usp=sharing"),
    "https://drive.google.com/thumbnail?id=ABC_123&sz=w1000",
  );
  assert.equal(
    normalizeAthletePhotoUrl("https://drive.google.com/open?id=FOTO99"),
    "https://drive.google.com/thumbnail?id=FOTO99&sz=w1000",
  );
});

test("prepara Dropbox para entregar el archivo y limpia espacios", () => {
  assert.equal(
    normalizeAthletePhotoUrl(" https://www.dropbox.com/s/a1/foto.jpg?dl=0 "),
    "https://www.dropbox.com/s/a1/foto.jpg?raw=1",
  );
});

test("conserva direcciones directas y rechaza valores que no son texto", () => {
  assert.equal(
    normalizeAthletePhotoUrl("https://firebasestorage.googleapis.com/foto.jpg"),
    "https://firebasestorage.googleapis.com/foto.jpg",
  );
  assert.equal(normalizeAthletePhotoUrl(null), "");
});
