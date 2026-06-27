/* ============================================================
   TENANT.JS — Contexto Multiempresa SaaS
   Cell City Gestão Empresarial

   Gerencia: empresa ativa, plano, módulos, perfil, permissões
   individuais, feature flags e white label por inquilino.

   Uso rápido:
     import { loadContext, hasModulo, hasFeature } from './tenant.js';
     await loadContext(uid);
     if (!hasModulo('estoque')) return;
     if (!hasFeature('whatsapp')) return;
   ============================================================ */

import { db, doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from '../scripts/firebase.js';

const CACHE_KEY = 'cc_tenant_ctx';

// ── Planos predefinidos ────────────────────────────────────────
export const PLANOS = {
  trial: {
    id: 'trial',
    nome: 'Trial',
    descricao: 'Acesso completo por período limitado (7, 15 ou 30 dias)',
    valor: 0,
    modulos: null,  // trial tem acesso total durante o período
    trial: true
  },
  basico: {
    id: 'basico',
    nome: 'Plano Básico',
    descricao: 'OS, Caixa, Financeiro e Alertas',
    valor: 0,
    modulos: ['os', 'caixa', 'financeiro', 'central-alertas', 'clientes', 'config']
  },
  profissional: {
    id: 'profissional',
    nome: 'Plano Profissional',
    descricao: 'Básico + Estoque, Compras, Agenda, Fornecedor, Relatórios e mais',
    valor: 0,
    modulos: [
      'os', 'caixa', 'financeiro', 'central-alertas', 'clientes',
      'estoque', 'compras', 'acaodasemana', 'fornecedor', 'garantias',
      'relatorios', 'pos-venda', 'crm-comercial', 'pendencias', 'config'
    ]
  },
  enterprise: {
    id: 'enterprise',
    nome: 'Plano Enterprise',
    descricao: 'Todos os módulos disponíveis sem restrição',
    valor: 0,
    modulos: null  // null = sem filtro, acesso total
  }
};

// ── Perfis de usuário ──────────────────────────────────────────
export const PERFIS = {
  master_admin: { nome: 'Master Admin',     nivel: 100 },
  admin:        { nome: 'Administrador',    nivel: 80  },
  gerente:      { nome: 'Gerente',          nivel: 60  },
  tecnico:      { nome: 'Técnico',          nivel: 40  },
  caixa:        { nome: 'Operador de Caixa',nivel: 30  },
  atendente:    { nome: 'Atendente',        nivel: 20  }
};

// ── Feature flags disponíveis ──────────────────────────────────
// Recursos independentes dos módulos, configuráveis por empresa.
export const FEATURES_DISPONIVEIS = [
  { id: 'whatsapp',            nome: 'WhatsApp',             icone: '💬' },
  { id: 'api_externa',         nome: 'API Externa',          icone: '🔌' },
  { id: 'ia',                  nome: 'Inteligência Artificial', icone: '🤖' },
  { id: 'dashboard_avancado',  nome: 'Dashboard Avançado',   icone: '📊' },
  { id: 'relatorios_premium',  nome: 'Relatórios Premium',   icone: '📈' },
  { id: 'portal_cliente',      nome: 'Portal do Cliente',    icone: '🔷' },
  { id: 'aplicativo',          nome: 'Aplicativo Mobile',    icone: '📱' },
  { id: 'nfe',                 nome: 'NF-e / NFC-e',         icone: '🧾' },
  { id: 'white_label',         nome: 'White Label',          icone: '🎨' },
  { id: 'importacao_dados',    nome: 'Importação de Dados',  icone: '📥' },
  { id: 'modo_suporte',        nome: 'Modo Suporte',         icone: '🔑' },
  { id: 'backup_automatico',   nome: 'Backup Automático',    icone: '🛡️' },
];

// ── Estado interno ─────────────────────────────────────────────
let _ctx = null;

// Promise que resolve com o contexto assim que loadContext() for chamado com sucesso.
// Módulos devem sempre usar: await tenantReady antes de chamar getEmpresaId()
let _resolveTenantReady;
let _tenantResolved = false; // true após tenantReady resolver (contexto disponível)
export const tenantReady = new Promise(r => {
  _resolveTenantReady = (ctx) => { _tenantResolved = true; r(ctx); };
});

function _readCache() {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}
function _writeCache(ctx) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(ctx)); } catch {}
}

