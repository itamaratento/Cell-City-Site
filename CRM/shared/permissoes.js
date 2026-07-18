/* ============================================================
   PERMISSOES.JS — RBAC operacional (Fase 2 + FASE 4.1)
   Cell City Gestão Operacional

   Responsabilidade: única fonte de leitura da matriz de
   perfis_operacionais (Fase 1) para o usuário atual. Controla
   EXIBIÇÃO de UI. A barreira de dados continua nas Firestore Rules
   (tenant + temAcessoLiberado + admin em coleções sensíveis).

   FASE 4.1: fail-CLOSED para usuários com perfil operacional
   carregado — ausência de entrada no módulo ou falha de leitura
   NÃO libera acesso. Admin/master_admin continuam sem restrição
   de matriz (acesso total na UI). Usuários legados sem
   perfil_operacional_id: sem restrição de matriz (compatibilidade),
   documentado como dívida até migração completa.
   ============================================================ */

import { db, doc, getDoc } from '../scripts/firebase.js';

// null = admin sem restrição OU legado sem perfil operacional.
let _matriz = null;
let _perfilOperacionalNome = null;
/** true quando o usuário tem perfil operacional e a matriz foi resolvida (mesmo vazia). */
let _rbacAtivo = false;
/** true após carregarPermissoes concluir (sucesso ou falha). */
let _carregado = false;

/**
 * Carrega a matriz de permissões do perfil operacional do usuário atual.
 * Deve ser chamada uma única vez, logo após initModulo() resolver.
 *
 * @param {Object} ctx — contexto retornado por initModulo() (kernel.js).
 * @returns {Promise<Object|null>} matriz de permissões ou null (sem restrição de matriz).
 */
export async function carregarPermissoes(ctx) {
    _carregado = false;
    _rbacAtivo = false;
    _matriz = null;
    _perfilOperacionalNome = null;

    if (!ctx) {
        _carregado = true;
        return null;
    }

    // Perfil legado admin/master_admin sempre vê tudo.
    if (ctx.perfil === 'admin' || ctx.perfil === 'master_admin') {
        _carregado = true;
        return null;
    }

    try {
        const usuarioSnap = await getDoc(doc(db, 'usuarios', ctx.uid));
        const perfilOpId = usuarioSnap.exists() ? usuarioSnap.data().perfil_operacional_id : null;

        // Usuário ainda não migrado para o RBAC novo — sem restrição de matriz.
        if (!perfilOpId) {
            _carregado = true;
            return null;
        }

        const perfilSnap = await getDoc(doc(db, 'perfis_operacionais', perfilOpId));
        if (perfilSnap.exists()) {
            _matriz = perfilSnap.data().permissoes || {};
            _perfilOperacionalNome = perfilSnap.data().nome || null;
            _rbacAtivo = true;
        } else {
            // Perfil operacional apontado mas doc ausente — fail-closed.
            _matriz = {};
            _rbacAtivo = true;
            _perfilOperacionalNome = null;
        }
        _carregado = true;
        return _matriz;
    } catch (e) {
        console.warn('[permissoes.js] Falha ao carregar permissões — fail-closed.', e);
        // FASE 4.1: falha na leitura NÃO abre o sistema.
        _matriz = {};
        _rbacAtivo = true;
        _carregado = true;
        return _matriz;
    }
}

/** Matriz bruta carregada (ou null). Uso apenas para diagnóstico. */
export function getMatrizAtual() {
    return _matriz;
}

function _permissao(moduloId, campo) {
    // Ainda não carregou: negar (evita flash de menu liberado).
    if (!_carregado) return false;
    // Sem RBAC operacional ativo (admin ou legado): liberado.
    if (!_rbacAtivo) return true;
    const perm = _matriz && _matriz[moduloId];
    if (!perm) return false; // fail-closed: módulo sem entrada
    return perm[campo] === true; // exige true explícito
}

/** @returns {boolean} true se o perfil pode visualizar o módulo. */
export function podeVisualizar(moduloId) { return _permissao(moduloId, 'visualizar'); }

/** @returns {boolean} true se o perfil pode criar no módulo. */
export function podeCriar(moduloId) { return _permissao(moduloId, 'criar'); }

/** @returns {boolean} true se o perfil pode editar no módulo. */
export function podeEditar(moduloId) { return _permissao(moduloId, 'editar'); }

/** @returns {boolean} true se o perfil pode excluir no módulo. */
export function podeExcluir(moduloId) { return _permissao(moduloId, 'excluir'); }

/** @returns {boolean} true se o perfil pode aprovar no módulo. */
export function podeAprovar(moduloId) { return _permissao(moduloId, 'aprovar'); }

/** @returns {string|null} Nome do perfil operacional RBAC (ex.: 'Administrador', 'Caixa'). */
export function getPerfilOperacionalNome() { return _perfilOperacionalNome; }
