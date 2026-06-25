/* ============================================
   CONTATOS — Módulo de Contatos Reutilizável
   Cell City Gestão Empresarial
   ============================================ */

import {
  db, collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy, serverTimestamp
} from "../../scripts/firebase.js";
import { getEmpresaId } from "../../shared/tenant.js";

/* ── CONSTANTES ──────────────────────────────────────────── */
const COL = 'contatos';
const CACHE_KEY = 'cc_contatos_cache';
const RECENTES_KEY = 'cc_contatos_recentes';

/* ── PALETA DE AVATARES ──────────────────────────────────── */
const _PALETTE = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#d97706',
  '#059669', '#0891b2', '#4f46e5', '#9333ea', '#0f766e',
  '#b45309', '#16a34a', '#0284c7', '#6366f1', '#c026d3'
];

/* ── HELPERS ─────────────────────────────────────────────── */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmtTel(num) {
  if (!num) return '';
  const d = num.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  if (d.length === 8) return `${d.slice(0,4)}-${d.slice(4)}`;
  if (d.length === 9) return `${d.slice(0,5)}-${d.slice(5)}`;
  return d;
}

function limparTelefone(num) {
  return (num || '').replace(/\D/g, '');
}

function toast(msg) {
  const el = document.getElementById('contato-toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.className = 'contato-toast';
  if (msg.includes('✅')) el.classList.add('success');
  else if (msg.includes('❌')) el.classList.add('error');
  else if (msg.includes('⚠️')) el.classList.add('warning');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.display = 'none'; }, 2500);
}

function _hash(s) {
  let h = 0;
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function _initials(nome) {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  return nome.slice(0, 2).toUpperCase();
}

function avatarHtml(nome) {
  const bg = _PALETTE[_hash(nome || '') % _PALETTE.length];
  return `<div class="contato-avatar" style="background:${bg}">${_initials(nome)}</div>`;
}

/* ── ESTADO ──────────────────────────────────────────────── */
let contatos = [];
let editandoId = null;
let termoBusca = '';

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
async function init() {
  await carregarContatos();
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('contato-modal');
      if (modal?.classList.contains('active')) fecharForm();
    }
  });
  document.getElementById('contato-modal')?.addEventListener('click', e => {
    if (e.target.id === 'contato-modal') fecharForm();
  });
}

/* ============================================================
   CARREGAR / RENDER
   ============================================================ */