// ═══════════════════════════════════════════════════════════════
// API PÚBLICA — Leitura do contexto
// ═══════════════════════════════════════════════════════════════

/** Retorna o contexto atual (memória → sessionStorage → null). */
export function getTenant() {
  if (_ctx) return _ctx;
  _ctx = _readCache();
  if (_ctx) {
    console.log('[TENANT] Contexto restaurado do sessionStorage:', _ctx.empresa_id);
    // Resolve tenantReady caso o contexto venha do cache (sessão anterior)
    _resolveTenantReady(_ctx);
  }
  return _ctx;
}

/** empresa_id da sessão atual.
 *  REQUER que tenantReady já tenha resolvido.
 *  Retorna null se chamado antes do contexto carregar — nunca use o resultado
 *  null em queries Firestore: o módulo deve aguardar await tenantReady primeiro. */
export function getEmpresaId() {
  if (!_tenantResolved) {
    console.error(
      '[TENANT] ⚠️ getEmpresaId() chamado ANTES de tenantReady resolver!\n' +
      '         Adicione `await window._ccTenantReady` antes de consultar o Firestore.\n' +
      '         Retornando null — query Firestore NÃO será executada com empresa incorreta.'
    );
    return null;
  }
  const id = getTenant()?.empresa_id || 'cellcity-master';
  if (!getTenant()) console.warn('[TENANT] getEmpresaId(): contexto nulo após tenant resolve — usando fallback:', id);
  return id;
}

/** Perfil do usuário atual. */
export function getPerfil() {
  return getTenant()?.perfil || 'admin';
}

/** true se o usuário é Master Admin (acesso total). */
export function isMasterAdmin() {
  return getTenant()?.perfil === 'master_admin';
}

/** true se a licença está vencida ou a empresa está bloqueada. */
export function isBloqueado() {
  return getTenant()?.bloqueado === true;
}

/**
 * Nível de acesso individual do usuário a um módulo.
 * Retorna: 'total' | 'consulta' | 'bloqueado'
 *
 * Ordem de precedência:
 *  1. master_admin → sempre 'total'
 *  2. Override individual do usuário (permissoes_modulos)
 *  3. Padrão do perfil
 */
export function getNivelAcesso(id) {
  const ctx = getTenant();
  if (!ctx || ctx.perfil === 'master_admin') return 'total';

  // Override individual (definido na Central SaaS por empresa)
  const override = ctx.permissoes_modulos?.[id];
  if (override === 'bloqueado' || override === 'consulta' || override === 'total') return override;

  // Padrão por perfil
  const perfil = ctx.perfil;
  const bloqueadosPorPerfil = {
    tecnico:   ['caixa', 'financeiro', 'relatorios', 'fechamento'],
    caixa:     ['relatorios', 'crm-comercial', 'central-automacao'],
    atendente: ['relatorios', 'caixa', 'financeiro', 'estoque', 'compras', 'fechamento']
  };
  const somenteLeituraPorPerfil = {
    tecnico:   ['clientes'],
    caixa:     ['clientes', 'estoque', 'os'],
    atendente: ['clientes', 'garantias']
  };

  if (bloqueadosPorPerfil[perfil]?.includes(id))     return 'bloqueado';
  if (somenteLeituraPorPerfil[perfil]?.includes(id)) return 'consulta';
  return 'total';
}

