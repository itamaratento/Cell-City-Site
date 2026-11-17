import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  itensAbaixoDoMinimo,
  agregarVendasPorProduto,
  dataISODiasAtras,
  montarListaComprarProximoPedido,
} from '../../CRM/pages/estoque/reposicao.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

const produtos = [
  { id: 'a', nome: 'Cabo USB-C', quantidade: 0, quantidadeMinima: 2 },
  { id: 'b', nome: 'Película', quantidade: 10, quantidadeMinima: 3 },
  { id: 'c', nome: 'Capinha', quantidade: 5, quantidadeMinima: 5 },
  { id: 'd', nome: 'Fone', quantidade: 20, quantidadeMinima: 2 },
];

test('itensAbaixoDoMinimo', () => {
  const baixo = itensAbaixoDoMinimo(produtos);
  assert.equal(baixo.length, 2); // a (0<=2) e c (5<=5)
  assert.ok(baixo.some(p => p.id === 'a'));
  assert.ok(baixo.some(p => p.id === 'c'));
});

test('agregarVendasPorProduto por id e nome', () => {
  const { porId, porNome } = agregarVendasPorProduto([
    { tipo: 'entrada', produtoId: 'b', quantidade: 2, descricao: 'Película' },
    { tipo: 'entrada', produtoId: 'b', quantidade: 1 },
    { tipo: 'entrada', descricao: 'Fone ×3', quantidade: 3 },
    { tipo: 'saida', produtoId: 'b', quantidade: 9 },
  ]);
  assert.equal(porId.get('b'), 3);
  assert.equal(porNome.get('fone'), 3);
});

test('dataISODiasAtras', () => {
  const base = new Date(2026, 10, 17); // 17/11/2026 local
  assert.equal(dataISODiasAtras(0, base), '2026-11-17');
  assert.equal(dataISODiasAtras(30, base), '2026-10-18');
});

test('montarListaComprarProximoPedido: mínimo + top vendas', () => {
  const lanc = [
    { tipo: 'entrada', produtoId: 'b', quantidade: 12 },
    { tipo: 'entrada', produtoId: 'd', quantidade: 8 },
    { tipo: 'entrada', produtoId: 'a', quantidade: 1 },
  ];
  const lista = montarListaComprarProximoPedido({ produtos, lancamentos: lanc, topN: 2 });
  assert.ok(lista.some(i => i.id === 'a' && i.motivo === 'abaixo_minimo'));
  assert.ok(lista.some(i => i.id === 'c' && i.motivo === 'abaixo_minimo'));
  // b e d entram como mais vendidos (top 2 que ainda não estão só por mínimo — a já está)
  assert.ok(lista.some(i => i.id === 'b' && i.motivo === 'mais_vendido' && i.vendidos30d === 12));
  assert.ok(lista.some(i => i.id === 'd'));
});

test('HTML/JS expõem seção Comprar no próximo pedido', () => {
  const html = readFileSync(join(ROOT, 'CRM/pages/estoque/index.html'), 'utf8');
  const js = readFileSync(join(ROOT, 'CRM/pages/estoque/estoque.js'), 'utf8');
  assert.match(html, /est-reposicao/);
  assert.match(html, /Comprar no próximo pedido/);
  assert.match(js, /montarListaComprarProximoPedido|renderReposicao/);
  assert.match(js, /limit\(400\)/);
});
