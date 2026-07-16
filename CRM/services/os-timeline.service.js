// Service: Timeline de OS — registro de eventos, observações, checklist
// Separa a lógica de timeline da lógica de apresentação

export function buildTimelineEvent(tipo, texto) {
  return {
    date: new Date().toISOString(),
    text: `${tipo}: ${texto}`
  };
}

export function addObservationEntry(texto) {
  return buildTimelineEvent('Nota', texto);
}

export function addStatusChangeEntry(oldStatus, newStatus, getStatusLabel) {
  return {
    date: new Date().toISOString(),
    text: `Status: ${getStatusLabel(oldStatus)} → ${getStatusLabel(newStatus)}`
  };
}

export function addDeliveryEntry() {
  return {
    date: new Date().toISOString(),
    text: 'Entregue ao cliente'
  };
}

export function addOrcamentoResponseEntry(resposta, dataResp, horaResp, escNome, obs) {
  const text = resposta === 'aprovado'
    ? `Cliente aprovou ${escNome} em ${dataResp} às ${horaResp}.${obs ? `\n\nObservação:\n"${obs}"` : ''}`
    : `Cliente recusou o orçamento em ${dataResp} às ${horaResp}.\n\nMotivo:\n"${obs}"`;
  return { date: new Date().toISOString(), text };
}