async function carregarContatos() {
  try {
    const snap = await getDocs(
      query(collection(db, COL), where('empresa_id', '==', getEmpresaId()), orderBy('criadoEm', 'desc'))
    );
    contatos = [];
    snap.forEach(d => contatos.push({ id: d.id, ...d.data() }));
    localStorage.setItem(CACHE_KEY, JSON.stringify(contatos));
  } catch (e) {
    console.warn('⚠️ Erro ao carregar contatos:', e);
    try { contatos = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch { contatos = []; }
  }
  render();
}

function getContatosFiltrados() {
  let filtrados = contatos.slice();

  // Favoritos no topo
  filtrados.sort((a, b) => {
    if (a.favorito && !b.favorito) return -1;
    if (!a.favorito && b.favorito) return 1;
    return 0;
  });

  // Busca textual
  if (termoBusca) {
    const q = termoBusca.toLowerCase();
    const soNum = termoBusca.replace(/\D/g, '');

    filtrados = filtrados.filter(c => {
      const nome = (c.nome || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const empresa = (c.empresa || '').toLowerCase();
      const cargo = (c.cargo || '').toLowerCase();
      const obs = (c.observacoes || '').toLowerCase();
      const whatsapp = limparTelefone(c.whatsapp);

      // Telefones
      const telsStr = (Array.isArray(c.telefones) ? c.telefones.map(t => limparTelefone(t.numero)).join(' ') : '');

      // Busca por número
      if (soNum && (
        whatsapp.includes(soNum) ||
        telsStr.includes(soNum)
      )) return true;

      // Busca textual
      const texto = `${nome} ${email} ${empresa} ${cargo} ${obs}`;
      return texto.includes(q);
    });
  }

  return filtrados;
}

function render() {
  const lista = document.getElementById('contato-lista');
  const contador = document.getElementById('contato-contador');
  if (!lista) return;

  const filtrados = getContatosFiltrados();

  if (contador) contador.textContent = filtrados.length;

  // Mostrar contador de resultados
  const countEl = document.getElementById('contato-resultado-count');
  if (countEl) {
    if (termoBusca) {
      countEl.textContent = filtrados.length === 1
        ? '1 contato encontrado'
        : `${filtrados.length} contatos encontrados`;
      countEl.style.display = 'block';
    } else {
      countEl.style.display = 'none';
    }
  }

  if (filtrados.length === 0) {
    lista.innerHTML = `
      <div class="contato-empty">
        <div class="contato-empty-icon">👤</div>
        <p>${termoBusca ? 'Nenhum contato encontrado para esta busca.' : 'Nenhum contato ainda. Clique em <strong>➕ Novo Contato</strong> para começar.'}</p>
      </div>
    `;
    return;
  }

  lista.innerHTML = filtrados.map(c => renderCard(c)).join('');
}

function renderCard(c) {
  const wppNumero = c.whatsapp || '';
  const wppLink = wppNumero ? `https://wa.me/55${limparTelefone(wppNumero)}` : null;

  // Encontrar o telefone principal
  let telPrincipal = '';
  if (Array.isArray(c.telefones)) {
    const p = c.telefones.find(t => t.principal);
    telPrincipal = p ? p.numero : (c.telefones[0]?.numero || '');
  }

  // Demais telefones (não principal)
  const outrosTels = Array.isArray(c.telefones)
    ? c.telefones.filter((t, i) => !t.principal && (c.telefones.length > 1 ? i > 0 || t.numero !== telPrincipal : false))
    : [];

  // Se só tem 1 telefone e não tem principal marcado, ele é o principal
  if (!telPrincipal && Array.isArray(c.telefones) && c.telefones.length === 1) {
    telPrincipal = c.telefones[0].numero;
  }

  const temCargoEmpresa = c.cargo || c.empresa;
  let cargoEmpresaHtml = '';
  if (temCargoEmpresa) {
    const partes = [];
    if (c.cargo) partes.push(esc(c.cargo));
    if (c.empresa) partes.push(`<strong>${esc(c.empresa)}</strong>`);
    cargoEmpresaHtml = `<div class="contato-card-cargo-empresa">${partes.join(' — ')}</div>`;
  }

  return `
    <div class="contato-card ${c.favorito ? 'contato-card-favorito' : ''}">
      <div class="contato-card-left">
        ${avatarHtml(c.nome)}
      </div>
      <div class="contato-card-body">
        <div class="contato-card-nome">
          ${esc(c.nome)}
          ${c.favorito ? '<span class="contato-star-icon">⭐</span>' : ''}
        </div>
        ${cargoEmpresaHtml}
        <div class="contato-card-contatos">
          ${wppNumero ? `
            <div class="contato-card-contato-item">
              <span class="contato-icone">💬</span>
              <span class="contato-valor">${fmtTel(wppNumero)}</span>
            </div>
          ` : ''}
          ${telPrincipal ? `
            <div class="contato-card-contato-item">
              <span class="contato-icone">📞</span>
              <span class="contato-valor">${esc(telPrincipal)}</span>
              <span class="contato-principal-badge">Principal</span>
            </div>
          ` : ''}
          ${outrosTels.map(t => `
            <div class="contato-card-contato-item">
              <span class="contato-icone">📞</span>
              <span class="contato-valor">${esc(t.numero)}</span>
            </div>
          `).join('')}
          ${c.email ? `
            <div class="contato-card-contato-item">
              <span class="contato-icone">✉️</span>
              <span class="contato-valor">${esc(c.email)}</span>
            </div>
          ` : ''}
        </div>
        ${c.observacoes ? `<div class="contato-card-observacoes">${esc(c.observacoes)}</div>` : ''}
      </div>
      <div class="contato-card-actions">
        <button class="contato-btn-acc contato-btn-fav ${c.favorito ? 'active' : ''}"
          onclick="Contato.toggleFavorito('${c.id}')" title="${c.favorito ? 'Remover favorito' : 'Favoritar'}">
          ${c.favorito ? '⭐' : '☆'}
        </button>
        ${wppLink ? `
          <a class="contato-btn-acc contato-btn-wpp" href="${wppLink}" target="_blank" rel="noopener" title="Abrir WhatsApp">
            💬
          </a>
        ` : ''}
        ${telPrincipal ? `
          <button class="contato-btn-acc contato-btn-copy" onclick="Contato.copiarTelefone('${c.id}')" title="Copiar telefone">
            📋
          </button>
        ` : ''}
        ${c.email ? `
          <button class="contato-btn-acc contato-btn-copy" onclick="Contato.copiarEmail('${c.id}')" title="Copiar e-mail">
            ✉️
          </button>
        ` : ''}
        <button class="contato-btn-acc contato-btn-edit" onclick="Contato.editar('${c.id}')" title="Editar">
          ✏️
        </button>
        <button class="contato-btn-acc contato-btn-del" onclick="Contato.excluir('${c.id}')" title="Excluir">
          🗑️
        </button>
      </div>
    </div>
  `;
}

/* ============================================================
   BUSCA
   ============================================================ */
function buscar(q) {
  termoBusca = (q || '').trim();
  render();
}

/* ============================================================
   FORMULÁRIO
   ============================================================ */
function abrirFormNovo() {
  editandoId = null;
  document.getElementById('contato-modal-titulo').textContent = '👤 Novo Contato';
  document.getElementById('contato-edit-id').value = '';

  // Limpar campos
  document.getElementById('contato-f-nome').value = '';
  document.getElementById('contato-f-whatsapp').value = '';
  document.getElementById('contato-f-email').value = '';
  document.getElementById('contato-f-empresa').value = '';
  document.getElementById('contato-f-cargo').value = '';
  document.getElementById('contato-f-observacoes').value = '';
  document.getElementById('contato-f-favorito').checked = false;

  // Resetar telefones
  resetarTelefones();

  document.getElementById('contato-modal').classList.add('active');
  setTimeout(() => document.getElementById('contato-f-nome')?.focus(), 100);
}

function abrirFormEditar(id) {
  const c = contatos.find(x => x.id === id);
  if (!c) return;

  editandoId = id;
  document.getElementById('contato-modal-titulo').textContent = '✏️ Editar Contato';
  document.getElementById('contato-edit-id').value = id;

  document.getElementById('contato-f-nome').value = c.nome || '';
  document.getElementById('contato-f-whatsapp').value = c.whatsapp || '';
  document.getElementById('contato-f-email').value = c.email || '';
  document.getElementById('contato-f-empresa').value = c.empresa || '';
  document.getElementById('contato-f-cargo').value = c.cargo || '';
  document.getElementById('contato-f-observacoes').value = c.observacoes || '';
  document.getElementById('contato-f-favorito').checked = c.favorito === true;

  // Carregar telefones
  const tels = Array.isArray(c.telefones) && c.telefones.length > 0
    ? c.telefones
    : [{ numero: '', principal: false }];
  setTelefones(tels);

  document.getElementById('contato-modal').classList.add('active');
  setTimeout(() => document.getElementById('contato-f-nome')?.focus(), 100);
}

function fecharForm() {
  document.getElementById('contato-modal').classList.remove('active');
  editandoId = null;
}

/* ============================================================
   TELEFONES DINÂMICOS
   ============================================================ */
function resetarTelefones() {
  setTelefones([{ numero: '', principal: false }]);
}

function setTelefones(lista) {
  const container = document.getElementById('contato-telefones-list');
  if (!container) return;
  container.innerHTML = '';
  lista.forEach((tel, index) => adicionarLinhaTelefone(tel.numero || '', tel.principal || false, index));
  atualizarBotoesPrincipal();
}

function adicionarTelefone(valor = '') {
  adicionarLinhaTelefone(valor, false);
  atualizarBotoesPrincipal();
  // Focar no último input adicionado
  const inputs = document.querySelectorAll('#contato-telefones-list .contato-input-phone');
  inputs[inputs.length - 1]?.focus();
}

function adicionarLinhaTelefone(valor = '', principal = false, index = null) {
  const container = document.getElementById('contato-telefones-list');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'contato-phone-row';

  const isPrincipal = principal;
  row.innerHTML = `
    <input type="tel" class="contato-input-phone" placeholder="(62) 99999-9999" maxlength="20" value="${esc(valor)}">
    <button type="button" class="contato-btn-phone-principal ${isPrincipal ? 'active' : ''}"
      onclick="Contato.togglePrincipal(this)" title="Definir como principal">
      ${isPrincipal ? '⭐' : '☆'}
    </button>
    <button type="button" class="contato-btn-phone-remove" onclick="Contato.removerTelefone(this)" title="Remover telefone">
      🗑️
    </button>
  `;

  container.appendChild(row);
}

function removerTelefone(btn) {
  const rows = document.querySelectorAll('#contato-telefones-list .contato-phone-row');
  if (rows.length <= 1) {
    // Se for o único, apenas limpa o valor
    const input = rows[0]?.querySelector('.contato-input-phone');
    if (input) input.value = '';
    return;
  }

  const row = btn.closest('.contato-phone-row');
  const wasPrincipal = row.querySelector('.contato-btn-phone-principal')?.classList.contains('active');
  row.remove();

  if (wasPrincipal) {
    // Se removeu o principal, marcar o primeiro como principal
    const firstPrincipal = document.querySelector('.contato-btn-phone-principal');
    if (firstPrincipal) {
      firstPrincipal.classList.add('active');
      firstPrincipal.textContent = '⭐';
    }
  }

  atualizarBotoesPrincipal();
}

function togglePrincipal(btn) {
  // Remover principal de todos
  document.querySelectorAll('.contato-btn-phone-principal').forEach(b => {
    b.classList.remove('active');
    b.textContent = '☆';
  });

  // Marcar este como principal
  btn.classList.add('active');
  btn.textContent = '⭐';
}

function atualizarBotoesPrincipal() {
  const botoes = document.querySelectorAll('.contato-btn-phone-principal');
  const temPrincipal = Array.from(botoes).some(b => b.classList.contains('active'));

  if (!temPrincipal && botoes.length > 0) {
    // Marcar o primeiro como principal por padrão
    botoes[0].classList.add('active');
    botoes[0].textContent = '⭐';
  }
}

function getTelefones() {
  const rows = document.querySelectorAll('#contato-telefones-list .contato-phone-row');
  return Array.from(rows).map(row => ({
    numero: row.querySelector('.contato-input-phone')?.value?.trim() || '',
    principal: row.querySelector('.contato-btn-phone-principal')?.classList.contains('active') || false
  })).filter(t => t.numero); // só inclui se tiver número
}

/* ============================================================
   SALVAR
   ============================================================ */
async function salvar() {
  const nome = document.getElementById('contato-f-nome').value.trim();
  if (!nome) {
    toast('⚠️ O campo Nome é obrigatório.');
    document.getElementById('contato-f-nome').focus();
    return;
  }

  const whatsapp = document.getElementById('contato-f-whatsapp').value.trim();
  const email = document.getElementById('contato-f-email').value.trim();
  const empresa = document.getElementById('contato-f-empresa').value.trim();
  const cargo = document.getElementById('contato-f-cargo').value.trim();
  const observacoes = document.getElementById('contato-f-observacoes').value.trim();
  const favorito = document.getElementById('contato-f-favorito').checked;
  const telefones = getTelefones();

  const agoraISO = new Date().toISOString();

  const dados = {
    nome,
    whatsapp,
    telefones,
    email,
    empresa,
    cargo,
    observacoes,
    favorito,
    empresa_id: getEmpresaId(),
    atualizadoEm: serverTimestamp(),
    atualizadoEmISO: agoraISO,
  };

  try {
    if (editandoId) {
      // Preservar dados de criação
      const orig = contatos.find(c => c.id === editandoId) || {};
      dados.criadoEm = orig.criadoEm;
      dados.criadoEmISO = orig.criadoEmISO;
      dados.vinculos = orig.vinculos || [];

      await setDoc(doc(db, COL, editandoId), dados, { merge: true });
      toast('✅ Contato atualizado!');
    } else {
      dados.criadoEm = serverTimestamp();
      dados.criadoEmISO = agoraISO;
      dados.vinculos = [];

      const ref = doc(collection(db, COL));
      await setDoc(ref, { ...dados, id: ref.id });
      toast('✅ Contato criado!');
    }

    fecharForm();
    await carregarContatos();
  } catch (err) {
    console.error('Erro ao salvar contato:', err);
    toast('❌ Erro ao salvar contato.');
  }
}

/* ============================================================
   EXCLUIR
   ============================================================ */
async function excluir(id) {
  const c = contatos.find(x => x.id === id);
  if (!c) return;
  if (!confirm(`Tem certeza que deseja excluir o contato "${c.nome}"?`)) return;

  try {
    await deleteDoc(doc(db, COL, id));
    contatos = contatos.filter(x => x.id !== id);
    localStorage.setItem(CACHE_KEY, JSON.stringify(contatos));
    render();
    toast('🗑️ Contato excluído.');
  } catch (err) {
    console.error('Erro ao excluir:', err);
    toast('❌ Erro ao excluir contato.');
  }
}

/* ============================================================
   FAVORITO
   ============================================================ */
async function toggleFavorito(id) {
  const c = contatos.find(x => x.id === id);
  if (!c) return;

  c.favorito = !c.favorito;
  render();

  try {
    await updateDoc(doc(db, COL, id), {
      favorito: c.favorito,
      atualizadoEm: serverTimestamp()
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(contatos));
    toast(c.favorito ? '⭐ Favoritado!' : '☆ Favorito removido.');
  } catch {
    localStorage.setItem(CACHE_KEY, JSON.stringify(contatos));
    toast('⚠️ Alteração salva apenas localmente.');
  }
}

/* ============================================================
   COPIAR
   ============================================================ */
async function copiarTelefone(id) {
  const c = contatos.find(x => x.id === id);
  if (!c) return;

  // Pegar o principal, ou o primeiro
  let numero = '';
  if (Array.isArray(c.telefones)) {
    const p = c.telefones.find(t => t.principal);
    numero = p ? p.numero : (c.telefones[0]?.numero || '');
  }

  if (!numero) {
    toast('⚠️ Nenhum telefone para copiar.');
    return;
  }

  try {
    await navigator.clipboard.writeText(numero);
    toast('✅ Telefone copiado!');
  } catch {
    // Fallback
    const textArea = document.createElement('textarea');
    textArea.value = numero;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    toast('✅ Telefone copiado!');
  }
}

async function copiarEmail(id) {
  const c = contatos.find(x => x.id === id);
  if (!c || !c.email) {
    toast('⚠️ Nenhum e-mail para copiar.');
    return;
  }

  try {
    await navigator.clipboard.writeText(c.email);
    toast('✅ E-mail copiado!');
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = c.email;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    toast('✅ E-mail copiado!');
  }
}

/* ============================================================
   API PÚBLICA (acessível via HTML onclick)
   ============================================================ */
window.Contato = {
  init,
  buscar,
  abrirFormNovo,
  abrirFormEditar,
  editar: (id) => abrirFormEditar(id),
  fecharForm,
  salvar,
  excluir,
  toggleFavorito,
  copiarTelefone,
  copiarEmail,
  adicionarTelefone,
  removerTelefone,
  togglePrincipal,
};

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  init();
});
