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
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(s)));
  return d.innerHTML;
}

// Fallback global para scripts clássicos (não-module)
if (typeof window !== 'undefined') window.CC_escHtml = escHtml;
