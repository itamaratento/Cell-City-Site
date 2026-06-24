/* ================================================================
   CENTRAL SAAS — Lógica completa
   Cell City Gestão Empresarial

   Coleções Firestore:
     empresas/{id}           — dados do inquilino
     empresas_arquivadas/{id}— empresas em exclusão segura (90 dias)
     usuarios/{uid}          — usuário vinculado a uma empresa
     assinaturas/{id}        — histórico financeiro por empresa
     notificacoes_saas/{id}  — alertas para o master
     auditoria_saas/{id}     — logs de ações administrativas
   ================================================================ */

import {
  db, auth, authReady,
  collection, addDoc, getDocs, getDoc, doc,
  setDoc, updateDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, limit, Timestamp
} from '../../scripts/firebase.js';
import {
  isMasterAdmin, getTenant, PLANOS, PERFIS,
  FEATURES_DISPONIVEIS, logAuditoria, ativarModoSuporte
} from '../../shared/tenant.js';
import { loadContext } from '../../shared/tenant.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// ── Catálogo de módulos ───────────────────────────────────────
const MODULOS_CATALOGO = [
  { id: 'os',                  nome: 'Ordem de Serviço',     icone: '📦', categoria: 'Operacional'    },
  { id: 'caixa',               nome: 'Caixa',                icone: '💰', categoria: 'Financeiro'     },
  { id: 'financeiro',          nome: 'Financeiro',           icone: '💹', categoria: 'Financeiro'     },
  { id: 'clientes',            nome: 'Clientes',             icone: '👥', categoria: 'Operacional'    },
  { id: 'estoque',             nome: 'Estoque',              icone: '📱', categoria: 'Estoque'        },
  { id: 'compras',             nome: 'Compras',              icone: '🛒', categoria: 'Estoque'        },
  { id: 'fornecedor',          nome: 'Fornecedor',           icone: '🏭', categoria: 'Comercial'      },
  { id: 'garantias',           nome: 'Garantias',            icone: '🛡️', categoria: 'Operacional'   },
  { id: 'pos-venda',           nome: 'Pós-venda',            icone: '💝', categoria: 'Comercial'      },
  { id: 'crm-comercial',       nome: 'CRM Comercial',        icone: '🎯', categoria: 'Comercial'      },
  { id: 'relatorios',          nome: 'Relatórios',           icone: '📊', categoria: 'Relatórios'     },
  { id: 'acaodasemana',        nome: 'Agenda',               icone: '📅', categoria: 'Operacional'    },
  { id: 'central-alertas',     nome: 'Central de Alertas',   icone: '🔔', categoria: 'Operacional'    },
  { id: 'central-comandos',    nome: 'Central de Comandos',  icone: '⚡', categoria: 'Ferramentas'    },
  { id: 'central-automacao',   nome: 'Central de Automação', icone: '🤖', categoria: 'Ferramentas'    },
  { id: 'portal-tecnico',      nome: 'Portal Técnico',       icone: '🔓', categoria: 'Ferramentas'    },
  { id: 'portal-cliente',      nome: 'Portal do Cliente',    icone: '🔷', categoria: 'Ferramentas'    },
  { id: 'pendencias',          nome: 'Pendências e Contas',  icone: '📋', categoria: 'Financeiro'     },
  { id: 'despesas',            nome: 'Despesas',             icone: '💸', categoria: 'Financeiro'     },
  { id: 'fechamento',          nome: 'Fechamento',           icone: '🔒', categoria: 'Financeiro'     },
  { id: 'backup',              nome: 'Backup do Sistema',    icone: '🛡️', categoria: 'Administração'  },
  { id: 'auditoria',           nome: 'Auditoria',            icone: '🔍', categoria: 'Administração'  },
  { id: 'lixeira',             nome: 'Lixeira',              icone: '🗑️', categoria: 'Administração'  },
  { id: 'config',              nome: 'Configurações',        icone: '⚙️', categoria: 'Administração'  },
];

// ── Templates de empresa por segmento ────────────────────────
const MODELOS = {
  assistencia: {
    nome: '🔧 Assistência Técnica',
    descricao: 'Celulares, eletrônicos e reparos em geral',
    plano: 'profissional',
    modulos: ['os','caixa','financeiro','clientes','estoque','garantias','pos-venda','central-alertas','config']
  },
  informatica: {
    nome: '💻 Informática',
    descricao: 'PCs, notebooks, formatação e manutenção',
    plano: 'profissional',
    modulos: ['os','caixa','financeiro','clientes','estoque','backup','central-alertas','config']
  },
  eletronica: {
    nome: '⚡ Eletrônica',
    descricao: 'Placas, fontes e equipamentos eletrônicos',
    plano: 'basico',
    modulos: ['os','caixa','financeiro','clientes','garantias','central-alertas','config']
  },
  loja: {
    nome: '🛍️ Loja / Comércio',
    descricao: 'Vendas, estoque e controle financeiro',
    plano: 'profissional',
    modulos: ['caixa','financeiro','clientes','estoque','compras','fornecedor','relatorios','crm-comercial','config']
  },
  servicos: {
    nome: '🏢 Prestadora de Serviços',
    descricao: 'Contratos, agenda e faturamento',
    plano: 'profissional',
    modulos: ['os','caixa','financeiro','clientes','acaodasemana','relatorios','crm-comercial','pendencias','config']
  }
};

// ── Permissões padrão por perfil ──────────────────────────────
const PERMISSOES_PADRAO_PERFIL = {
  admin:     {},  // admin tem tudo — override vazio
  gerente:   { relatorios: 'consulta', fechamento: 'consulta' },
  tecnico:   { caixa: 'bloqueado', financeiro: 'bloqueado', relatorios: 'bloqueado', compras: 'consulta' },
  caixa:     { relatorios: 'bloqueado', crm_comercial: 'bloqueado', central_automacao: 'bloqueado' },
  atendente: { caixa: 'bloqueado', financeiro: 'bloqueado', relatorios: 'bloqueado', estoque: 'consulta' }
};

