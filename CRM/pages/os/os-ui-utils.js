// UI utils compartilhados do módulo OS — extraído de os.js (P2.2, 2026-07-16).
// Sem dependência de estado do módulo (currentOS/DB/etc.) — só manipulação de DOM.
export function openModal(content) { document.getElementById('modal-content').innerHTML = content; document.getElementById('modal-overlay').classList.add('active'); }
export function closeModal(event) { if (event && event.target === document.getElementById('modal-overlay')) document.getElementById('modal-overlay').classList.remove('active'); else document.getElementById('modal-overlay').classList.remove('active'); }
export function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }
