/**
 * Loja × Feira — helpers puros (preço sugerido, local, totais).
 */

export const LOCAL_LOJA = 'loja';
export const LOCAL_FEIRA = 'feira';

export const LOCAIS_VENDA = [
  { id: LOCAL_LOJA, label: 'Loja Cell City' },
  { id: LOCAL_FEIRA, label: 'Feira da Marreta' },
];

export function labelLocal(id) {
  const found = LOCAIS_VENDA.find(l => l.id === id);
  return found ? found.label : 'Loja Cell City';
}

/** Normaliza local: só 'feira' é feira; resto (incl. vazio/legado) = loja. */
export function normalizarLocal(local) {
  return local === LOCAL_FEIRA ? LOCAL_FEIRA : LOCAL_LOJA;
}

/**
 * Preço sugerido conforme o local.
 * Feira usa vendaFeira; se ausente/zero, cai no preço de loja (venda).
 */
export function precoSugerido(produto, local) {
  if (!produto) return 0;
  const loja = Number(produto.venda) || 0;
  if (normalizarLocal(local) === LOCAL_FEIRA) {
    const feira = Number(produto.vendaFeira) || 0;
    return feira > 0 ? feira : loja;
  }
  return loja;
}

/** Totais de vendas (não-saída) + despesas, opcionalmente filtrados por local. */
export function totaisPorLocal(lancamentos, localFiltro = 'todos') {
  const lista = Array.isArray(lancamentos) ? lancamentos : [];
  const filtrados = localFiltro === 'todos'
    ? lista
    : lista.filter(l => normalizarLocal(l.localVenda) === localFiltro);

  const vendas = filtrados.filter(l => l.tipo !== 'saida');
  const despesas = filtrados.filter(l => l.tipo === 'saida');
  const vendido = vendas.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const custoMercadoria = vendas.reduce((s, l) => s + (Number(l.custo) || 0), 0);
  const totalDespesas = despesas.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const custo = custoMercadoria + totalDespesas;
  const lucro = vendido - custo;

  return { vendido, custo, lucro, qtd: filtrados.length };
}

/** Breakdown Loja / Feira (sempre sobre a lista já filtrada por período). */
export function breakdownLocais(lancamentos) {
  return {
    loja: totaisPorLocal(lancamentos, LOCAL_LOJA),
    feira: totaisPorLocal(lancamentos, LOCAL_FEIRA),
  };
}
