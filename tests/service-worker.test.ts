import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('el service worker no precachea páginas privadas ni APIs', async () => {
  const worker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.doesNotMatch(worker, /\/admin\//);
  assert.match(worker, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /request\.mode === "navigate"[\s\S]*fetch\(request\)/);
});
