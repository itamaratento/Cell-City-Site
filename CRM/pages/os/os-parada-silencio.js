/**
 * OS paradas / silêncio de alerta / aguardando retirada.
 * Pure helpers — usados pelo CRM (OS + sino do Dashboard) e pelos testes.
 *
 * Status `aguardando_retirada`: cliente já avisado; permanece em andamento
 * (não é terminal); sai do alerta "+15 dias"; lembrete de cobrança a cada 30 dias.
 *
 * Silêncio: silenciadoAte (ISO ou null = até mudar status), silenciadoMotivo, silenciadoPor.
 * Mudança de status limpa o silêncio.
 */

export const STATUS_AGUARDANDO_RETIRADA = 'aguardando_retirada';
export const DIAS_PARADA = 15;
export const DIAS_COBRANCA_RETIRADA = 30;

/** Sentinel gravado em silenciadoAte quando a opção é "até mudar o status". */
export const SILENCIO_ATE_STATUS = 'ate_status';

export const OPCOES_SILENCIO = [
  { key: '15', label: '15 dias', dias: 15 },
  { key: '30', label: '30 dias', dias: 30 },
  { key: 'ate_status', label: 'Até mudar o status', dias: null },
];

/**
 * @param {object} os
 * @param {number} [agoraMs]
 * @returns {boolean}
 */
export function isSilencioAtivo(os, agoraMs = Date.now()) {
  if (!os) return false;
  const ate = os.silenciadoAte;
  const temMeta = !!(os.silenciadoMotivo || os.silenciadoPor || ate);
  if (!temMeta) return false;
  if (ate == null || ate === '' || ate === SILENCIO_ATE_STATUS) {
    // "até mudar status" — ativo enquanto houver motivo/por ou sentinel
    return !!(os.silenciadoMotivo || os.silenciadoPor || ate === SILENCIO_ATE_STATUS);
  }
  const t = Date.parse(ate);
  if (Number.isNaN(t)) return false;
  return t > agoraMs;
}

/** Payload para limpar silêncio (status mudou ou reativação manual). */
export function payloadLimparSilencio() {
  return {
    silenciadoAte: null,
    silenciadoMotivo: null,
    silenciadoPor: null,
  };
}

/**
 * @param {'15'|'30'|'ate_status'|string} opcao
 * @param {string} motivo
 * @param {string} por
 * @param {number} [agoraMs]
 */
export function payloadSilenciar(opcao, motivo, por, agoraMs = Date.now()) {
  const motivoLimpo = String(motivo || '').trim();
  const porLimpo = String(por || '').trim() || 'Operador';
  if (!motivoLimpo) throw new Error('Informe o motivo do silêncio');
  let silenciadoAte;
  if (opcao === 'ate_status' || opcao === SILENCIO_ATE_STATUS) {
    silenciadoAte = SILENCIO_ATE_STATUS;
  } else {
    const dias = Number(opcao);
    if (![15, 30].includes(dias)) throw new Error('Opção de silêncio inválida');
    silenciadoAte = new Date(agoraMs + dias * 86400000).toISOString();
  }
  return {
    silenciadoAte,
    silenciadoMotivo: motivoLimpo,
    silenciadoPor: porLimpo,
  };
}

/** Texto curto do selo no detalhe da OS. */
export function textoSeloSilencio(os, agoraMs = Date.now()) {
  if (!isSilencioAtivo(os, agoraMs)) return '';
  const motivo = os.silenciadoMotivo ? ` — ${os.silenciadoMotivo}` : '';
  if (os.silenciadoAte === SILENCIO_ATE_STATUS || os.silenciadoAte == null || os.silenciadoAte === '') {
    return `🔕 Alerta silenciado até mudar o status${motivo}`;
  }
  try {
    const d = new Date(os.silenciadoAte);
    const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `🔕 Alerta silenciado até ${label}${motivo}`;
  } catch {
    return `🔕 Alerta silenciado${motivo}`;
  }
}

/**
 * Alerta "OS paradas (+15 dias)": andamento, não aguardando retirada, não silenciada.
 * @param {object} os
 * @param {number} diasDesdeUltimoStatus
 * @param {number} [agoraMs]
 */
export function deveAlertarParada(os, diasDesdeUltimoStatus, agoraMs = Date.now()) {
  const st = (os && os.status) || '';
  if (st === STATUS_AGUARDANDO_RETIRADA) return false;
  if (isSilencioAtivo(os, agoraMs)) return false;
  return Number(diasDesdeUltimoStatus) >= DIAS_PARADA;
}

/**
 * Lembrete de cobrança (aguardando retirada): a cada 30 dias sem mudança.
 * @param {object} os
 * @param {number} diasDesdeUltimoStatus
 * @param {number} [agoraMs]
 */
export function deveAlertarCobrancaRetirada(os, diasDesdeUltimoStatus, agoraMs = Date.now()) {
  const st = (os && os.status) || '';
  if (st !== STATUS_AGUARDANDO_RETIRADA) return false;
  if (isSilencioAtivo(os, agoraMs)) return false;
  const dias = Number(diasDesdeUltimoStatus);
  if (dias < DIAS_COBRANCA_RETIRADA) return false;
  // "a cada 30 dias": dispara em 30, 60, 90… (janela do dia do ciclo)
  // Mantém no sino enquanto dias >= 30 (operador pode silenciar).
  return true;
}

if (typeof window !== 'undefined') {
  window.OSParadaSilencio = {
    STATUS_AGUARDANDO_RETIRADA,
    DIAS_PARADA,
    DIAS_COBRANCA_RETIRADA,
    SILENCIO_ATE_STATUS,
    OPCOES_SILENCIO,
    isSilencioAtivo,
    payloadLimparSilencio,
    payloadSilenciar,
    textoSeloSilencio,
    deveAlertarParada,
    deveAlertarCobrancaRetirada,
  };
}
