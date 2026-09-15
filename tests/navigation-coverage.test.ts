import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("las herramientas nuevas siguen visibles en la navegación", () => {
  const navigation = readFileSync(new URL("../src/lib/admin-navigation.ts", import.meta.url), "utf8");
  const required = [
    "/admin/conciliar-asistencia", "/admin/arbol-habilidades",
    "/admin/estado-fisico", "/admin/entrenamiento", "/admin/organizador-atletas",
    "/admin/puzzle", "/admin/pantalla", "/admin/comprar", "/admin/privacidad",
    "/admin/perfil-tecnico",
  ];
  required.forEach((route) => assert.match(navigation, new RegExp(route.replaceAll("/", "\\/"))));
});

test("más herramientas contiene cada ruta del catálogo oficial", () => {
  const navigation = readFileSync(new URL("../src/lib/admin-navigation.ts", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../src/app/admin/layout.tsx", import.meta.url), "utf8");
  const catalog = navigation.slice(navigation.indexOf("export const ADMIN_TOOL_GROUPS"));
  const routes = [...catalog.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]);
  assert.ok(routes.length >= 50, "el catálogo debe conservar todas sus herramientas");
  assert.equal(new Set(routes).size, routes.length, "el catálogo no debe duplicar rutas");
  for (const route of routes) {
    assert.match(layout, new RegExp(`href: ["']${route.replaceAll("/", "\\/")}["']`));
  }
});

test("más herramientas abre en accesos rápidos y ofrece búsqueda accesible", () => {
  const layout = readFileSync(new URL("../src/app/admin/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /if \(open\) \{[\s\S]*setActiveToolGroupId\(QUICK_ACCESS_GROUP_ID\)/);
  assert.match(layout, /id="tool-search"/);
  assert.match(layout, /normalizeToolSearch/);
  assert.match(layout, /toolSearchResults/);
  assert.match(layout, /aria-live="polite"/);
  assert.match(layout, /motion-reduce:animate-none/);
});

test("el panel de herramientas permanece dentro del viewport", () => {
  const layout = readFileSync(new URL("../src/app/admin/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /fixed inset-x-3[^"]*mx-auto[^"]*max-w-\[64rem\]/);
  assert.match(layout, /max-h-\[calc\(100dvh-6rem\)\]/);
  assert.doesNotMatch(layout, /lg:absolute lg:inset-x-auto lg:right-0/);
});
