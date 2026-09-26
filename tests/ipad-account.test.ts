import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Mi cuenta usa PIN, muestra un resumen limitado y se borra a los 45 segundos", async () => {
  const [html, javascript, route] = await Promise.all([
    readFile(new URL("../public/ipad/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/ipad/ipad.js", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/api/ipad/mi-cuenta/route.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(html, /id="account-panel"/);
  assert.match(html, /id="account-pin-form"/);
  assert.match(html, /data-account-action="payment"/);
  assert.match(html, /data-account-action="pass"/);
  assert.match(html, /data-account-action="attendance"/);
  assert.match(javascript, /setTimeout\(resetAccount, 45000\)/);
  assert.match(javascript, /account-name[^\n]*Hola, atleta/);
  assert.match(route, /kioskAthleteFromPin/);
  assert.match(route, /Cache-Control/);
  assert.doesNotMatch(route, /telefono|correo|emergencia|notas/i);
});

test("el carrusel espera un minuto de inactividad y después continúa en bucle", async () => {
  const javascript = await readFile(
    new URL("../public/ipad/ipad.js", import.meta.url),
    "utf8",
  );

  assert.match(javascript, /CAROUSEL_IDLE_MS = 60000/);
  assert.match(javascript, /CAROUSEL_SLIDE_MS = 6500/);
  assert.match(javascript, /current = \(current \+ 1\) % covers\.length/);
  assert.match(javascript, /scheduleCarouselAfterIdle\(\)/);
});
