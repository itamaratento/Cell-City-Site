/* ============================================
   DOCK LATERAL COMPARTILHADO — Cell City CRM
   Inclua em cada página como:
   <script type="module" src="../../shared/dock.js"></script>
   
   v2.0 — Adicionado: Drag & Drop, modo edição,
   salvamento no Firestore, suporte mobile.
   ============================================ */
import {
  db, doc, getDoc, setDoc, onSnapshot, serverTimestamp
} from '../scripts/firebase.js';
import { getUid, onUid } from './session.js';

// Barra de favoritos — injeta o lançador flutuante em cada módulo
import './favoritos.js?v=20260612-fornecedor-fix';

const isDashboard = window.location.pathname.includes('/dashboard/');
const DOCK_ORDEM_KEY = 'cc_dock_ordem';
const SESSION_LOGGED_KEY = 'cc_acesso';

// ── Lista mestra de itens do dock (com IDs únicos) ──────────────────
const DOCK_ITEMS = [
  { id: 'alarme',    html: `<button class="dock-item" id="dock-alarme" data-tooltip="Alarme OS Nova"><span class="dock-icon">🔔</span></button>` },
  { id: 'notas',     html: `<button class="dock-item" id="dock-notas" data-tooltip="Bloco de Notas"><span class="dock-icon">📋</span></button>` },
  { id: 'autoatendimento', html: `<a href="../autoatendimento/index.html" class="dock-item" data-tooltip="Autoatendimento (Pré-OS Online)"><span class="dock-icon">🤖</span></a>` },
  { id: 'site',      html: `<a href="https://www.cellcityinformatica.com.br" class="dock-item" data-tooltip="Site Cell City"><span class="dock-icon">🌐</span></a>` },
  { id: 'comandos',  html: `<a href="../central-comandos/index.html" class="dock-item" data-tooltip="Central de Comandos"><span class="dock-icon">⚡</span></a>` },
  { id: 'central',   html: `<a href="../central-informacoes/index.html" class="dock-item" data-tooltip="Central de Informações"><span class="dock-icon">📚</span></a>` },
  { id: 'portal',    html: `<a href="../portal-cliente/admin.html" class="dock-item" data-tooltip="Portal do Cliente"><span class="dock-icon">👤</span></a>` },
  { id: 'wpp-msgs',    html: `<a href="../mensagens-wpp/index.html" class="dock-item" data-tooltip="Mensagens WhatsApp"><span class="dock-icon">💬</span></a>` },
  { id: 'venda-rapida', html: `<a href="../venda-rapida/index.html" class="dock-item" data-tooltip="Venda Rápida (Cód. Barras)"><span class="dock-icon">⚡</span></a>` },
  { id: 'gdrive', html: `<a href="https://drive.google.com" target="_blank" class="dock-item" data-tooltip="Google Drive"><span class="dock-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 87.3 78" width="22" height="22" style="display:block;"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 11.5z" fill="#ea4335"/><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/><path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg></span></a>` },
  { id: 'ferramentas', html: `<a href="../config/index.html" class="dock-item dock-item-separator" id="dock-ferramentas" data-tooltip="Ferramentas"><span class="dock-icon">⚙️</span></a>` }
];

// Dashboard tem alarme extra — só adiciona se for dashboard
// ATENÇÃO: os HTMLs abaixo devem espelhar EXATAMENTE os items nativos
// do dashboard/index.html para que onclick e outros atributos funcionem
// mesmo após renderizarDock() substituir o innerHTML.
const DASHBOARD_ITENS = [
  { id: 'alarme',    html: `<button class="dock-item" id="dock-alarme" data-tooltip="Alarme OS Nova" onclick="openAlarmePanel()"><span class="dock-icon">🔔</span></button>` },
  { id: 'notas',     html: `<button class="dock-item" id="dock-notas" data-tooltip="Bloco de Notas"><span class="dock-icon">📋</span></button>` },
  { id: 'autoatendimento', html: `<a href="../autoatendimento/index.html" class="dock-item" data-tooltip="Autoatendimento (Pré-OS Online)"><span class="dock-icon">🤖</span></a>` },
  { id: 'site',      html: `<a href="https://www.cellcityinformatica.com.br" class="dock-item" data-tooltip="Site Cell City"><span class="dock-icon">🌐</span></a>` },
  { id: 'comandos',  html: `<a href="../central-comandos/index.html" class="dock-item" data-tooltip="Central de Comandos"><span class="dock-icon">⚡</span></a>` },
  { id: 'central',   html: `<a href="../central-informacoes/index.html" class="dock-item" data-tooltip="Central de Informações"><span class="dock-icon">📚</span></a>` },
  { id: 'portal',    html: `<a href="../portal-cliente/admin.html" class="dock-item" data-tooltip="Portal do Cliente"><span class="dock-icon">👤</span></a>` },
  { id: 'venda-rapida-d', html: `<a href="../venda-rapida/index.html" class="dock-item" data-tooltip="Venda Rápida (Cód. Barras)"><span class="dock-icon">⚡</span></a>` },
  { id: 'gdrive-d', html: `<a href="https://drive.google.com" target="_blank" class="dock-item" data-tooltip="Google Drive"><span class="dock-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 87.3 78" width="22" height="22" style="display:block;"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 11.5z" fill="#ea4335"/><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/><path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg></span></a>` },
  { id: 'ferramentas', html: `<a href="../config/index.html" class="dock-item dock-item-separator" id="dock-ferramentas" data-tooltip="Ferramentas"><span class="dock-icon">⚙️</span></a>` }
];

