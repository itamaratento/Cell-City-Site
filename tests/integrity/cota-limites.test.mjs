// Regressão — tetos de cota nos hotspots (DT-10…14) + BL-007 engines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('financeiro: carregar() usa limit(LIMITE_LISTA)', () => {
  const c = strip(read('CRM/pages/financeiro/financeiro.js'));
  assert.ok(c.includes('PAGINACAO'), 'deve importar PAGINACAO');
  assert.ok(/limit\(LIMITE_LISTA\)/.test(c), 'queries principais devem ter limit(LIMITE_LISTA)');
  assert.ok(!/getDocs\(query\(collection\(db, COL_PAGAR\), \.\.\.injectTenantFilter\(\[\]\)\)\)/.test(c),
    'COL_PAGAR sem limit não pode voltar');
});

test('central-alertas: OS.list e financeiro usam limitTo', () => {
  const c = strip(read('CRM/pages/central-alertas/central-alertas.js'));
  assert.ok(/OS\.list\(\{\s*limitTo:\s*LIMITE_LISTA\s*\}\)/.test(c));
  assert.ok(/FinanceiroPagar\.list\(\{\s*limitTo:\s*LIMITE_LISTA\s*\}\)/.test(c));
});

test('dashboard-alertas: getDocs de os/agenda com limit', () => {
  const c = strip(read('CRM/pages/dashboard/dashboard-alertas.js'));
  assert.ok(/collection\(db, 'os'\).*limit\(LIMITE_LISTA\)/.test(c.replace(/\s+/g, ' '))
    || c.includes("collection(db, 'os'), ...injectTenantFilter([]), limit(LIMITE_LISTA)"));
  assert.ok(c.includes("collection(db, 'agenda'), ...injectTenantFilter([]), limit(LIMITE_LISTA)"));
});

test('portal admin: portal_eventos com limit(200)', () => {
  const c = strip(read('CRM/pages/portal-cliente/admin.js'));
  assert.ok(/portal_eventos[\s\S]{0,200}limit\(200\)/.test(c));
  assert.ok(!/where\('tipo', '==', 'acesso'\)\s*\)\s*\)/.test(c.replace(/\s+/g, ' ')) ||
    c.includes("where('tipo', '==', 'acesso'), limit(200)"));
});

test('BL-007: functions engines + firebase.json runtime nodejs22', () => {
  const pkg = JSON.parse(read('functions/package.json'));
  assert.equal(pkg.engines.node, '22');
  const fb = read('firebase.json');
  assert.ok(fb.includes('"runtime": "nodejs22"'));
  assert.ok(!fb.includes('"runtime": "nodejs20"'));
});
