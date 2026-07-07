// Mock de scripts/kernel.js
let _ctx = { empresaId: 'empresa_teste', uid: 'uid_teste' };

export async function initModulo() { return _ctx; }
export function __setCtx(ctx) { _ctx = ctx; }
export function __reset() { _ctx = { empresaId: 'empresa_teste', uid: 'uid_teste' }; }
