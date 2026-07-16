/* ============================================================
   APP-CONFIG.JS — Configuração Global Centralizada
   Sprint 1 · Fase 1.2 (2026-07-16)

   FONTE ÚNICA para constantes, parâmetros e flags compartilhados
   do client. Relação com as fontes que JÁ eram canônicas:

   - env-config.js  → continua sendo o seletor de ambiente/projeto
                      Firebase no BOOT (script clássico, define
                      window.CC_ENV e window.CC_FIREBASE_CONFIG).
                      Este módulo CONSOME o resultado — não o substitui.
   - firebase.js / auth.js / pages/config/config.js / global.css
                    → protegidos (CLAUDE.md §1) — NÃO tocados; a
                      config do Firebase permanece onde está.
   - tenant-context.js → continua dono do ESTADO do tenant em runtime;
                      aqui vive só a CONSTANTE do tenant padrão.
   - functions/lib/config.js → server-side (deploy empacota só
                      functions/); duplicação deliberada e documentada
                      lá — manter os dois em sincronia manual.

   Consumo:
   - Módulos ES:      import { ENV, URLS, TEMPOS, ... } from '../shared/app-config.js'
   - Scripts clássicos (brand-header, dock…): window.CC_CONFIG (side
     effect abaixo) — adoção gradual; enquanto não migram, os literais
     locais desses arquivos devem apontar para cá em comentário.

   Regra de ouro: novo código NÃO cria constante global, chave "cc_"
   nem timeout mágico fora daqui.
   ============================================================ */

// ── AMBIENTE ─────────────────────────────────────────────────
// Deriva de window.CC_ENV (env-config.js). Fallback: recomputa com a
// MESMA regra do env-config (fail-safe = dev) — cobre contexts onde o
// boot script não rodou (testes jsdom/node, imports isolados).
function _computarEnv() {
  try {
    if (typeof window !== 'undefined' && window.CC_ENV) return window.CC_ENV;
    const loc = (typeof location !== 'undefined') ? location : null;
    if (!loc) return 'dev';
    const isProdHost = loc.hostname === 'www.cellcityinformatica.com.br' || loc.hostname === 'cellcityinformatica.com.br';
    const isDevPath = loc.pathname === '/dev' || loc.pathname.startsWith('/dev/');
    return (isProdHost && !isDevPath) ? 'prod' : 'dev';
  } catch { return 'dev'; }
}

