/**
 * Diálogos in-page (substitui confirm/prompt/alert nativos).
 * ESM + espelho em window.ccUiDialog para scripts clássicos.
 */
const STYLE_ID = 'cc-ui-dialog-style';
const ROOT_ID = 'cc-ui-dialog-root';

function ensureStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
#${ROOT_ID}{position:fixed;inset:0;z-index:100000;display:none;align-items:flex-end;justify-content:center;
  background:rgba(0,0,0,.55);padding:12px;box-sizing:border-box;}
#${ROOT_ID}.cc-open{display:flex;}
#${ROOT_ID} .cc-dlg{width:100%;max-width:420px;background:#12151a;border:1px solid rgba(255,255,255,.12);
  border-radius:16px 16px 12px 12px;padding:18px 16px 14px;color:#f3f4f6;
  box-shadow:0 -8px 32px rgba(0,0,0,.45);font-family:system-ui,-apple-system,Segoe UI,sans-serif;}
#${ROOT_ID} .cc-dlg-title{font-size:16px;font-weight:800;margin:0 0 8px;text-align:center;}
#${ROOT_ID} .cc-dlg-body{font-size:13px;color:#9ca3af;line-height:1.45;margin:0 0 14px;text-align:center;white-space:pre-wrap;}
#${ROOT_ID} .cc-dlg-input{width:100%;box-sizing:border-box;padding:11px 12px;margin:0 0 14px;
  border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#1a1f27;color:#f3f4f6;font-size:14px;}
#${ROOT_ID} .cc-dlg-input:focus{outline:none;border-color:#00C853;}
#${ROOT_ID} .cc-dlg-actions{display:flex;gap:8px;}
#${ROOT_ID} .cc-dlg-btn{flex:1;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);
  background:#1f2430;color:#e5e7eb;font-size:13px;font-weight:700;cursor:pointer;}
#${ROOT_ID} .cc-dlg-btn-ok{background:#00C853;border-color:#00C853;color:#04140a;}
#${ROOT_ID} .cc-dlg-btn-danger{background:#ef4444;border-color:#ef4444;color:#fff;}
@media (min-width:640px){
  #${ROOT_ID}{align-items:center;}
  #${ROOT_ID} .cc-dlg{border-radius:14px;}
}
@media (max-width:360px){
  #${ROOT_ID}{padding:8px;}
  #${ROOT_ID} .cc-dlg{padding:14px 12px 12px;}
  #${ROOT_ID} .cc-dlg-title{font-size:15px;}
}
`;
  document.head.appendChild(s);
}

function ensureRoot() {
  ensureStyle();
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    document.body.appendChild(root);
  }
  return root;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {object} opts
 * @param {'confirm'|'prompt'|'alert'} opts.mode
 * @param {string} [opts.title]
 * @param {string} [opts.body]
 * @param {string} [opts.okText]
 * @param {string} [opts.cancelText]
 * @param {string} [opts.placeholder]
 * @param {string} [opts.defaultValue]
 * @param {boolean} [opts.danger]
 * @returns {Promise<boolean|string|null|void>}
 */
function openDialog(opts) {
  const mode = opts.mode || 'alert';
  const root = ensureRoot();
  const title = opts.title || (mode === 'prompt' ? 'Informe' : mode === 'confirm' ? 'Confirmar' : 'Aviso');
  const body = opts.body || '';
  const okText = opts.okText || (mode === 'alert' ? 'OK' : 'Confirmar');
  const cancelText = opts.cancelText || 'Cancelar';
  const danger = !!opts.danger;

  return new Promise((resolve) => {
    const inputHtml = mode === 'prompt'
      ? `<input class="cc-dlg-input" id="cc-dlg-input" type="text" placeholder="${esc(opts.placeholder || '')}" value="${esc(opts.defaultValue || '')}" autocomplete="off">`
      : '';
    const cancelHtml = mode === 'alert'
      ? ''
      : `<button type="button" class="cc-dlg-btn" data-act="cancel">${esc(cancelText)}</button>`;
    root.innerHTML = `<div class="cc-dlg">
      <h3 class="cc-dlg-title">${esc(title)}</h3>
      ${body ? `<p class="cc-dlg-body">${esc(body)}</p>` : ''}
      ${inputHtml}
      <div class="cc-dlg-actions">
        ${cancelHtml}
        <button type="button" class="cc-dlg-btn ${danger ? 'cc-dlg-btn-danger' : 'cc-dlg-btn-ok'}" data-act="ok">${esc(okText)}</button>
      </div>
    </div>`;
    root.classList.add('cc-open');

    const input = root.querySelector('#cc-dlg-input');
    const finish = (value) => {
      root.classList.remove('cc-open');
      root.innerHTML = '';
      root.onclick = null;
      resolve(value);
    };

    root.onclick = (e) => {
      if (e.target === root && mode !== 'alert') finish(mode === 'prompt' ? null : false);
    };
    root.querySelector('[data-act="ok"]')?.addEventListener('click', () => {
      if (mode === 'prompt') finish(input ? input.value : '');
      else if (mode === 'confirm') finish(true);
      else finish();
    });
    root.querySelector('[data-act="cancel"]')?.addEventListener('click', () => {
      finish(mode === 'prompt' ? null : false);
    });
    if (input) {
      setTimeout(() => input.focus(), 30);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish(input.value);
        if (e.key === 'Escape') finish(null);
      });
    }
  });
}

export function uiConfirm(opts = {}) {
  return openDialog({ ...opts, mode: 'confirm' });
}

export function uiPrompt(opts = {}) {
  return openDialog({ ...opts, mode: 'prompt' });
}

export function uiAlert(opts = {}) {
  return openDialog({ ...opts, mode: 'alert' });
}

if (typeof window !== 'undefined') {
  window.ccUiDialog = { uiConfirm, uiPrompt, uiAlert };
}
