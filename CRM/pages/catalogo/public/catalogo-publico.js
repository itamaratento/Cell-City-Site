/* ============================================================
   CATÁLOGO PÚBLICO — Cell City Informática
   Leitura pública do Firestore (sem autenticação)
   ============================================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getFirestore, collection, getDocs, doc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ─── Config Firebase (mesma do CRM) ────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD5wQRvcVdweOhVqwd8e08JuzRXOESEbqE",
  authDomain: "cellcity-crm.firebaseapp.com",
  projectId: "cellcity-crm",
  storageBucket: "cellcity-crm.firebasestorage.app",
  messagingSenderId: "645609867368",
  appId: "1:645609867368:web:b3ee19ccfe3d17c61c53dd"
};

// ─── Estado ─────────────────────────────────────────────────
let _app, _db;
let _produtos = [];
let _config = { whatsapp: '', mensagemTemplate: 'Olá! Tenho interesse no produto: {produto}' };
let _filtroCategoria = 'todos';
let _filtroBusca = '';
let _produtoModal = null;
let _fotoModalIdx = 0;

// ─── Inicialização ────────────────────────────────────────
async function init() {
  try {
    _app = initializeApp(FIREBASE_CONFIG);
    _db  = getFirestore(_app);
    await carregarConfig();
    await carregarProdutos();
    renderCategorias();
    renderProdutos();
  } catch (e) {
    console.error('[Catálogo] Erro ao inicializar:', e);
    document.getElementById('cat-grid').innerHTML =
      '<div class="cat-vazio">Erro ao carregar o catálogo. Tente novamente.</div>';
  }
}

async function carregarConfig() {
  try {
    const snap = await getDoc(doc(_db, 'catalogo_config', 'geral'));
    if (snap.exists()) Object.assign(_config, snap.data());
    atualizarWppHeader();
  } catch (_) {}
}

function atualizarWppHeader() {
  const n = (_config.whatsapp || '').replace(/\D/g, '');
  const btn = document.getElementById('cat-wpp-header');
  if (!btn) return;
  if (n) {
    btn.href = `https://wa.me/${n}`;
    btn.style.display = 'flex';
  } else {
    btn.style.display = 'none';
  }
}

async function carregarProdutos() {
  document.getElementById('cat-grid').innerHTML =
    '<div class="cat-loading"><div class="cat-spinner"></div>Carregando produtos...</div>';
  try {
    const snap = await getDocs(collection(_db, 'catalogo_produtos'));
    _produtos = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.ativo !== false)
      .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
  } catch (e) {
    console.error('[Catálogo] Erro ao carregar produtos:', e);
    _produtos = [];
  }
}

// ─── Render Categorias ─────────────────────────────────────
function renderCategorias() {
  const cats = ['todos', ...new Set(_produtos.map(p => p.categoria).filter(Boolean))];
  const wrap = document.getElementById('cat-cats');
  wrap.innerHTML = cats.map(c =>
    `<button class="cat-cat-chip${c === _filtroCategoria ? ' ativo' : ''}"
             onclick="catFiltrarCat(${JSON.stringify(c)})">${c === 'todos' ? '🏷️ Todos' : c}</button>`
  ).join('');
}

// ─── Render Produtos ────────────────────────────────────────
function renderProdutos() {
  const filtrados = _produtos.filter(p => {
    const matchCat = _filtroCategoria === 'todos' || p.categoria === _filtroCategoria;
    const matchBusca = !_filtroBusca ||
      (p.nome || '').toLowerCase().includes(_filtroBusca) ||
      (p.categoria || '').toLowerCase().includes(_filtroBusca) ||
      (p.descricao || '').toLowerCase().includes(_filtroBusca);
    return matchCat && matchBusca;
  });

  document.getElementById('cat-count').textContent =
    `${filtrados.length} produto${filtrados.length !== 1 ? 's' : ''}`;

  const destaques = filtrados.filter(p => p.destaque);
  const secDestaques = document.getElementById('cat-destaques-sec');
  const gridDestaques = document.getElementById('cat-grid-destaques');
  if (destaques.length && !_filtroBusca && _filtroCategoria === 'todos') {
    secDestaques.style.display = '';
    gridDestaques.innerHTML = destaques.map(p => cardHTML(p)).join('');
  } else {
    secDestaques.style.display = 'none';
  }

  const grid = document.getElementById('cat-grid');
  if (!filtrados.length) {
    grid.innerHTML = '<div class="cat-vazio">Nenhum produto encontrado.</div>';
    return;
  }
  grid.innerHTML = filtrados.map(p => cardHTML(p)).join('');
}

function cardHTML(p) {
  const fotoUrl = (p.fotos && p.fotos.length)
    ? p.fotos[p.fotoPrincipal || 0]
    : null;

  const imgHTML = fotoUrl
    ? `<img src="${esc(fotoUrl)}" alt="${esc(p.nome)}" loading="lazy">`
    : `<span>📦</span>`;

  const precoHTML = p.precoPromo
    ? `<span class="cat-card-preco-promo">${fmtPreco(p.precoPromo)}</span>
       <span class="cat-card-preco-original">${fmtPreco(p.preco)}</span>`
    : `<span class="cat-card-preco-normal">${fmtPreco(p.preco)}</span>`;

  const badgeDestaque = p.destaque
    ? `<span class="cat-card-badge-destaque">⭐ Destaque</span>` : '';

  return `<div class="cat-card" onclick="catAbrirModal(${JSON.stringify(p.id)})">
    <div class="cat-card-img-wrap">
      <div class="cat-card-img">${imgHTML}</div>
      ${badgeDestaque}
    </div>
    <div class="cat-card-body">
      <span class="cat-card-cat">${esc(p.categoria || '')}</span>
      <div class="cat-card-nome">${esc(p.nome || '')}</div>
      <div class="cat-card-preco-wrap">${precoHTML}</div>
      <div class="cat-card-btns">
        <button class="cat-btn-detalhes" onclick="event.stopPropagation();catAbrirModal(${JSON.stringify(p.id)})">Ver detalhes</button>
        <button class="cat-btn-wpp" onclick="event.stopPropagation();catComprarWpp(${JSON.stringify(p.id)})">🟢 WhatsApp</button>
      </div>
    </div>
  </div>`;
}

// ─── Modal de detalhes ─────────────────────────────────────
window.catAbrirModal = function(id) {
  const p = _produtos.find(x => x.id === id);
  if (!p) return;
  _produtoModal = p;
  _fotoModalIdx = p.fotoPrincipal || 0;
  renderModal(p);
  document.getElementById('cat-modal').classList.add('aberto');
  document.body.style.overflow = 'hidden';
};

window.catFecharModal = function() {
  document.getElementById('cat-modal').classList.remove('aberto');
  document.body.style.overflow = '';
  _produtoModal = null;
};

function renderModal(p) {
  const fotos = p.fotos && p.fotos.length ? p.fotos : [];

  const fotoAtual = fotos[_fotoModalIdx];
  const fotoHTML = fotoAtual
    ? `<img src="${esc(fotoAtual)}" alt="${esc(p.nome)}">`
    : `<span>📦</span>`;

  const miniaturas = fotos.length > 1
    ? fotos.map((f, i) =>
        `<div class="cat-modal-miniatura${i === _fotoModalIdx ? ' ativa' : ''}"
              onclick="catTrocarFoto(${i})">
          <img src="${esc(f)}" alt="Foto ${i+1}">
        </div>`
      ).join('') : '';

  const precoHTML = p.precoPromo
    ? `<span class="cat-modal-preco-promo">${fmtPreco(p.precoPromo)}</span>
       <span class="cat-modal-preco-original">${fmtPreco(p.preco)}</span>`
    : `<span class="cat-modal-preco-normal">${fmtPreco(p.preco)}</span>`;

  const n = (_config.whatsapp || '').replace(/\D/g, '');
  const msg = (_config.mensagemTemplate || 'Olá! Interesse no produto: {produto}')
    .replace('{produto}', p.nome || '');
  const wppHref = n ? `https://wa.me/${n}?text=${encodeURIComponent(msg)}` : '#';

  document.getElementById('cat-modal-body').innerHTML = `
    <div class="cat-modal-galeria">
      <div class="cat-modal-foto-principal">${fotoHTML}</div>
      <div class="cat-modal-miniaturas">${miniaturas}</div>
    </div>
    <div class="cat-modal-info">
      <span class="cat-modal-cat">${esc(p.categoria || '')}</span>
      <div class="cat-modal-nome">${esc(p.nome || '')}</div>
      <div class="cat-modal-preco-wrap">${precoHTML}</div>
      ${p.descricao ? `<div class="cat-modal-desc">${esc(p.descricao)}</div>` : ''}
      <a class="cat-modal-wpp" href="${wppHref}" target="_blank" rel="noopener">
        🟢 Comprar pelo WhatsApp
      </a>
    </div>`;
}

window.catTrocarFoto = function(idx) {
  if (!_produtoModal) return;
  _fotoModalIdx = idx;
  renderModal(_produtoModal);
};

// ─── WhatsApp direto do card ───────────────────────────────
window.catComprarWpp = function(id) {
  const p = _produtos.find(x => x.id === id);
  if (!p) return;
  const n = (_config.whatsapp || '').replace(/\D/g, '');
  if (!n) { alert('Número de WhatsApp não configurado.'); return; }
  const msg = (_config.mensagemTemplate || 'Olá! Interesse no produto: {produto}')
    .replace('{produto}', p.nome || '');
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(msg)}`, '_blank');
};

// ─── Filtros ──────────────────────────────────────────────
window.catFiltrarCat = function(cat) {
  _filtroCategoria = cat;
  document.querySelectorAll('.cat-cat-chip').forEach(el => {
    el.classList.toggle('ativo', el.textContent.replace('🏷️ ', '') === (cat === 'todos' ? 'Todos' : cat));
  });
  renderProdutos();
};

window.catBuscar = function(val) {
  _filtroBusca = val.trim().toLowerCase();
  renderProdutos();
};

// ─── Utilitários ──────────────────────────────────────────
function fmtPreco(v) {
  if (!v && v !== 0) return 'Consultar';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── Start ────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
