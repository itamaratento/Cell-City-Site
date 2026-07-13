/* ============================================================
   DATE UTILS — Formatação de datas (Cell City CRM)
   ------------------------------------------------------------
   Fonte única de verdade para formatação de datas em todo o
   CRM. Substitui as 11 implementações locais de formatDate(),
   formatarData(), formatarDataCompleta() — ver TECHDOC §33.

   Uso:
     import { formatDate, formatDateTime } from '../../shared/date-utils.js';
   ============================================================ */
export function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch { return String(iso); }
}

export function formatDateTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
      ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return String(iso); }
}

export function formatDateFull(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return String(iso); }
}
