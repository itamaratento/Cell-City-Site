/* ================================================================
   CENTRAL SAAS — Lógica principal
   Cell City Gestão Empresarial

   Coleções Firestore:
     empresas/{empresaId}          — dados do inquilino
     usuarios/{uid}                — usuário vinculado a uma empresa
     empresa_modulos/{empresaId}   — módulos ativos (alternativa plana)
     auditoria_saas/{logId}        — logs de ações administrativas
   ================================================================ */

import {
  db, auth, authReady,
  collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc,
  query, orderBy, where, onSnapshot, serverTimestamp, limit
} from '../../scripts/firebase.js';
import { isMasterAdmin, getTenant, PLANOS, PERFIS, logAuditoria } from '../../shared/tenant.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// ── Catálogo completo de módulos ──────────────────────────────
const MODULOS_CATALOGO = [
  { id: 'os',                  nome: 'Ordem de Serviço',     icone: '📦', categoria: 'Operacional'   },
  { id: 'caixa',               nome: 'Caixa',                icone: '💰', categoria: 'Financeiro'    },
  { id: 'financeiro',          nome: 'Financeiro',           icone: '💹', categoria: 'Financeiro'    },
  { id: 'clientes',            nome: 'Clientes',             icone: '👥', categoria: 'Operacional'   },
  { id: 'estoque',             nome: 'Estoque',              icone: '📱', categoria: 'Estoque'       },
  { id: 'compras',             nome: 'Compras',              icone: '🛒', categoria: 'Estoque'       },
  { id: 'fornecedor',          nome: 'Fornecedor',           icone: '🏭', categoria: 'Comercial'     },
  { id: 'garantias',           nome: 'Garantias',            icone: '🛡️', categoria: 'Operacional'  },
  { id: 'pos-venda',           nome: 'Pós-venda',            icone: '💝', categoria: 'Comercial'     },
  { id: 'crm-comercial',       nome: 'CRM Comercial',        icone: '🎯', categoria: 'Comercial'     },
  { id: 'relatorios',          nome: 'Relatórios',           icone: '📊', categoria: 'Relatórios'    },
  { id: 'acaodasemana',        nome: 'Agenda',               icone: '📅', categoria: 'Operacional'   },
  { id: 'central-alertas',     nome: 'Central de Alertas',   icone: '🔔', categoria: 'Operacional'   },
  { id: 'central-comandos',    nome: 'Central de Comandos',  icone: '⚡', categoria: 'Ferramentas'   },
  { id: 'central-automacao',   nome: 'Central de Automação', icone: '🤖', categoria: 'Ferramentas'   },
  { id: 'portal-tecnico',      nome: 'Portal Técnico',       icone: '🔓', categoria: 'Ferramentas'   },
  { id: 'portal-cliente',      nome: 'Portal do Cliente',    icone: '🔷', categoria: 'Ferramentas'   },
  { id: 'pendencias',          nome: 'Pendências e Contas',  icone: '📋', categoria: 'Financeiro'    },
  { id: 'despesas',            nome: 'Despesas',             icone: '💸', categoria: 'Financeiro'    },
  { id: 'fechamento',          nome: 'Fechamento',           icone: '🔒', categoria: 'Financeiro'    },
  { id: 'backup',              nome: 'Backup do Sistema',    icone: '🛡️', categoria: 'Administração' },
  { id: 'auditoria',           nome: 'Auditoria',            icone: '🔍', categoria: 'Administração' },
  { id: 'lixeira',             nome: 'Lixeira',              icone: '🗑️', categoria: 'Administração' },
  { id: 'config',              nome: 'Configurações',        icone: '⚙️', categoria: 'Administração' },
];

// ── Estado ────────────────────────────────────────────────────
let _empresas      = [];    // cache de empresas
let _usuarios      = [];    // cache de usuários
let _empresaAtual  = null;  // empresa sendo editada
let _novaEmpresa   = false; // true = criação, false = edição

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

async function init() {
  await authReady;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      mostrarAcessoNegado('Faça login para continuar.');
      return;
    }

    // Aguarda tenant context (pode ainda não estar no sessionStorage)
    let tentativas = 0;
    while (!getTenant() && tentativas < 10) {
      await delay(300);
      tentativas++;
    }

    if (!isMasterAdmin()) {
      mostrarAcessoNegado();
      return;
    }

    document.getElementById('saas-main').style.display = '';
    setupTabs();
    await carregarEmpresas();
    renderizarPlanos();
    await carregarUsuarios();
    await carregarAuditoria();
    setupEventos();
  });
}

