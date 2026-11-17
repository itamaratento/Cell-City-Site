/**
 * Venda rápida + import Feira.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buscarProdutosPorNome,
  montarPayloadVendaRapida,
  parseVendasFeiraTexto,
} from '../../CRM/pages/caixa/venda-rapida.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(__dirname, '../../CRM/pages/caixa/index.html'), 'utf8');
const JS = readFileSync(join(__dirname, '../../CRM/pages/caixa/caixa.js'), 'utf8');

const produtos = [
  { id: '1', nome: 'Carregador USB', venda: 40, vendaFeira: 35, custo: 10, quantidade: 5 },
  { id: '2', nome: 'Película A10', venda: 25, vendaFeira: 0, custo: 5, quantidade: 20 },
];

test('buscarProdutosPorNome por parte do nome', () => {
  assert.equal(buscarProdutosPorNome(produtos, 'carreg').length, 1);
  assert.equal(buscarProdutosPorNome(produtos, 'a10')[0].id, '2');
  assert.deepEqual(buscarProdutosPorNome(produtos, ''), []);
});

test('montarPayloadVendaRapida: Loja vs Feira + qtd', () => {
  const loja = montarPayloadVendaRapida({
    produto: produtos[0], local: 'loja', quantidade: 2, dataYYYYMMDD: '2026-11-17',
  });
  assert.equal(loja.valor, 80);
  assert.equal(loja.custo, 20);
  assert.equal(loja.localVenda, 'loja');

  const feira = montarPayloadVendaRapida({
    produto: produtos[0], local: 'feira', quantidade: 1, dataYYYYMMDD: '2026-11-17',
  });
  assert.equal(feira.valor, 35);
  assert.equal(feira.localVenda, 'feira');
});

test('parseVendasFeiraTexto: prévia com erros isolados', () => {
  const texto = `Carregador USB, 2, 45
Película A10, 25
linha ruim
Cabo Type-C 1 30`;
  const { ok, erros } = parseVendasFeiraTexto(texto);
  assert.equal(ok.length, 3);
  assert.ok(erros.length >= 1);
  assert.equal(ok[0].valor, 90);
  assert.equal(ok[0].localVenda, 'feira');
  assert.equal(ok[1].quantidade, 1);
  assert.equal(ok[1].valor, 25);
});

test('HTML/JS expõem Venda rápida e Importar Feira', () => {
  assert.match(HTML, /secao-venda-rapida|Venda rápida/);
  assert.match(HTML, /Importar vendas da Feira|feira-import-texto/);
  assert.match(JS, /salvarVendaRapida|preverImportFeira|gravarImportFeira/);
  assert.match(JS, /venda-rapida\.js/);
});
