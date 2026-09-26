import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("el kiosco se abre deslizando hacia arriba", async () => {
  const [html, css, javascript] = await Promise.all([
    readFile(new URL("../public/ipad/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/ipad/ipad.css", import.meta.url), "utf8"),
    readFile(new URL("../public/ipad/ipad.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /↑<\/span> sube al kiosco/);
  assert.match(css, /\.kiosk-view[^}]*translate3d\(0,101%,0\)/);
  assert.match(javascript, /deltaY < -90/);
  assert.match(javascript, /Math\.min\(-deltaY \/ 150, 1\)/);
});

test("las carátulas avanzan solas y se pausan al interactuar", async () => {
  const javascript = await readFile(
    new URL("../public/ipad/ipad.js", import.meta.url),
    "utf8",
  );

  assert.match(javascript, /function startCarousel\(\)/);
  assert.match(javascript, /current = \(current \+ 1\) % covers\.length/);
  assert.match(javascript, /6500/);
  assert.match(javascript, /pauseCarouselForInteraction/);
  assert.match(javascript, /prefers-reduced-motion: reduce/);
});

test("la escucha RFID sólo funciona mientras está abierto el modo tag", async () => {
  const [html, javascript, rfidRoute, eventRoute] = await Promise.all([
    readFile(new URL("../public/ipad/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/ipad/ipad.js", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/rfid/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/api/ipad/evento-rfid/route.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(html, /id="tag-listening"/);
  assert.match(javascript, /function startRfidPolling\(\)/);
  assert.match(javascript, /mode === "tag"[\s\S]*startRfidPolling\(\)/);
  assert.match(javascript, /stopRfidPolling\(\)/);
  assert.match(javascript, /setTimeout\(pollRfidEvent, delay\)/);
  assert.doesNotMatch(javascript, /setInterval\(pollRfidEvent/);
  assert.match(rfidRoute, /KioscoEventos/);
  assert.match(rfidRoute, /const batch = db\.batch\(\)/);
  assert.match(rfidRoute, /batch\.set\(pantallaRef/);
  assert.match(rfidRoute, /await batch\.commit\(\)/);
  assert.match(eventRoute, /EVENT_TTL_MS = 20_000/);
  assert.match(eventRoute, /Cache-Control/);
  assert.doesNotMatch(eventRoute, /rfidNormalizado|mensajePago|fotoUrl/);
});
