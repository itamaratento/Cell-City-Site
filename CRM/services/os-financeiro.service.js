// Service: Financeiro de OS — cálculo de valores, registro de caixa
// Centraliza as regras financeiras relacionadas a OS

export function calcularLucro(valor, custo) {
  return (parseFloat(valor) || 0) - (parseFloat(custo) || 0);
}

export function montarLancamentoCaixa(osId, clientName, model, valor) {
  const v = parseFloat(valor) || 0;
  const dataISO = new Date().toISOString();
  return {
    tipo: 'entrada',
    descricao: `OS ${osId} - ${clientName || ''} - ${model || ''}`,
    categoria: 'Vendas',
    valor: v,
    custo: 0,
    lucro: v,
    data: dataISO.slice(0, 10),
    dataISO,
    ano: new Date().getFullYear(),
    osId,
  };
}

export function formatarValorPago(valor) {
  return `R$ ${Number(valor || 0).toFixed(2)}`;
}