// ── Utilitários ─────────────────────────────────────────────────────
function gerarIdUnico() {
  let id = localStorage.getItem('cc_dock_user_id');
  if (!id) {
    id = 'dock_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem('cc_dock_user_id', id);
  }
  return id;
}

function isLogado() {
  return sessionStorage.getItem(SESSION_LOGGED_KEY) === 'ok';
}

// ── Firebase: carregar/salvar ordem ─────────────────────────────────
const DOCK_CONFIG_DOC = doc(db, 'config', 'dock_ordem');

async function carregarOrdemFirestore() {
  try {
    const snap = await getDoc(DOCK_CONFIG_DOC);
    if (snap.exists()) {
      const data = snap.data();
      return data.ordem || null;
    }
  } catch (e) {
    console.warn('⚠️ Dock: erro ao carregar ordem do Firestore', e);
  }
  return null;
}

async function salvarOrdemFirestore(ordem) {
  try {
    await setDoc(DOCK_CONFIG_DOC, {
      ordem,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: gerarIdUnico()
    }, { merge: true });
    console.log('✅ Dock: ordem salva no Firestore');
  } catch (e) {
    console.warn('⚠️ Dock: erro ao salvar ordem no Firestore', e);
  }
}

// ── Carregar ordem (Firestore > localStorage) ───────────────────────
async function obterOrdem() {
  // Tenta Firestore primeiro
  const fsOrdem = await carregarOrdemFirestore();
  if (fsOrdem && Array.isArray(fsOrdem) && fsOrdem.length) {
    localStorage.setItem(DOCK_ORDEM_KEY, JSON.stringify(fsOrdem));
    return fsOrdem;
  }
  // Fallback: localStorage
  try {
    const local = localStorage.getItem(DOCK_ORDEM_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {}
  return null;
}

// ── Ordem padrão (baseada no ambiente) ─────────────────────────────
function ordemPadrao() {
  // No dashboard, a ordem inclui alarme na primeira posição
  const padrao = isDashboard
    ? DASHBOARD_ITENS.map(i => i.id)
    : DOCK_ITEMS.map(i => i.id);
  return padrao;
}

// ── Renderizar dock com ordem personalizada ─────────────────────────
function getListaItens() {
  return isDashboard ? DASHBOARD_ITENS : DOCK_ITEMS;
}

function renderizarDock(dockEl, ordem) {
  const todos = getListaItens();
  // Mapa id → html
  const mapa = {};
  todos.forEach(i => { mapa[i.id] = i.html; });

  // Itens na ordem especificada
  let html = '';
  (ordem || ordemPadrao()).forEach(id => {
    if (mapa[id]) html += mapa[id] + '\n    ';
  });
  // Adiciona itens que por ventura não estão na ordem salva
  todos.forEach(i => {
    if (!ordem || !ordem.includes(i.id)) html += i.html + '\n    ';
  });

  dockEl.innerHTML = html;
}

// ── DRAG & DROP (event delegation no container) ───────────────────
// Sempre ativo: reordena apenas arrastando, sem botão nem modo edição.
let dragState = {
  arrastando: null,
  listenersAnexados: false
};


function _extrairOrdemAtual(dockEl) {
  return [...dockEl.querySelectorAll('.dock-item')].map(el => {
    const tooltip = el.getAttribute('data-tooltip') || '';
    const icon = el.querySelector('.dock-icon');
    const iconText = icon ? icon.textContent : '';
    return mapearItemParaId(iconText, tooltip);
  }).filter(Boolean);
}

// Reposiciona o item arrastado relativo ao alvo, conforme a posição do cursor.
// Detecta a orientação da dock (vertical no desktop, horizontal no mobile).
function _reposicionar(dockEl, itemArrastado, itemAlvo, clientX, clientY) {
  if (!itemAlvo || itemAlvo === itemArrastado) return;
  const horizontal = getComputedStyle(dockEl).flexDirection === 'row';
  const rect = itemAlvo.getBoundingClientRect();
  const depois = horizontal
    ? clientX > rect.left + rect.width / 2
    : clientY > rect.top + rect.height / 2;
  if (depois) {
    itemAlvo.parentNode.insertBefore(itemArrastado, itemAlvo.nextSibling);
  } else {
    itemAlvo.parentNode.insertBefore(itemArrastado, itemAlvo);
  }
}

function iniciarDragDrop(dockEl, onReordenar) {
  // Marca todos os itens como draggable
  dockEl.querySelectorAll('.dock-item').forEach(item => {
    item.setAttribute('draggable', 'true');
  });

  // Se já anexou listeners via delegação, não duplica
  if (dragState.listenersAnexados) return;
  dragState.listenersAnexados = true;

  // ── Desktop: arrastar e soltar (reposicionamento ao vivo) ──
  dockEl.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.dock-item');
    if (!item) return;
    dragState.arrastando = item;
    // Adia para o navegador capturar a imagem de arraste antes de esmaecer
    requestAnimationFrame(() => item.classList.add('dragging'));
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', item.id || ''); } catch {}
  });

  dockEl.addEventListener('dragover', (e) => {
    if (!dragState.arrastando) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const itemAlvo = e.target.closest('.dock-item');
    _reposicionar(dockEl, dragState.arrastando, itemAlvo, e.clientX, e.clientY);
  });

  dockEl.addEventListener('drop', (e) => {
    e.preventDefault(); // reordenação já ocorreu ao vivo; salvamento no dragend
  });

  dockEl.addEventListener('dragend', () => {
    if (!dragState.arrastando) return;
    dragState.arrastando.classList.remove('dragging');
    const novaOrdem = _extrairOrdemAtual(dockEl);
    if (onReordenar) onReordenar(novaOrdem);
    dragState.arrastando = null;
  });

  // ── Mobile: toque prolongado + arrasto (reposicionamento ao vivo) ──
  dockEl.addEventListener('touchstart', (e) => {
    const item = e.target.closest('.dock-item');
    if (!item) return;

    item.dataset.dndLongPress = 'false';

    const timer = setTimeout(() => {
      item.dataset.dndLongPress = 'true';
      dragState.arrastando = item;
      item.classList.add('long-press', 'dragging');
      if (navigator.vibrate) navigator.vibrate(20);
    }, 400);
    item.dataset.dndTimerId = timer;
  }, { passive: true });

  dockEl.addEventListener('touchmove', (e) => {
    if (!dragState.arrastando) {
      // Movimento antes do long-press: cancela o timer (foi um toque/scroll)
      const item = e.target.closest('.dock-item');
      if (item && item.dataset.dndTimerId) {
        clearTimeout(Number(item.dataset.dndTimerId));
        item.dataset.dndTimerId = '';
      }
      return;
    }
    const item = dragState.arrastando;
    if (item.dataset.dndLongPress !== 'true') return;
    e.preventDefault();

    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const itemAlvo = el ? el.closest('.dock-item') : null;
    _reposicionar(dockEl, item, itemAlvo, touch.clientX, touch.clientY);
  }, { passive: false });

  const finalizarToque = (e) => {
    const item = e.target.closest('.dock-item');
    if (item && item.dataset.dndTimerId) {
      clearTimeout(Number(item.dataset.dndTimerId));
      item.dataset.dndTimerId = '';
    }
    if (!dragState.arrastando) return;
    const arrastado = dragState.arrastando;
    arrastado.classList.remove('long-press', 'dragging');
    arrastado.dataset.dndLongPress = 'false';
    const novaOrdem = _extrairOrdemAtual(dockEl);
    if (onReordenar) onReordenar(novaOrdem);
    dragState.arrastando = null;
  };

  dockEl.addEventListener('touchend', finalizarToque);
  dockEl.addEventListener('touchcancel', finalizarToque);
}

