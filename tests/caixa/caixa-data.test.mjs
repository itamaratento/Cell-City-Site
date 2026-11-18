/**
 * Campos mes/dia/mesNumero/diaMes do Caixa — exigidos pelo Relatório.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  camposDataLancamento,
  hojeSP,
  normalizarCategoriaCaixa,
  chaveCategoriaCaixa,
  dedupeCategoriasCaixa,
} from '../../CRM/pages/caixa/caixa-data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAIXA_JS = readFileSync(join(__dirname, '../../CRM/pages/caixa/caixa.js'), 'utf8');

test('camposDataLancamento: jul/2026 → mes/dia/mesNumero/diaMes corretos', () => {
  const c = camposDataLancamento('2026-07-15');
  assert.equal(c.dia, '2026-07-15');
  assert.equal(c.mes, '2026-07');
  assert.equal(c.ano, 2026);
  assert.equal(c.mesNumero, 7);
  assert.equal(c.diaMes, 15);
  assert.ok(typeof c.dataISO === 'string' && c.dataISO.endsWith('Z'));
  // Meio-dia SP (−03) → 15:00 UTC
  assert.equal(c.dataISO, '2026-07-15T15:00:00.000Z');
});

test('camposDataLancamento: virada de mês e ano', () => {
  const dez = camposDataLancamento('2025-12-31');
  assert.equal(dez.mes, '2025-12');
  assert.equal(dez.mesNumero, 12);
  assert.equal(dez.diaMes, 31);

  const jan = camposDataLancamento('2026-01-01');
  assert.equal(jan.mes, '2026-01');
  assert.equal(jan.mesNumero, 1);
  assert.equal(jan.diaMes, 1);
});

test('camposDataLancamento: data inválida lança', () => {
  assert.throws(() => camposDataLancamento(''), /inválida/i);
  assert.throws(() => camposDataLancamento('15/07/2026'), /inválida/i);
  assert.throws(() => camposDataLancamento('2026-13-01'), /intervalo/i);
});

test('hojeSP retorna YYYY-MM-DD', () => {
  assert.match(hojeSP(), /^\d{4}-\d{2}-\d{2}$/);
});

test('caixa.js grava camposDataLancamento em criar, editar e pagar lembrete', () => {
  assert.match(CAIXA_JS, /from '\.\/caixa-data\.js'/);
  assert.match(CAIXA_JS, /camposDataLancamento/);
  // _executarSalvamento, salvarEdicao e pagarLembrete usam o helper
  const usos = CAIXA_JS.match(/camposDataLancamento\(/g) || [];
  assert.ok(usos.length >= 3, `esperado ≥3 usos, veio ${usos.length}`);
  assert.match(CAIXA_JS, /\.\.\.camposData/);
  // Helper exporta mesNumero/diaMes (spread no addDoc/updateDoc)
  const helper = readFileSync(join(__dirname, '../../CRM/pages/caixa/caixa-data.js'), 'utf8');
  assert.match(helper, /mesNumero/);
  assert.match(helper, /diaMes/);
});

test('normalizarCategoriaCaixa: maiúsc./minúsc./singular → canônico', () => {
  assert.equal(normalizarCategoriaCaixa('DESPESAS'), 'Despesas');
  assert.equal(normalizarCategoriaCaixa('Despesas'), 'Despesas');
  assert.equal(normalizarCategoriaCaixa('VENDAS'), 'Vendas');
  assert.equal(normalizarCategoriaCaixa('SERVIÇO'), 'Serviços');
  assert.equal(normalizarCategoriaCaixa('Servicos'), 'Serviços');
  assert.equal(normalizarCategoriaCaixa('FORNECEDOR'), 'Fornecedores');
  assert.equal(chaveCategoriaCaixa('DESPESAS'), chaveCategoriaCaixa('Despesas'));
});

test('dedupeCategoriasCaixa: uma opção por canônico', () => {
  const out = dedupeCategoriasCaixa([
    { nome: 'DESPESAS', tipo: 'saida' },
    { nome: 'Despesas', tipo: 'saida' },
    { nome: 'VENDAS', tipo: 'entrada' },
    { nome: 'Vendas', tipo: 'entrada' },
    { nome: 'Acessórios', tipo: 'entrada' },
  ]);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map(c => c.nome).sort(), ['Acessórios', 'Despesas', 'Vendas']);
});

test('caixa.js usa dedupeCategoriasCaixa no select (sem regravar lançamentos)', () => {
  assert.match(CAIXA_JS, /dedupeCategoriasCaixa/);
  assert.match(CAIXA_JS, /normalizarCategoriaCaixa/);
  assert.equal(/updateDoc\([\s\S]*categoria.*DESPESAS/.test(CAIXA_JS), false);
});
