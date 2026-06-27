/* ============================================================
   CATÁLOGO — Painel Administrativo
   ============================================================ */

import { db, authReady } from '../../scripts/firebase.js';
import {
  collection, getDocs, doc, getDoc, setDoc, addDoc,
  updateDoc, deleteDoc, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ─── Estado ──────────────────────────────────────────────
let _produtos = [];
let _config = { whatsapp: '', mensagemTemplate: 'Olá! Tenho interesse no produto: {produto}' };
let _filtroAdm = '';
let _filtroCatAdm = 'todos';
let _produtoEditando = null;

const CATEGORIAS = [
  'Carregadores', 'Cabos', 'Fones Bluetooth', 'Power Banks',
  'Películas', 'Capinhas', 'Informática', 'Outros'
];

const URL_PUBLICA = 'https://www.cellcityinformatica.com.br/catalogo.html';

// ─── Init ─────────────────────────────────────────────────
async function init() {
  await authReady;
  document.getElementById('link-publico-url').textContent = URL_PUBLICA;
  document.getElementById('link-publico-href').href = URL_PUBLICA;

  await Promise.all([carregarConfig(), carregarProdutos()]);
  renderTabela();
  preencherConfigForm();
  renderFiltrosCat();
}

// ─── Produtos ─────────────────────────────────────────────
async function carregarProdutos() {
  try {
    const q = query(collection(db, 'catalogo_produtos'), orderBy('ordem', 'asc'));
    const snap = await getDocs(q);
    _produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (_) {
    _produtos = [];
  }
}

function renderFiltrosCat() {
  const sel = document.getElementById('adm-filtro-cat');
  if (!sel) return;
  const cats = ['todos', ...CATEGORIAS];
  sel.innerHTML = cats.map(c => `<option value="${esc(c)}">${c === 'todos' ? 'Todas as categorias' : esc(c)}</option>`).join('');
}

function renderTabela() {
  const filtrados = _produtos.filter(p => {
    const matchCat = _filtroCatAdm === 'todos' || p.categoria === _filtroCatAdm;
    const matchBusca = !_filtroAdm ||
      (p.nome || '').toLowerCase().includes(_filtroAdm) ||
      (p.categoria || '').toLowerCase().includes(_filtroAdm);
    return matchCat && matchBusca;
  });

  document.getElementById('adm-count').textContent = `${filtrados.length} produto(s)`;

  const tbody = document.getElementById('adm-tbody');
  if (!filtrados.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="adm-vazio">Nenhum produto encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(p => {
    const fotoUrl = (p.fotos && p.fotos.length) ? p.fotos[p.fotoPrincipal || 0] : null;
    const thumbHTML = fotoUrl
      ? `<div class="thumb"><img src="${esc(fotoUrl)}" alt="foto"></div>`
      : `<div class="thumb">📦</div>`;

    const precoStr = fmtPreco(p.preco);
    const promoStr = p.precoPromo ? fmtPreco(p.precoPromo) : '—';

    const statusBadges = [];
    if (p.ativo !== false) statusBadges.push(`<span class="badge badge-ativo">Ativo</span>`);
    else statusBadges.push(`<span class="badge badge-inativo">Inativo</span>`);
    if (p.destaque) statusBadges.push(`<span class="badge badge-destaque">⭐</span>`);

    return `<tr>
      <td class="td-foto">${thumbHTML}</td>
      <td class="td-nome"><span title="${esc(p.nome || '')}">${esc(p.nome || '—')}</span></td>
      <td class="td-cat">${esc(p.categoria || '—')}</td>
      <td class="td-preco">${precoStr}</td>
      <td class="td-promo">${promoStr}</td>
      <td class="td-status">${statusBadges.join(' ')}</td>
      <td>${p.ordem ?? '—'}</td>
      <td class="td-acoes">
        <div class="acoes-wrap">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="admEditar('${p.id}')" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="admDuplicar('${p.id}')" title="Duplicar">📋</button>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="admToggleAtivo('${p.id}')" title="${p.ativo !== false ? 'Ocultar' : 'Mostrar'}">${p.ativo !== false ? '🙈' : '👁️'}</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="admExcluir('${p.id}')" title="Excluir">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ─── ADICIONAR / EDITAR ────────────────────────────────────
window.admAbrirForm = function(id = null) {
  _produtoEditando = id ? _produtos.find(p => p.id === id) || null : null;

  document.getElementById('form-modal-title').textContent = id ? 'Editar Produto' : 'Novo Produto';
  document.getElementById('form-nome').value = _produtoEditando?.nome || '';
  document.getElementById('form-cat').value = _produtoEditando?.categoria || CATEGORIAS[0];
  document.getElementById('form-preco').value = _produtoEditando?.preco ?? '';
  document.getElementById('form-promo').value = _produtoEditando?.precoPromo ?? '';
  document.getElementById('form-desc').value = _produtoEditando?.descricao || '';
  document.getElementById('form-ativo').checked = (_produtoEditando?.ativo ?? true);
  document.getElementById('form-destaque').checked = (_produtoEditando?.destaque ?? false);
  document.getElementById('form-ordem').value = _produtoEditando?.ordem ?? (_produtos.length + 1);

  const fotoAtual = _produtoEditando?.fotos?.[ _produtoEditando?.fotoPrincipal || 0] || '';
  document.getElementById('form-foto-url').value = fotoAtual;

  document.getElementById('modal-produto').classList.add('aberto');
};

window.admEditar = function(id) { admAbrirForm(id); };

window.admFecharForm = function() {
  document.getElementById('modal-produto').classList.remove('aberto');
  _produtoEditando = null;
};


// ─── SALVAR PRODUTO ────────────────────────────────────────
window.admSalvar = async function() {
  const nome = document.getElementById('form-nome').value.trim();
  if (!nome) { alert('Informe o nome do produto.'); return; }

  const btn = document.getElementById('btn-salvar');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const urlFoto = document.getElementById('form-foto-url').value.trim();
    const todasFotos = urlFoto ? [urlFoto] : [];
    const fotoPrincipalFinal = 0;

    const data = {
      nome,
      categoria: document.getElementById('form-cat').value,
      preco: parseFloat(document.getElementById('form-preco').value) || 0,
      precoPromo: parseFloat(document.getElementById('form-promo').value) || null,
      descricao: document.getElementById('form-desc').value.trim(),
      ativo: document.getElementById('form-ativo').checked,
      destaque: document.getElementById('form-destaque').checked,
      ordem: parseInt(document.getElementById('form-ordem').value) || 0,
      fotos: todasFotos,
      fotoPrincipal: fotoPrincipalFinal,
      atualizadoEm: serverTimestamp()
    };
    if (!data.precoPromo) data.precoPromo = null;

    if (_produtoEditando) {
      await updateDoc(doc(db, 'catalogo_produtos', _produtoEditando.id), data);
    } else {
      data.criadoEm = serverTimestamp();
      await addDoc(collection(db, 'catalogo_produtos'), data);
    }

    admFecharForm();
    await carregarProdutos();
    renderTabela();
    renderFiltrosCat();
  } catch (e) {
    console.error('[Catálogo] Erro ao salvar:', e);
    alert('Erro ao salvar produto: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar';
  }
};

// ─── DUPLICAR ─────────────────────────────────────────────
window.admDuplicar = async function(id) {
  const p = _produtos.find(x => x.id === id);
  if (!p) return;
  const { id: _, criadoEm: __, atualizadoEm: ___, ...dados } = p;
  dados.nome = dados.nome + ' (cópia)';
  dados.criadoEm = serverTimestamp();
  dados.atualizadoEm = serverTimestamp();
  dados.ordem = (_produtos.length + 1);
  try {
    await addDoc(collection(db, 'catalogo_produtos'), dados);
    await carregarProdutos();
    renderTabela();
  } catch (e) {
    alert('Erro ao duplicar: ' + e.message);
  }
};

// ─── TOGGLE ATIVO ──────────────────────────────────────────
window.admToggleAtivo = async function(id) {
  const p = _produtos.find(x => x.id === id);
  if (!p) return;
  try {
    await updateDoc(doc(db, 'catalogo_produtos', id), {
      ativo: !(p.ativo !== false),
      atualizadoEm: serverTimestamp()
    });
    await carregarProdutos();
    renderTabela();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
};

// ─── EXCLUIR ──────────────────────────────────────────────
window.admExcluir = async function(id) {
  const p = _produtos.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Excluir o produto "${p.nome}"? Esta ação não pode ser desfeita.`)) return;
  try {
    await deleteDoc(doc(db, 'catalogo_produtos', id));
    await carregarProdutos();
    renderTabela();
  } catch (e) {
    alert('Erro ao excluir: ' + e.message);
  }
};

// ─── FILTROS ADM ──────────────────────────────────────────
window.admBuscar = function(val) {
  _filtroAdm = val.trim().toLowerCase();
  renderTabela();
};

window.admFiltrarCat = function(val) {
  _filtroCatAdm = val;
  renderTabela();
};

// ─── TABS ────────────────────────────────────────────────
window.admTab = function(tab) {
  document.querySelectorAll('.adm-tab').forEach(el =>
    el.classList.toggle('ativo', el.dataset.tab === tab)
  );
  document.querySelectorAll('.adm-section').forEach(el =>
    el.classList.toggle('ativo', el.id === 'sec-' + tab)
  );
};

// ─── CONFIG ──────────────────────────────────────────────
async function carregarConfig() {
  try {
    const snap = await getDoc(doc(db, 'catalogo_config', 'geral'));
    if (snap.exists()) Object.assign(_config, snap.data());
  } catch (_) {}
}

function preencherConfigForm() {
  document.getElementById('cfg-wpp').value = _config.whatsapp || '';
  document.getElementById('cfg-msg').value = _config.mensagemTemplate || 'Olá! Tenho interesse no produto: {produto}';
}

window.admSalvarConfig = async function() {
  const btn = document.getElementById('btn-salvar-cfg');
  btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    const data = {
      whatsapp: document.getElementById('cfg-wpp').value.trim(),
      mensagemTemplate: document.getElementById('cfg-msg').value.trim()
    };
    await setDoc(doc(db, 'catalogo_config', 'geral'), data, { merge: true });
    Object.assign(_config, data);
    alert('Configurações salvas!');
  } catch (e) {
    alert('Erro: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar configurações';
  }
};

// ─── Utilitários ─────────────────────────────────────────
function fmtPreco(v) {
  if (!v && v !== 0) return '—';
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
