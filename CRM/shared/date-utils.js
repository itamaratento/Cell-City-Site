/* ============================================================
   DATE UTILS — Formatação de datas (Cell City CRM)
   ------------------------------------------------------------
   Fonte única de verdade para formatação de datas em todo o
   CRM. Substitui as implementações locais de formatDate(),
   formatarData(), fmtData(), fmtDataRel(), fmtDataHora() —
   ver TECHDOC §33/§34.

   Aceita como entrada: string ISO, Date, epoch (ms) e
   Firestore Timestamp (via .toDate() ou {seconds}).

   ATENÇÃO — strings date-only ("YYYY-MM-DD"): use
   formatDateOnly(), que formata por string sem passar por
   Date. new Date('2026-07-13') interpreta como UTC-meia-noite
   e em BRT (UTC-3) exibiria o DIA ANTERIOR.

   Uso:
     import { formatDate, formatDateTime, formatDateOnly }
       from '../../shared/date-utils.js';
   ============================================================ */

// Normaliza qualquer entrada aceita para Date (ou null).
function toDate(x) {
  if (x == null || x === '') return null;
  if (x instanceof Date) return isNaN(x.getTime()) ? null : x;
  if (typeof x.toDate === 'function') { try { return x.toDate(); } catch { return null; } }
  if (typeof x.seconds === 'number') return new Date(x.seconds * 1000);
  const d = new Date(x);
  return isNaN(d.getTime()) ? null : d;
}

/** dd/mm/aa (padrão) ou dd/mm/aaaa com { year: 'numeric' }. */
export function formatDate(x, { year = '2-digit', vazio = '' } = {}) {
  const d = toDate(x);
  if (!d) return vazio;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year });
}

/** dd/mm/aa, hh:mm — year: 'numeric' p/ aaaa, year: null p/ omitir o ano. */
export function formatDateTime(x, { year = '2-digit', vazio = '' } = {}) {
  const d = toDate(x);
  if (!d) return vazio;
  const opts = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
  if (year) opts.year = year;
  return d.toLocaleString('pt-BR', opts);
}

/** dd/mm (sem ano, sem hora). */
export function formatDateShort(x, vazio = '') {
  const d = toDate(x);
  if (!d) return vazio;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** 'YYYY-MM-DD[…]' → dd/mm/aaaa por string — imune a fuso horário. */
export function formatDateOnly(iso, vazio = '') {
  if (!iso) return vazio;
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}

/** dd de mês de aaaa (mês por extenso). */
export function formatDateFull(x, vazio = '') {
  const d = toDate(x);
  if (!d) return vazio;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}


/**
 * Data de entrega de uma OS (garantia/pos-venda).
 * So usa fallback updatedAt quando status === 'entregue'.
 */
export function getDeliveryDate(os) {
  if (Array.isArray(os.timeline)) {
    const entry = [...os.timeline].reverse().find(t => t.text && t.text.includes('Entregue'));
    if (entry?.date) return entry.date;
  }
  if (os.status !== 'entregue') return null;
  const ua = os.updatedAt;
  if (!ua) return null;
  if (typeof ua === 'string') return ua;
  if (ua.toDate) return ua.toDate().toISOString();
  return null;
}

/** Dias corridos desde dateStr ate now. */
export function calcDiasDesde(dateStr, now = new Date()) {
  try { return Math.floor((now - new Date(dateStr)) / 86400000); } catch { return 0; }
}