// ── Estado ────────────────────────────────────────────────────
let _empresas     = [];
let _usuarios     = [];
let _empresaAtual = null;
let _novaEmpresa  = false;

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

async function init() {
  await authReady;

  onAuthStateChanged(auth, async (user) => {
    if (!user) { mostrarAcessoNegado('Faça login para continuar.'); return; }

    let tentativas = 0;
    while (!getTenant() && tentativas < 10) {
      await _delay(300);
      tentativas++;
    }

    if (!isMasterAdmin()) { mostrarAcessoNegado(); return; }

    document.getElementById('saas-main').style.display = '';
    setupTabs();
    await Promise.all([
      carregarEmpresas(),
      carregarUsuarios(),
    ]);
    renderizarDashboard();
    renderizarPlanos();
    await Promise.all([
      carregarAuditoria(),
      carregarNotificacoes(),
    ]);
    setupEventos();
  });
}

function mostrarAcessoNegado(msg) {
  const el = document.getElementById('acesso-negado');
  if (msg) el.querySelector('p').textContent = msg;
  el.style.display = '';
}

function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════

function setupTabs() {
  document.querySelectorAll('.saas-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.saas-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
    });
  });

  document.querySelectorAll('.detail-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('[id^="modal"]');
      parent?.querySelectorAll('.detail-tab').forEach(b => b.classList.remove('active'));
      parent?.querySelectorAll('.detail-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('dtab-' + btn.dataset.dtab)?.classList.add('active');
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD MASTER
// ═══════════════════════════════════════════════════════════════

async function renderizarDashboard() {
  const container = document.getElementById('dashboard-stats');
  if (!container) return;

  const ativas    = _empresas.filter(e => e.status === 'ativo').length;
  const trial     = _empresas.filter(e => e.plano  === 'trial').length;
  const suspensas = _empresas.filter(e => e.status === 'suspenso').length;
  const canceladas= _empresas.filter(e => e.status === 'cancelado').length;
  const total     = _empresas.length;
  const totalUsers= _usuarios.length;

  // MRR: soma dos valores mensais das empresas ativas
  const mrr = _empresas
    .filter(e => e.status === 'ativo' && e.plano !== 'trial')
    .reduce((acc, e) => acc + (parseFloat(e.valor_mensal) || 0), 0);

  // Próximos vencimentos (7 dias)
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const em7  = new Date(hoje); em7.setDate(em7.getDate() + 7);
  const vencimentos = _empresas
    .filter(e => {
      if (!e.data_vencimento) return false;
      const dv = e.data_vencimento.toDate ? e.data_vencimento.toDate() : new Date(e.data_vencimento);
      return dv >= hoje && dv <= em7;
    })
    .sort((a, b) => {
      const da = a.data_vencimento?.toDate ? a.data_vencimento.toDate() : new Date(a.data_vencimento);
      const db2= b.data_vencimento?.toDate ? b.data_vencimento.toDate() : new Date(b.data_vencimento);
      return da - db2;
    });

  container.innerHTML = `
    <div class="saas-stats">
      <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total Empresas</div></div>
      <div class="stat-card" style="border-color:rgba(0,200,83,0.3)">
        <div class="stat-value" style="color:var(--green)">${ativas}</div>
        <div class="stat-label">Ativas</div>
      </div>
      <div class="stat-card" style="border-color:rgba(59,130,246,0.3)">
        <div class="stat-value" style="color:var(--blue)">${trial}</div>
        <div class="stat-label">Em Trial</div>
      </div>
      <div class="stat-card" style="border-color:rgba(245,158,11,0.3)">
        <div class="stat-value" style="color:var(--yellow)">${suspensas}</div>
        <div class="stat-label">Suspensas</div>
      </div>
      <div class="stat-card" style="border-color:rgba(239,68,68,0.3)">
        <div class="stat-value" style="color:var(--red)">${canceladas}</div>
        <div class="stat-label">Canceladas</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalUsers}</div>
        <div class="stat-label">Usuários</div>
      </div>
      <div class="stat-card" style="border-color:rgba(0,200,83,0.3)">
        <div class="stat-value" style="color:var(--green);font-size:22px">
          ${mrr.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
        </div>
        <div class="stat-label">MRR</div>
      </div>
    </div>

    ${vencimentos.length ? `
      <div style="background:var(--surface2);border:1px solid rgba(245,158,11,0.3);border-radius:var(--radius-lg);padding:16px;margin-top:4px">
        <div style="font-size:12px;font-weight:700;color:var(--yellow);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">
          ⚠️ Vencimentos nos próximos 7 dias
        </div>
        ${vencimentos.map(e => {
          const dv = e.data_vencimento?.toDate ? e.data_vencimento.toDate() : new Date(e.data_vencimento);
          return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:13px;font-weight:600;color:var(--text);flex:1">${_esc(e.nome_fantasia || e.razao_social)}</span>
            <span style="font-size:12px;color:var(--yellow)">${dv.toLocaleDateString('pt-BR')}</span>
            <button class="btn btn-outline btn-sm" onclick="selecionarEmpresa('${e.id}')">Ver</button>
          </div>`;
        }).join('')}
      </div>
    ` : ''}
  `;
}

// ═══════════════════════════════════════════════════════════════
// EMPRESAS — CRUD
// ═══════════════════════════════════════════════════════════════

const EMPRESA_MASTER_ID = 'cellcity-master';

async function carregarEmpresas() {
  const lista = document.getElementById('lista-empresas');
  if (lista) lista.innerHTML = '<div class="saas-loading">Carregando...</div>';

  try {
    const snap = await getDocs(query(collection(db, 'empresas'), orderBy('nome_fantasia')));
    _empresas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarListaEmpresas();
    renderizarDashboard();
  } catch (err) {
    if (lista) lista.innerHTML = `<div class="saas-empty">Erro: ${err.message}</div>`;
  }
}

function renderizarListaEmpresas(filtro = '') {
  const lista = document.getElementById('lista-empresas');
  if (!lista) return;
  const termo = filtro.toLowerCase();
  const itens = _empresas.filter(e =>
    !filtro ||
    (e.nome_fantasia || '').toLowerCase().includes(termo) ||
    (e.razao_social  || '').toLowerCase().includes(termo) ||
    (e.cnpj          || '').includes(filtro)
  );

  if (!itens.length) { lista.innerHTML = '<div class="saas-empty">Nenhuma empresa.</div>'; return; }

  lista.innerHTML = itens.map(e => `
    <div class="empresa-card ${_empresaAtual?.id === e.id ? 'selected' : ''}"
         data-id="${e.id}" onclick="selecionarEmpresa('${e.id}')">
      <div class="empresa-card-nome">
        ${e.is_master ? '⭐ ' : ''}${_esc(e.nome_fantasia || e.razao_social || 'Sem nome')}
      </div>
      <div class="empresa-card-meta">
        <span class="badge badge-${e.status || 'ativo'}">${e.status || 'ativo'}</span>
        <span>${e.plano || 'básico'}</span>
        ${_diasParaVencer(e.data_vencimento)}
      </div>
    </div>
  `).join('');
}

function _diasParaVencer(dv) {
  if (!dv) return '';
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const venc = dv.toDate ? dv.toDate() : new Date(dv);
  const dias = Math.ceil((venc - hoje) / 86400000);
  if (dias < 0)  return `<span style="color:var(--red);font-size:10px">Vencida ${Math.abs(dias)}d</span>`;
  if (dias <= 7) return `<span style="color:var(--yellow);font-size:10px">Vence em ${dias}d</span>`;
  return '';
}

window.selecionarEmpresa = function(id) {
  _empresaAtual = _empresas.find(e => e.id === id) || null;
  renderizarListaEmpresas(document.getElementById('busca-empresa')?.value || '');
  abrirModalEmpresa(false);
};

function abrirModalEmpresa(nova) {
  _novaEmpresa = nova;
  const modal     = document.getElementById('modal-empresa');
  const titulo    = document.getElementById('modal-titulo');
  const btnExcluir= document.getElementById('btn-excluir-empresa');
  const btnSuporte= document.getElementById('btn-modo-suporte');

  if (nova) {
    _empresaAtual = null;
    titulo.textContent = 'Nova Empresa';
    limparFormEmpresa();
    if (btnExcluir) btnExcluir.style.display = 'none';
    if (btnSuporte) btnSuporte.style.display = 'none';
    _renderModeloSelector();
  } else {
    const isMaster = _empresaAtual?.is_master;
    titulo.textContent = (isMaster ? '⭐ ' : '') + (_empresaAtual?.nome_fantasia || 'Editar Empresa');
    preencherFormEmpresa(_empresaAtual);
    if (btnExcluir) btnExcluir.style.display = isMaster ? 'none' : '';
    if (btnSuporte) btnSuporte.style.display = isMaster ? 'none' : '';
    _renderModeloSelector(false);
  }

  // Ativa aba Geral
  document.querySelectorAll('#modal-tabs .detail-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.detail-section').forEach(s => s.classList.remove('active'));
  document.querySelector('#modal-tabs [data-dtab="geral"]')?.classList.add('active');
  document.getElementById('dtab-geral')?.classList.add('active');

  renderizarCheckboxesModulos(_empresaAtual?.modulos_ativos || null);
  renderizarFeatureFlags(_empresaAtual?.feature_flags || {});
  carregarUsuariosDaEmpresa(_empresaAtual?.id || null);
  atualizarCamposLicenca(_empresaAtual);
  renderizarWhiteLabel(_empresaAtual?.white_label || {});

  modal.style.display = '';
}

function _renderModeloSelector(mostrar = true) {
  const el = document.getElementById('modelo-selector');
  if (!el) return;
  el.style.display = mostrar ? '' : 'none';
}

function limparFormEmpresa() {
  ['razao-social','nome-fantasia','cnpj','responsavel','telefone','whatsapp',
   'email','observacoes','valor-mensal','data-vencimento',
   'wl-nome','wl-cor-primaria','wl-cor-secundaria'].forEach(id => {
    const el = document.getElementById(`f-${id}`);
    if (el) el.value = '';
  });
  _set('f-status', 'ativo');
  _set('f-plano',  'trial');
  _set('f-trial-dias', '30');
  _set('f-modelo', '');
  _set('f-data-cadastro', new Date().toISOString().split('T')[0]);
  _set('f-dias-atraso', '—');
}

function preencherFormEmpresa(e) {
  if (!e) return;
  _set('f-razao-social',  e.razao_social);
  _set('f-nome-fantasia', e.nome_fantasia);
  _set('f-cnpj',          e.cnpj);
  _set('f-responsavel',   e.responsavel);
  _set('f-telefone',      e.telefone);
  _set('f-whatsapp',      e.whatsapp);
  _set('f-email',         e.email);
  _set('f-observacoes',   e.observacoes);
  _set('f-status',        e.status  || 'ativo');
  _set('f-plano',         e.plano   || 'basico');
  _set('f-valor-mensal',  e.valor_mensal || '');

  const dc = e.data_cadastro?.toDate ? e.data_cadastro.toDate() : new Date();
  _set('f-data-cadastro', dc.toISOString().split('T')[0]);

  // White label
  if (e.white_label) {
    _set('f-wl-nome',         e.white_label.nome          || '');
    _set('f-wl-cor-primaria', e.white_label.cor_primaria  || '#00c853');
    _set('f-wl-cor-secundaria',e.white_label.cor_secundaria|| '');
  }
}

function atualizarCamposLicenca(e) {
  if (!e?.data_vencimento) {
    _set('f-data-vencimento', '');
    _set('f-dias-atraso', '—');
    return;
  }
  const dv = e.data_vencimento.toDate ? e.data_vencimento.toDate() : new Date(e.data_vencimento);
  _set('f-data-vencimento', dv.toISOString().split('T')[0]);
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const dias = Math.ceil((dv - hoje) / 86400000);
  _set('f-dias-atraso',
    dias < 0 ? `${Math.abs(dias)} dias em atraso` :
    dias === 0 ? 'Vence hoje' : `${dias} dias restantes`
  );
}

function renderizarCheckboxesModulos(ativos) {
  const container = document.getElementById('modulos-checkboxes');
  if (!container) return;
  const cats = [...new Set(MODULOS_CATALOGO.map(m => m.categoria))];
  container.innerHTML = cats.map(cat => {
    const mods = MODULOS_CATALOGO.filter(m => m.categoria === cat);
    return `
      <div style="grid-column:1/-1;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;
        letter-spacing:0.5px;margin-top:12px;margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid var(--border)">
        ${cat}
      </div>
      ${mods.map(m => {
        const checked = !ativos || ativos.includes(m.id);
        return `
          <label class="modulo-check ${checked ? 'checked' : ''}">
            <input type="checkbox" value="${m.id}" ${checked ? 'checked' : ''}
              onchange="this.closest('.modulo-check').classList.toggle('checked',this.checked)">
            <span>${m.icone}</span><span>${m.nome}</span>
          </label>`;
      }).join('')}`;
  }).join('');
}

function renderizarFeatureFlags(ativos) {
  const container = document.getElementById('feature-flags-checkboxes');
  if (!container) return;
  container.innerHTML = FEATURES_DISPONIVEIS.map(f => {
    const on = ativos[f.id] === true;
    return `
      <label class="modulo-check ${on ? 'checked' : ''}">
        <input type="checkbox" value="${f.id}" ${on ? 'checked' : ''}
          onchange="this.closest('.modulo-check').classList.toggle('checked',this.checked)">
        <span>${f.icone}</span><span>${f.nome}</span>
      </label>`;
  }).join('');
}

function renderizarWhiteLabel(wl) {
  _set('f-wl-nome',          wl.nome           || '');
  _set('f-wl-cor-primaria',  wl.cor_primaria   || '#00c853');
  _set('f-wl-cor-secundaria',wl.cor_secundaria || '');
}

window._saasAplicarPlano = function(planoId) {
  const plano = PLANOS[planoId];
  const mods  = plano?.modulos;
  document.querySelectorAll('#modulos-checkboxes input[type=checkbox]').forEach(cb => {
    const ativo = !mods || mods.includes(cb.value);
    cb.checked = ativo;
    cb.closest('.modulo-check').classList.toggle('checked', ativo);
  });
  // Trial: mostra selector de dias
  const trialRow = document.getElementById('trial-dias-row');
  if (trialRow) trialRow.style.display = planoId === 'trial' ? '' : 'none';
};

window._saasAplicarModelo = function(modeloId) {
  if (!modeloId) return;
  const m = MODELOS[modeloId];
  if (!m) return;
  _set('f-plano', m.plano);
  document.querySelectorAll('#modulos-checkboxes input[type=checkbox]').forEach(cb => {
    const ativo = m.modulos.includes(cb.value);
    cb.checked = ativo;
    cb.closest('.modulo-check').classList.toggle('checked', ativo);
  });
  window._saasAplicarPlano(m.plano);
  _mostrarToast(`Modelo "${m.nome}" aplicado!`);
};

function _lerModulosMarcados() {
  const plano = document.getElementById('f-plano')?.value;
  if (plano === 'enterprise') return null;
  return [...document.querySelectorAll('#modulos-checkboxes input[type=checkbox]')]
    .filter(c => c.checked).map(c => c.value);
}

function _lerFeatureFlags() {
  const flags = {};
  document.querySelectorAll('#feature-flags-checkboxes input[type=checkbox]')
    .forEach(cb => { flags[cb.value] = cb.checked; });
  return flags;
}

async function salvarEmpresa() {
  const btn = document.getElementById('btn-salvar-empresa');
  btn.disabled = true; btn.textContent = 'Salvando...';

  const razao    = document.getElementById('f-razao-social')?.value.trim();
  const fantasia = document.getElementById('f-nome-fantasia')?.value.trim();
  if (!razao || !fantasia) {
    alert('Preencha Razão Social e Nome Fantasia.');
    btn.disabled = false; btn.textContent = '💾 Salvar Empresa';
    return;
  }

  // Protege empresa master
  if (!_novaEmpresa && _empresaAtual?.is_master) {
    const novoStatus = document.getElementById('f-status')?.value;
    if (novoStatus && novoStatus !== 'ativo') {
      alert('A empresa master não pode ser suspensa, bloqueada ou cancelada.');
      btn.disabled = false; btn.textContent = '💾 Salvar Empresa';
      return;
    }
  }

  const plano     = document.getElementById('f-plano')?.value;
  const trialDias = parseInt(document.getElementById('f-trial-dias')?.value || '30');
  const dataVencInput = document.getElementById('f-data-vencimento')?.value;

  // Calcular data_vencimento para trial automaticamente
  let dataVenc = dataVencInput ? new Date(dataVencInput + 'T12:00:00') : null;
  if (plano === 'trial' && !dataVencInput) {
    dataVenc = new Date();
    dataVenc.setDate(dataVenc.getDate() + trialDias);
  }

  const modulos = _lerModulosMarcados();
  const flags   = _lerFeatureFlags();

  // White label
  const wl = {
    nome:           document.getElementById('f-wl-nome')?.value.trim() || '',
    cor_primaria:   document.getElementById('f-wl-cor-primaria')?.value || '',
    cor_secundaria: document.getElementById('f-wl-cor-secundaria')?.value || ''
  };

  const dados = {
    razao_social:   razao,
    nome_fantasia:  fantasia,
    cnpj:           document.getElementById('f-cnpj')?.value.trim()           || '',
    responsavel:    document.getElementById('f-responsavel')?.value.trim()    || '',
    telefone:       document.getElementById('f-telefone')?.value.trim()       || '',
    whatsapp:       document.getElementById('f-whatsapp')?.value.trim()       || '',
    email:          document.getElementById('f-email')?.value.trim()          || '',
    status:         document.getElementById('f-status')?.value                || 'ativo',
    plano,
    trial_dias:     plano === 'trial' ? trialDias : null,
    modulos_ativos: modulos,
    feature_flags:  flags,
    white_label:    wl,
    valor_mensal:   parseFloat(document.getElementById('f-valor-mensal')?.value || '0') || 0,
    data_vencimento: dataVenc,
    observacoes:    document.getElementById('f-observacoes')?.value.trim()    || '',
    atualizado_em:  serverTimestamp()
  };

  try {
    if (_novaEmpresa) {
      dados.data_cadastro = serverTimestamp();
      dados.is_master = false;
      const ref = await addDoc(collection(db, 'empresas'), dados);
      _empresaAtual = { id: ref.id, ...dados };
      await logAuditoria('empresa_criada', { empresa_id: ref.id, nome: fantasia, plano });

      // Registra no histórico de assinaturas
      await _registrarAssinatura(ref.id, { nome: fantasia, plano, status: dados.status, valor: dados.valor_mensal, acao: 'criacao' });

      // Notifica master se for trial
      if (plano === 'trial') {
        await _criarNotificacao('trial_iniciado', `Nova empresa em Trial: ${fantasia}`, ref.id, fantasia);
      }
    } else {
      const statusAnterior = _empresaAtual.status;
      await updateDoc(doc(db, 'empresas', _empresaAtual.id), dados);
      _empresaAtual = { ..._empresaAtual, ...dados };
      await logAuditoria('empresa_atualizada', { empresa_id: _empresaAtual.id, nome: fantasia, status: dados.status });

      // Auditoria de mudança de status
      if (statusAnterior !== dados.status) {
        await logAuditoria('empresa_status_alterado', {
          empresa_id: _empresaAtual.id,
          status_anterior: statusAnterior,
          status_novo: dados.status
        });
      }
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

  // Proteção da empresa master
  if (_empresaAtual.is_master) {
    alert('A empresa master do sistema não pode ser excluída.');
    return;
  }

  const nome = _empresaAtual.nome_fantasia || _empresaAtual.razao_social || 'esta empresa';
  if (!confirm(`Arquivar "${nome}"?\n\nA empresa será movida para a lista de arquivadas.\nOs dados ficam preservados por 90 dias antes da exclusão definitiva.`)) return;

  try {
    // Exclusão segura: mover para empresas_arquivadas
    const arquivoData = {
      ..._empresaAtual,
      status: 'arquivado',
      arquivado_em: serverTimestamp(),
      exclusao_definitiva_em: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      arquivado_por: getTenant()?.nome || getTenant()?.uid || 'master'
    };

    await setDoc(doc(db, 'empresas_arquivadas', _empresaAtual.id), arquivoData);
    await deleteDoc(doc(db, 'empresas', _empresaAtual.id));
    await logAuditoria('empresa_arquivada', { empresa_id: _empresaAtual.id, nome });

    _empresaAtual = null;
    await carregarEmpresas();
    fecharModal();
    _mostrarToast(`"${nome}" arquivada. Dados preservados por 90 dias.`, 'warn');
  } catch (err) {
    alert('Erro ao arquivar: ' + err.message);
  }
}

// ── Modo Suporte ──────────────────────────────────────────────
window.entrarModoSuporte = async function() {
  if (!_empresaAtual) return;
  const nome = _empresaAtual.nome_fantasia || _empresaAtual.razao_social;
  if (!confirm(`Entrar como suporte na empresa "${nome}"?\n\nSua sessão será registrada na auditoria.`)) return;

  try {
    await ativarModoSuporte(_empresaAtual.id, nome);
    fecharModal();
    window.location.href = '/CRM/pages/dashboard/index.html';
  } catch (err) {
    alert('Erro: ' + err.message);
  }
};

// ── Backup / Exportação ───────────────────────────────────────
async function exportarDadosEmpresa() {
  if (!_empresaAtual) { alert('Selecione uma empresa primeiro.'); return; }
  const btn = document.getElementById('btn-exportar-dados');
  if (btn) { btn.disabled = true; btn.textContent = 'Exportando...'; }

  const empresaId = _empresaAtual.id;
  const nome = _empresaAtual.nome_fantasia || _empresaAtual.razao_social || empresaId;

  try {
    const coletores = ['os', 'clientes', 'caixa_lancamentos', 'financeiro_receber',
      'financeiro_pagar', 'estoque_produtos', 'agenda', 'usuarios'];

    const exportData = {
      empresa: _empresaAtual,
      exportado_em: new Date().toISOString(),
      dados: {}
    };

    await Promise.all(coletores.map(async (col) => {
      try {
        const snap = await getDocs(query(
          collection(db, col),
          where('empresa_id', '==', empresaId),
          limit(5000)
        ));
        exportData.dados[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch {
        exportData.dados[col] = [];
      }
    }));

    // Download como JSON
    const json  = JSON.stringify(exportData, null, 2);
    const blob  = new Blob([json], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `backup_${nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    await logAuditoria('backup_exportado', { empresa_id: empresaId, nome });
    _mostrarToast('Backup exportado com sucesso!');
  } catch (err) {
    alert('Erro ao exportar: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📥 Exportar JSON'; }
  }
}

// ── Assinaturas ───────────────────────────────────────────────
async function _registrarAssinatura(empresaId, dados) {
  try {
    await addDoc(collection(db, 'assinaturas'), {
      empresa_id: empresaId,
      ...dados,
      criado_em: serverTimestamp()
    });
  } catch {}
}

// ── Notificações SaaS ─────────────────────────────────────────
async function _criarNotificacao(tipo, mensagem, empresaId = '', empresaNome = '') {
  try {
    await addDoc(collection(db, 'notificacoes_saas'), {
      tipo, mensagem,
      empresa_id: empresaId,
      empresa_nome: empresaNome,
      lida: false,
      timestamp: serverTimestamp()
    });
  } catch {}
}

async function carregarNotificacoes() {
  const badge = document.getElementById('notif-badge');
  const lista = document.getElementById('lista-notificacoes');
  if (!lista) return;

  try {
    const snap = await getDocs(query(
      collection(db, 'notificacoes_saas'),
      orderBy('timestamp', 'desc'),
      limit(50)
    ));
    const naoLidas = snap.docs.filter(d => !d.data().lida).length;
    if (badge) badge.textContent = naoLidas > 0 ? naoLidas : '';
    if (badge) badge.style.display = naoLidas > 0 ? '' : 'none';

    if (!snap.empty) {
      lista.innerHTML = snap.docs.map(d => {
        const n = d.data();
        const ts = n.timestamp?.toDate ? n.timestamp.toDate().toLocaleDateString('pt-BR') : '—';
        return `
          <div style="padding:12px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:flex-start;${!n.lida ? 'background:rgba(0,200,83,0.04)' : ''}">
            <span style="font-size:20px">${_iconeNotif(n.tipo)}</span>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600;color:var(--text)">${_esc(n.mensagem)}</div>
              ${n.empresa_nome ? `<div style="font-size:11px;color:var(--text3)">${_esc(n.empresa_nome)}</div>` : ''}
              <div style="font-size:11px;color:var(--text3);margin-top:2px">${ts}</div>
            </div>
            ${!n.lida ? `<button class="btn btn-outline btn-sm" onclick="marcarNotifLida('${d.id}')">✓</button>` : ''}
          </div>`;
      }).join('');
    } else {
      lista.innerHTML = '<div class="saas-empty">Nenhuma notificação.</div>';
    }
  } catch (err) {
    if (lista) lista.innerHTML = `<div class="saas-empty">Erro: ${err.message}</div>`;
  }
}

window.marcarNotifLida = async function(id) {
  try {
    await updateDoc(doc(db, 'notificacoes_saas', id), { lida: true });
    carregarNotificacoes();
  } catch {}
};

function _iconeNotif(tipo) {
  const map = {
    trial_iniciado: '🆕', trial_vencendo: '⏰', trial_vencido: '⏱️',
    licenca_vencida: '🔴', empresa_suspensa: '⚠️', backup_falhou: '💾',
    erro_critico: '🚨', login_excessivo: '🔐'
  };
  return map[tipo] || '🔔';
}

// ═══════════════════════════════════════════════════════════════
// USUÁRIOS — CRUD
// ═══════════════════════════════════════════════════════════════

async function carregarUsuarios() {
  const tbody = document.getElementById('tbody-usuarios');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="saas-loading">Carregando...</td></tr>';

  try {
    const snap = await getDocs(query(collection(db, 'usuarios'), orderBy('nome')));
    _usuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarTabelaUsuarios();
    _preencherSelectEmpresas();
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="saas-empty">Erro: ${err.message}</td></tr>`;
  }
}

function renderizarTabelaUsuarios(filtroEmp = '', filtroNome = '') {
  const tbody = document.getElementById('tbody-usuarios');
  if (!tbody) return;
  const lista = _usuarios.filter(u => {
    if (filtroEmp && u.empresa_id !== filtroEmp) return false;
    if (filtroNome) {
      const t = filtroNome.toLowerCase();
      return (u.nome||'').toLowerCase().includes(t) || (u.email||'').toLowerCase().includes(t);
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
    return `
      <tr>
        <td style="font-weight:600;color:var(--text)">${_esc(u.nome||'—')}</td>
        <td>${_esc(u.email||'—')}</td>
        <td>${_esc(emp?.nome_fantasia || u.empresa_id || '—')}</td>
        <td><span class="badge badge-ativo">${PERFIS[u.perfil]?.nome || u.perfil || '—'}</span></td>
        <td><span class="badge badge-${u.ativo!==false?'ativo':'cancelado'}">${u.ativo!==false?'Ativo':'Inativo'}</span></td>
        <td>${ult}</td>
        <td><button class="btn btn-outline btn-sm" onclick="editarUsuario('${u.id}')">Editar</button></td>
      </tr>`;
  }).join('');
}

async function carregarUsuariosDaEmpresa(empresaId) {
  const lista = document.getElementById('lista-usuarios-emp');
  if (!lista) return;
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
        <div class="saas-empty">Nenhum usuário cadastrado.</div>
        <div style="text-align:center;margin-top:8px">
          <button class="btn btn-outline btn-sm" onclick="abrirModalNovoUsuario('${empresaId}')">+ Adicionar</button>
        </div>`;
      return;
    }
    lista.innerHTML = `
      <table class="saas-table">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td style="font-weight:600;color:var(--text)">${_esc(u.nome||'—')}</td>
              <td>${_esc(u.email||'—')}</td>
              <td>${PERFIS[u.perfil]?.nome||u.perfil||'—'}</td>
              <td><span class="badge badge-${u.ativo!==false?'ativo':'cancelado'}">${u.ativo!==false?'Ativo':'Inativo'}</span></td>
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

function _preencherSelectEmpresas() {
  ['filtro-empresa-user','uf-empresa'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const first = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(first);
    _empresas.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.nome_fantasia || e.razao_social || e.id;
      sel.appendChild(opt);
    });
  });
}

window.abrirModalNovoUsuario = function(empresaId = '') {
  _set('uf-nome', ''); _set('uf-email', ''); _set('uf-perfil', 'admin');
  document.getElementById('uf-error').textContent = '';
  document.getElementById('modal-usuario-titulo').textContent = 'Novo Usuário';
  document.getElementById('btn-salvar-usuario').dataset.uid = '';
  _preencherSelectEmpresas();
  if (empresaId) _set('uf-empresa', empresaId);
  _renderizarPermissoesUsuario('admin', {});
  document.getElementById('modal-usuario').style.display = '';
};

window.editarUsuario = function(uid) {
  const u = _usuarios.find(x => x.id === uid);
  if (!u) return;
  document.getElementById('modal-usuario-titulo').textContent = 'Editar Usuário';
  _set('uf-nome',   u.nome  || '');
  _set('uf-email',  u.email || '');
  _set('uf-perfil', u.perfil|| 'admin');
  document.getElementById('uf-error').textContent = '';
  document.getElementById('btn-salvar-usuario').dataset.uid = uid;
  _preencherSelectEmpresas();
  _set('uf-empresa', u.empresa_id || '');
  _renderizarPermissoesUsuario(u.perfil || 'admin', u.permissoes_modulos || {});
  document.getElementById('modal-usuario').style.display = '';
};

function _renderizarPermissoesUsuario(perfil, overrides) {
  const container = document.getElementById('perm-modulos');
  if (!container) return;
  const padrao = PERMISSOES_PADRAO_PERFIL[perfil] || {};

  container.innerHTML = MODULOS_CATALOGO.map(m => {
    const nivel = overrides[m.id] || padrao[m.id] || 'total';
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:13px;flex:1;color:var(--text)">${m.icone} ${m.nome}</span>
        <select data-mod="${m.id}" style="padding:4px 8px;background:var(--surface3);border:1px solid var(--border);
          border-radius:6px;color:var(--text);font-size:12px;font-family:var(--font);cursor:pointer" onchange="void 0">
          <option value="total"    ${nivel==='total'    ?'selected':''}>✅ Total</option>
          <option value="consulta" ${nivel==='consulta' ?'selected':''}>👁️ Consulta</option>
          <option value="bloqueado"${nivel==='bloqueado'?'selected':''}>🚫 Bloqueado</option>
        </select>
      </div>`;
  }).join('');
}

async function salvarUsuario() {
  const btn       = document.getElementById('btn-salvar-usuario');
  const uid       = btn.dataset.uid;
  const nome      = document.getElementById('uf-nome')?.value.trim();
  const email     = document.getElementById('uf-email')?.value.trim();
  const empresaId = document.getElementById('uf-empresa')?.value;
  const perfil    = document.getElementById('uf-perfil')?.value;
  const errEl     = document.getElementById('uf-error');

  if (!nome)      { errEl.textContent = 'Informe o nome.';    return; }
  if (!email)     { errEl.textContent = 'Informe o e-mail.';  return; }
  if (!empresaId) { errEl.textContent = 'Selecione empresa.'; return; }

  btn.disabled = true; btn.textContent = 'Salvando...';
  errEl.textContent = '';

  // Lê permissões individuais
  const permissoes = {};
  document.querySelectorAll('#perm-modulos select[data-mod]').forEach(sel => {
    if (sel.value !== 'total') permissoes[sel.dataset.mod] = sel.value;
  });

  const dados = {
    nome, email, empresa_id: empresaId, perfil,
    permissoes_modulos: permissoes,
    ativo: true, atualizado_em: serverTimestamp()
  };

  try {
    if (uid) {
      await setDoc(doc(db, 'usuarios', uid), dados, { merge: true });
      await logAuditoria('usuario_atualizado', { uid, nome, empresa_id: empresaId, perfil, permissoes });
    } else {
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
// PLANOS
// ═══════════════════════════════════════════════════════════════

function renderizarPlanos() {
  const grid = document.getElementById('planos-grid');
  if (!grid) return;
  grid.innerHTML = Object.values(PLANOS).map(p => `
    <div class="plano-card ${p.id === 'enterprise' ? 'enterprise' : ''} ${p.trial ? 'trial-card' : ''}">
      <div class="plano-card-nome">${p.nome}</div>
      <div class="plano-card-desc">${p.descricao}</div>
      ${p.trial ? `
        <div style="display:flex;gap:8px;margin:12px 0 4px;flex-wrap:wrap">
          ${[7,15,30].map(d => `<span class="badge badge-ativo" style="font-size:12px;padding:4px 10px">${d} dias</span>`).join('')}
        </div>` : ''}
      <div class="plano-modulos">
        ${p.modulos
          ? p.modulos.map(id => {
              const m = MODULOS_CATALOGO.find(x => x.id === id);
              return m ? `<div class="plano-modulo-item">${m.icone} ${m.nome}</div>` : '';
            }).join('')
          : '<div class="plano-modulo-item">Todos os módulos disponíveis</div>'
        }
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════════
// AUDITORIA
// ═══════════════════════════════════════════════════════════════

async function carregarAuditoria() {
  const tbody = document.getElementById('tbody-auditoria');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="saas-loading">Carregando...</td></tr>';
  try {
    const snap = await getDocs(query(
      collection(db, 'auditoria_saas'),
      orderBy('timestamp', 'desc'),
      limit(200)
    ));
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" class="saas-empty">Nenhum registro.</td></tr>';
      return;
    }
    tbody.innerHTML = snap.docs.map(d => {
      const r   = d.data();
      const ts  = r.timestamp?.toDate ? r.timestamp.toDate().toLocaleString('pt-BR') : '—';
      const emp = _empresas.find(e => e.id === r.empresa_id);
      const det = typeof r.detalhes === 'object' ? JSON.stringify(r.detalhes).slice(0, 80) : String(r.detalhes||'');
      return `
        <tr>
          <td style="white-space:nowrap;color:var(--text3);font-size:12px">${ts}</td>
          <td>${_esc(emp?.nome_fantasia || r.empresa_id || '—')}</td>
          <td>${_esc(r.usuario_nome || r.usuario_id || '—')}</td>
          <td><span class="badge badge-ativo" style="font-size:10px">${_esc(r.acao||'—')}</span>
              ${r.em_suporte ? '<span class="badge badge-suspenso" style="font-size:10px">suporte</span>' : ''}</td>
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
  _on('busca-empresa',   'input',  e => renderizarListaEmpresas(e.target.value));
  _on('btn-nova-empresa','click',  () => abrirModalEmpresa(true));
  _on('btn-salvar-empresa','click',salvarEmpresa);
  _on('btn-excluir-empresa','click',excluirEmpresa);
  _on('btn-modo-suporte','click',  () => window.entrarModoSuporte());
  _on('btn-exportar-dados','click',exportarDadosEmpresa);
  _on('btn-atualizar-audit','click',carregarAuditoria);
  _on('btn-atualizar-notif','click',carregarNotificacoes);
  _on('btn-novo-usuario', 'click', () => window.abrirModalNovoUsuario(''));
  _on('btn-add-usuario-emp','click',() => window.abrirModalNovoUsuario(_empresaAtual?.id||''));
  _on('btn-salvar-usuario','click',salvarUsuario);

  _on('f-plano', 'change', e => window._saasAplicarPlano(e.target.value));
  _on('f-modelo','change', e => window._saasAplicarModelo(e.target.value));

  _on('f-data-vencimento','change', e => {
    atualizarCamposLicenca({
      ..._empresaAtual,
      data_vencimento: e.target.value ? new Date(e.target.value + 'T12:00:00') : null
    });
  });

  _on('uf-perfil','change', e => {
    const uid = document.getElementById('btn-salvar-usuario')?.dataset?.uid;
    const u   = uid ? (_usuarios.find(x => x.id === uid) || {}) : {};
    _renderizarPermissoesUsuario(e.target.value, u.permissoes_modulos || {});
  });

  _on('busca-usuario',       'input',  e => renderizarTabelaUsuarios(document.getElementById('filtro-empresa-user')?.value||'', e.target.value));
  _on('filtro-empresa-user', 'change', e => renderizarTabelaUsuarios(e.target.value, document.getElementById('busca-usuario')?.value||''));

  // CNPJ: máscara
  _on('f-cnpj','input', e => {
    let v = e.target.value.replace(/\D/g,'').slice(0,14);
    if (v.length > 12) v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5');
    else if (v.length > 8) v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/,'$1.$2.$3/$4');
    else if (v.length > 5) v = v.replace(/(\d{2})(\d{3})(\d{3})/,'$1.$2.$3');
    else if (v.length > 2) v = v.replace(/(\d{2})(\d{3})/,'$1.$2');
    e.target.value = v;
  });
}

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════

function _set(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }
function _on(id, ev, fn) { document.getElementById(id)?.addEventListener(ev, fn); }
function _esc(s) {
  return String(s||'').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}

function _mostrarToast(msg, tipo = 'ok') {
  let t = document.getElementById('saas-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'saas-toast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;transition:opacity 0.3s;box-shadow:0 4px 20px rgba(0,0,0,0.5);pointer-events:none';
    document.body.appendChild(t);
  }
  t.style.background = tipo === 'ok' ? 'var(--green)' : tipo === 'warn' ? 'var(--yellow)' : 'var(--red)';
  t.style.color = '#000';
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

// Fechar modais (também acessível pelo HTML via window.fecharModal etc.)
window.fecharModal = () => { document.getElementById('modal-empresa').style.display = 'none'; };
window.fecharModalUsuario = () => { document.getElementById('modal-usuario').style.display = 'none'; };

window.selecionarTodosModulos = (v) => {
  document.querySelectorAll('#modulos-checkboxes input[type=checkbox]').forEach(cb => {
    cb.checked = v;
    cb.closest('.modulo-check').classList.toggle('checked', v);
  });
};
window.aplicarPlano = () => window._saasAplicarPlano(document.getElementById('f-plano')?.value);

// Fecha modais ao clicar fora
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-empresa')?.addEventListener('click', e => { if (e.target === e.currentTarget) fecharModal(); });
  document.getElementById('modal-usuario')?.addEventListener('click', e => { if (e.target === e.currentTarget) fecharModalUsuario(); });
});

// ── Inicia ────────────────────────────────────────────────────
init();
