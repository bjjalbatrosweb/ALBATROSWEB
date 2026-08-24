import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("las herramientas nuevas siguen visibles en la navegación", () => {
  const navigation = readFileSync(new URL("../src/lib/admin-navigation.ts", import.meta.url), "utf8");
  const required = [
    "/admin/conciliar-asistencia", "/admin/arbol-habilidades",
    "/admin/estado-fisico", "/admin/entrenamiento", "/admin/organizador-atletas",
    "/admin/puzzle", "/admin/pantalla", "/admin/comprar", "/admin/privacidad",
  ];
  required.forEach((route) => assert.match(navigation, new RegExp(route.replaceAll("/", "\\/"))));
});
