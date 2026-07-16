// Toast — extraído de informacoes.js (P2.2, 2026-07-16).
// Sem dependência de estado do módulo (informacoes/categorias/etc.) — só DOM.
export function toast(msg) {
    const el = document.getElementById('info-toast');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.classList.remove('success', 'error', 'warning');
    if (msg.includes('✅')) el.classList.add('success');
    else if (msg.includes('❌')) el.classList.add('error');
    else if (msg.includes('⚠️')) el.classList.add('warning');

    setTimeout(() => {
        el.style.display = 'none';
    }, 2500);
}
