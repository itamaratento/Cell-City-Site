/**
 * Varredura confirm/prompt/alert — helpers + ausência nos 7 módulos.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from '../rbac/node_modules/jsdom/lib/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

const MODULOS = {
  os: 'CRM/pages/os/os.js',
  caixa: 'CRM/pages/caixa/caixa.js',
  estoque: 'CRM/pages/estoque/estoque.js',
  compras: 'CRM/pages/compras/compras.js',
  'central-alertas': 'CRM/pages/central-alertas/central-alertas.js',
  'alertas-panel': 'CRM/pages/dashboard/dashboard-alertas-panel.js',
  clientes: 'CRM/pages/clientes/clientes.js',
  relatorios: 'CRM/pages/relatorios/relatorios.js',
};

const NATIVO = /\b(?:window\.)?(?:confirm|prompt|alert)\s*\(/;

test('ui-dialog: confirm/prompt/alert via modal DOM', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const mod = await import(`file://${join(ROOT, 'CRM/shared/ui-dialog.js')}?t=${Date.now()}`);
  assert.equal(typeof mod.uiConfirm, 'function');
  assert.equal(typeof mod.uiPrompt, 'function');
  assert.equal(typeof mod.uiAlert, 'function');

  const p = mod.uiConfirm({ title: 'T', body: 'B', okText: 'Sim' });
  const root = document.getElementById('cc-ui-dialog-root');
  assert.ok(root);
  assert.ok(root.classList.contains('cc-open'));
  root.querySelector('[data-act="ok"]').click();
  assert.equal(await p, true);

  const p2 = mod.uiPrompt({ title: 'P', body: 'digite', defaultValue: '77' });
  const input = document.querySelector('#cc-dlg-input');
  assert.ok(input);
  input.value = '77';
  document.querySelector('[data-act="ok"]').click();
  assert.equal(await p2, '77');

  delete globalThis.window;
  delete globalThis.document;
});

test('7 módulos (+ painel alertas): sem confirm/prompt/alert nativos', () => {
  for (const [nome, rel] of Object.entries(MODULOS)) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    const hits = [];
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      if (NATIVO.test(line) && !/sem confirm\(\)|sem confirm\/|substitui confirm/.test(line)) {
        hits.push(`${i + 1}: ${line.trim()}`);
      }
    });
    assert.equal(hits.length, 0, `${nome} ainda tem nativos:\n${hits.join('\n')}`);
  }
});

test('HTML dashboard carrega painel de alertas como module', () => {
  const html = readFileSync(join(ROOT, 'CRM/pages/dashboard/index.html'), 'utf8');
  assert.match(html, /type="module"\s+src="dashboard-alertas-panel\.js"/);
});
