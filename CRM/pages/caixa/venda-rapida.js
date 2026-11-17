/**
 * Venda rápida + importação de vendas da Feira (helpers puros).
 */
import { LOCAL_FEIRA, LOCAL_LOJA, normalizarLocal, precoSugerido } from './loja-feira.js';

/**
 * Busca produtos do estoque por parte do nome.
 * @param {object[]} produtos
 * @param {string} termo
 * @param {number} [limite]
 */
export function buscarProdutosPorNome(produtos, termo, limite = 12) {
  const t = String(termo || '').trim().toLowerCase();
  if (t.length < 1) return [];
  return (produtos || [])
    .filter(p => String(p.nome || '').toLowerCase().includes(t))
    .slice(0, limite);
}

/**
 * Monta payload de lançamento para venda rápida (1 clique).
 */
export function montarPayloadVendaRapida({ produto, local, quantidade, dataYYYYMMDD }) {
  if (!produto || !produto.nome) throw new Error('Selecione um produto');
  const qty = Math.max(1, parseInt(quantidade, 10) || 1);
  const loc = normalizarLocal(local);
  const unit = precoSugerido(produto, loc);
  if (!(unit > 0)) throw new Error('Produto sem preço para este local');
  const custoUnit = Number(produto.custo) || 0;
  return {
    tipo: 'entrada',
    descricao: qty > 1 ? `${produto.nome} ×${qty}` : produto.nome,
    categoria: 'Vendas',
    valor: +(unit * qty).toFixed(2),
    custo: +(custoUnit * qty).toFixed(2),
    data: dataYYYYMMDD,
    obs: loc === LOCAL_FEIRA ? 'Venda rápida (Feira)' : 'Venda rápida (Loja)',
    localVenda: loc,
    quantidade: qty,
    produtoId: produto.id || null,
  };
}

/**
 * Parseia lista colada (uma venda por linha) para importação da Feira.
 * Formatos aceitos (vírgula ou espaços no fim):
 *   Nome do produto, quantidade, preço unitário
 *   Nome do produto, preço          (qtd=1)
 *   Nome do produto 2 45,90
 *
 * @returns {{ ok: object[], erros: string[] }}
 */
export function parseVendasFeiraTexto(texto) {
  const linhas = String(texto || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const ok = [];
  const erros = [];
  linhas.forEach((linha, idx) => {
    const n = idx + 1;
    let nome = '';
    let qty = 1;
    let preco = 0;

    if (linha.includes(',')) {
      const parts = linha.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length < 2) {
        erros.push(`Linha ${n}: informe pelo menos nome e preço`);
        return;
      }
      nome = parts[0];
      if (parts.length === 2) {
        preco = parseNumBR(parts[1]);
      } else {
        qty = Math.max(1, parseInt(parts[1], 10) || 1);
        preco = parseNumBR(parts[2]);
      }
    } else {
      // "... 2 45.90" ou "... 45,90"
      const m = linha.match(/^(.*?)(?:\s+(\d+))?\s+([\d]+(?:[.,]\d{1,2})?)\s*$/);
      if (!m) {
        erros.push(`Linha ${n}: não entendi "${linha}"`);
        return;
      }
      nome = m[1].trim();
      qty = m[2] ? Math.max(1, parseInt(m[2], 10)) : 1;
      preco = parseNumBR(m[3]);
    }

    if (!nome) {
      erros.push(`Linha ${n}: nome vazio`);
      return;
    }
    if (!(preco > 0)) {
      erros.push(`Linha ${n}: preço inválido`);
      return;
    }
    ok.push({
      linha: n,
      descricao: qty > 1 ? `${nome} ×${qty}` : nome,
      nomeProduto: nome,
      quantidade: qty,
      valor: +(preco * qty).toFixed(2),
      precoUnit: preco,
      localVenda: LOCAL_FEIRA,
      tipo: 'entrada',
      categoria: 'Vendas',
      obs: 'Importado da Feira',
    });
  });
  return { ok, erros };
}

function parseNumBR(s) {
  const t = String(s || '').trim().replace(/\./g, '').replace(',', '.');
  // if only one separator was comma as decimal:
  const alt = String(s || '').trim().replace(',', '.');
  const n = Number(alt.includes(',') ? t : alt);
  return Number.isFinite(n) ? n : 0;
}

export { LOCAL_FEIRA, LOCAL_LOJA };
