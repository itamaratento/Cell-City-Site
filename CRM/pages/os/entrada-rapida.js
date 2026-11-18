/**
 * Helpers da entrada rápida da Nova OS (puros — sem DOM/Firebase).
 */

/** Categorias com bloqueio de tela — impressora e afins não pedem senha. */
const CATS_COM_BLOQUEIO = new Set(['celular', 'tablet', 'notebook']);

/** Sem senha/padrão registrados (e não marcado "Sem senha"). Não bloqueia criação. */
export function osFaltaSenha(os) {
  if (!os) return false;
  const cat = String(os.category || os.categoria || '').toLowerCase().trim();
  // Sem categoria → trata como aparelho com bloqueio (legado). Impressora/outros → nunca.
  if (cat && !CATS_COM_BLOQUEIO.has(cat)) return false;
  if (String(os.password || '').trim()) return false;
  if (Array.isArray(os.patternSequence) && os.patternSequence.length > 0) return false;
  const lt = String(os.lockType || '').toLowerCase();
  if (lt === 'sem senha') return false;
  return true;
}

/** Texto dos acessórios deixados gravados na OS. */
export function acessoriosTexto(os) {
  const arr = Array.isArray(os?.acessoriosDeixados)
    ? os.acessoriosDeixados.map(a => String(a || '').trim()).filter(Boolean)
    : [];
  return arr.length ? arr.join(', ') : '';
}

/** Badge HTML curto para lista/detalhe (já escapado pelo chamador se necessário). */
export function badgeFaltaSenhaHtml() {
  return '<span class="os-falta-senha" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;color:#b45309;background:rgba(245,158,11,0.18);border:1px solid rgba(245,158,11,0.45);padding:2px 8px;border-radius:100px;">⚠️ FALTA SENHA</span>';
}
