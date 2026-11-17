/**
 * Loja × Feira — preço sugerido, totais e presença no HTML.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCAL_LOJA,
  LOCAL_FEIRA,
  precoSugerido,
  totaisPorLocal,
  breakdownLocais,
  normalizarLocal,
  labelLocal,
} from '../../CRM/pages/caixa/loja-feira.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAIXA_HTML = readFileSync(join(__dirname, '../../CRM/pages/caixa/index.html'), 'utf8');
const CAIXA_JS = readFileSync(join(__dirname, '../../CRM/pages/caixa/caixa.js'), 'utf8');
const EST_HTML = readFileSync(join(__dirname, '../../CRM/pages/estoque/index.html'), 'utf8');
const EST_JS = readFileSync(join(__dirname, '../../CRM/pages/estoque/estoque.js'), 'utf8');

const prod = { venda: 100, vendaFeira: 80, custo: 40 };

test('precoSugerido: loja usa venda; feira usa vendaFeira', () => {
  assert.equal(precoSugerido(prod, LOCAL_LOJA), 100);
  assert.equal(precoSugerido(prod, LOCAL_FEIRA), 80);
});

test('precoSugerido: feira sem vendaFeira cai no preço loja', () => {
  assert.equal(precoSugerido({ venda: 50, vendaFeira: 0 }, LOCAL_FEIRA), 50);
  assert.equal(precoSugerido({ venda: 50 }, LOCAL_FEIRA), 50);
});

test('normalizarLocal: legado/vazio → loja', () => {
  assert.equal(normalizarLocal(undefined), LOCAL_LOJA);
  assert.equal(normalizarLocal(''), LOCAL_LOJA);
  assert.equal(normalizarLocal('feira'), LOCAL_FEIRA);
});

test('labelLocal legível', () => {
  assert.match(labelLocal(LOCAL_LOJA), /Loja/);
  assert.match(labelLocal(LOCAL_FEIRA), /Feira/);
});

test('totaisPorLocal e breakdown', () => {
  const lanc = [
    { tipo: 'entrada', valor: 100, custo: 40, localVenda: 'loja' },
    { tipo: 'entrada', valor: 80, custo: 30, localVenda: 'feira' },
    { tipo: 'saida', valor: 10, custo: 0, localVenda: 'loja' },
  ];
  const todos = totaisPorLocal(lanc, 'todos');
  assert.equal(todos.vendido, 180);
  assert.equal(todos.custo, 40 + 30 + 10);
  assert.equal(todos.lucro, 180 - 80);

  const loja = totaisPorLocal(lanc, 'loja');
  assert.equal(loja.vendido, 100);
  assert.equal(loja.custo, 50);

  const bd = breakdownLocais(lanc);
  assert.equal(bd.feira.vendido, 80);
  assert.equal(bd.loja.vendido, 100);
});

test('HTML Caixa: local da venda + filtros + modal confirm', () => {
  assert.match(CAIXA_HTML, /local-venda/);
  assert.match(CAIXA_HTML, /Feira da Marreta/);
  assert.match(CAIXA_HTML, /filtrarLocal/);
  assert.match(CAIXA_HTML, /modal-confirm/);
  assert.match(CAIXA_HTML, /np-venda-feira/);
});

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

test('caixa.js sem confirm/prompt nativos', () => {
  const code = stripComments(CAIXA_JS);
  assert.doesNotMatch(code, /\bconfirm\s*\(/);
  assert.doesNotMatch(code, /\bprompt\s*\(/);
  assert.match(CAIXA_JS, /confirmarCaixa/);
  assert.match(CAIXA_JS, /promptCaixa/);
  assert.match(CAIXA_JS, /localVenda/);
  assert.match(CAIXA_JS, /precoSugerido/);
});

test('HTML/JS Estoque: Preço Loja/Feira, fornecedor, pedido, sem confirm nativo', () => {
  assert.match(EST_HTML, /est-inp-venda-feira/);
  assert.match(EST_HTML, /Preço Loja/);
  assert.match(EST_HTML, /Preço Feira/);
  assert.match(EST_HTML, /est-inp-fornecedor/);
  assert.match(EST_HTML, /est-inp-pedido/);
  assert.match(EST_HTML, /est-confirm-overlay/);
  assert.match(EST_JS, /vendaFeira/);
  assert.match(EST_JS, /pedidoCompra/);
  assert.match(EST_JS, /confirmarEstoque/);
  assert.doesNotMatch(stripComments(EST_JS), /\bconfirm\s*\(/);
});
