// Mock mínimo do Firebase Functions para testes.
export function getFunctions() { return { __mock: true }; }
export function httpsCallable() { return async () => ({ data: { success: true } }); }