function mostrarAcessoNegado(msg) {
  const el = document.getElementById('acesso-negado');
  if (msg) el.querySelector('p').textContent = msg;
  el.style.display = '';
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════

function setupTabs() {
  document.querySelectorAll('.saas-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.saas-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const tabId = 'tab-' + btn.dataset.tab;
      document.getElementById(tabId)?.classList.add('active');
    });
  });

  document.querySelectorAll('.detail-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('[id^="modal"]');
      parent?.querySelectorAll('.detail-tab').forEach(b => b.classList.remove('active'));
      parent?.querySelectorAll('.detail-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const secId = 'dtab-' + btn.dataset.dtab;
      document.getElementById(secId)?.classList.add('active');
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// EMPRESAS — CRUD
// ═══════════════════════════════════════════════════════════════

async function carregarEmpresas() {
  const lista = document.getElementById('lista-empresas');
  lista.innerHTML = '<div class="saas-loading">Carregando...</div>';

  try {
    const snap = await getDocs(query(collection(db, 'empresas'), orderBy('nome_fantasia')));
    _empresas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarListaEmpresas();
  } catch (err) {
    lista.innerHTML = `<div class="saas-empty">Erro ao carregar: ${err.message}</div>`;
  }
}

function renderizarListaEmpresas(filtro = '') {
  const lista  = document.getElementById('lista-empresas');
  const termo  = filtro.toLowerCase();
  const itens  = _empresas.filter(e =>
    !filtro ||
    (e.nome_fantasia || '').toLowerCase().includes(termo) ||
    (e.razao_social  || '').toLowerCase().includes(termo) ||
    (e.cnpj          || '').includes(filtro)
  );

  if (!itens.length) {
    lista.innerHTML = '<div class="saas-empty">Nenhuma empresa encontrada.</div>';
    return;
  }

  lista.innerHTML = itens.map(e => `
    <div class="empresa-card ${_empresaAtual?.id === e.id ? 'selected' : ''}"
         data-id="${e.id}" onclick="selecionarEmpresa('${e.id}')">
      <div class="empresa-card-nome">${_esc(e.nome_fantasia || e.razao_social || 'Sem nome')}</div>
      <div class="empresa-card-meta">
        <span class="badge badge-${e.status || 'ativo'}">${e.status || 'ativo'}</span>
        <span>${e.plano || 'básico'}</span>
        ${_diasParaVencer(e.data_vencimento)}
      </div>
    </div>
  `).join('');

  // Atualiza stats
  _atualizarStats();
}

function _diasParaVencer(dataVenc) {
  if (!dataVenc) return '';
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const venc = dataVenc.toDate ? dataVenc.toDate() : new Date(dataVenc);
  const dias = Math.ceil((venc - hoje) / 86400000);
  if (dias < 0)  return `<span style="color:var(--red);font-size:10px">Vencida ${Math.abs(dias)}d</span>`;
  if (dias <= 7) return `<span style="color:var(--yellow);font-size:10px">Vence em ${dias}d</span>`;
  return '';
}

function _atualizarStats() {
  const total    = _empresas.length;
  const ativas   = _empresas.filter(e => e.status === 'ativo').length;
  const suspensas = _empresas.filter(e => e.status === 'suspenso').length;
  const bloqueadas = _empresas.filter(e => e.status === 'bloqueado').length;
  // Stats exibidas no header de planos
  _renderStats({ total, ativas, suspensas, bloqueadas });
}

window.selecionarEmpresa = function(id) {
  _empresaAtual = _empresas.find(e => e.id === id) || null;
  renderizarListaEmpresas(document.getElementById('busca-empresa').value);
  abrirModalEmpresa(false);
};

function abrirModalEmpresa(nova) {
  _novaEmpresa = nova;
  const modal = document.getElementById('modal-empresa');
  const titulo = document.getElementById('modal-titulo');
  const btnExcluir = document.getElementById('btn-excluir-empresa');

  if (nova) {
    _empresaAtual = null;
    titulo.textContent = 'Nova Empresa';
    limparFormEmpresa();
    btnExcluir.style.display = 'none';
  } else {
    titulo.textContent = _empresaAtual?.nome_fantasia || 'Editar Empresa';
    preencherFormEmpresa(_empresaAtual);
    btnExcluir.style.display = '';
  }

  // Ativa aba Geral
  document.querySelectorAll('#modal-tabs .detail-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.detail-section').forEach(s => s.classList.remove('active'));
  document.querySelector('#modal-tabs [data-dtab="geral"]').classList.add('active');
  document.getElementById('dtab-geral').classList.add('active');

  renderizarCheckboxesModulos(_empresaAtual?.modulos_ativos || null);
  carregarUsuariosDaEmpresa(_empresaAtual?.id || null);
  atualizarCamposLicenca(_empresaAtual);

  modal.style.display = '';
}

function limparFormEmpresa() {
  ['razao-social','nome-fantasia','cnpj','responsavel','telefone','whatsapp',
   'email','observacoes','valor-mensal','data-vencimento'].forEach(id => {
    const el = document.getElementById(`f-${id}`);
    if (el) el.value = '';
  });
  document.getElementById('f-status').value = 'ativo';
  document.getElementById('f-plano').value  = 'basico';
  document.getElementById('f-data-cadastro').value = new Date().toISOString().split('T')[0];
  document.getElementById('f-dias-atraso').value = '—';
}

function preencherFormEmpresa(e) {
  if (!e) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('f-razao-social',    e.razao_social);
  set('f-nome-fantasia',   e.nome_fantasia);
  set('f-cnpj',            e.cnpj);
  set('f-responsavel',     e.responsavel);
  set('f-telefone',        e.telefone);
  set('f-whatsapp',        e.whatsapp);
  set('f-email',           e.email);
  set('f-observacoes',     e.observacoes);
  set('f-status',          e.status || 'ativo');
  set('f-plano',           e.plano  || 'basico');
  set('f-valor-mensal',    e.valor_mensal || '');

  // Data de cadastro
  const dc = e.data_cadastro?.toDate ? e.data_cadastro.toDate() : (e.data_cadastro ? new Date(e.data_cadastro) : new Date());
  document.getElementById('f-data-cadastro').value = dc.toISOString().split('T')[0];
}

function atualizarCamposLicenca(e) {
  if (!e) {
    document.getElementById('f-data-vencimento').value = '';
    document.getElementById('f-dias-atraso').value = '—';
    return;
  }
  if (e.data_vencimento) {
    const dv = e.data_vencimento.toDate ? e.data_vencimento.toDate() : new Date(e.data_vencimento);
    document.getElementById('f-data-vencimento').value = dv.toISOString().split('T')[0];
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const dias = Math.ceil((dv - hoje) / 86400000);
    document.getElementById('f-dias-atraso').value =
      dias < 0 ? `${Math.abs(dias)} dias em atraso` : (dias === 0 ? 'Vence hoje' : `${dias} dias restantes`);
  } else {
    document.getElementById('f-data-vencimento').value = '';
    document.getElementById('f-dias-atraso').value = '—';
  }
}

function renderizarCheckboxesModulos(modulosAtivos) {
  const container = document.getElementById('modulos-checkboxes');
  const categorias = [...new Set(MODULOS_CATALOGO.map(m => m.categoria))];

  container.innerHTML = categorias.map(cat => {
    const mods = MODULOS_CATALOGO.filter(m => m.categoria === cat);
    return `
      <div style="grid-column:1/-1;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-top:12px;margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid var(--border)">${cat}</div>
      ${mods.map(m => {
        const checked = !modulosAtivos || modulosAtivos.includes(m.id);
        return `
          <label class="modulo-check ${checked ? 'checked' : ''}" onclick="this.classList.toggle('checked',this.querySelector('input').checked)">
            <input type="checkbox" value="${m.id}" ${checked ? 'checked' : ''}
              onchange="this.closest('.modulo-check').classList.toggle('checked',this.checked)">
            <span>${m.icone}</span>
            <span>${m.nome}</span>
          </label>`;
      }).join('')}
    `;
  }).join('');
}

window._saasAplicarPlano = function(planoId) {
  const plano = PLANOS[planoId];
  const mods  = plano?.modulos;
  document.querySelectorAll('#modulos-checkboxes input[type=checkbox]').forEach(cb => {
    const ativo = !mods || mods.includes(cb.value);
    cb.checked = ativo;
    cb.closest('.modulo-check').classList.toggle('checked', ativo);
  });
};

function _lerModulosMarcados() {
  const checks = document.querySelectorAll('#modulos-checkboxes input[type=checkbox]');
  const plano  = document.getElementById('f-plano').value;
  if (plano === 'enterprise') return null;
  return [...checks].filter(c => c.checked).map(c => c.value);
}

async function salvarEmpresa() {
  const btn = document.getElementById('btn-salvar-empresa');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  const razao    = document.getElementById('f-razao-social').value.trim();
  const fantasia = document.getElementById('f-nome-fantasia').value.trim();
  if (!razao || !fantasia) {
    alert('Preencha Razão Social e Nome Fantasia.');
    btn.disabled = false; btn.textContent = '💾 Salvar Empresa';
    return;
  }

  const dataVenc = document.getElementById('f-data-vencimento').value;
  const modulos  = _lerModulosMarcados();
  const plano    = document.getElementById('f-plano').value;

  const dados = {
    razao_social:   razao,
    nome_fantasia:  fantasia,
    cnpj:           document.getElementById('f-cnpj').value.trim(),
    responsavel:    document.getElementById('f-responsavel').value.trim(),
    telefone:       document.getElementById('f-telefone').value.trim(),
    whatsapp:       document.getElementById('f-whatsapp').value.trim(),
    email:          document.getElementById('f-email').value.trim(),
    status:         document.getElementById('f-status').value,
    plano,
    modulos_ativos: modulos,
    valor_mensal:   parseFloat(document.getElementById('f-valor-mensal').value || '0') || 0,
    data_vencimento: dataVenc ? new Date(dataVenc + 'T12:00:00') : null,
    observacoes:    document.getElementById('f-observacoes').value.trim(),
    atualizado_em:  serverTimestamp()
  };

  try {
    if (_novaEmpresa) {
      dados.data_cadastro = serverTimestamp();
      const ref = await addDoc(collection(db, 'empresas'), dados);
      _empresaAtual = { id: ref.id, ...dados };
      await logAuditoria('empresa_criada', { empresa_id: ref.id, nome: fantasia });
    } else {
      await updateDoc(doc(db, 'empresas', _empresaAtual.id), dados);
      _empresaAtual = { ..._empresaAtual, ...dados };
      await logAuditoria('empresa_atualizada', { empresa_id: _empresaAtual.id, nome: fantasia });
    }

    await carregarEmpresas();
    fecharModal();
    _mostrarToast('Empresa salva com sucesso!');
  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = '💾 Salvar Empresa';
  }
}

async function excluirEmpresa() {
  if (!_empresaAtual) return;
  const nome = _empresaAtual.nome_fantasia || _empresaAtual.razao_social || 'esta empresa';
  if (!confirm(`Excluir ${nome}?\n\nOS dados desta empresa serão preservados no Firestore, mas ela não terá mais acesso ao sistema.`)) return;

  try {
    await deleteDoc(doc(db, 'empresas', _empresaAtual.id));
    await logAuditoria('empresa_excluida', { empresa_id: _empresaAtual.id, nome });
    _empresaAtual = null;
    await carregarEmpresas();
    fecharModal();
    _mostrarToast('Empresa removida.', 'warn');
  } catch (err) {
    alert('Erro ao excluir: ' + err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// USUÁRIOS — CRUD
// ═══════════════════════════════════════════════════════════════

async function carregarUsuarios() {
  const tbody = document.getElementById('tbody-usuarios');
  tbody.innerHTML = '<tr><td colspan="7" class="saas-loading">Carregando...</td></tr>';

  try {
    const snap = await getDocs(query(collection(db, 'usuarios'), orderBy('nome')));
    _usuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarTabelaUsuarios();
    preencherSelectEmpresas();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="saas-empty">Erro: ${err.message}</td></tr>`;
  }
}

function renderizarTabelaUsuarios(filtroEmpresa = '', filtroNome = '') {
  const tbody = document.getElementById('tbody-usuarios');
  const lista = _usuarios.filter(u => {
    if (filtroEmpresa && u.empresa_id !== filtroEmpresa) return false;
    if (filtroNome) {
      const t = filtroNome.toLowerCase();
      if (!(u.nome || '').toLowerCase().includes(t) && !(u.email || '').toLowerCase().includes(t)) return false;
    }
    return true;
  });

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="saas-empty">Nenhum usuário encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(u => {
    const emp = _empresas.find(e => e.id === u.empresa_id);
    const ult = u.ultimo_acesso?.toDate ? u.ultimo_acesso.toDate().toLocaleDateString('pt-BR') : '—';
    const perfilInfo = PERFIS[u.perfil] || { nome: u.perfil || '—' };
    return `
      <tr>
        <td style="font-weight:600;color:var(--text)">${_esc(u.nome || '—')}</td>
        <td>${_esc(u.email || '—')}</td>
        <td>${_esc(emp?.nome_fantasia || u.empresa_id || '—')}</td>
        <td><span class="badge badge-ativo">${perfilInfo.nome}</span></td>
        <td><span class="badge badge-${u.ativo !== false ? 'ativo' : 'cancelado'}">${u.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
        <td>${ult}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="editarUsuario('${u.id}')">Editar</button>
        </td>
      </tr>`;
  }).join('');
}

async function carregarUsuariosDaEmpresa(empresaId) {
  const lista = document.getElementById('lista-usuarios-emp');
  if (!empresaId) {
    lista.innerHTML = '<div class="saas-empty">Salve a empresa primeiro para adicionar usuários.</div>';
    return;
  }

  lista.innerHTML = '<div class="saas-loading">Carregando...</div>';

  try {
    const snap = await getDocs(query(collection(db, 'usuarios'), where('empresa_id', '==', empresaId)));
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!users.length) {
      lista.innerHTML = `
        <div class="saas-empty">Nenhum usuário cadastrado nesta empresa.</div>
        <div style="text-align:center;margin-top:8px">
          <button class="btn btn-outline btn-sm" onclick="abrirModalNovoUsuario('${empresaId}')">+ Adicionar usuário</button>
        </div>`;
      return;
    }

    lista.innerHTML = `
      <table class="saas-table">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td style="font-weight:600;color:var(--text)">${_esc(u.nome || '—')}</td>
              <td>${_esc(u.email || '—')}</td>
              <td>${PERFIS[u.perfil]?.nome || u.perfil || '—'}</td>
              <td><span class="badge badge-${u.ativo !== false ? 'ativo' : 'cancelado'}">${u.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
              <td><button class="btn btn-outline btn-sm" onclick="editarUsuario('${u.id}')">Editar</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div style="margin-top:12px">
        <button class="btn btn-outline btn-sm" onclick="abrirModalNovoUsuario('${empresaId}')">+ Adicionar usuário</button>
      </div>`;
  } catch (err) {
    lista.innerHTML = `<div class="saas-empty">Erro: ${err.message}</div>`;
  }
}

function preencherSelectEmpresas() {
  const selects = ['filtro-empresa-user', 'uf-empresa'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const primeiro = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(primeiro);
    _empresas.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.nome_fantasia || e.razao_social || e.id;
      sel.appendChild(opt);
    });
  });
}

window.abrirModalNovoUsuario = function(empresaId = '') {
  document.getElementById('uf-nome').value   = '';
  document.getElementById('uf-email').value  = '';
  document.getElementById('uf-perfil').value = 'admin';
  document.getElementById('uf-error').textContent = '';
  document.getElementById('modal-usuario-titulo').textContent = 'Novo Usuário';

  preencherSelectEmpresas();
  if (empresaId) document.getElementById('uf-empresa').value = empresaId;
  document.getElementById('modal-usuario').style.display = '';

  // UID da edição
  document.getElementById('btn-salvar-usuario').dataset.uid = '';
};

window.editarUsuario = function(uid) {
  const user = _usuarios.find(u => u.id === uid);
  if (!user) return;
  document.getElementById('modal-usuario-titulo').textContent = 'Editar Usuário';
  document.getElementById('uf-nome').value   = user.nome  || '';
  document.getElementById('uf-email').value  = user.email || '';
  document.getElementById('uf-perfil').value = user.perfil || 'admin';
  document.getElementById('uf-error').textContent = '';
  preencherSelectEmpresas();
  document.getElementById('uf-empresa').value = user.empresa_id || '';
  document.getElementById('btn-salvar-usuario').dataset.uid = uid;
  document.getElementById('modal-usuario').style.display = '';
};

async function salvarUsuario() {
  const btn      = document.getElementById('btn-salvar-usuario');
  const uid      = btn.dataset.uid;
  const nome     = document.getElementById('uf-nome').value.trim();
  const email    = document.getElementById('uf-email').value.trim();
  const empresaId = document.getElementById('uf-empresa').value;
  const perfil   = document.getElementById('uf-perfil').value;
  const errEl    = document.getElementById('uf-error');

  if (!nome)  { errEl.textContent = 'Informe o nome.'; return; }
  if (!email) { errEl.textContent = 'Informe o e-mail.'; return; }
  if (!empresaId) { errEl.textContent = 'Selecione a empresa.'; return; }

  btn.disabled = true; btn.textContent = 'Salvando...';
  errEl.textContent = '';

  try {
    const dados = { nome, email, empresa_id: empresaId, perfil, ativo: true, atualizado_em: serverTimestamp() };

    if (uid) {
      // Edição — usa o UID do Firebase Auth do documento existente
      await setDoc(doc(db, 'usuarios', uid), dados, { merge: true });
      await logAuditoria('usuario_atualizado', { uid, nome, empresa_id: empresaId });
    } else {
      // Novo — cria doc com e-mail como ID temporário (será substituído pelo UID do Auth no primeiro login)
      const fakeId = email.replace(/[^a-z0-9]/gi, '_') + '_' + Date.now();
      dados.data_cadastro = serverTimestamp();
      await setDoc(doc(db, 'usuarios', fakeId), dados);
      await logAuditoria('usuario_criado', { email, empresa_id: empresaId, perfil });
    }

    await carregarUsuarios();
    fecharModalUsuario();
    _mostrarToast('Usuário salvo!');
  } catch (err) {
    errEl.textContent = 'Erro: ' + err.message;
  } finally {
    btn.disabled = false; btn.textContent = '💾 Salvar';
  }
}

// ═══════════════════════════════════════════════════════════════
// PLANOS — Renderização
// ═══════════════════════════════════════════════════════════════

function renderizarPlanos() {
  const grid = document.getElementById('planos-grid');
  grid.innerHTML = Object.values(PLANOS).map(p => `
    <div class="plano-card ${p.id === 'enterprise' ? 'enterprise' : ''}">
      <div class="plano-card-nome">${p.nome}</div>
      <div class="plano-card-desc">${p.descricao}</div>
      <div class="plano-modulos">
        ${p.modulos ? p.modulos.map(id => {
          const m = MODULOS_CATALOGO.find(x => x.id === id);
          return m ? `<div class="plano-modulo-item">${m.icone} ${m.nome}</div>` : '';
        }).join('') : '<div class="plano-modulo-item">Todos os módulos disponíveis</div>'}
      </div>
    </div>
  `).join('');
}

function _renderStats(s) {
  const el = document.getElementById('saas-stats-container');
  if (!el) return;
  el.innerHTML = `
    <div class="stat-card"><div class="stat-value">${s.total}</div><div class="stat-label">Total</div></div>
    <div class="stat-card" style="border-color:rgba(0,200,83,0.3)"><div class="stat-value" style="color:var(--green)">${s.ativas}</div><div class="stat-label">Ativas</div></div>
    <div class="stat-card" style="border-color:rgba(245,158,11,0.3)"><div class="stat-value" style="color:var(--yellow)">${s.suspensas}</div><div class="stat-label">Suspensas</div></div>
    <div class="stat-card" style="border-color:rgba(239,68,68,0.3)"><div class="stat-value" style="color:var(--red)">${s.bloqueadas}</div><div class="stat-label">Bloqueadas</div></div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// AUDITORIA
// ═══════════════════════════════════════════════════════════════

async function carregarAuditoria() {
  const tbody = document.getElementById('tbody-auditoria');
  tbody.innerHTML = '<tr><td colspan="5" class="saas-loading">Carregando...</td></tr>';

  try {
    const snap = await getDocs(
      query(collection(db, 'auditoria_saas'), orderBy('timestamp', 'desc'), limit(100))
    );

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" class="saas-empty">Nenhum registro encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = snap.docs.map(d => {
      const r   = d.data();
      const ts  = r.timestamp?.toDate ? r.timestamp.toDate().toLocaleString('pt-BR') : '—';
      const emp = _empresas.find(e => e.id === r.empresa_id);
      const det = typeof r.detalhes === 'object' ? JSON.stringify(r.detalhes).slice(0, 60) : String(r.detalhes || '');
      return `
        <tr>
          <td style="white-space:nowrap;color:var(--text3)">${ts}</td>
          <td>${_esc(emp?.nome_fantasia || r.empresa_id || '—')}</td>
          <td>${_esc(r.usuario_nome || r.usuario_id || '—')}</td>
          <td><span class="badge badge-ativo">${_esc(r.acao || '—')}</span></td>
          <td style="color:var(--text3);font-size:12px">${_esc(det)}</td>
        </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="saas-empty">Erro: ${err.message}</td></tr>`;
  }
}

// ═══════════════════════════════════════════════════════════════
// EVENTOS
// ═══════════════════════════════════════════════════════════════

function setupEventos() {
  // Busca de empresa
  document.getElementById('busca-empresa').addEventListener('input', e => {
    renderizarListaEmpresas(e.target.value);
  });

  // Botão nova empresa
  document.getElementById('btn-nova-empresa').addEventListener('click', () => {
    abrirModalEmpresa(true);
  });

  // Salvar empresa
  document.getElementById('btn-salvar-empresa').addEventListener('click', salvarEmpresa);

  // Excluir empresa
  document.getElementById('btn-excluir-empresa').addEventListener('click', excluirEmpresa);

  // Plano → atualiza módulos sugeridos
  document.getElementById('f-plano').addEventListener('change', e => {
    window._saasAplicarPlano(e.target.value);
  });

  // Vencimento → atualiza dias
  document.getElementById('f-data-vencimento').addEventListener('change', e => {
    const emp = { ..._empresaAtual, data_vencimento: e.target.value ? new Date(e.target.value + 'T12:00:00') : null };
    atualizarCamposLicenca(emp);
  });

  // Busca de usuário
  document.getElementById('busca-usuario').addEventListener('input', e => {
    renderizarTabelaUsuarios(
      document.getElementById('filtro-empresa-user').value,
      e.target.value
    );
  });
  document.getElementById('filtro-empresa-user').addEventListener('change', e => {
    renderizarTabelaUsuarios(e.target.value, document.getElementById('busca-usuario').value);
  });

  // Botão novo usuário (aba geral)
  document.getElementById('btn-novo-usuario').addEventListener('click', () => {
    window.abrirModalNovoUsuario('');
  });

  // Botão add usuário na empresa
  document.getElementById('btn-add-usuario-emp').addEventListener('click', () => {
    window.abrirModalNovoUsuario(_empresaAtual?.id || '');
  });

  // Salvar usuário
  document.getElementById('btn-salvar-usuario').addEventListener('click', salvarUsuario);

  // Atualizar auditoria
  document.getElementById('btn-atualizar-audit').addEventListener('click', carregarAuditoria);

  // CNPJ: máscara simples
  document.getElementById('f-cnpj').addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 14);
    if (v.length > 12) v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    else if (v.length > 8) v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '$1.$2.$3/$4');
    else if (v.length > 5) v = v.replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2.$3');
    else if (v.length > 2) v = v.replace(/(\d{2})(\d{3})/, '$1.$2');
    e.target.value = v;
  });
}

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════

function _esc(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function _mostrarToast(msg, tipo = 'ok') {
  let toast = document.getElementById('saas-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'saas-toast';
    toast.style.cssText = `
      position:fixed;bottom:24px;right:24px;z-index:9999;
      padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;
      transition:opacity 0.3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.5);`;
    document.body.appendChild(toast);
  }
  toast.style.background = tipo === 'ok' ? 'var(--green)' : 'var(--yellow)';
  toast.style.color = tipo === 'ok' ? '#000' : '#000';
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// ── Inicia tudo ───────────────────────────────────────────────
init();
