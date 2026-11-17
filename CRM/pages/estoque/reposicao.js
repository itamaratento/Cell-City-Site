/**
 * Alerta de reposição — "Comprar no próximo pedido".
 * Helpers puros (sem Firestore/DOM).
 */

/**
 * Itens com quantidade ≤ mínimo.
 * @param {object[]} produtos
 */
export function itensAbaixoDoMinimo(produtos) {
  return (produtos || []).filter(p => {
    const q = Number(p.quantidade) || 0;
    const min = Number(p.quantidadeMinima);
    const piso = Number.isFinite(min) ? min : 1;
    return q <= piso;
  });
}

/**
 * Soma quantidades vendidas por produtoId (e por nome normalizado como fallback).
 * @param {object[]} lancamentos — caixa (últimos 30 dias)
 * @returns {{ porId: Map<string, number>, porNome: Map<string, number> }}
 */
export function agregarVendasPorProduto(lancamentos) {
  const porId = new Map();
  const porNome = new Map();
  for (const l of lancamentos || []) {
    if (l.tipo === 'saida') continue;
    const qty = Math.max(1, parseInt(l.quantidade, 10) || 1);
    const id = l.produtoId ? String(l.produtoId) : '';
    if (id) porId.set(id, (porId.get(id) || 0) + qty);
    const nome = normalizarNomeProduto(l.nomeProduto || extrairNomeDescricao(l.descricao));
    if (nome) porNome.set(nome, (porNome.get(nome) || 0) + qty);
  }
  return { porId, porNome };
}

export function normalizarNomeProduto(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/×\s*\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairNomeDescricao(desc) {
  return String(desc || '').replace(/\s*×\s*\d+\s*$/, '').trim();
}

/**
 * Data YYYY-MM-DD de N dias atrás (calendário local).
 * @param {number} dias
 * @param {Date} [agora]
 */
export function dataISODiasAtras(dias, agora = new Date()) {
  const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  d.setDate(d.getDate() - Math.max(0, dias | 0));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Monta lista unificada "Comprar no próximo pedido":
 * - todos abaixo do mínimo
 * - mais vendidos dos últimos 30d (topN) que ainda não estão na lista
 *
 * @param {object} args
 * @param {object[]} args.produtos
 * @param {object[]} args.lancamentos
 * @param {number} [args.topN=8]
 */
export function montarListaComprarProximoPedido({ produtos, lancamentos, topN = 8 }) {
  const lista = [];
  const seen = new Set();

  const baixo = itensAbaixoDoMinimo(produtos)
    .slice()
    .sort((a, b) => (Number(a.quantidade) || 0) - (Number(b.quantidade) || 0));

  for (const p of baixo) {
    const id = String(p.id || '');
    if (id) seen.add(id);
    lista.push({
      id: p.id,
      nome: p.nome || p.description || '—',
      quantidade: Number(p.quantidade) || 0,
      quantidadeMinima: Number(p.quantidadeMinima) || 1,
      motivo: 'abaixo_minimo',
      vendidos30d: 0,
    });
  }

  const { porId, porNome } = agregarVendasPorProduto(lancamentos);
  const ranking = (produtos || []).map(p => {
    const id = String(p.id || '');
    const nome = normalizarNomeProduto(p.nome || p.description);
    const v = (id && porId.get(id)) || porNome.get(nome) || 0;
    return { p, vendidos: v };
  }).filter(x => x.vendidos > 0)
    .sort((a, b) => b.vendidos - a.vendidos);

  let added = 0;
  for (const { p, vendidos } of ranking) {
    if (added >= topN) break;
    const id = String(p.id || '');
    if (id && seen.has(id)) {
      const item = lista.find(x => String(x.id) === id);
      if (item) item.vendidos30d = vendidos;
      continue;
    }
    if (id) seen.add(id);
    lista.push({
      id: p.id,
      nome: p.nome || p.description || '—',
      quantidade: Number(p.quantidade) || 0,
      quantidadeMinima: Number(p.quantidadeMinima) || 1,
      motivo: 'mais_vendido',
      vendidos30d: vendidos,
    });
    added += 1;
  }

  // Preenche vendidos30d nos que já estavam só por mínimo
  for (const item of lista) {
    if (item.vendidos30d) continue;
    const id = String(item.id || '');
    const nome = normalizarNomeProduto(item.nome);
    item.vendidos30d = (id && porId.get(id)) || porNome.get(nome) || 0;
  }

  return lista;
}
