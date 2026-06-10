/* ============================================
   DOCK LATERAL COMPARTILHADO — Cell City CRM
   Inclua em cada página como:
   <script type="module" src="../../shared/dock.js"></script>
   ============================================ */
import { db, doc, getDoc, setDoc, serverTimestamp }
  from '../scripts/firebase.js';
// Barra de favoritos — injeta o lançador flutuante em cada módulo
import './favoritos.js';

const isDashboard = window.location.pathname.includes('/dashboard/');

function buildDockHTML() {
  const backBtn = isDashboard ? '' : `
    <a href="../dashboard/index.html" class="dock-item dock-item-back" data-tooltip="Dashboard">
      <span class="dock-icon">🏠</span>
    </a>`;

  return `
    ${backBtn}
    <button class="dock-item" id="dock-notas" data-tooltip="Bloco de Notas">
      <span class="dock-icon">📋</span>
    </button>
    <a href="../autoatendimento/index.html" class="dock-item" data-tooltip="Autoatendimento (Pré-OS Online)">
      <span class="dock-icon">🤖</span>
    </a>
    <a href="../central-informacoes/index.html" class="dock-item" data-tooltip="Central de Informações">
      <span class="dock-icon">📚</span>
    </a>
    <a href="../portal-cliente/admin.html" class="dock-item" data-tooltip="Portal do Cliente">
      <span class="dock-icon">👤</span>
    </a>
    <a href="../config/index.html" class="dock-item dock-item-separator" id="dock-ferramentas" data-tooltip="Ferramentas">
      <span class="dock-icon">⚙️</span>
    </a>`;
}

function injectDock() {
  // Não duplicar se já houver um dock (dashboard tem o próprio)
  if (document.querySelector('.dock')) return;

  const aside = document.createElement('aside');
  aside.className = 'dock';
  aside.innerHTML = buildDockHTML();
  document.body.appendChild(aside);

  // Painel de notas
  const notePanel = document.createElement('div');
  notePanel.className = 'nota-panel';
  notePanel.id = 'nota-panel';
  notePanel.innerHTML = `
    <div class="nota-header">
      <span class="nota-title">📋 Minhas Notas</span>
      <div class="nota-status" id="nota-status"></div>
      <button class="nota-close" id="nota-close">✕</button>
    </div>
    <textarea class="nota-textarea" id="nota-textarea"
      placeholder="Digite suas notas aqui...&#10;Salva automaticamente em todos os dispositivos."></textarea>`;
  document.body.appendChild(notePanel);
}

function setupNotas() {
  const btnNotas = document.getElementById('dock-notas');
  const panel    = document.getElementById('nota-panel');
  const btnClose = document.getElementById('nota-close');
  const textarea = document.getElementById('nota-textarea');
  const statusEl = document.getElementById('nota-status');
  if (!btnNotas || !panel || !textarea) return;

  let userId = localStorage.getItem('cc_nota_uid');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('cc_nota_uid', userId);
  }

  const docRef = doc(db, 'notas_usuarios', userId);
  let saveTimer = null;
  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

  const carregarNota = async () => {
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) textarea.value = snap.data().conteudo || '';
      setStatus('✓ sincronizado');
    } catch { setStatus(''); }
  };

  const salvarNota = () => {
    clearTimeout(saveTimer);
    setStatus('digitando...');
    saveTimer = setTimeout(async () => {
      setStatus('salvando...');
      try {
        await setDoc(docRef, { conteudo: textarea.value, atualizadoEm: serverTimestamp(), userId });
        setStatus('✓ salvo');
      } catch { setStatus('⚠ erro ao salvar'); }
    }, 1000);
  };

  btnNotas.addEventListener('click', () => {
    const aberto = panel.style.display !== 'none';
    panel.style.display = aberto ? 'none' : 'flex';
    if (!aberto) { carregarNota(); textarea.focus(); }
  });

  btnClose.addEventListener('click', () => { panel.style.display = 'none'; });
  textarea.addEventListener('input', salvarNota);
}

// Para o dashboard que já tem sua própria dock, apenas configura as notas
function setupDashboardDock() {
  setupNotas();
  const toolsItem = document.getElementById('dock-ferramentas');
  if (toolsItem) {
    toolsItem.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '../config/index.html';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (isDashboard) {
    // Dashboard tem seu próprio dock HTML e dashboard.js cuida dos eventos
    return;
  }
  injectDock();
  setupNotas();
});
