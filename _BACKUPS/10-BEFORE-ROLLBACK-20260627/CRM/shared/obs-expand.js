/**
 * obs-expand.js — Componente global ⛶ Tela Cheia para o CRM Cell City
 * Adiciona automaticamente o botão ⛶ em todos os textareas com 3+ linhas.
 * Usa MutationObserver para detectar textareas criados dinamicamente.
 */
(function () {
    'use strict';

    const OVERLAY_ID = 'obs-fullscreen-overlay';

    // ── CSS injetado uma única vez ──────────────────────────────────────────
    const styleEl = document.createElement('style');
    styleEl.id = 'obs-expand-styles';
    styleEl.textContent = `
.obs-wrap { position: relative; display: block; width: 100%; }
.obs-wrap > textarea { width: 100%; box-sizing: border-box; }
.obs-fullscreen-btn {
    position: absolute;
    top: 7px; right: 7px;
    z-index: 10;
    width: 26px; height: 26px;
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.14);
    color: rgba(255,255,255,0.65);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    display: flex; align-items: center; justify-content: center;
    opacity: 0.5;
    transition: opacity 0.15s, background 0.15s;
    line-height: 1;
    padding: 0;
}
.obs-fullscreen-btn:hover { opacity: 1; background: rgba(255,255,255,0.1); }
@keyframes obsFadeIn { from { opacity:0; } to { opacity:1; } }
#${OVERLAY_ID} { animation: obsFadeIn 0.18s ease; }
#${OVERLAY_ID} button:hover { opacity: 0.8; }
    `;
    if (!document.getElementById('obs-expand-styles')) {
        document.head.appendChild(styleEl);
    }

    // ── Detecta o título do textarea ────────────────────────────────────────
    function getTitle(ta) {
        if (ta.dataset.obsTitle) return ta.dataset.obsTitle;
        // Procura label anterior no DOM
        let el = ta.closest('.obs-wrap')?.previousElementSibling
            || ta.previousElementSibling;
        if (el?.tagName === 'LABEL') return el.textContent.trim();
        // Procura dentro do pai
        const parent = ta.parentElement;
        if (parent) {
            const label = parent.querySelector('label');
            if (label) return label.textContent.trim();
            const prev = ta.closest('.obs-wrap')?.previousElementSibling;
            if (prev?.tagName === 'LABEL') return prev.textContent.trim();
        }
        return ta.placeholder || ta.name || '📄 Texto';
    }

    // ── Abre tela cheia ─────────────────────────────────────────────────────
    function openFullscreen(ta) {
        document.getElementById(OVERLAY_ID)?.remove();

        const title = getTitle(ta);
        const escDiv = document.createElement('div');
        escDiv.textContent = ta.value || '';
        const escapedContent = escDiv.innerHTML;

        const escTitle = document.createElement('span');
        escTitle.textContent = title;
        const escapedTitle = escTitle.innerHTML;

        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:9999',
            'background:#0f1110', 'display:flex', 'flex-direction:column'
        ].join(';');

        overlay.innerHTML = `
<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #252525;background:#161a18;flex-shrink:0;gap:12px;">
    <span style="font-size:15px;font-weight:700;color:#e8e8e8;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapedTitle}</span>
    <button onclick="document.getElementById('${OVERLAY_ID}').remove()"
        style="flex-shrink:0;background:#252525;border:1px solid #333;color:#e8e8e8;padding:7px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;line-height:1;">
        ✕ Fechar
    </button>
</div>
<div style="flex:1;overflow-y:auto;padding:24px 20px;-webkit-overflow-scrolling:touch;">
    <div style="white-space:pre-wrap;font-size:16px;color:#e8e8e8;line-height:1.9;word-break:break-word;max-width:760px;margin:0 auto;">
        ${escapedContent || '<span style="color:#555;font-style:italic;">Nenhum conteúdo ainda.</span>'}
    </div>
</div>`;

        // Fecha ao pressionar Esc
        const onKey = (e) => {
            if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
        };
        document.addEventListener('keydown', onKey);

        document.body.appendChild(overlay);
    }

    // ── Wrapping automático ─────────────────────────────────────────────────
    function wrapTextarea(ta) {
        if (ta.dataset.obsWrapped || ta.closest('.obs-wrap')) return;
        ta.dataset.obsWrapped = '1';

        const wrap = document.createElement('div');
        wrap.className = 'obs-wrap';
        ta.parentNode.insertBefore(wrap, ta);
        wrap.appendChild(ta);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'obs-fullscreen-btn';
        btn.innerHTML = '⛶';
        btn.title = 'Tela cheia';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openFullscreen(ta);
        });
        wrap.appendChild(btn);
    }

    function shouldWrap(ta) {
        return (ta.rows >= 3 || ta.offsetHeight > 60) && !ta.readOnly;
    }

    function scan() {
        document.querySelectorAll('textarea:not([data-obs-wrapped])').forEach(ta => {
            if (shouldWrap(ta)) wrapTextarea(ta);
        });
    }

    // Escaneia após o DOM estar pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scan);
    } else {
        scan();
    }

    // Detecta textareas inseridos dinamicamente (renderDetail, modais, etc.)
    new MutationObserver(scan).observe(document.body, {
        childList: true,
        subtree: true
    });

    // ── API pública (compatibilidade retroativa) ─────────────────────────────
    window.openObsModal = function (idOrEl, title) {
        const ta = typeof idOrEl === 'string'
            ? document.getElementById(idOrEl)
            : idOrEl;
        if (!ta) return;
        if (title) ta.dataset.obsTitle = title;
        openFullscreen(ta);
    };

})();
