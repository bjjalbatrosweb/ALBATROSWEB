import assert from 'node:assert/strict';
import test from 'node:test';
import { STORE_PRODUCTS } from '../src/lib/store-products';

test('el catálogo iPad conserva los trece productos y precios del menú de recepción', () => {
  const expected = {
    coca_cola: 25, refresco_lata: 25, agua_500: 10, agua_1l: 15,
    frutas_500: 25, frutas_1l: 35, gatorade_1l: 25, gatorade_500: 28,
    powerade_1l: 35, powerade_500: 28, fuze_tea: 24,
    bolis_naturales: 20, bolis_sorbin: 5,
  };
  const products = STORE_PRODUCTS.filter(p => 'ipad' in p && p.ipad);
  assert.deepEqual(Object.fromEntries(products.map(p => [p.id, p.precio])), expected);
  assert.equal(new Set(STORE_PRODUCTS.map(p => p.id)).size, STORE_PRODUCTS.length);
  assert.ok(products.every(p => p.imagen && p.detalle));
});

test('los productos anteriores mantienen sus identificadores para conservar el inventario', () => {
  for (const id of ['agua_600', 'agua_1l', 'amper_mango', 'amper_blanco', 'amper_azul', 'barra_proteina', 'chocolate']) {
    assert.ok(STORE_PRODUCTS.some(p => p.id === id));
  }
});
