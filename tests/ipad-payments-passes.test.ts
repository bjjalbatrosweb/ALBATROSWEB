import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("el iPad conserva sus apartados y agrega pago y pases", async () => {
  const [html, javascript] = await Promise.all([
    readFile(new URL("../public/ipad/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/ipad/ipad.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /id="booking-panel"/);
  assert.match(html, /id="attendance-panel"/);
  assert.match(html, /id="payment-panel"/);
  assert.match(html, /id="passes-panel"/);
  assert.match(html, /id="future-panel"/);
  assert.match(javascript, /metodo: method/);
  assert.match(javascript, /eventoId: eventId/);
  assert.match(javascript, /accion: "crear_invitado"/);
  assert.match(javascript, /accion: "buscar_agenda"/);
  assert.match(javascript, /accion: "crear_desde_agenda"/);
});

test("el pago iPad usa el mismo token de confirmación sin crear pagos", async () => {
  const route = await readFile(
    new URL("../src/app/api/ipad/pago/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /TokensSolicitudPago/);
  assert.match(route, /solicitud-pago\/\$\{rawToken\}/);
  assert.match(route, /SolicitudesPago/);
  assert.match(route, /Pagos/);
  assert.doesNotMatch(route, /collection\("Pagos"\)\.doc\([^)]*\)\.(create|set|update)/);
  assert.match(route, /QRCode\.toDataURL/);
});

test("las citas se verifican con teléfono y nunca se listan globalmente", async () => {
  const route = await readFile(
    new URL("../src/app/api/ipad/pases/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /where\("telefono", "==", normalizedPhone\)/);
  assert.match(route, /appointment\.estado === "cancelada"/);
  assert.match(route, /maxUses: 1/);
  assert.match(route, /PASS_TTL_MS = 24 \* 60 \* 60_000/);
  assert.doesNotMatch(route, /collection\("SolicitudesClasePrueba"\)\.limit/);
});
