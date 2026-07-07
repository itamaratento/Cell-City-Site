// Mock de shared/permissoes.js — só a borda; testa o branching real do
// código chamador (estoque.js, caixa.js, crm.js, etc.), não a implementação
// real de permissoes.js (que não é tocada por este mock).
let _matriz = null;      // null = módulo não migrado (fail-open total)
let _adminLegado = false;

export async function carregarPermissoes(_ctx) {
    // no-op: estado é definido via __setMatriz/__setAdminLegado antes do cenário
}

function check(moduloId, verbo) {
    if (_adminLegado) return true;
    if (_matriz === null) return true;
    const m = _matriz[moduloId];
    if (!m) return true; // módulo específico não migrado: fail-open
    return !!m[verbo];
}

export function podeVisualizar(m) { return check(m, 'visualizar'); }
export function podeCriar(m) { return check(m, 'criar'); }
export function podeEditar(m) { return check(m, 'editar'); }
export function podeExcluir(m) { return check(m, 'excluir'); }
export function podeAprovar(m) { return check(m, 'aprovar'); }

export function __setMatriz(matriz) { _matriz = matriz; }
export function __setAdminLegado(v) { _adminLegado = v; }
export function __reset() { _matriz = null; _adminLegado = false; }
