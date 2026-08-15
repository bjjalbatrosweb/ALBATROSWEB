import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizarPerfilAcceso, puedeAdministrarSede } from '../src/lib/access-control.ts';

test('un administrador activo con TODAS administra cada sede', () => {
  const profile = normalizarPerfilAcceso({ rol: 'admin', activo: true, sede: 'TODAS' });
  assert.ok(profile);
  for (const site of ['MMA', 'CAUCEL', 'JUAN_PABLO'] as const) assert.equal(puedeAdministrarSede(profile, site), true);
});

test('un profesor sólo administra su sede y un usuario inactivo ninguna', () => {
  const teacher = normalizarPerfilAcceso({ rol: 'profesor', activo: true, sede: 'CAUCEL' });
  const inactive = normalizarPerfilAcceso({ rol: 'admin', activo: false, sede: 'TODAS' });
  assert.ok(teacher); assert.ok(inactive);
  assert.equal(puedeAdministrarSede(teacher, 'CAUCEL'), true);
  assert.equal(puedeAdministrarSede(teacher, 'MMA'), false);
  assert.equal(puedeAdministrarSede(inactive, 'MMA'), false);
});

test('roles desconocidos se rechazan', () => {
  assert.equal(normalizarPerfilAcceso({ rol: 'superadmin', activo: true }), null);
});
