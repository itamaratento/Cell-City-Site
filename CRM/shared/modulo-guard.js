/* ============================================================
   MODULO-GUARD.JS — Proteção Padrão de Módulos
   Cell City Gestão Empresarial

   PADRÃO OBRIGATÓRIO para todos os módulos do sistema.
   Todo módulo DEVE chamar initModulo() no carregamento.

   Uso (em cada módulo):
     <script type="module">
       import { initModulo } from '../../shared/modulo-guard.js';
       const ctx = await initModulo('os');  // 'os' = ID do módulo
       if (!ctx) return;  // guard redirecionou / exibiu bloqueio

       // Módulo liberado — inicializa normalmente
       const empresaId = ctx.empresa_id;
     </script>

   O que initModulo() verifica (em ordem):
     1. Sessão: cc_acesso === 'ok' → senão redireciona para login
     2. Contexto tenant: carrega se ainda não carregado
     3. Licença: bloqueada/vencida → exibe tela de bloqueio
     4. Permissão do módulo: hasModulo(id) → senão redireciona para dashboard
   ============================================================ */

import { auth, authReady } from '../scripts/firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getTenant, loadContext, hasModulo, isBloqueado, isMasterAdmin } from './tenant.js';

const LOGIN_URL     = '/CRM/pages/config/index.html';
const DASHBOARD_URL = '/CRM/pages/dashboard/index.html';

/**
 * Inicializa a proteção do módulo.
 * Retorna o contexto do tenant ou null (quando redireciona ou exibe bloqueio).
 *
 * @param {string} moduloId - ID do módulo (deve corresponder ao id em TODOS_MODULOS)
 * @param {Object} [opcoes]
 * @param {boolean} [opcoes.somenteLeitura] - True se o módulo é só consulta para alguns perfis
 * @returns {Promise<Object|null>} Contexto tenant ou null
 */
export async function initModulo(moduloId, opcoes = {}) {
  // ── 1. Sessão ───────────────────────────────────────────────
  if (sessionStorage.getItem('cc_acesso') !== 'ok') {
    window.location.replace(LOGIN_URL);
    return null;
  }

  // ── 2. Firebase Auth ────────────────────────────────────────
  await authReady;
  const user = await _aguardarUsuario();

  // ── 3. Contexto do tenant ───────────────────────────────────
  let ctx = getTenant();
  if (!ctx && user && !user.isAnonymous) {
    ctx = await loadContext(user.uid);
  }

  // ── 4. Verificar bloqueio de licença ────────────────────────
  if (ctx?.bloqueado) {
    _exibirTelaBloqueio(ctx);
    return null;
  }

  // ── 5. Verificar permissão do módulo ────────────────────────
  // Master admin passa sempre
  if (ctx && !isMasterAdmin() && !hasModulo(moduloId)) {
    _exibirSemPermissao(moduloId);
    return null;
  }

  // ── 6. Aplicar white label ─────────────────────────────────
  _aplicarWhiteLabel(ctx?.empresa?.white_label);

  // ── 7. Indicador de modo suporte ───────────────────────────
  if (ctx?.em_suporte) {
    _exibirBannerSuporte(ctx);
  }

  return ctx || null;
}

// ─── Utilitários internos ────────────────────────────────────

function _aguardarUsuario() {
  return new Promise(resolve => {
    const u = auth.currentUser;
    if (u !== undefined && u !== null) { resolve(u); return; }
    const unsub = onAuthStateChanged(auth, user => { unsub(); resolve(user); });
    setTimeout(() => resolve(null), 3000);
  });
}

