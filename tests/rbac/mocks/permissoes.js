// Mock de shared/permissoes.js — só a borda; testa o branching real do
// código chamador (estoque.js, caixa.js, crm.js, etc.), não a implementação
// real de permissoes.js (que não é tocada por este mock).
let _matriz = null;      // null = legado / admin nos testes (sem restrição de matriz)

let _adminLegado = false;

export async function carregarPermissoes(_ctx) {
    // no-op: estado é definido via __setMatriz/__setAdminLegado antes do cenário
}

function check(moduloId, verbo) {
    if (_adminLegado) return true;
    if (_matriz === null) return true; // legado / cenário sem RBAC nos testes
    const m = _matriz[moduloId];
    if (!m) return false; // FASE 4.1 fail-closed
    return m[verbo] === true;
}

export function podeVisualizar(m) { return check(m, 'visualizar'); }
export function podeCriar(m) { return check(m, 'criar'); }
export function podeEditar(m) { return check(m, 'editar'); }
export function podeExcluir(m) { return check(m, 'excluir'); }
export function podeAprovar(m) { return check(m, 'aprovar'); }

export function __setMatriz(matriz) { _matriz = matriz; }
export function __setAdminLegado(v) { _adminLegado = v; }
export function __reset() { _matriz = null; _adminLegado = false; }
