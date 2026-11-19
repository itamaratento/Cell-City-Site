/**
 * Estados visuais da lista Em Andamento / Finalizados.
 * Extraído para teste unitário (tela preta na 1ª abertura).
 */

export function listLoadingHtml() {
    return `<div class="os-list-state os-list-loading" role="status" aria-live="polite">
        <div class="os-list-spinner" aria-hidden="true"></div>
        <p>Carregando OS…</p>
    </div>`;
}

export function listErrorHtml(filter) {
    const safe = filter === 'finalizados' ? 'finalizados' : 'andamento';
    return `<div class="os-list-state os-list-error" role="alert">
        <p>Não foi possível carregar as OS.</p>
        <button type="button" class="os-list-retry" onclick="showList('${safe}')">Tentar de novo</button>
    </div>`;
}

/**
 * Simula o contrato do ensureOsData: nunca aplica cache vazio antes do fetch.
 * Usado nos testes da corrida load × showList.
 */
export async function loadCacheAtomic(fetchAll) {
    const next = await fetchAll();
    return {
        os: Array.isArray(next?.os) ? next.os : [],
        clients: Array.isArray(next?.clients) ? next.clients : [],
        counter: (next && next.counter) || 0,
    };
}