// Mapeia ícone+tooltip para ID do item
function mapearItemParaId(iconText, tooltip) {
  const mapa = {
    '🔔': 'alarme',
    '📋': 'notas',
    '🤖': 'autoatendimento',
    '🌐': 'site',
    '⚡': 'comandos',
    '📚': 'central',
    '👤': 'portal',
    '⚙️': 'ferramentas'
  };
  if (tooltip === 'Google Drive') return isDashboard ? 'gdrive-d' : 'gdrive';
  return mapa[iconText] || null;
}

// ── Salvar nova ordem (localStorage sempre; Firestore se logado) ─────
function persistirOrdem(novaOrdem) {
  if (!novaOrdem || !novaOrdem.length) return;
  localStorage.setItem(DOCK_ORDEM_KEY, JSON.stringify(novaOrdem));
  if (isLogado()) salvarOrdemFirestore(novaOrdem);
}

// ── Setup completo do dock com reordenação ───────────────────────────
export async function setupDockReordering(dockSelector = '.dock') {
  const dockEl = document.querySelector(dockSelector);
  if (!dockEl) return;

  // Carrega e aplica a ordem salva
  const ordem = await obterOrdem();
  if (ordem) {
    renderizarDock(dockEl, ordem);
  }

  // Drag & drop sempre ativo — reorganiza apenas arrastando, sem botões
  iniciarDragDrop(dockEl, persistirOrdem);
}