/**
 * Verifica se o módulo está disponível para a empresa E o usuário.
 * Master Admin e Enterprise sempre retornam true.
 */
export function hasModulo(id) {
  const ctx = getTenant();
  if (!ctx) return true;                          // sem contexto → modo legado
  if (ctx.perfil === 'master_admin') return true; // master vê tudo
  if (ctx.bloqueado) return false;                // licença vencida/bloqueada

  // Verifica se empresa tem o módulo
  const mods = ctx.modulos_ativos;
  if (mods && !mods.includes(id)) return false;

  // Verifica permissão individual
  return getNivelAcesso(id) !== 'bloqueado';
}

/**
 * Verifica se uma feature flag está ativa para a empresa.
 * Master Admin sempre retorna true.
 */
export function hasFeature(id) {
  const ctx = getTenant();
  if (!ctx || ctx.perfil === 'master_admin') return true;
  if (ctx.bloqueado) return false;
  const flags = ctx.feature_flags;
  if (!flags) return false;
  return flags[id] === true;
}

/** White label da empresa atual (logo, cores, nome). */
export function getWhiteLabel() {
  return getTenant()?.empresa?.white_label || null;
}

// ═══════════════════════════════════════════════════════════════
// LOAD CONTEXT — Carrega e valida o contexto após login
// ═══════════════════════════════════════════════════════════════

export async function loadContext(uid) {
  try {
    console.log('[TENANT] Carregando contexto para uid:', uid);
    const userSnap = await getDoc(doc(db, 'usuarios', uid));
    if (!userSnap.exists()) {
      console.error('[TENANT] Documento usuarios/' + uid + ' não encontrado no Firestore.');
      return null;
    }

    const userData = userSnap.data();

    // Suporte mode: master acessa como outra empresa
    const suporteId = sessionStorage.getItem('cc_suporte_empresa_id');
    const empId = suporteId || userData.empresa_id;

    const empSnap = await getDoc(doc(db, 'empresas', empId));
    const empData = empSnap.exists() ? empSnap.data() : {};

    // ── 1. Status administrativo ──
    const status = empData.status || 'ativo';
    if (status === 'bloqueado' || status === 'cancelado' || status === 'arquivado') {
      console.warn(`[TENANT] Empresa ${empId} bloqueada: status=${status}`);
      _ctx = {
        uid, empresa_id: empId, perfil: userData.perfil || 'admin',
        nome: userData.nome || '', email: userData.email || '',
        empresa: empData, modulos_ativos: null,
        bloqueado: true, motivo_bloqueio: status, status
      };
      _writeCache(_ctx);
      _resolveTenantReady(_ctx);
      return _ctx;
    }

    // ── 2. Vencimento automático ──
    if (empData.data_vencimento && status !== 'arquivado') {
      const venc = empData.data_vencimento?.toDate
        ? empData.data_vencimento.toDate()
        : new Date(empData.data_vencimento);
      if (venc < new Date()) {
        console.warn(`[TENANT] Licença vencida para ${empId} em ${venc.toISOString()}`);
        _ctx = {
          uid, empresa_id: empId, perfil: userData.perfil || 'admin',
          nome: userData.nome || '', email: userData.email || '',
          empresa: empData, modulos_ativos: null,
          bloqueado: true, motivo_bloqueio: 'licenca_vencida', status: 'vencido',
          data_vencimento: venc.toISOString()
        };
        _writeCache(_ctx);
        _resolveTenantReady(_ctx);
        // Registra vencimento (não bloqueia o return)
        _registrarVencimento(empId, empData).catch(() => {});
        return _ctx;
      }
    }

    // ── 3. Módulos ativos ──
    const plano = PLANOS[empData.plano] || PLANOS.enterprise;
    const modulosAtivos = empData.modulos_ativos || plano.modulos;

    // ── 4. Permissões individuais do usuário ──
    const permissoesMod = userData.permissoes_modulos || {};

    // ── 5. Feature flags ──
    const featureFlags = empData.feature_flags || {};

    _ctx = {
      uid,
      empresa_id:         empId,
      perfil:             userData.perfil       || 'admin',
      nome:               userData.nome         || '',
      email:              userData.email        || '',
      foto_url:           userData.foto_url     || '',
      empresa:            empData,
      modulos_ativos:     modulosAtivos,
      permissoes_modulos: permissoesMod,
      feature_flags:      featureFlags,
      status,
      bloqueado:          false,
      em_suporte:         !!suporteId,           // true quando master está em modo suporte
      suporte_empresa_id: suporteId || null
    };

    _writeCache(_ctx);
    _resolveTenantReady(_ctx); // libera qualquer módulo aguardando tenantReady
    console.log(`[TENANT] Contexto carregado: empresa_id=${_ctx.empresa_id} perfil=${_ctx.perfil} bloqueado=${_ctx.bloqueado}`);

    // Notifica módulos que o contexto está disponível
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cc-tenant-ready', { detail: { ctx: _ctx } }));
    }

    // Atualiza último acesso + device info (non-blocking)
    setDoc(doc(db, 'usuarios', uid), {
      ultimo_acesso: serverTimestamp(),
      ultimo_dispositivo: navigator.userAgent?.slice(0, 100) || ''
    }, { merge: true }).catch(() => {});

    return _ctx;
  } catch (err) {
    console.error('[TENANT] Erro ao carregar contexto:', err.message);
    console.error('[TENANT] Stack:', err.stack);
    return null;
  }
}

