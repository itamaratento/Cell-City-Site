/**
 * Home enxuta do Dashboard — 8 módulos + Mais módulos + preferência painel.
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
const CLI_HTML = readFileSync(join(__dirname, '../../CRM/pages/clientes/index.html'), 'utf8');
const CFG_HTML = readFileSync(join(__dirname, '../../CRM/pages/config/index.html'), 'utf8');
const IMP_HTML = readFileSync(join(__dirname, '../../CRM/pages/config/impressao.html'), 'utf8');

test('HOME_MODULOS_PRIMARIOS: exatamente 8 na ordem pedida', () => {
  assert.deepEqual(HOME_MODULOS_PRIMARIOS, [
    'os', 'caixa', 'estoque', 'compras', 'central-alertas', 'clientes', 'pos-venda', 'relatorios',
  ]);
});

test('ordenarComPrimariosPrimeiro coloca os 8 no topo', () => {
  const ids = ['financeiro', 'clientes', 'os', 'diario', 'caixa', 'relatorios', 'pos-venda'];
  assert.deepEqual(ordenarComPrimariosPrimeiro(ids), [
    'os', 'caixa', 'clientes', 'pos-venda', 'relatorios', 'financeiro', 'diario',
  ]);
});

test('maisModulosAbertoFromPainel lê config/painel', () => {
  assert.equal(maisModulosAbertoFromPainel(null), null);
  assert.equal(maisModulosAbertoFromPainel({}), null);
  assert.equal(maisModulosAbertoFromPainel({ [PAINEL_CAMPO_MAIS]: true }), true);
  assert.equal(maisModulosAbertoFromPainel({ [PAINEL_CAMPO_MAIS]: false }), false);
});

test('HTML: grid primário com 8 + details Mais módulos com extras', () => {
  assert.match(HTML, /modules-grid--primarios/);
  assert.match(HTML, /id="mais-modulos"/);
  assert.match(HTML, /Mais módulos/);
  for (const id of HOME_MODULOS_PRIMARIOS) {
    assert.match(HTML, new RegExp(`data-module="${id}"[^>]*data-home-tier="primario"|data-home-tier="primario"[^>]*data-module="${id}"`));
  }
  // Pós-venda não fica em "mais"
  assert.doesNotMatch(HTML, /data-module="pos-venda"[^>]*data-home-tier="mais"|data-home-tier="mais"[^>]*data-module="pos-venda"/);
  for (const id of ['financeiro', 'fornecedor', 'config', 'portal-cliente', 'diario', 'auditoria', 'acaodasemana']) {
    assert.match(HTML, new RegExp(`data-module="${id}"`));
    assert.match(HTML, new RegExp(`data-module="${id}"[^>]*data-home-tier="mais"|data-home-tier="mais"[^>]*data-module="${id}"`));
  }
});

test('sidebar: 8 primários + toggle Mais', () => {
  assert.match(HTML, /data-sid="central-alertas"/);
  assert.match(HTML, /data-sid="pos-venda"[^>]*data-home-tier="primario"|data-home-tier="primario"[^>]*data-sid="pos-venda"/);
  assert.match(HTML, /id="sidebar-mais-toggle"/);
  assert.match(HTML, /id="sidebar-mais-itens"/);
  const primIdx = HOME_MODULOS_PRIMARIOS.map(id => HTML.indexOf(`data-sid="${id}"`));
  assert.ok(primIdx.every(i => i > 0));
  for (let i = 1; i < primIdx.length; i++) {
    assert.ok(primIdx[i] > primIdx[i - 1], `ordem sidebar quebrada em ${HOME_MODULOS_PRIMARIOS[i]}`);
  }
});

test('Clientes: lista real (não Impressora); Impressão em Config', () => {
  assert.match(CLI_HTML, /<title>Cell City — Clientes<\/title>/);
  assert.match(CLI_HTML, /id="cli-search"/);
  assert.match(CLI_HTML, /clientes\.js/);
  assert.doesNotMatch(CLI_HTML, /impressao\.js|Impressora|loja-nome/);
  assert.match(IMP_HTML, /Impressão e Garantias/);
  assert.match(IMP_HTML, /loja-nome/);
  assert.match(IMP_HTML, /impressao\.js/);
  assert.match(CFG_HTML, /impressao\.html/);
  assert.match(CFG_HTML, /Impressão e Garantias/);
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

test('SW bump comentário home clientes/pos-venda', () => {
  assert.match(SW, /home clientes|pos-venda|__GIT_SHA__/);
});