export const ENV = {
  get atual() { return _computarEnv(); },
  get isProd() { return _computarEnv() === 'prod'; },
  get isDev()  { return _computarEnv() !== 'prod'; },
  get isLocal() {
    try { return typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1'); }
    catch { return false; }
  },
};

// Prefixo de path do ambiente ('' em produção, '/dev' no espelho DEV).
// Substitui as 24 repetições de `pathname === '/dev' || startsWith('/dev/')`
// espalhadas pelo código (migração gradual — usar em todo código novo).
export function devPrefix() {
  try {
    if (typeof location === 'undefined') return '';
    return (location.pathname === '/dev' || location.pathname.startsWith('/dev/')) ? '/dev' : '';
  } catch { return ''; }
}

// ── URLS ─────────────────────────────────────────────────────
export const URLS = {
  DOMINIO_OFICIAL: 'cellcityinformatica.com.br',
  ORIGEM_PROD: 'https://www.cellcityinformatica.com.br',
  // Link EXTERNO fixo do Portal (mensagens WhatsApp p/ cliente — sempre produção)
  PORTAL_CLIENTE_PROD: 'https://www.cellcityinformatica.com.br/CRM/pages/portal-cliente/index.html',
  CATALOGO_PUBLICO_PROD: 'https://www.cellcityinformatica.com.br/catalogo.html',
  // Navegação interna respeitando o ambiente atual
  portalCliente(query = '') { return `${devPrefix()}/CRM/pages/portal-cliente/index.html${query}`; },
  dashboard() { return `${devPrefix()}/CRM/pages/dashboard/index.html`; },
  login() { return `${devPrefix()}/CRM/login.html`; },
};

// ── TENANT ───────────────────────────────────────────────────
// Constante do tenant padrão (compatibilidade single-tenant). O ESTADO
// do tenant em runtime continua em tenant-context.js; tenant-resolver.js
// reexporta esta constante para os consumidores legados.
export const DEFAULT_TENANT_ID = 'cellcity-master';

// ── TEMPOS (ms) ──────────────────────────────────────────────
export const TEMPOS = {
  FIREBASE_READY_TIMEOUT: 12000,  // espera máxima pelo evento firebase-ready (portal)
  TOAST: 2200,                    // duração padrão de toast (os-ui-utils)
  TOAST_LONGO: 2500,              // variante longa (informacoes)
  SENHA_VISIVEL: 10000,           // popover de senha auto-oculta (central-informacoes)
  DEBOUNCE_DIGITACAO: 700,        // auto-save de campo enquanto digita (obs rápida)
  DEBOUNCE_BUSCA: 300,            // padrão p/ novos campos de busca
};

// ── PAGINAÇÃO E LIMITES ──────────────────────────────────────
export const PAGINACAO = {
  PAGE_SIZE_PADRAO: 20,       // listarPaginado() da Camada Repository
  LIMITE_LISTA_PADRAO: 200,   // teto de segurança p/ listagens sem paginação
  LIMITE_BUSCA_PADRAO: 50,    // teto p/ resultados de busca
};

// ── CACHE ────────────────────────────────────────────────────
export const CACHE = {
  TTL_CURTO_MS: 30_000,        // dados voláteis (contadores, badges)
  TTL_PADRAO_MS: 5 * 60_000,   // listas de referência (categorias, config)
  PREFIXO_STORAGE: 'cc_',
};

// Registro das chaves de localStorage/sessionStorage em uso (fonte da
// verdade para evitar colisão e permitir limpeza consciente). Migração
// dos literais é gradual; chave NOVA nasce aqui obrigatoriamente.
export const STORAGE_KEYS = {
  // sessão/ambiente
  KERNEL_GATE: 'cc_kernel_v1',
  SUPORTE_EMPRESA: 'cc_suporte_empresa_id',   // sessionStorage (Modo Suporte)
  TEMA: 'cc_theme',
  // preferências de UI
  SIDEBAR_ORDER: 'cc_sidebar_order',
  SIDEBAR_STATE: 'cc_sidebar_state',
  DOCK_USER: 'cc_dock_user_id',
  ULTIMA_TELA: 'cc_ultima_tela',
  OS_FAV: 'cc_os_fav',
  INFO_VIEWMODE: 'cc_informacoes_viewmode',
  // caches de dados
  INFO_CACHE: 'cc_informacoes_cache',
  INFO_CATEGORIAS_CACHE: 'cc_categorias_informacoes_cache',
  INFO_RECENTES: 'cc_informacoes_recentes',
  CONFIG_IMPRESSAO: 'cc_config_impressao',
  CONFIG_ALERTAS: 'cc_config_alertas',
  // fluxos entre páginas
  DADOS_PREOS: 'cc_dados_preos',
  DADOS_PORTAL_OS: 'cc_dados_portal_os',
  CRM_MSG: 'cc_crm_msg',
  CRM_PREFILL: 'cc_crm_prefill',
  OPERADOR_NOME: 'cc_operador_nome',
  LINK_AVALIACAO: 'cc_link_avaliacao_google',
  // dock / sidebar / favoritos / central
  DOCK_ORDEM: 'cc_dock_ordem',
  FAVORITOS: 'cc_favoritos',
  MODULOS_FAVS: 'cc_modulos_favs',
  MODULOS_CATALOGO: 'cc_modulos_catalogo',
  MODULOS_LOG: 'cc_modulos_log',
  SIDEBAR_PREFS: 'cc_sidebar_prefs',
  // central-comandos / diário / autoatendimento
  COMANDOS_CACHE: 'cc_comandos_cache',
  COMANDOS_RECENTES: 'cc_comandos_recentes',
  CATEGORIAS_CACHE: 'cc_categorias_cache',
  COMANDOS_VIEWMODE: 'cc_comandos_viewmode',
  MIGRACAO_V1_LOG: 'cc_migracao_v1_log',
  DIARIO_PANELS: 'cc_diario_panels',
  PREOS_CACHE: 'cc_preos_cache',
  // tenant / sync / portal técnico
  TENANT_CACHE: 'cc_tenant_v1',
  DEVICE_NICK: 'cc_device_nick',
  PT_TUTORIAIS: 'cc_pt_tutoriais',
  PT_FAVORITOS: 'cc_pt_favoritos',
  // diagnóstico
  DEBUG_REPO: 'cc_repo_debug',
};

// Coleções Firestore compartilhadas (não confundir com STORAGE_KEYS).
export const COLECOES = {
  CC_LIXEIRA: 'cc_lixeira',
  CC_GDRIVE_LOGS: 'cc_gdrive_logs',
};

// ── LOGS ─────────────────────────────────────────────────────
export const LOGS = {
  DEBUG_KEY: STORAGE_KEYS.DEBUG_REPO,
  debugAtivo() {
    try { return typeof localStorage !== 'undefined' && localStorage.getItem(this.DEBUG_KEY) === '1'; }
    catch { return false; }
  },
  debug(tag, ...args) { if (this.debugAtivo()) console.log(`[${tag}]`, ...args); },
  erro(tag, ...args) { console.error(`[${tag}]`, ...args); },
};

// ── AUDITORIA ────────────────────────────────────────────────
export const AUDITORIA = {
  COLECOES: {
    USUARIOS_PERMISSOES: 'auditoria_usuarios_permissoes', // escrita server-side (excluirUsuarioAdmin) e client (usuarios-permissoes)
  },
};

// ── FEATURE FLAGS ────────────────────────────────────────────
// Fachada única. Flags de RUNTIME delegam à fonte que já as governa
// (tenant-context); registro em runtime evita import estático
// app-config ↔ tenant-context (P2.2-B).
let _tenantFiltersChecker = () => false;

/** @param {() => boolean} fn — tipicamente areTenantFiltersEnabled */
export function registerTenantFiltersChecker(fn) {
  if (typeof fn === 'function') _tenantFiltersChecker = fn;
}

export const FLAGS = {
  filtrosTenant: () => _tenantFiltersChecker(),
  CHAT_ATIVO: false,
  SAAS_ONBOARDING_ATIVO: false,
};

// ── Ponte para scripts clássicos (não-módulo) ────────────────
if (typeof window !== 'undefined') {
  window.CC_CONFIG = {
    ENV, URLS, TEMPOS, PAGINACAO, CACHE, STORAGE_KEYS, COLECOES, LOGS, AUDITORIA,
    FLAGS, DEFAULT_TENANT_ID, devPrefix, registerTenantFiltersChecker,
  };
}
