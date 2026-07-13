/* ============================================================
   SANITIZE — Escape HTML (Cell City CRM)
   ------------------------------------------------------------
   Fonte única de verdade para escape de HTML em todo o CRM.
   Substitui as 28 implementações locais de escHtml()/esc()
   espalhadas pelos módulos — ver TECHDOC §33.

   Uso:
     import { escHtml } from '../../shared/sanitize.js';

   Uso em script clássico (não-module):
     window.CC_escHtml = escHtml;
   ============================================================ */
export function escHtml(s) {
  if (s == null) return '';
  // Escapa também aspas: a saída é interpolada dentro de atributos HTML
  // (value="...", title="...") em vários módulos — a variante DOM
  // (createTextNode→innerHTML) não escapa aspas e reabriria o stored XSS
  // corrigido na Certificação v1.0 (2026-07-10).
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Fallback global para scripts clássicos (não-module)
if (typeof window !== 'undefined') window.CC_escHtml = escHtml;
