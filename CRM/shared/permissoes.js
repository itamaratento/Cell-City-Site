/* ============================================================
   PERMISSOES.JS — RBAC operacional (Fase 2)
   Cell City Gestão Operacional

   Responsabilidade: única fonte de leitura da matriz de
   perfis_operacionais (Fase 1) para o usuário atual. Controla
   apenas EXIBIÇÃO de UI — a segurança real continua nas
   Firestore Rules. Não altera kernel.js nem cria listeners de
   autenticação próprios.

   Uso padrão em cada módulo (após initModulo()):
     import { carregarPermissoes, podeVisualizar } from '/CRM/shared/permissoes.js';

     const ctx = await initModulo();
     if (!ctx) return;
     await carregarPermissoes(ctx);
     if (!podeVisualizar('financeiro')) { ... }

   Fail-open: qualquer ausência de dado ou falha de leitura
   resulta em "sem restrição" (mostra tudo) — nunca oculta por
   engano. Ver MASTER_ROADMAP.md (Fase 2) e
   plans/fase2-sprint1-dashboard-rbac.md para o racional.
   ============================================================ */

import { db, doc, getDoc } from '../scripts/firebase.js';

// null = sem restrição carregada (mostra tudo).
let _matriz = null;

/**
 * Carrega a matriz de permissões do perfil operacional do usuário atual.
 * Deve ser chamada uma única vez, logo após initModulo() resolver.
 *
 * @param {Object} ctx — contexto retornado por initModulo() (kernel.js).
 * @returns {Promise<Object|null>} matriz de permissões ou null (sem restrição).
 */
export async function carregarPermissoes(ctx) {
    if (!ctx) { _matriz = null; return null; }

    // Perfil legado admin/master_admin sempre vê tudo — não altera o
    // significado desse campo, só evita restringir quem já tem acesso total.
    if (ctx.perfil === 'admin' || ctx.perfil === 'master_admin') {
        _matriz = null;
        return null;
    }

    try {
        const usuarioSnap = await getDoc(doc(db, 'usuarios', ctx.uid));
        const perfilOpId = usuarioSnap.exists() ? usuarioSnap.data().perfil_operacional_id : null;

        // Usuário ainda não migrado para o RBAC novo — sem restrição.
        if (!perfilOpId) { _matriz = null; return null; }

        const perfilSnap = await getDoc(doc(db, 'perfis_operacionais', perfilOpId));
        _matriz = perfilSnap.exists() ? (perfilSnap.data().permissoes || null) : null;
        return _matriz;
    } catch (e) {
        console.warn('[permissoes.js] Falha ao carregar permissões — sem restrição por padrão.', e);
        _matriz = null; // falha na leitura nunca esconde módulo por engano
        return null;
    }
}

/** Matriz bruta carregada (ou null). Uso apenas para diagnóstico. */
export function getMatrizAtual() {
    return _matriz;
}

function _permissao(moduloId, campo) {
    if (!_matriz) return true; // sem restrição carregada — fail-open
    const perm = _matriz[moduloId];
    if (!perm) return true; // módulo ainda sem entrada na matriz — fail-open
    return perm[campo] !== false;
}

/** @returns {boolean} true se o perfil pode visualizar o módulo (fail-open). */
export function podeVisualizar(moduloId) { return _permissao(moduloId, 'visualizar'); }

/** @returns {boolean} true se o perfil pode criar no módulo (fail-open). */
export function podeCriar(moduloId) { return _permissao(moduloId, 'criar'); }

/** @returns {boolean} true se o perfil pode editar no módulo (fail-open). */
export function podeEditar(moduloId) { return _permissao(moduloId, 'editar'); }

/** @returns {boolean} true se o perfil pode excluir no módulo (fail-open). */
export function podeExcluir(moduloId) { return _permissao(moduloId, 'excluir'); }

/** @returns {boolean} true se o perfil pode aprovar no módulo (fail-open). */
export function podeAprovar(moduloId) { return _permissao(moduloId, 'aprovar'); }
