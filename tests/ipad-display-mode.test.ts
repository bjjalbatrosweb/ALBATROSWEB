import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("la versión iPad declara una instalación independiente", async () => {
  const html = await readFile(
    new URL("../public/ipad/index.html", import.meta.url),
    "utf8",
  );
  const manifest = JSON.parse(
    await readFile(
      new URL("../public/ipad/manifest.webmanifest", import.meta.url),
      "utf8",
    ),
  ) as { display?: string; start_url?: string; scope?: string };

  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /href="\/ipad\/manifest\.webmanifest"/);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/ipad");
  assert.equal(manifest.scope, "/ipad");
});

test("el control desaparece y la salida exige un gesto desde el borde", async () => {
  const [html, css, javascript] = await Promise.all([
    readFile(new URL("../public/ipad/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/ipad/ipad.css", import.meta.url), "utf8"),
    readFile(new URL("../public/ipad/ipad.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /class="[^"]*js-display-mode/);
  assert.match(html, /id="display-guide"/);
  assert.match(css, /\.display-mode-active \.js-display-mode/);
  assert.match(css, /\.standalone-mode \.js-display-mode/);
  assert.match(javascript, /requestFullscreen/);
  assert.match(javascript, /navigator\.standalone/);
  assert.match(javascript, /clientX > 24/);
  assert.match(javascript, /edgeExitDeltaX >= 180/);
});
