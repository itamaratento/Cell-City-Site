/**
 * Montagem pura da mensagem WhatsApp de OS finalizada.
 * Nenhum placeholder/condicional JS deve sobreviver na saída.
 */

export const PORTAL_CLIENTE_URL =
  'https://www.cellcityinformatica.com.br/CRM/pages/portal-cliente/index.html';

/** Template padrão — só placeholders simples {chave}. */
export function msgFinalizadoPadrao() {
  return (
    'Olá, {nome}! 👋\n\n' +
    'Sua Ordem de Serviço foi finalizada com sucesso.\n\n' +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    '📋 *OS Nº:* {os}\n\n' +
    '📱 *Aparelho:*\n{modelo}\n\n' +
    '🛠 *Serviço realizado:*\n{servico}\n\n' +
    '🛡 *Garantia:*\n{garantia}\n\n' +
    '{validade_bloco}' +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    '🌐 *Portal do Cliente*\n\n' +
    'Acompanhe sua Ordem de Serviço sempre que precisar.\n\n' +
    '🔗\n' +
    PORTAL_CLIENTE_URL +
    '\n\n' +
    '📱 Para acessar utilize o mesmo telefone informado na Ordem de Serviço.\n\n' +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    'Obrigado por escolher a Cell City Informática.\n\n' +
    'Estamos à disposição sempre que precisar.\n\n' +
    '📍 Cell City Informática'
  );
}

/** Detecta templates legados com expressão JS / Handlebars visível. */
export function templateFinalizadoInvalido(tpl) {
  if (!tpl || typeof tpl !== 'string') return true;
  return (
    /\{validade\s*\?/.test(tpl) ||
    /\{\{#if\b/.test(tpl) ||
    /\{\{[^}]+\}\}/.test(tpl) ||
    /\{[^}\n]*\?[^}\n]*:[^}\n]*\}/.test(tpl)
  );
}

export function prazoGarantiaDias(os) {
  const n = Number(os?.prazoGarantia);
  if (Number.isFinite(n)) return n;
  return 90;
}

/**
 * @param {object} os
 * @param {string|null} [modeloNome] nome do modelo de garantia (geral/personalizado)
 */
export function formatarGarantia(os, modeloNome = null) {
  const dias = prazoGarantiaDias(os);
  if (dias <= 0) return 'Sem garantia';
  return modeloNome ? `${dias} dias — ${modeloNome}` : `${dias} dias`;
}

export function formatarValidadeGarantia(os) {
  const dias = prazoGarantiaDias(os);
  if (dias <= 0) return '';
  const base = os?.createdAt;
  if (!base) return '';
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('pt-BR');
}

export function formatarModeloAparelho(os) {
  return [os?.brand, os?.model].filter(Boolean).join(' ') || 'Não informado';
}

export function formatarServico(os) {
  const s = (os?.defect || '').trim();
  return s || 'Não especificado';
}

/**
 * Monta a mensagem final com todos os placeholders resolvidos.
 * @param {object} os
 * @param {{ template?: string, garantiaModeloNome?: string|null }} [opts]
 */
export function montarMensagemFinalizado(os, opts = {}) {
  const custom = opts.template;
  const template = templateFinalizadoInvalido(custom)
    ? msgFinalizadoPadrao()
    : custom;

  const nome = String(os?.clientName || '').trim().split(/\s+/)[0] || 'Cliente';
  const validade = formatarValidadeGarantia(os);
  const validadeBloco = validade
    ? `📅 *Válida até:*\n${validade}\n\n`
    : '';

  const msg = template
    .replace(/\{nome\}/g, nome)
    .replace(/\{os\}/g, os?.id || '')
    .replace(/\{modelo\}/g, formatarModeloAparelho(os))
    .replace(/\{aparelho\}/g, formatarModeloAparelho(os))
    .replace(/\{servico\}/g, formatarServico(os))
    .replace(/\{defeito\}/g, formatarServico(os))
    .replace(/\{garantia\}/g, formatarGarantia(os, opts.garantiaModeloNome || null))
    .replace(/\{validade_bloco\}/g, validadeBloco)
    .replace(/\{validade\}/g, validade);

  // Rede de segurança: nenhum ternário/Handlebars residual
  return msg
    .replace(/\{validade\s*\?[^}]*\}/g, '')
    .replace(/\{\{#if[\s\S]*?\}\}/g, '')
    .replace(/\{\{\/if\}\}/g, '')
    .replace(/\{\{[^}]+\}\}/g, '');
}
