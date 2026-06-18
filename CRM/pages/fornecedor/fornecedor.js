/* ============================================================
   FORNECEDOR — CRM de Fornecedores + Lista de Compras v2
   ============================================================ */

import {
  db, collection, doc, addDoc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp
} from '../../scripts/firebase.js';

/* ── Coleções Firestore ──────────────────────────────────────── */
const COL_FORNECEDORES = 'fornecedores';
const COL_COMPRAS      = 'fornecedor_compras';
const COL_TENDENCIAS   = 'fornecedor_tendencias';
const COL_ESTOQUE      = 'estoque_produtos';

/* ── Estado ──────────────────────────────────────────────────── */
const state = {
  fornecedores: [],
  compras:      [],
  editandoForn: null,
  editandoComp: null,
  compModo:     'individual',   // 'individual' | 'lote'
};

/* ── Helpers ─────────────────────────────────────────────────── */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtTel(num) {
  if (!num) return '';
  const d = num.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return d;
}

function toast(msg) {
  const el = document.getElementById('forn-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visivel');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('visivel'), 2500);
}

const URG_ICON = { alta: '🔴', media: '🟡', baixa: '🟢' };

/* ── Avatar ──────────────────────────────────────────────────── */
const _PAL = ['#2563eb','#7c3aed','#db2777','#dc2626','#d97706','#059669','#0891b2','#4f46e5','#9333ea','#0f766e','#b45309','#16a34a'];
function _hash(s) { let h=0; for(let i=0;i<(s||'').length;i++) h=(h*31+s.charCodeAt(i))|0; return Math.abs(h); }
function _initials(nome) {
  if (!nome) return '?';
  const caps = nome.match(/[A-Z]/g) || [];
  if (caps.length >= 2) return caps[0] + caps[caps.length - 1];
  const ws = nome.trim().split(/\s+/);
  if (ws.length >= 2) return (ws[0][0] + ws[ws.length - 1][0]).toUpperCase();
  return nome.slice(0, 2).toUpperCase();
}
function av(nome) {
  const bg = _PAL[_hash(nome || '') % _PAL.length];
  return `<div class="forn-avatar" style="background:${bg}">${_initials(nome)}</div>`;
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
function atualizarDashboard() {
  const pendentes = state.compras.filter(i => i.status !== 'feita').length;
  const comprados = state.compras.filter(i => i.status === 'feita').length;
  const totalForn = state.fornecedores.length;
  const totalFav  = state.fornecedores.filter(f => f.favorito).length;

  document.getElementById('dash-pendentes').textContent   = pendentes;
  document.getElementById('dash-comprados').textContent   = comprados;
  document.getElementById('dash-fornecedores').textContent = totalForn;
  document.getElementById('dash-favoritos').textContent   = totalFav;
}

/* ═══════════════════════════════════════════════════════════════
   FORNECEDORES
   ═══════════════════════════════════════════════════════════════ */

async function carregarFornecedores() {
  document.getElementById('forn-loading').style.display = 'flex';
  try {
    const snap = await getDocs(collection(db, COL_FORNECEDORES));
    state.fornecedores = [];
    snap.forEach(d => state.fornecedores.push({ id: d.id, ...d.data() }));
    state.fornecedores.sort((a, b) => {
      if (a.favorito && !b.favorito) return -1;
      if (!a.favorito && b.favorito) return 1;
      return (a.nome || '').localeCompare(b.nome || '', 'pt');
    });
    renderFornecedores(state.fornecedores);
    atualizarDashboard();
  } catch (e) {
    console.error(e);
    renderFornecedores([]);
  }
  document.getElementById('forn-loading').style.display = 'none';
}

function renderFornecedores(lista) {
  const el = document.getElementById('forn-lista');
  const emptyEl = document.getElementById('forn-empty');
  if (!lista.length) {
    el.innerHTML = '';
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';
  el.innerHTML = lista.map(f => {
    const wpp = f.whatsapp || f.telefone1 || '';
    const wppLink = wpp ? `https://wa.me/55${wpp.replace(/\D/g,'')}` : null;
    return `
      <div class="forn-card-forn ${f.favorito ? 'forn-card-fav' : ''}">
        <div class="forn-card-left">
          ${av(f.nome)}
          <div class="forn-card-forn-body">
            <div class="forn-card-forn-nome">
              ${esc(f.nome)}
              ${f.favorito ? '<span class="forn-star-icon">⭐</span>' : ''}
            </div>
            ${f.empresa ? `<div class="forn-card-forn-empresa">🏢 ${esc(f.empresa)}</div>` : ''}
            <div class="forn-card-forn-contatos">
              ${f.telefone1 ? `<span>📞 ${fmtTel(f.telefone1)}</span>` : ''}
              ${f.telefone2 ? `<span>📞 ${fmtTel(f.telefone2)}</span>` : ''}
              ${f.whatsapp ? `<span>💬 ${fmtTel(f.whatsapp)}</span>` : ''}
              ${f.instagram ? `<span>📷 ${esc(f.instagram)}</span>` : ''}
              ${f.endereco ? `<span>📍 ${esc(f.endereco)}</span>` : ''}
              ${f.cidade ? `<span>📍 ${esc(f.cidade)}</span>` : ''}
            </div>
            ${f.obs ? `<div class="forn-card-forn-obs">${esc(f.obs)}</div>` : ''}
          </div>
        </div>
        <div class="forn-card-forn-actions">
          <button class="forn-btn-acc forn-btn-fav ${f.favorito ? 'on' : ''}"
            onclick="Forn.toggleFav('${f.id}')" title="${f.favorito ? 'Remover dos favoritos' : 'Favoritar'}">
            ${f.favorito ? '⭐' : '☆'}
          </button>
          ${wppLink ? `<a class="forn-btn-acc forn-btn-wpp" href="${wppLink}" target="_blank" rel="noopener" title="WhatsApp">💬</a>` : ''}
          ${f.site ? `<a class="forn-btn-acc forn-btn-site" href="${esc(f.site)}" target="_blank" rel="noopener" title="Abrir Site">🌐</a>` : ''}
          <button class="forn-btn-acc forn-btn-edit" onclick="Forn.editar('${f.id}')" title="Editar">✏️</button>
          <button class="forn-btn-acc forn-btn-del" onclick="Forn.excluir('${f.id}')" title="Excluir">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

function abrirFormForn(id) {
  document.getElementById('forn-loading').style.display = 'none';
  if (id) {
    const f = state.fornecedores.find(x => x.id === id);
    if (!f) return;
    document.getElementById('ff-id').value         = f.id;
    document.getElementById('ff-nome').value       = f.nome || '';
    document.getElementById('ff-empresa').value    = f.empresa || '';
    document.getElementById('ff-tel1').value       = f.telefone1 || '';
    document.getElementById('ff-tel2').value       = f.telefone2 || '';
    document.getElementById('ff-whatsapp').value   = f.whatsapp || '';
    document.getElementById('ff-instagram').value  = f.instagram || '';
    document.getElementById('ff-site').value       = f.site || '';
    document.getElementById('ff-endereco').value   = f.endereco || '';
    document.getElementById('ff-cidade').value     = f.cidade || '';
    document.getElementById('ff-obs').value        = f.obs || '';
    document.getElementById('form-forn-titulo').textContent = 'Editar Fornecedor';
    state.editandoForn = id;
  } else {
    ['ff-id','ff-nome','ff-empresa','ff-tel1','ff-tel2','ff-whatsapp',
     'ff-instagram','ff-site','ff-endereco','ff-cidade','ff-obs'
    ].forEach(k => document.getElementById(k).value = '');
    document.getElementById('form-forn-titulo').textContent = 'Novo Fornecedor';
    state.editandoForn = null;
  }
  document.getElementById('form-fornecedor').style.display = 'flex';
  document.getElementById('btn-novo-fornecedor').style.display = 'none';
  document.getElementById('ff-nome').focus();
}

function fecharFormForn() {
  document.getElementById('form-fornecedor').style.display = 'none';
  document.getElementById('btn-novo-fornecedor').style.display = '';
  state.editandoForn = null;
}

async function salvarForn() {
  const nome = document.getElementById('ff-nome').value.trim();
  const tel1 = document.getElementById('ff-tel1').value.trim();
  if (!nome) { toast('⚠️ Preencha o nome do fornecedor.'); document.getElementById('ff-nome').focus(); return; }
  if (!tel1) { toast('⚠️ Preencha pelo menos o Telefone 1.'); document.getElementById('ff-tel1').focus(); return; }

  const dados = {
    nome,
    empresa:    document.getElementById('ff-empresa').value.trim(),
    telefone1:  tel1,
    telefone2:  document.getElementById('ff-tel2').value.trim(),
    whatsapp:   document.getElementById('ff-whatsapp').value.trim(),
    instagram:  document.getElementById('ff-instagram').value.trim(),
    site:       document.getElementById('ff-site').value.trim(),
    endereco:   document.getElementById('ff-endereco').value.trim(),
    cidade:     document.getElementById('ff-cidade').value.trim(),
    obs:        document.getElementById('ff-obs').value.trim(),
    favorito:   false,
    atualizadoEm: serverTimestamp(),
  };

  const editId = state.editandoForn;
  try {
    if (editId) {
      const ant = state.fornecedores.find(x => x.id === editId);
      if (ant) {
        dados.favorito = ant.favorito || false;
        dados.criadoEm = ant.criadoEm;
      }
      await updateDoc(doc(db, COL_FORNECEDORES, editId), dados);
      toast('✏️ Fornecedor atualizado!');
    } else {
      dados.favorito = false;
      dados.criadoEm = serverTimestamp();
      const ref = doc(collection(db, COL_FORNECEDORES));
      await setDoc(ref, dados);
      toast('✅ Fornecedor cadastrado!');
    }
    fecharFormForn();
    await carregarFornecedores();
  } catch (e) {
    toast('❌ Erro ao salvar.');
    console.error(e);
  }
}

async function excluirForn(id) {
  const f = state.fornecedores.find(x => x.id === id);
  if (!f) return;
  if (!confirm(`Tem certeza que deseja excluir "${f.nome}"?\nTodos os dados do fornecedor serão removidos.`)) return;
  try {
    await deleteDoc(doc(db, COL_FORNECEDORES, id));
    toast('🗑️ Fornecedor excluído.');
    await carregarFornecedores();
  } catch (e) {
    toast('❌ Erro ao excluir.');
    console.error(e);
  }
}

async function toggleFav(id) {
  const f = state.fornecedores.find(x => x.id === id);
  if (!f) return;
  const novo = !f.favorito;
  try {
    await updateDoc(doc(db, COL_FORNECEDORES, id), { favorito: novo, atualizadoEm: serverTimestamp() });
    f.favorito = novo;
    state.fornecedores.sort((a, b) => {
      if (a.favorito && !b.favorito) return -1;
      if (!a.favorito && b.favorito) return 1;
      return (a.nome || '').localeCompare(b.nome || '', 'pt');
    });
    renderFornecedores(state.fornecedores);
    atualizarDashboard();
    toast(novo ? '⭐ Favoritado!' : '☆ Favorito removido.');
  } catch (e) {
    toast('❌ Erro.');
    console.error(e);
  }
}

function buscarFornecedores(q) {
  const clearBtn = document.getElementById('forn-busca-clear');
  if (clearBtn) clearBtn.style.display = q ? '' : 'none';

  // auto-switch para aba fornecedores ao digitar
  if (q) {
    const tabForn = document.querySelector('[data-tab="fornecedores"]');
    if (tabForn && !tabForn.classList.contains('active')) tabForn.click();
  }

  const termo = (q || '').trim().toLowerCase();
  if (!termo) { renderFornecedores(state.fornecedores); return; }

  const palavras = termo.split(/\s+/).filter(Boolean);
  const soNum    = termo.replace(/\D/g, '');

  const filtrados = state.fornecedores.filter(f => {
    const textos = [
      f.nome      || '',
      f.empresa   || '',
      f.instagram || '',
      f.endereco  || '',
      f.cidade    || '',
      f.obs       || '',
    ].map(s => s.toLowerCase()).join(' ');

    const tels = [
      (f.telefone1 || '').replace(/\D/g, ''),
      (f.telefone2 || '').replace(/\D/g, ''),
      (f.whatsapp  || '').replace(/\D/g, ''),
    ].join(' ');

    if (soNum && tels.includes(soNum)) return true;
    return palavras.every(p => textos.includes(p));
  });
  renderFornecedores(filtrados);
}

function limparBusca() {
  const input = document.getElementById('forn-busca');
  if (input) { input.value = ''; input.focus(); }
  const clearBtn = document.getElementById('forn-busca-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  renderFornecedores(state.fornecedores);
}

function toggleDash() {
  const dash = document.getElementById('forn-dashboard');
  const ico  = document.getElementById('forn-dash-ico');
  const recolhido = dash.classList.toggle('recolhido');
  ico.classList.toggle('recolhido', recolhido);
  localStorage.setItem('forn_dash_recolhido', recolhido ? '1' : '0');
}

/* ═══════════════════════════════════════════════════════════════
   LISTA DE COMPRAS (MELHORADA)
   ═══════════════════════════════════════════════════════════════ */

async function carregarCompras() {
  document.getElementById('compras-loading').style.display = 'flex';
  try {
    const snap = await getDocs(collection(db, COL_COMPRAS));
    state.compras = [];
    snap.forEach(d => state.compras.push({ id: d.id, ...d.data() }));
    state.compras.sort((a, b) => {
      const p = { alta: 0, media: 1, baixa: 2 };
      return (p[a.urgencia] ?? 1) - (p[b.urgencia] ?? 1);
    });
    renderCompras(state.compras);
    atualizarDashboard();
  } catch {
    state.compras = [];
    renderCompras([]);
  }
  document.getElementById('compras-loading').style.display = 'none';
}

function renderCompras(itens) {
  const listaEl = document.getElementById('compras-lista');
  const emptyEl = document.getElementById('compras-empty');
  const btnDel  = document.getElementById('btn-excluir-todos-compras');
  if (btnDel) btnDel.style.display = itens.length ? '' : 'none';
  if (!itens.length) { listaEl.innerHTML = ''; emptyEl.style.display = 'flex'; return; }
  emptyEl.style.display = 'none';

  listaEl.innerHTML = itens.map(item => {
    const feita = item.status === 'feita';
    return `
      <div class="forn-card-compra ${feita ? 'compra-feita' : ''}">
        <div class="compra-card-top">
          <div class="compra-card-info">
            <div class="compra-card-nome">${esc(item.nome)}</div>
            <div class="compra-card-meta">
              Qtd: <strong>${item.quantidade || 1}</strong>
              <span class="compra-urg-badge ${item.urgencia || 'media'}">
                ${URG_ICON[item.urgencia] || '🟡'} ${item.urgencia || 'media'}
              </span>
            </div>
            ${item.obs ? `<div class="compra-card-obs">${esc(item.obs)}</div>` : ''}
          </div>
        </div>
        <div class="compra-card-actions">
          <button class="compra-btn compra-btn-edit" onclick="Forn.editarCompra('${item.id}')" title="Editar">✏️ Editar</button>
          <button class="compra-btn compra-btn-del" onclick="Forn.excluirCompra('${item.id}')" title="Excluir">🗑️ Excluir</button>
          <button class="compra-btn compra-btn-feita ${feita ? 'marcado' : ''}"
            onclick="Forn.toggleFeita('${item.id}', ${feita})" title="${feita ? 'Desmarcar' : 'Marcar como feita'}">
            ${feita ? '↩ Desmarcar' : '✅ Feita'}
          </button>
          ${!feita ? `<button class="compra-btn compra-btn-receber" onclick="Forn.receberItem('${item.id}')" title="Dar entrada no estoque">📦 Recebi</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

function filtrarCompras() {
  const q = (document.getElementById('compras-busca')?.value || '').trim().toLowerCase();
  if (!q) { renderCompras(state.compras); return; }
  renderCompras(state.compras.filter(item =>
    (item.nome || '').toLowerCase().includes(q) ||
    (item.obs  || '').toLowerCase().includes(q)
  ));
}

function setModoCompra(modo) {
  state.compModo = modo;
  document.getElementById('fc-modo-btn-individual').classList.toggle('active', modo === 'individual');
  document.getElementById('fc-modo-btn-lote').classList.toggle('active',       modo === 'lote');
  document.getElementById('fc-campos-individual').style.display = modo === 'individual' ? '' : 'none';
  document.getElementById('fc-campos-lote').style.display       = modo === 'lote'       ? '' : 'none';
}

function abrirFormCompra(id) {
  document.getElementById('form-compra-titulo').textContent = id ? 'Editar Item' : 'Novo Item para Comprar';
  // No modo edição só permite individual
  document.getElementById('fc-modo-toggle').style.display = id ? 'none' : '';
  if (id) {
    setModoCompra('individual');
    const item = state.compras.find(x => x.id === id);
    if (!item) return;
    document.getElementById('fc-nome').value     = item.nome || '';
    document.getElementById('fc-qty').value      = item.quantidade || 1;
    document.getElementById('fc-urgencia').value = item.urgencia || 'media';
    document.getElementById('fc-obs').value      = item.obs || '';
    state.editandoComp = id;
  } else {
    setModoCompra(state.compModo);   // mantém o último modo escolhido
    document.getElementById('fc-nome').value     = '';
    document.getElementById('fc-qty').value      = '1';
    document.getElementById('fc-urgencia').value = 'media';
    document.getElementById('fc-obs').value      = '';
    document.getElementById('fc-lote').value     = '';
    state.editandoComp = null;
  }
  document.getElementById('form-compra').style.display = 'flex';
  document.getElementById('btn-nova-compra').style.display = 'none';
  state.compModo === 'lote'
    ? document.getElementById('fc-lote').focus()
    : document.getElementById('fc-nome').focus();
}

function fecharFormCompra() {
  document.getElementById('form-compra').style.display = 'none';
  document.getElementById('btn-nova-compra').style.display = '';
  state.editandoComp = null;
}

async function salvarCompra() {
  // Modo lote: cria um item por linha não-vazia
  if (state.compModo === 'lote' && !state.editandoComp) {
    const linhas = (document.getElementById('fc-lote').value || '')
      .split('\n').map(l => l.trim()).filter(Boolean);
    if (!linhas.length) { document.getElementById('fc-lote').focus(); return; }
    try {
      const urgencia = 'media';
      for (let i = 0; i < linhas.length; i++) {
        await setDoc(doc(db, COL_COMPRAS, `compra_${Date.now()}_${i}`), {
          nome: linhas[i], quantidade: 1, urgencia, obs: '', atualizadoEm: serverTimestamp()
        });
      }
      toast(`✅ ${linhas.length} item(s) adicionado(s)!`);
      fecharFormCompra();
      await carregarCompras();
    } catch { toast('⚠ Erro ao salvar.'); }
    return;
  }

  // Modo individual (criação ou edição)
  const nome = document.getElementById('fc-nome').value.trim();
  if (!nome) { document.getElementById('fc-nome').focus(); return; }
  const dados = {
    nome,
    quantidade: Number(document.getElementById('fc-qty').value) || 1,
    urgencia:   document.getElementById('fc-urgencia').value,
    obs:        document.getElementById('fc-obs').value.trim(),
    atualizadoEm: serverTimestamp()
  };
  const editId = state.editandoComp;
  const id = editId || `compra_${Date.now()}`;
  try {
    if (editId) {
      const ant = state.compras.find(x => x.id === editId);
      if (ant && ant.status) dados.status = ant.status;
      await updateDoc(doc(db, COL_COMPRAS, id), dados);
    } else {
      await setDoc(doc(db, COL_COMPRAS, id), dados);
    }
    toast(editId ? '✏️ Item atualizado!' : '✅ Item adicionado!');
    fecharFormCompra();
    await carregarCompras();
  } catch { toast('⚠ Erro ao salvar.'); }
}

async function excluirCompraById(id) {
  if (!confirm('Tem certeza que deseja excluir este item da lista de compras?')) return;
  try {
    await deleteDoc(doc(db, COL_COMPRAS, id));
    toast('🗑️ Item removido.');
    await carregarCompras();
  } catch { toast('⚠ Erro ao excluir.'); }
}

async function excluirTodasCompras() {
  if (!state.compras.length) { toast('Nenhum item para excluir'); return; }
  const ok = confirm(`Tem certeza que deseja excluir todos os ${state.compras.length} item(s) da lista de compras?\n\nEsta ação não pode ser desfeita.`);
  if (!ok) return;
  try {
    await Promise.all(state.compras.map(i => deleteDoc(doc(db, COL_COMPRAS, i.id))));
    state.compras = [];
    renderCompras([]);
    toast('🗑️ Todos os itens foram excluídos.');
  } catch { toast('⚠ Erro ao excluir.'); }
}

async function toggleFeita(id, jaFeita) {
  try {
    const novoStatus = jaFeita ? '' : 'feita';
    await updateDoc(doc(db, COL_COMPRAS, id), { status: novoStatus, atualizadoEm: serverTimestamp() });
    toast(jaFeita ? '↩ Desmarcado.' : '✅ Tarefa concluída!');
    await carregarCompras();
  } catch { toast('⚠ Erro ao salvar.'); }
}

/* ═══════════════════════════════════════════════════════════════
   ESTOQUE BAIXO (mantido)
   ═══════════════════════════════════════════════════════════════ */
async function carregarEstoqueBaixo() {
  document.getElementById('baixo-loading').style.display = 'flex';
  try {
    const snap = await getDocs(collection(db, COL_ESTOQUE));
    const baixo = [];
    snap.forEach(d => {
      const p = { id: d.id, ...d.data() };
      if (p.quantidade <= p.quantidadeMinima) baixo.push(p);
    });
    renderEstoqueBaixo(baixo);
  } catch { renderEstoqueBaixo([]); }
  document.getElementById('baixo-loading').style.display = 'none';
}

function renderEstoqueBaixo(itens) {
  const listaEl = document.getElementById('baixo-lista');
  const emptyEl = document.getElementById('baixo-empty');
  if (!itens.length) { listaEl.innerHTML = ''; emptyEl.style.display = 'flex'; return; }
  emptyEl.style.display = 'none';
  const CAT_ICON = { 'Cabo':'🔌','Capinha':'📱','Película':'🛡️','Carregador':'⚡','Fone':'🎧','Bateria':'🔋','Tela':'📺','Peça':'🔧','Acessório':'✨','Outro':'📌' };
  listaEl.innerHTML = itens.map(p => `
    <div class="forn-card-compra compra-alerta">
      <div class="compra-card-top">
        <div class="compra-card-info">
          <div class="compra-card-nome">
            ${CAT_ICON[p.categoria] || '📌'} ${esc(p.nome || p.description || '—')}
          </div>
          <div class="compra-card-meta">
            Categoria: ${esc(p.categoria || 'Outro')} ·
            Qtd atual: <strong style="color:#f87171">${p.quantidade}</strong> /
            Mín: ${p.quantidadeMinima}
          </div>
        </div>
      </div>
      <div class="compra-card-actions">
        <span class="forn-badge-alerta">⚠️ Baixo</span>
      </div>
    </div>
  `).join('');
}

/* ═══════════════════════════════════════════════════════════════
   TENDÊNCIAS DE MERCADO (mantido)
   ═══════════════════════════════════════════════════════════════ */
async function carregarTendencias() {
  document.getElementById('tendencias-loading').style.display = 'flex';
  try {
    const snap = await getDocs(collection(db, COL_TENDENCIAS));
    const itens = [];
    snap.forEach(d => itens.push({ id: d.id, ...d.data() }));
    renderTendencias(itens);
  } catch { renderTendencias([]); }
  document.getElementById('tendencias-loading').style.display = 'none';
}

function renderTendencias(itens) {
  const listaEl = document.getElementById('tendencias-lista');
  const emptyEl = document.getElementById('tendencias-empty');
  if (!itens.length) { listaEl.innerHTML = ''; emptyEl.style.display = 'flex'; return; }
  emptyEl.style.display = 'none';
  const TEND = { crescendo: '📈', estavel: '➡️', caindo: '📉' };
  const PRIO = { alta: '🔴', media: '🟡', baixa: '🟢' };
  listaEl.innerHTML = itens.map(item => `
    <div class="forn-card-compra">
      <div class="compra-card-top">
        <div class="compra-card-info">
          <div class="compra-card-nome">
            ${TEND[item.tendencia] || '📈'} ${esc(item.produto)}
          </div>
          ${item.obs ? `<div class="compra-card-obs">${esc(item.obs)}</div>` : ''}
        </div>
      </div>
      <div class="compra-card-actions">
        <span class="compra-urg-badge ${item.prio || 'media'}">${PRIO[item.prio] || '🟡'} ${item.prio || 'media'}</span>
        <button class="compra-btn compra-btn-del" onclick="Forn.excluirTendencia('${item.id}')" title="Remover">🗑️ Excluir</button>
      </div>
    </div>
  `).join('');
}

async function excluirTendencia(id) {
  if (!confirm('Remover esta observação de mercado?')) return;
  try {
    await deleteDoc(doc(db, COL_TENDENCIAS, id));
    toast('🗑️ Removido.');
    await carregarTendencias();
  } catch { toast('⚠ Erro.'); }
}

function salvarTendencia() {
  const produto = document.getElementById('ft-produto').value.trim();
  if (!produto) { document.getElementById('ft-produto').focus(); return; }
  const dados = {
    produto,
    tendencia: document.getElementById('ft-tendencia').value,
    prio:      document.getElementById('ft-prio').value,
    obs:       document.getElementById('ft-obs').value.trim(),
    criadoEm:  serverTimestamp()
  };
  setDoc(doc(db, COL_TENDENCIAS, `tend_${Date.now()}`), dados)
    .then(() => {
      toast('✅ Observação salva!');
      document.getElementById('form-tendencia').style.display = 'none';
      document.getElementById('btn-nova-tendencia').style.display = '';
      document.getElementById('ft-produto').value = '';
      document.getElementById('ft-obs').value = '';
      carregarTendencias();
    })
    .catch(() => toast('⚠ Erro ao salvar.'));
}

function fecharFormTendencia() {
  document.getElementById('form-tendencia').style.display = 'none';
  document.getElementById('btn-nova-tendencia').style.display = '';
}

/* ═══════════════════════════════════════════════════════════════
   TABS
   ═══════════════════════════════════════════════════════════════ */
document.querySelectorAll('.forn-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.forn-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.forn-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'fornecedores') carregarFornecedores();
    if (btn.dataset.tab === 'compras') carregarCompras();
    if (btn.dataset.tab === 'estoque-baixo') carregarEstoqueBaixo();
    if (btn.dataset.tab === 'mercado') carregarTendencias();
  });
});

/* ═══════════════════════════════════════════════════════════════
   EVENTOS
   ═══════════════════════════════════════════════════════════════ */

// Fornecedores
document.getElementById('btn-novo-fornecedor').addEventListener('click', () => abrirFormForn(null));
document.getElementById('ff-salvar').addEventListener('click', salvarForn);
document.getElementById('ff-cancelar').addEventListener('click', fecharFormForn);
document.getElementById('ff-nome').addEventListener('keypress', e => { if (e.key === 'Enter') salvarForn(); });

// Compras
document.getElementById('btn-nova-compra').addEventListener('click', () => abrirFormCompra(null));
document.getElementById('fc-salvar').addEventListener('click', salvarCompra);
document.getElementById('fc-cancelar').addEventListener('click', fecharFormCompra);
document.getElementById('fc-nome').addEventListener('keypress', e => { if (e.key === 'Enter') salvarCompra(); });

// Tendências
document.getElementById('btn-nova-tendencia').addEventListener('click', () => {
  document.getElementById('form-tendencia').style.display = 'flex';
  document.getElementById('btn-nova-tendencia').style.display = 'none';
  document.getElementById('ft-produto').focus();
});
document.getElementById('ft-salvar').addEventListener('click', salvarTendencia);
document.getElementById('ft-cancelar').addEventListener('click', fecharFormTendencia);

/* ═══════════════════════════════════════════════════════════════
   INTEGRAÇÃO: FORNECEDOR → ESTOQUE
   ═══════════════════════════════════════════════════════════════ */
async function receberItemNoEstoque(item) {
  const nome = (item.nome || '').trim();
  const qtd  = parseInt(item.quantidade) || 1;
  if (!nome) return;
  try {
    const snap = await getDocs(query(collection(db, COL_ESTOQUE), where('nome', '==', nome)));
    if (!snap.empty) {
      const prodRef = doc(db, COL_ESTOQUE, snap.docs[0].id);
      const atual = snap.docs[0].data().quantidade || 0;
      await updateDoc(prodRef, { quantidade: atual + qtd, atualizadoEm: serverTimestamp() });
    } else {
      await addDoc(collection(db, COL_ESTOQUE), {
        nome: nome,
        quantidade: qtd,
        quantidadeMinima: 2,
        categoria: item.categoria || 'Comprado',
        fornecedor: item.obs || '',
        precoCusto: 0,
        precoVenda: 0,
        criadoEm: serverTimestamp()
      });
    }
    await deleteDoc(doc(db, COL_COMPRAS, item.id));
    toast(`📦 "${nome}" adicionado ao estoque!`);
    return true;
  } catch (e) {
    console.error('[Integração] Erro ao receber item no estoque:', e);
    toast('⚠️ Erro ao dar entrada no estoque');
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   API PÚBLICA
   ═══════════════════════════════════════════════════════════════ */
window.Forn = {
  editar:            (id) => abrirFormForn(id),
  excluir:           (id) => excluirForn(id),
  toggleFav:         (id) => toggleFav(id),
  buscar:            (q)  => buscarFornecedores(q),
  limparBusca:       ()   => limparBusca(),
  toggleDash:        ()   => toggleDash(),
  editarCompra:      (id) => abrirFormCompra(id),
  excluirCompra:     (id) => excluirCompraById(id),
  excluirTodas:      ()   => excluirTodasCompras(),
  setModo:           (m)  => setModoCompra(m),
  toggleFeita:       (id, feita) => toggleFeita(id, feita),
  filtrarCompras:    () => filtrarCompras(),
  excluirTendencia:  (id) => excluirTendencia(id),
  receberItem:       (id) => {
    const item = state.compras.find(x => x.id === id);
    if (!item) return;
    if (confirm(`Dar entrada de "${item.nome}" (x${item.quantidade || 1}) no estoque?`)) {
      receberItemNoEstoque(item).then(ok => { if (ok) { state.compras = state.compras.filter(x => x.id !== id); renderCompras(state.compras); } });
    }
  },
};

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('forn_dash_recolhido') === '1') {
    document.getElementById('forn-dashboard')?.classList.add('recolhido');
    document.getElementById('forn-dash-ico')?.classList.add('recolhido');
  }
  carregarFornecedores();
});
