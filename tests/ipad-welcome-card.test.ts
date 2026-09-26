import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("la bienvenida reutiliza la respuesta de asistencia y se limpia sola", async () => {
  const [html, css, javascript, route] = await Promise.all([
    readFile(new URL("../public/ipad/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/ipad/ipad.css", import.meta.url), "utf8"),
    readFile(new URL("../public/ipad/ipad.js", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/api/ipad/asistencia/route.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(html, /id="welcome-summary"/);
  assert.match(html, /id="welcome-week"/);
  assert.match(html, /id="welcome-class"/);
  assert.match(html, /id="welcome-achievement"/);
  assert.match(css, /\.welcome-summary\s*\{/);
  assert.match(javascript, /result\.bienvenida/);
  assert.match(javascript, /setTimeout\(resetAttendance, 15000\)/);
  assert.match(route, /bienvenida,/);
  assert.doesNotMatch(javascript, /fetch\([^)]*bienvenida/);
});