function _exibirTelaBloqueio(ctx) {
  const motivo = ctx.motivo_bloqueio;
  const msgs = {
    licenca_vencida: { titulo: 'Licença Vencida', sub: 'Sua licença venceu. Entre em contato para renovar o acesso.', icone: '⏰' },
    bloqueado:       { titulo: 'Empresa Bloqueada', sub: 'Sua empresa foi bloqueada por inadimplência. Entre em contato com o suporte.', icone: '🔴' },
    cancelado:       { titulo: 'Contrato Cancelado', sub: 'O contrato desta empresa foi encerrado.', icone: '⛔' },
    arquivado:       { titulo: 'Empresa Arquivada', sub: 'Esta empresa está arquivada. Contate o administrador.', icone: '📦' }
  };
  const info = msgs[motivo] || { titulo: 'Acesso Bloqueado', sub: 'Contate o administrador do sistema.', icone: '🔒' };

  document.body.innerHTML = `
    <div style="
      min-height:100vh; display:flex; align-items:center; justify-content:center;
      background:#050505; color:#e8edf5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
      flex-direction:column; gap:20px; text-align:center; padding:24px;">
      <div style="font-size:64px; line-height:1">${info.icone}</div>
      <h1 style="font-size:24px; font-weight:900; color:#ef4444">${info.titulo}</h1>
      <p style="font-size:15px; color:#9aa5b8; max-width:400px">${info.sub}</p>
      ${ctx.data_vencimento ? `<p style="font-size:13px;color:#5a6578">Venceu em: ${new Date(ctx.data_vencimento).toLocaleDateString('pt-BR')}</p>` : ''}
      <div style="display:flex;gap:12px;margin-top:8px">
        <a href="/CRM/pages/config/index.html" style="
          padding:12px 24px; background:#1a1d21; border:1px solid rgba(255,255,255,0.1);
          border-radius:10px; color:#9aa5b8; text-decoration:none; font-size:14px; font-weight:600;">
          ← Sair
        </a>
        <a href="https://wa.me/55" style="
          padding:12px 24px; background:#00c853; border:none;
          border-radius:10px; color:#000; text-decoration:none; font-size:14px; font-weight:700;">
          📞 Falar com Suporte
        </a>
      </div>
    </div>`;
}

function _exibirSemPermissao(moduloId) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(5,5,5,0.96);z-index:9999;
    display:flex;align-items:center;justify-content:center;
    flex-direction:column;gap:16px;text-align:center;padding:24px;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;`;
  overlay.innerHTML = `
    <div style="font-size:48px">🔒</div>
    <h2 style="font-size:20px;font-weight:800;color:#ef4444">Sem Permissão</h2>
    <p style="font-size:14px;color:#9aa5b8;max-width:320px">
      O módulo <strong style="color:#e8edf5">${moduloId}</strong> não está disponível no seu plano ou perfil.
    </p>
    <a href="${DASHBOARD_URL}" style="
      padding:10px 24px;background:#141618;border:1px solid rgba(255,255,255,0.1);
      border-radius:10px;color:#9aa5b8;text-decoration:none;font-size:13px;font-weight:600;margin-top:4px">
      ← Voltar ao Dashboard
    </a>`;
  document.body.appendChild(overlay);
}

function _aplicarWhiteLabel(wl) {
  if (!wl) return;
  const root = document.documentElement;
  if (wl.cor_primaria)   root.style.setProperty('--cell-green', wl.cor_primaria);
  if (wl.cor_secundaria) root.style.setProperty('--cell-green-dim', wl.cor_secundaria);
  if (wl.nome) {
    const titles = document.querySelectorAll('.app-name, [data-app-name]');
    titles.forEach(el => { el.textContent = wl.nome; });
    if (document.title.includes('Cell City')) {
      document.title = document.title.replace(/Cell City/g, wl.nome);
    }
  }
}

function _exibirBannerSuporte(ctx) {
  const banner = document.createElement('div');
  banner.id = 'suporte-banner';
  banner.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:10000;
    background:#f59e0b;color:#000;
    display:flex;align-items:center;justify-content:center;gap:12px;
    padding:8px 16px;font-size:13px;font-weight:700;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;`;
  banner.innerHTML = `
    <span>🔑 MODO SUPORTE — Empresa: ${ctx.empresa?.nome_fantasia || ctx.empresa_id}</span>
    <button onclick="window._sairModoSuporte && window._sairModoSuporte()" style="
      background:#000;color:#fff;border:none;border-radius:6px;
      padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer">
      Sair do Suporte
    </button>`;
  document.body.prepend(banner);
  document.body.style.paddingTop = ((parseInt(document.body.style.paddingTop) || 0) + 38) + 'px';

  // Função global para sair do suporte
  window._sairModoSuporte = async () => {
    try {
      const { desativarModoSuporte } = await import('./tenant.js');
      await desativarModoSuporte();
    } catch {}
    sessionStorage.removeItem('cc_suporte_empresa_id');
    window.location.href = '/CRM/pages/saas/index.html';
  };
}

// ─── Exportações utilitárias ─────────────────────────────────

/** Filtra array de itens pelo hasModulo() — útil para menus dinâmicos. */
export function filtrarPorPermissao(itens, getIdFn = i => i.id) {
  return itens.filter(item => hasModulo(getIdFn(item)));
}

/** Retorna empresa_id da sessão (getEmpresaId simplificado para módulos). */
export function getEmpresaAtual() {
  return getTenant()?.empresa_id || 'cellcity-master';
}
