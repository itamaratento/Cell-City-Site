/**
 * Mensagem pronta ao criar OS (e botão "Copiar mensagem" no detalhe).
 * Pura — sem DOM/Firestore. Link do Portal sempre em produção, com ?tel=&os=.
 */

export const PORTAL_CLIENTE_URL =
  'https://www.cellcityinformatica.com.br/CRM/pages/portal-cliente/index.html';

/** Sugere categoria a partir do texto do modelo/marca. */
export function sugerirCategoriaPorModelo(texto) {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!t.trim()) return null;
  if (
    /\b(notebook|laptop|ultrabook|netbook|chromebook|macbook)\b/.test(t) ||
    /\b(dell|acer|lenovo|asus|hp pavilion|positivo|samsung book|ideapad|thinkpad|inspiron|vivobook|zenbook)\b/.test(t)
  ) {
    return 'notebook';
  }
  if (
    /\b(impressora|printer|multifuncional|epson|brother|canon pixma|hp tank|deskjet|laserjet|ecotank|tanque de tinta)\b/.test(t) ||
    /\bhp\s*tank\b/.test(t)
  ) {
    return 'impressora';
  }
  return null;
}

export function digitosTelefoneOS(os) {
  const d = String(os?.phoneDigits || '').replace(/\D/g, '');
  if (d.length >= 10) return d;
  return String(os?.phone || '').replace(/\D/g, '');
}

export function linkPortalClienteOS(os) {
  const tel = digitosTelefoneOS(os);
  const osId = encodeURIComponent(os?.id || '');
  const q = [];
  if (tel) q.push(`tel=${encodeURIComponent(tel)}`);
  if (osId) q.push(`os=${osId}`);
  return q.length ? `${PORTAL_CLIENTE_URL}?${q.join('&')}` : PORTAL_CLIENTE_URL;
}

function primeiroNome(os) {
  return String(os?.clientName || '').trim().split(/\s+/)[0] || 'Cliente';
}

function aparelho(os) {
  return [os?.brand, os?.model].filter(Boolean).join(' ') || 'Não informado';
}

function formatarValor(os) {
  const n = Number(os?.valor);
  if (!Number.isFinite(n) || n <= 0) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarGarantiaCriacao(os) {
  const n = Number(os?.prazoGarantia);
  const dias = Number.isFinite(n) ? n : 90;
  if (dias <= 0) return 'Sem garantia';
  return `${dias} dias`;
}

/**
 * Monta a mensagem de abertura da OS para o cliente.
 * @param {object} os
 */
export function montarMensagemCriacao(os) {
  const nome = primeiroNome(os);
  const valor = formatarValor(os);
  const linhas = [
    `Olá, ${nome}! 👋`,
    '',
    'Sua Ordem de Serviço foi aberta na Cell City Informática.',
    '',
    `📋 *OS Nº:* ${os?.id || ''}`,
    `📱 *Aparelho:* ${aparelho(os)}`,
  ];
  if (valor) linhas.push(`💰 *Valor:* ${valor}`);
  linhas.push(`🛡 *Garantia:* ${formatarGarantiaCriacao(os)}`);
  linhas.push('');
  linhas.push('🌐 *Portal do Cliente*');
  linhas.push('Acompanhe sua OS pelo link:');
  linhas.push(linkPortalClienteOS(os));
  linhas.push('');
  linhas.push('📱 Use o mesmo telefone informado na OS para acessar.');
  linhas.push('');
  linhas.push('Cell City Informática');
  return linhas.join('\n');
}
