/**
 * Home enxuta do Dashboard — 7 módulos + Mais módulos + preferência painel.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HOME_MODULOS_PRIMARIOS,
  ordenarComPrimariosPrimeiro,
  maisModulosAbertoFromPainel,
  PAINEL_CAMPO_MAIS,
} from '../../CRM/pages/dashboard/dashboard-home-enxuto.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(__dirname, '../../CRM/pages/dashboard/index.html'), 'utf8');
const UI = readFileSync(join(__dirname, '../../CRM/pages/dashboard/dashboard-ui.js'), 'utf8');
const CSS = readFileSync(join(__dirname, '../../CRM/pages/dashboard/dashboard.css'), 'utf8');
const SW = readFileSync(join(__dirname, '../../CRM/sw.js'), 'utf8');

test('HOME_MODULOS_PRIMARIOS: exatamente 7 na ordem pedida', () => {
  assert.deepEqual(HOME_MODULOS_PRIMARIOS, [
    'os', 'caixa', 'estoque', 'compras', 'central-alertas', 'clientes', 'relatorios',
  ]);
});

test('ordenarComPrimariosPrimeiro coloca os 7 no topo', () => {
  const ids = ['financeiro', 'clientes', 'os', 'diario', 'caixa', 'relatorios'];
  assert.deepEqual(ordenarComPrimariosPrimeiro(ids), [
    'os', 'caixa', 'clientes', 'relatorios', 'financeiro', 'diario',
  ]);
});

test('maisModulosAbertoFromPainel lê config/painel', () => {
  assert.equal(maisModulosAbertoFromPainel(null), null);
  assert.equal(maisModulosAbertoFromPainel({}), null);
  assert.equal(maisModulosAbertoFromPainel({ [PAINEL_CAMPO_MAIS]: true }), true);
  assert.equal(maisModulosAbertoFromPainel({ [PAINEL_CAMPO_MAIS]: false }), false);
});

test('HTML: grid primário com 7 + details Mais módulos com extras', () => {
  assert.match(HTML, /modules-grid--primarios/);
  assert.match(HTML, /id="mais-modulos"/);
  assert.match(HTML, /Mais módulos/);
  for (const id of HOME_MODULOS_PRIMARIOS) {
    assert.match(HTML, new RegExp(`data-module="${id}"[^>]*data-home-tier="primario"|data-home-tier="primario"[^>]*data-module="${id}"`));
  }
  // Extras escondidos (não apagados)
  for (const id of ['financeiro', 'fornecedor', 'pos-venda', 'config', 'portal-cliente', 'diario', 'auditoria', 'acaodasemana']) {
    assert.match(HTML, new RegExp(`data-module="${id}"`));
    assert.match(HTML, new RegExp(`data-module="${id}"[^>]*data-home-tier="mais"|data-home-tier="mais"[^>]*data-module="${id}"`));
  }
});

test('sidebar: 7 primários + toggle Mais', () => {
  assert.match(HTML, /data-sid="central-alertas"/);
  assert.match(HTML, /id="sidebar-mais-toggle"/);
  assert.match(HTML, /id="sidebar-mais-itens"/);
  const primIdx = HOME_MODULOS_PRIMARIOS.map(id => HTML.indexOf(`data-sid="${id}"`));
  assert.ok(primIdx.every(i => i > 0));
  for (let i = 1; i < primIdx.length; i++) {
    assert.ok(primIdx[i] > primIdx[i - 1], `ordem sidebar quebrada em ${HOME_MODULOS_PRIMARIOS[i]}`);
  }
});

test('UI persiste preferência em config/painel', () => {
  assert.match(UI, /config',\s*'painel'|config", "painel"/);
  assert.match(UI, /homeMaisModulosAberto|PAINEL_CAMPO_MAIS/);
  assert.match(UI, /_persistMaisModulosOnline|_syncMaisModulosFromFirestore/);
});

test('CSS home enxuta: 4 colunas / cards maiores', () => {
  assert.match(CSS, /modules-grid--primarios/);
  assert.match(CSS, /mais-modulos/);
  assert.match(CSS, /min-height:\s*168px|min-height:\s*150px/);
});

test('SW bump comentário home enxuta', () => {
  assert.match(SW, /home enxuta|__GIT_SHA__/);
});
