// Mock de scripts/kernel.js
let _ctx = { empresaId: 'empresa_teste', uid: 'uid_teste' };

export async function initModulo() { return _ctx; }
export function __setCtx(ctx) { _ctx = ctx; }
export function __reset() { _ctx = { empresaId: 'empresa_teste', uid: 'uid_teste' }; }

// Funções necessárias por módulos que importam kernel.js diretamente
export function getUid() { return _ctx?.uid || 'uid_teste'; }
export function getNome() { return _ctx?.nome || 'Admin Teste'; }
export function temPermissao() { return true; }
// config.js (tela de PIN) usa getCtxAsync()/logout() — o kernel real
// exporta ambos (kernel.js:202/221); sem eles aqui o import do módulo
// inteiro falha no loader ESM e os 3 testes de config quebram.
export async function getCtxAsync() { return _ctx; }
export async function logout() {}
