import { URLS, devPrefix, STORAGE_KEYS } from '../../shared/app-config.js';
import { db, collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, query, limit } from '../../scripts/firebase.js';
import { initModulo } from '../../scripts/kernel.js';
import { carregarPermissoes, podeVisualizar, podeCriar, podeEditar, podeExcluir } from '../../shared/permissoes.js';
import { escHtml as esc } from '../../shared/sanitize.js';
import { formatDateOnly } from '../../shared/date-utils.js';
import { injectTenantFilter, tData } from '../../shared/tenant-query.js';

const COL_COMPRAS = 'compras_pedidos';
const fmt = v => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

let dados = [];
let fornecedores = [];
let filtroStatus = 'todos';
let editandoId = null;

// ── Toast ──────────────────────────────────────────────────────────
const toastEl = document.getElementById('cr-toast');
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

// ── Carregar ───────────────────────────────────────────────────────
async function carregar() {
  try {
    const q = query(collection(db, COL_COMPRAS), ...injectTenantFilter([]), limit(500));
    const snap = await getDocs(q);
    dados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { dados = []; }

  try {
    const q = query(collection(db, 'fornecedor_compras'), ...injectTenantFilter([]), limit(200));
    const snap = await getDocs(q);
    fornecedores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { fornecedores = []; }

  render();
}

// ── Render ─────────────────────────────────────────────────────────
function render() {
  const listaEl = document.getElementById('cr-lista');
  const emptyEl = document.getElementById('cr-empty');
  let f = dados;
  if (filtroStatus !== 'todos') f = dados.filter(c => c.status === filtroStatus);
  f = f.sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  if (!f.length) { listaEl.innerHTML = ''; emptyEl.style.display = 'flex'; return; }
  emptyEl.style.display = 'none';

  const nomesFornecedor = {};
  fornecedores.forEach(f => { nomesFornecedor[f.id] = f.descricao || f.nome || f.id; });

  listaEl.innerHTML = f.map(c => {
    const nomeForn = nomesFornecedor[c.fornecedor_ref] || c.fornecedor_nome || '—';
    return `<div class="cr-card">
      <div class="cr-card-left">
        <div class="cr-card-info">
          <div class="cr-card-desc">${esc(c.descricao || '—')}</div>
          <div class="cr-card-sub">🏭 ${esc(nomeForn)} · 📅 ${fmtData(c.data)} · ${statusBadge(c.status)}</div>
        </div>
      </div>
      <div class="cr-card-right">
        <div class="cr-card-valor">${fmt(c.valor)}</div>
        <div class="cr-card-acoes">
          ${podeEditar('compras') ? `<button class="cr-card-edit-btn" data-id="${c.id}" title="Editar">✏️</button>` : ''}
          ${podeExcluir('compras') ? `<button class="cr-card-del-btn" data-id="${c.id}" title="Excluir">🗑️</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  // Bind events
  listaEl.querySelectorAll('.cr-card-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => abrirEdicao(btn.dataset.id));
  });
  listaEl.querySelectorAll('.cr-card-del-btn').forEach(btn => {
    btn.addEventListener('click', () => excluir(btn.dataset.id));
  });
}

// ── Form ───────────────────────────────────────────────────────────
function abrirForm(editId) {
  editandoId = editId;
  const item = editId ? dados.find(c => c.id === editId) : null;
  document.getElementById('cr-form').classList.remove('hidden');
  document.getElementById('cr-form-titulo').textContent = editId ? 'Editar Pedido' : 'Novo Pedido';
  document.getElementById('cr-desc').value = item?.descricao || '';
  document.getElementById('cr-fornecedor').value = item?.fornecedor_ref || '';
  document.getElementById('cr-data').value = item?.data || new Date().toISOString().slice(0, 10);
  document.getElementById('cr-valor').value = item?.valor || '';
  document.getElementById('cr-status').value = item?.status || 'pendente';
  document.getElementById('cr-obs').value = item?.obs || '';
  document.getElementById('cr-btn-nova').style.display = 'none';

  // Popula fornecedores
  const selForn = document.getElementById('cr-fornecedor');
  selForn.innerHTML = '<option value="">Selecionar fornecedor...</option>' +
    fornecedores.map(f => `<option value="${f.id}" ${f.id === item?.fornecedor_ref ? 'selected' : ''}>${esc(f.descricao || f.nome || f.id)}</option>`).join('');
}

function fecharForm() {
  document.getElementById('cr-form').classList.add('hidden');
  document.getElementById('cr-btn-nova').style.display = '';
  editandoId = null;
}

async function salvar() {
  const desc = document.getElementById('cr-desc').value.trim();
  if (!desc) { toast('Informe a descrição do pedido.'); return; }
  const dadosDoc = tData({
    descricao: desc,
    fornecedor_ref: document.getElementById('cr-fornecedor').value || '',
    fornecedor_nome: document.getElementById('cr-fornecedor').selectedOptions?.[0]?.text || '',
    data: document.getElementById('cr-data').value || new Date().toISOString().slice(0, 10),
    valor: Number(document.getElementById('cr-valor').value) || 0,
    status: document.getElementById('cr-status').value || 'pendente',
    obs: document.getElementById('cr-obs').value.trim() || '',
    atualizadoEm: serverTimestamp()
  });
  const id = editandoId || `comp_${Date.now()}`;
  try {
    await setDoc(doc(db, COL_COMPRAS, id), dadosDoc);
    toast(editandoId ? '✏️ Pedido atualizado!' : '✅ Pedido criado!');
    fecharForm();
    await carregar();
  } catch { toast('⚠ Erro ao salvar.'); }
}

async function excluir(id) {
  if (!confirm('Excluir este pedido?')) return;
  try {
    await deleteDoc(doc(db, COL_COMPRAS, id));
    dados = dados.filter(c => c.id !== id);
    render();
    toast('🗑️ Removido.');
  } catch { toast('⚠ Erro ao excluir.'); }
}

function abrirEdicao(id) { abrirForm(id); }

// ── Utilitários ────────────────────────────────────────────────────
function statusBadge(s) {
  const m = { pendente: 'Pendente', pedido: 'Pedido', recebido: 'Recebido', cancelado: 'Cancelado' };
  const cls = s === 'recebido' ? 'cr-badge-recebido' : s === 'pedido' ? 'cr-badge-pedido' : s === 'cancelado' ? 'cr-badge-cancelado' : 'cr-badge-pendente';
  return `<span class="cr-badge ${cls}">${m[s] || s}</span>`;
}
function fmtData(iso) { return formatDateOnly(iso, '—'); }

// ── Eventos ────────────────────────────────────────────────────────
document.getElementById('cr-btn-nova')?.addEventListener('click', () => abrirForm(null));
document.getElementById('cr-salvar')?.addEventListener('click', salvar);
document.getElementById('cr-cancelar')?.addEventListener('click', fecharForm);
document.querySelectorAll('[data-cr-status]')?.forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-cr-status]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filtroStatus = btn.dataset.crStatus;
    render();
  });
});

// ── Boot ───────────────────────────────────────────────────────────
(async function boot() {
  const ctx = await initModulo();
  if (!ctx) return;
  await carregarPermissoes(ctx);
  if (!podeVisualizar('compras')) { window.location.href = URLS.dashboard(); return; }
  if (!podeCriar('compras')) document.getElementById('cr-btn-nova').style.display = 'none';
  await carregar();
})();
