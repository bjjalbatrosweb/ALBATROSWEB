import assert from "node:assert/strict";
import test from "node:test";

import { isPublicAppRoute } from "../src/lib/public-app-routes";

test("el foro y sus rutas hijas son publicos", () => {
  assert.equal(isPublicAppRoute("/foro"), true);
  assert.equal(isPublicAppRoute("/foro/derribes"), true);
});

test("las rutas privadas y nombres parecidos siguen protegidos", () => {
  assert.equal(isPublicAppRoute("/dashboard"), false);
  assert.equal(isPublicAppRoute("/estado-fisico"), false);
  assert.equal(isPublicAppRoute("/foro-interno"), false);
  assert.equal(isPublicAppRoute(null), false);
});