async function _registrarVencimento(empId, empData) {
  try {
    await addDoc(collection(db, 'notificacoes_saas'), {
      tipo: 'licenca_vencida',
      empresa_id: empId,
      empresa_nome: empData.nome_fantasia || empData.razao_social || empId,
      mensagem: `Licença vencida para a empresa ${empData.nome_fantasia || empId}`,
      lida: false,
      timestamp: serverTimestamp()
    });
  } catch {}
}

/** Remove o contexto da sessão (chamar no logout). */
export function clearContext() {
  _ctx = null;
  sessionStorage.removeItem(CACHE_KEY);
  sessionStorage.removeItem('cc_suporte_empresa_id');
}

/** Entra em modo suporte como outra empresa. Só para master_admin. */
export async function ativarModoSuporte(empresaId, empresaNome) {
  if (!isMasterAdmin()) throw new Error('Apenas Master Admin pode usar o Modo Suporte.');
  const ctx = getTenant();
  sessionStorage.setItem('cc_suporte_empresa_id', empresaId);
  await logAuditoria('modo_suporte_ativado', {
    empresa_alvo_id: empresaId,
    empresa_alvo_nome: empresaNome,
    master_uid: ctx?.uid,
    master_nome: ctx?.nome
  });
}

/** Sai do modo suporte, voltando para a empresa master. */
export async function desativarModoSuporte() {
  const empresaId = sessionStorage.getItem('cc_suporte_empresa_id');
  sessionStorage.removeItem('cc_suporte_empresa_id');
  _ctx = null;
  await logAuditoria('modo_suporte_encerrado', { empresa_alvo_id: empresaId || 'desconhecido' });
}

// ═══════════════════════════════════════════════════════════════
// AUDITORIA
// ═══════════════════════════════════════════════════════════════

export async function logAuditoria(acao, detalhes = {}) {
  try {
    const ctx = getTenant();
    await addDoc(collection(db, 'auditoria_saas'), {
      empresa_id:   ctx?.empresa_id  || 'sistema',
      usuario_id:   ctx?.uid         || 'sistema',
      usuario_nome: ctx?.nome        || '',
      perfil:       ctx?.perfil      || '',
      acao,
      detalhes,
      em_suporte:   ctx?.em_suporte  || false,
      timestamp:    serverTimestamp()
    });
  } catch {}
}
