// Service: Status de OS — fluxo, labels, transições
// Centraliza toda a lógica de status de Ordem de Serviço

export const STATUS_FLOW = [
  'novo', 'orcamento', 'orcamento_enviado', 'orcamento_aprovado',
  'autorizado', 'andamento', 'pronto', 'entregue',
];

export const STATUS_LEGACY = {
  'Aguardando':      'novo',
  'Orçamento':       'orcamento',
  'Orçamento Enviado': 'orcamento_enviado',
  'Autorizado':      'autorizado',
  'Executando':      'andamento',
  'Executado':       'pronto',
  'Entregue':        'entregue',
};

export const STATUS_TERMINAIS = ['entregue', 'orcamento_recusado', 'devolvido_orcamento'];

export function getStatusLabel(status) {
  const labels = {
    novo: 'Novo',
    orcamento: 'Orçamento',
    orcamento_enviado: 'Orçamento Enviado',
    orcamento_aprovado: 'Orçamento Aprovado',
    orcamento_recusado: 'Orçamento Recusado',
    devolvido_orcamento: 'Devolvido (Orçamento)',
    autorizado: 'Autorizado',
    andamento: 'Em Andamento',
    pronto: 'Pronto',
    entregue: 'Entregue',
  };
  return labels[status] || status;
}

export function getNextStatus(currentStatus) {
  const idx = STATUS_FLOW.indexOf(currentStatus);
  return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
}

export function isTerminal(status) {
  return STATUS_TERMINAIS.includes(status);
}

export function buildTimelineEntry(oldStatus, newStatus) {
  return {
    date: new Date().toISOString(),
    text: `Status: ${getStatusLabel(oldStatus)} → ${getStatusLabel(newStatus)}`
  };
}