// ── buildDockHTML (usado apenas em páginas não-dashboard) ──────────
function buildDockHTML(ordemPersonalizada) {
  const ids = ordemPersonalizada || ordemPadrao();
  const todos = getListaItens();
  const mapa = {};
  todos.forEach(i => { mapa[i.id] = i.html; });

  let html = '';
  ids.forEach(id => {
    if (mapa[id]) html += '    ' + mapa[id] + '\n';
  });
  // Itens que não estão na ordem
  todos.forEach(i => {
    if (!ids.includes(i.id)) html += '    ' + i.html + '\n';
  });

  return html;
}

// ── FUNÇÕES ORIGINAIS (preservadas para compatibilidade) ──────────

function injectDock() {
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

  // Identidade ESTÁVEL da conta (substitui o antigo cc_nota_uid aleatório).
  let docRef = doc(db, 'notas_usuarios', getUid());
  let saveTimer = null;
  let notaUnsub = null;
  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

  // Sincronização em tempo real: aplica o valor remoto quando o usuário
  // NÃO está digitando (textarea sem foco), evitando sobrescrever a edição.
  const assinarNota = () => {
    if (notaUnsub) { notaUnsub(); notaUnsub = null; }
    docRef = doc(db, 'notas_usuarios', getUid());
    notaUnsub = onSnapshot(docRef, (snap) => {
      const remoto = snap.exists() ? (snap.data().conteudo || '') : '';
      if (document.activeElement !== textarea && textarea.value !== remoto) {
        textarea.value = remoto;
      }
      setStatus('✓ sincronizado');
    }, () => setStatus(''));
  };
  onUid(() => assinarNota());

  const salvarNota = () => {
    clearTimeout(saveTimer);
    setStatus('digitando...');
    saveTimer = setTimeout(async () => {
      setStatus('salvando...');
      try {
        await setDoc(docRef, { conteudo: textarea.value, atualizadoEm: serverTimestamp(), userId: getUid() });
        setStatus('✓ salvo');
      } catch { setStatus('⚠ erro ao salvar'); }
    }, 1000);
  };

  btnNotas.addEventListener('click', () => {
    const aberto = panel.style.display !== 'none';
    panel.style.display = aberto ? 'none' : 'flex';
    if (!aberto) textarea.focus();
  });

  btnClose.addEventListener('click', () => { panel.style.display = 'none'; });
  textarea.addEventListener('input', salvarNota);
}

// Dashboard: configura notas (deve ser chamado APÓS renderizarDock)
function setupDashboardDock() {
  setupNotas();
  // Ferramentas agora é <a href="..."> nativo, listener não é mais necessário
}

// ── Inicialização ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (isDashboard) {
    // Dashboard tem seu próprio dock HTML
    // setupDockReordering VEM PRIMEIRO porque pode substituir innerHTML
    await setupDockReordering('.dock');
    setupDashboardDock();
    return;
  }

  // Páginas comuns: injeta dock, DnD, depois anexa listeners
  injectDock();
  await setupDockReordering('.dock');
  setupNotas();
});
