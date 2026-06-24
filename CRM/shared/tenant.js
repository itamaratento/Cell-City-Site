/* ============================================================
   TENANT.JS — Contexto Multiempresa (SaaS)
   Cell City Gestão Empresarial

   Carrega e mantém o contexto da empresa ativa após login:
   empresa_id, plano, módulos liberados, perfil do usuário.

   Uso:
     import { loadContext, getTenant, hasModulo, getEmpresaId } from './tenant.js';
     await loadContext(uid);
     if (!hasModulo('estoque')) redirectToHome();
   ============================================================ */

import { db, doc, getDoc, setDoc, serverTimestamp } from '../scripts/firebase.js';

const CACHE_KEY = 'cc_tenant_ctx';

// ── Planos predefinidos ────────────────────────────────────────
export const PLANOS = {
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

// ── Perfis de usuário ─────────────────────────────────────────
export const PERFIS = {
  master_admin: { nome: 'Master Admin',       nivel: 100 },
  admin:        { nome: 'Administrador',       nivel: 80  },
  gerente:      { nome: 'Gerente',             nivel: 60  },
  tecnico:      { nome: 'Técnico',             nivel: 40  },
  caixa:        { nome: 'Operador de Caixa',   nivel: 30  },
  atendente:    { nome: 'Atendente',           nivel: 20  }
};

// ── Estado interno ────────────────────────────────────────────
let _ctx = null;

function _readCache() {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}

function _writeCache(ctx) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(ctx)); } catch {}
}

// ── API pública ───────────────────────────────────────────────

/** Retorna o contexto atual (memória → sessionStorage → null). */
export function getTenant() {
  if (_ctx) return _ctx;
  _ctx = _readCache();
  return _ctx;
}

/** empresa_id da sessão atual. Fallback: 'cellcity-master'. */
export function getEmpresaId() {
  return getTenant()?.empresa_id || 'cellcity-master';
}

/** Perfil do usuário atual. */
export function getPerfil() {
  return getTenant()?.perfil || 'admin';
}

/** True se o usuário é Master Admin (acesso total ao SaaS). */
export function isMasterAdmin() {
  return getTenant()?.perfil === 'master_admin';
}

/**
 * Verifica se o módulo está liberado para a empresa atual.
 * Master Admin e Enterprise sempre retornam true.
 */
export function hasModulo(id) {
  const ctx = getTenant();
  if (!ctx)                          return true;   // sem contexto → modo legado
  if (ctx.perfil === 'master_admin') return true;   // master vê tudo
  const mods = ctx.modulos_ativos;
  if (!mods)                         return true;   // enterprise → tudo
  return mods.includes(id);
}

/**
 * Carrega o contexto do tenant a partir do Firestore.
 * Deve ser chamado logo após o login do Firebase Auth.
 * Retorna o contexto ou null se usuário não estiver cadastrado.
 */
export async function loadContext(uid) {
  try {
    const userSnap = await getDoc(doc(db, 'usuarios', uid));
    if (!userSnap.exists()) return null;

    const userData  = userSnap.data();
    const empId     = userData.empresa_id;

    const empSnap  = await getDoc(doc(db, 'empresas', empId));
    const empData  = empSnap.exists() ? empSnap.data() : {};

    // Status da licença
    const status = empData.status || 'ativo';
    if (status === 'bloqueado' || status === 'cancelado') {
      _ctx = { bloqueado: true, status, empresa_id: empId, empresa: empData };
      _writeCache(_ctx);
      return _ctx;
    }

    // Módulos ativos: empresa pode ter lista personalizada ou herdar do plano
    const plano = PLANOS[empData.plano] || PLANOS.enterprise;
    const modulosAtivos = empData.modulos_ativos || plano.modulos;

    _ctx = {
      uid,
      empresa_id:     empId,
      perfil:         userData.perfil || 'admin',
      nome:           userData.nome   || '',
      email:          userData.email  || '',
      foto_url:       userData.foto_url || '',
      empresa:        empData,
      modulos_ativos: modulosAtivos,
      status,
      bloqueado:      false
    };

    _writeCache(_ctx);

    // Atualiza último acesso (non-blocking)
    setDoc(doc(db, 'usuarios', uid), { ultimo_acesso: serverTimestamp() }, { merge: true }).catch(() => {});

    return _ctx;
  } catch (err) {
    console.warn('[Tenant] Erro ao carregar contexto:', err);
    return null;
  }
}

/** Remove o contexto da sessão (chamar no logout). */
export function clearContext() {
  _ctx = null;
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
}

/**
 * Registra log de auditoria no Firestore.
 * Falha silenciosamente para não bloquear a operação principal.
 */
export async function logAuditoria(acao, detalhes = {}) {
  try {
    const ctx = getTenant();
    const { addDoc, collection } = await import('../scripts/firebase.js');
    await addDoc(collection(db, 'auditoria_saas'), {
      empresa_id:  ctx?.empresa_id || 'desconhecido',
      usuario_id:  ctx?.uid        || 'desconhecido',
      usuario_nome: ctx?.nome      || '',
      acao,
      detalhes,
      timestamp: serverTimestamp()
    });
  } catch {}
}
