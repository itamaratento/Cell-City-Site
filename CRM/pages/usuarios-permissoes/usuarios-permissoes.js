/* ============================================================
   USUÁRIOS E PERMISSÕES — Cell City CRM (Fase 1, módulo isolado)

   Não importa nada de shared/tenant.js nem altera scripts/kernel.js,
   scripts/firebase.js ou login.html. Usa apenas as APIs públicas já
   existentes do kernel (initModulo/temPermissao/getUid/getNome) para
   decidir quem pode abrir o módulo.

   Duas camadas de "perfil" convivem no sistema, propositalmente
   separadas:
   - usuarios/{uid}.perfil        → nível de acesso do kernel.js
                                     (master_admin/admin/gerente/tecnico/atendente),
                                     usado por temPermissao(). NÃO é alterado
                                     em seu significado por este módulo.
   - perfis_operacionais/{id}     → RBAC operacional novo (Administrador,
                                     Financeiro, Caixa, Estoque, Técnico,
                                     Comercial, Atendimento, + livres),
                                     com matriz de permissões por módulo.
                                     Referenciado em usuarios/{uid}.perfil_operacional_id.

   Como toda conta criada por este módulo precisa de um valor em
   usuarios/{uid}.perfil (senão o kernel.js assume 'pendente' por padrão
   na sessão — sem nenhum acesso, ver _buildContext), mapeamos cada perfil
   operacional para o nível mínimo sensato do kernel em
   PERFIL_OPERACIONAL_PARA_KERNEL. A aplicação fina de permissões dentro
   dos módulos existentes fica para fases futuras (gradual, um módulo
   por vez).

   Exclusão de usuário (2026-07-04): usa a Cloud Function
   excluirUsuarioAdmin (functions/index.js) — o client SDK não consegue
   apagar a conta de OUTRO usuário no Firebase Auth sem impersoná-lo
   (exigiria a senha atual dele); a function roda com Admin SDK e checa
   no servidor se quem está chamando é admin/master_admin, sem precisar
   de nenhuma senha da conta-alvo.
   ============================================================ */
import { initModulo, temPermissao, getUid, getNome } from '../../scripts/kernel.js';
import {
  db, collection, addDoc, doc, setDoc, updateDoc, getDoc,
  query, orderBy, onSnapshot, serverTimestamp, limit
} from '../../scripts/firebase.js';
import { criarContaSecundaria, redefinirSenhaSecundaria, enviarResetPorEmail } from './firebase-secondary.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js';
import { formatDateTime } from '../../shared/date-utils.js';

// Mesma região do deploy da function (functions/index.js) e do Firestore.
const excluirUsuarioAdminFn = httpsCallable(getFunctions(getApp(), 'southamerica-east1'), 'excluirUsuarioAdmin');

// Senha administrativa de confirmação de exclusão (pedido do proprietário,
// briefing 2026-07-03). É uma trava contra exclusão acidental, NÃO uma
// barreira de segurança: quem protege de verdade é a Cloud Function
// excluirUsuarioAdmin (functions/index.js), que confere no servidor se
// quem chama é admin/master_admin antes de apagar qualquer coisa.
const SENHA_ADMIN_EXCLUSAO = '1056';

// ── Catálogo de módulos (matriz de permissões) ─────────────────
const MODULOS = [
  { id: 'dashboard',          nome: 'Dashboard',              temAprovar: false },
  { id: 'os',                 nome: 'OS',                     temAprovar: false },
  { id: 'caixa',              nome: 'Caixa',                  temAprovar: true  },
  { id: 'estoque',            nome: 'Estoque',                temAprovar: false },
  { id: 'financeiro',         nome: 'Financeiro',             temAprovar: true  },
  { id: 'crm',                nome: 'CRM Comercial',          temAprovar: false },
  { id: 'agenda',             nome: 'Agenda',                 temAprovar: false },
  { id: 'relatorios',         nome: 'Relatórios',             temAprovar: false },
  { id: 'config',             nome: 'Configurações',          temAprovar: false },
  { id: 'compras',            nome: 'Compras',                temAprovar: false },
  { id: 'fornecedor',         nome: 'Fornecedor',             temAprovar: false },
  { id: 'catalogo',           nome: 'Catálogo',               temAprovar: false },
  { id: 'pos-venda',          nome: 'Pós-Venda',              temAprovar: false },
  { id: 'contas',             nome: 'Contas & Números',       temAprovar: false },
  { id: 'diario',             nome: 'Diário',                 temAprovar: false },
  { id: 'chat',               nome: 'Chat',                   temAprovar: false },
  { id: 'minha-semana',       nome: 'Minha Semana',           temAprovar: false },
  { id: 'autoatendimento',    nome: 'Autoatendimento',        temAprovar: false },
  { id: 'importar',           nome: 'Importar',               temAprovar: false },
  { id: 'campanhas',          nome: 'Campanhas',              temAprovar: false },
  { id: 'analise',            nome: 'Análise',                temAprovar: false },
  { id: 'auditoria',          nome: 'Auditoria',              temAprovar: false },
  { id: 'central-alertas',    nome: 'Central de Alertas',     temAprovar: false },
  { id: 'central-comandos',   nome: 'Central de Comandos',    temAprovar: false },
  { id: 'central-informacoes',nome: 'Central de Informações', temAprovar: false },
];

function matrizVazia(padraoVisualizar = true) {
  const m = {};
  MODULOS.forEach(mod => {
    m[mod.id] = { visualizar: padraoVisualizar, criar: false, editar: false, excluir: false, aprovar: false };
  });
  return m;
}
// Nível mínimo do kernel.js (hierarquia existente: master_admin/admin/gerente/tecnico/atendente)
// atribuído a cada perfil operacional na criação da conta. Não altera o
// significado desse campo — apenas evita deixá-lo vazio (o que faria o
// kernel.js assumir 'admin' por padrão). Perfis operacionais criados
// depois pelo admin (fora dos 7 padrão) caem no fallback 'atendente'.
const PERFIL_OPERACIONAL_PARA_KERNEL = {
  administrador: 'admin',
  financeiro:    'gerente',
  caixa:         'atendente',
  estoque:       'atendente',
  tecnico:       'tecnico',
  comercial:     'atendente',
  atendimento:   'atendente',
};
function kernelPerfilPara(perfilOperacionalId) {
  return PERFIL_OPERACIONAL_PARA_KERNEL[perfilOperacionalId] || 'atendente';
}

// ── Estado ──────────────────────────────────────────────────────
let usuarios = [];
let perfis = [];
let logs = [];
let buscaUsuarios = '';
let periodoLogs = 'hoje';
let perfilPermissoesSelecionadoId = null;
let matrizEdicao = null;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gerarSenhaTemp = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};
const fmtData = (ts) => formatDateTime(ts, { vazio: '—' });

function toast(msg) {
  const t = $('up-toast');
  t.textContent = msg;
  t.classList.add('up-show');
  clearTimeout(toast._h);
  toast._h = setTimeout(() => t.classList.remove('up-show'), 2600);
}

function abrirModal(titulo, bodyHtml) {
  $('up-modal-titulo').textContent = titulo;
  $('up-modal-body').innerHTML = bodyHtml;
  $('up-modal').classList.add('up-open');
}
function fecharModal() { $('up-modal').classList.remove('up-open'); }
window.__upFecharModal = fecharModal;

async function registrarAuditoria(acao, alvoUid, alvoNome, detalhes) {
  try {
    await addDoc(collection(db, 'auditoria_usuarios_permissoes'), {
      acao,
      admin_uid: getUid(),
      admin_nome: getNome(),
      alvo_uid: alvoUid || null,
      alvo_nome: alvoNome || null,
      detalhes: detalhes || null,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.error('[usuarios-permissoes] Falha ao registrar auditoria', e);
  }
}

function traduzErroAuth(e) {
  const c = (e && e.code) || '';
  if (c.includes('email-already-in-use')) return 'Este e-mail já possui conta.';
  if (c.includes('weak-password')) return 'Senha muito fraca (mínimo 6 caracteres).';
  if (c.includes('invalid-email')) return 'E-mail inválido.';
  if (c.includes('wrong-password') || c.includes('invalid-credential')) return 'Senha atual incorreta.';
  if (c.includes('user-not-found')) return 'Conta não encontrada no Firebase Auth.';
  if (c.includes('too-many-requests')) return 'Muitas tentativas — aguarde alguns minutos.';
  if (c.includes('permission-denied')) return 'Sem permissão para esta operação.';
  return (e && e.message) || 'Falha na operação.';
}

/** 'admin'/'master_admin' no nível do kernel.js — quem acessa este módulo (temPermissao('admin') no boot). */
function ehAdministrador(u) {
  return u.perfil === 'admin' || u.perfil === 'master_admin';
}

/**
 * Guarda compartilhada por exclusão e desativação: bloqueia agir sobre a
 * própria conta logada e bloqueia remover a última capacidade de admin do
 * sistema. `baseAdmins` é o conjunto relevante para CADA ação — todos os
 * usuários geridos pelo módulo na exclusão (perder o cadastro é definitivo,
 * não importa o status atual); só os com status "ativo" na desativação (um
 * admin já inativo não conta como capacidade disponível agora). Retorna
 * true e mostra o toast quando bloqueado; false quando pode prosseguir.
 */
function bloqueadoPorProtecaoAdmin(u, baseAdmins, msgProprio, msgUltimoAdmin) {
  if (u.id === getUid()) {
    toast(msgProprio);
    return true;
  }
  if (ehAdministrador(u) && baseAdmins.filter(ehAdministrador).length <= 1) {
    toast(msgUltimoAdmin);
    return true;
  }
  return false;
}

/**
 * Desabilita `btn` e troca seu texto durante `fn` (indicação de carregamento
 * e trava contra duplo clique), restaura ao final, e centraliza o
 * tratamento de erro (console + toast) — usado em toda ação de escrita
 * disparada por botão neste módulo.
 */
async function comCarregamento(btn, textoCarregando, fn) {
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = textoCarregando;
  try {
    await fn();
  } catch (e) {
    console.error('[usuarios-permissoes]', e);
    toast(traduzErroAuth(e));
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

// =================================================================
// ABA POLÍTICAS DE SENHA
// =================================================================
const COL_POLITICAS = 'config';
const DOC_POLITICAS = 'politicas_senha';

let politicasCache = {
  expiracao_dias: 90,
  forca_minima: { min_length: 8,ExigeMaiuscula: true, ExigeMinuscula: true, ExigeDigito: true, ExigeEspecial: false },
  historico_qtd: 5
};

async function carregarPoliticas() {
  try {
    const snap = await getDoc(doc(db, COL_POLITICAS, DOC_POLITICAS));
    if (snap.exists()) politicasCache = { ...politicasCache, ...snap.data() };
  } catch {}
  renderPoliticas();
}

function renderPoliticas() {
  const p = politicasCache;
  const f = p.forca_minima || {};
  document.getElementById('pol-expiracao').value = p.expiracao_dias || 90;
  document.getElementById('pol-min-length').value = f.min_length || 8;
  document.getElementById('pol-maiuscula').checked = f.ExigeMaiuscula !== false;
  document.getElementById('pol-minuscula').checked = f.ExigeMinuscula !== false;
  document.getElementById('pol-digito').checked = f.ExigeDigito !== false;
  document.getElementById('pol-especial').checked = f.ExigeEspecial === true;
  document.getElementById('pol-historico').value = p.historico_qtd || 5;
  document.getElementById('pol-teste-senha').value = '';
  document.getElementById('pol-teste-resultado').innerHTML = '';
}

// ── Exports para testes ──────────────────────────────────────────
window.validarSenhaPoliticas = validarSenhaPoliticas;
window.calcularForcaSenha = calcularForcaSenha;
window.salvarPoliticas = async function() {
  const p = {
    expiracao_dias: parseInt(document.getElementById('pol-expiracao').value) || 90,
    forca_minima: {
      min_length: parseInt(document.getElementById('pol-min-length').value) || 8,
      ExigeMaiuscula: document.getElementById('pol-maiuscula').checked,
      ExigeMinuscula: document.getElementById('pol-minuscula').checked,
      ExigeDigito: document.getElementById('pol-digito').checked,
      ExigeEspecial: document.getElementById('pol-especial').checked
    },
    historico_qtd: parseInt(document.getElementById('pol-historico').value) || 5,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: getUid()
  };
  try {
    await setDoc(doc(db, COL_POLITICAS, DOC_POLITICAS), p);
    politicasCache = { ...politicasCache, ...p };
    toast('✅ Políticas de senha salvas!');
  } catch(e) {
    console.error(e);
    toast('❌ Erro ao salvar políticas');
  }
};

window.testarSenha = function() {
  const senha = document.getElementById('pol-teste-senha')?.value || '';
  const resultado = document.getElementById('pol-teste-resultado');
  if (!resultado) return;
  if (!senha) { resultado.innerHTML = ''; return; }

  const f = politicasCache.forca_minima || {};
  const erros = [];
  if (senha.length < (f.min_length || 8)) erros.push(`Mínimo de ${f.min_length || 8} caracteres`);
  if (f.ExigeMaiuscula !== false && !/[A-Z]/.test(senha)) erros.push('Letra maiúscula');
  if (f.ExigeMinuscula !== false && !/[a-z]/.test(senha)) erros.push('Letra minúscula');
  if (f.ExigeDigito !== false && !/\d/.test(senha)) erros.push('Número');
  if (f.ExigeEspecial === true && !/[^a-zA-Z0-9]/.test(senha)) erros.push('Caractere especial');

  const forca = calcularForcaSenha(senha);
  const nivel = forca >= 80 ? 'forte' : forca >= 50 ? 'media' : 'fraca';
  const cores = { forte: 'var(--green-light)', media: 'var(--yellow)', fraca: 'var(--red)' };

  resultado.innerHTML = `
    <div class="pol-teste-bar"><div class="pol-teste-fill" style="width:${forca}%;background:${cores[nivel]}"></div></div>
    <div style="font-size:13px;font-weight:700;color:${cores[nivel]};margin-bottom:6px">${nivel.toUpperCase()} (${forca}%)</div>
    ${erros.length ? '<div style="font-size:12px;color:var(--text3)">❌ Requisitos não atendidos:<br>' + erros.map(e => '&nbsp;· ' + e).join('<br>') + '</div>' : '<div style="font-size:12px;color:var(--green-light)">✅ Todos os requisitos atendidos</div>'}
  `;
};

function calcularForcaSenha(s) {
  let score = 0;
  if (s.length >= 8) score += 25;
  if (s.length >= 12) score += 10;
  if (s.length >= 16) score += 5;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) score += 20;
  if (/\d/.test(s)) score += 15;
  if (/[^a-zA-Z0-9]/.test(s)) score += 15;
  if (s.length > 20) score += 10;
  return Math.min(100, score);
}

function validarSenhaPoliticas(senha) {
  const f = politicasCache.forca_minima || {};
  const erros = [];
  if (senha.length < (f.min_length || 8)) erros.push(`Mínimo ${f.min_length || 8} caracteres`);
  if (f.ExigeMaiuscula !== false && !/[A-Z]/.test(senha)) erros.push('maiúscula');
  if (f.ExigeMinuscula !== false && !/[a-z]/.test(senha)) erros.push('minúscula');
  if (f.ExigeDigito !== false && !/\d/.test(senha)) erros.push('número');
  if (f.ExigeEspecial === true && !/[^a-zA-Z0-9]/.test(senha)) erros.push('caractere especial');
  return erros;
}

// ── Adiciona aba de políticas ───────────────────────────────────
function setupPoliticasUI() {
  const btnSalvar = document.getElementById('pol-btn-salvar');
  if (btnSalvar) btnSalvar.addEventListener('click', salvarPoliticas);
  const testeInput = document.getElementById('pol-teste-senha');
  if (testeInput) testeInput.addEventListener('input', testarSenha);
}

// =================================================================
// BOOT
// =================================================================
(async function boot() {
  const ctx = await initModulo();
  if (!ctx) return;

  if (!temPermissao('admin')) {
    $('up-bloqueado').style.display = 'block';
    return;
  }
  $('up-app').style.display = 'block';

  setupTabs();
  setupUsuariosUI();
  setupPerfisUI();
  setupPermissoesUI();
  setupLogsUI();
  setupPoliticasUI();
  await carregarPoliticas();
  iniciarListeners();
})();

function setupTabs() {
  $('up-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.up-tab');
    if (!btn) return;
    document.querySelectorAll('.up-tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.up-panel').forEach(p => p.classList.toggle('active', p.id === 'up-panel-' + btn.dataset.tab));
  });
}

function iniciarListeners() {
  onSnapshot(query(collection(db, 'usuarios'), orderBy('nome_exibicao', 'asc')), (snap) => {
    usuarios = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.perfil_operacional_id); // só usuários geridos por este módulo
    renderUsuarios();
    renderDashboard();
  }, (err) => console.error('[usuarios-permissoes] listener usuarios:', err));

  onSnapshot(collection(db, 'perfis_operacionais'), (snap) => {
    perfis = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    renderPerfis();
    renderPermissoesSelect();
    // A coluna "Perfil" da aba Usuários é resolvida a partir de `perfis` (join
    // em memória, ver renderUsuarios). Se o snapshot de perfis chegar DEPOIS
    // do de usuarios (comum — são onSnapshot independentes), a tabela já
    // desenhada ficava presa em "—" para sempre, porque só o listener de
    // usuarios chamava renderUsuarios(). Bug conhecido desde a Fase 1
    // (TECHDOC §6.7), reproduzido com dados reais na homologação de 2026-07-04.
    renderUsuarios();
    renderDashboard();
  }, (err) => console.error('[usuarios-permissoes] listener perfis:', err));

  onSnapshot(query(collection(db, 'auditoria_usuarios_permissoes'), orderBy('timestamp', 'desc'), limit(300)), (snap) => {
    logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderLogs();
    renderDashboard();
  }, (err) => console.error('[usuarios-permissoes] listener logs:', err));
}

// =================================================================
// DASHBOARD
// =================================================================
function renderDashboard() {
  const ativos = usuarios.filter(u => u.status !== 'inativo').length;
  const inativos = usuarios.filter(u => u.status === 'inativo').length;
  const cards = [
    { valor: usuarios.length, label: 'Total de usuários' },
    { valor: ativos, label: 'Usuários ativos' },
    { valor: inativos, label: 'Usuários inativos' },
    { valor: perfis.length, label: 'Perfis cadastrados' },
  ];
  $('up-dash-cards').innerHTML = cards.map(c => `
    <div class="up-card"><div class="up-card-valor">${c.valor}</div><div class="up-card-label">${c.label}</div></div>
  `).join('');

  const ultimas = logs.slice(0, 8);
  $('up-dash-alteracoes').innerHTML = ultimas.length
    ? ultimas.map(l => `<div>🕒 ${fmtData(l.timestamp)} — <b>${esc(descricaoAcao(l.acao))}</b>${l.alvo_nome ? ' · ' + esc(l.alvo_nome) : ''} <span style="color:var(--text-muted)">(${esc(l.admin_nome || '—')})</span></div>`).join('')
    : '<div class="up-vazio-inline">Nenhuma alteração registrada ainda.</div>';
}

function descricaoAcao(acao) {
  const map = {
    usuario_criado: 'Usuário criado', usuario_editado: 'Usuário editado',
    usuario_desativado: 'Usuário desativado', usuario_reativado: 'Usuário reativado',
    usuario_excluido: 'Usuário excluído',
    perfil_alterado: 'Perfil alterado', permissoes_alteradas: 'Permissões alteradas',
    senha_redefinida: 'Senha redefinida', perfil_criado: 'Perfil criado', perfil_editado: 'Perfil editado'
  };
  return map[acao] || acao;
}

// =================================================================
// ABA USUÁRIOS
// =================================================================
function setupUsuariosUI() {
  $('up-usr-busca').addEventListener('input', (e) => { buscaUsuarios = e.target.value.trim().toLowerCase(); renderUsuarios(); });
  $('up-btn-novo-usuario').addEventListener('click', () => abrirFormUsuario(null));
  $('up-usr-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-acao]');
    if (!btn) return;
    const u = usuarios.find(x => x.id === btn.dataset.uid);
    if (!u) return;
    if (btn.dataset.acao === 'editar') abrirFormUsuario(u);
    // Sucesso reconstrói a tbody via listener (renderUsuarios) — o texto/estado
    // do botão só precisa ser restaurado pelo comCarregamento no caminho de erro.
    if (btn.dataset.acao === 'toggle-status') comCarregamento(btn, '...', () => toggleStatusUsuario(u));
    if (btn.dataset.acao === 'redefinir-senha') abrirRedefinirSenha(u);
    if (btn.dataset.acao === 'excluir') abrirExcluirUsuario(u);
  });
}

function renderUsuarios() {
  const filtro = buscaUsuarios;
  const lista = usuarios.filter(u => !filtro ||
    (u.nome_exibicao || '').toLowerCase().includes(filtro) ||
    (u.email || '').toLowerCase().includes(filtro) ||
    (u.setor || '').toLowerCase().includes(filtro));

  $('up-usr-vazio').style.display = lista.length ? 'none' : 'block';
  $('up-usr-tbody').innerHTML = lista.map(u => {
    const perfil = perfis.find(p => p.id === u.perfil_operacional_id);
    const inativo = u.status === 'inativo';
    return `<tr>
      <td>${esc(u.nome_exibicao || u.nome || '—')}${u.conta_padrao ? ' <span class="up-badge up-badge-sistema" title="Conta padrão">padrão</span>' : ''}</td>
      <td>${esc(u.email || '—')}</td>
      <td>${esc(perfil ? perfil.nome : '—')}</td>
      <td>${esc(u.setor || '—')}</td>
      <td><span class="up-badge ${inativo ? 'up-badge-inativo' : 'up-badge-ativo'}">${inativo ? 'Inativo' : 'Ativo'}</span></td>
      <td>${fmtData(u.ultimo_acesso)}</td>
      <td>${fmtData(u.ultima_alteracao)}</td>
      <td class="up-td-acoes">
        <div class="up-acoes">
          <button class="up-btn up-btn-sm" data-acao="editar" data-uid="${u.id}">Editar</button>
          <button class="up-btn up-btn-sm" data-acao="redefinir-senha" data-uid="${u.id}">Senha</button>
          <button class="up-btn up-btn-sm ${inativo ? '' : 'up-btn-danger'}" data-acao="toggle-status" data-uid="${u.id}">${inativo ? 'Reativar' : 'Desativar'}</button>
          <button class="up-btn up-btn-sm up-btn-danger" data-acao="excluir" data-uid="${u.id}">Excluir</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function opcoesPerfis(selecionadoId) {
  return perfis.map(p => `<option value="${p.id}" ${p.id === selecionadoId ? 'selected' : ''}>${esc(p.nome)}${p.ativo === false ? ' (inativo)' : ''}</option>`).join('');
}

function abrirFormUsuario(usuarioExistente) {
  const editando = !!usuarioExistente;
  const u = usuarioExistente || {};
  const senhaTemp = gerarSenhaTemp();

  abrirModal(editando ? 'Editar usuário' : 'Novo usuário', `
    <div class="up-field"><label>Nome de exibição *</label><input class="up-input" id="uf-nome" value="${esc(u.nome_exibicao || '')}" placeholder="Ex.: Caixa 01" required></div>
    <div class="up-field"><label>E-mail ${editando ? '(não editável)' : '*'}</label><input class="up-input" id="uf-email" type="email" value="${esc(u.email || '')}" ${editando ? 'disabled' : ''} placeholder="conta@exemplo.com" required></div>
    ${editando ? '' : `<div class="up-field"><label>Senha temporária *</label><input class="up-input" id="uf-senha" value="${senhaTemp}" required></div>`}
    <div class="up-field"><label>Perfil *</label><select class="up-input" id="uf-perfil" required><option value="">Selecionar...</option>${opcoesPerfis(u.perfil_operacional_id)}</select></div>
    <div class="up-field"><label>Setor</label><input class="up-input" id="uf-setor" value="${esc(u.setor || '')}"></div>
    <div class="up-field"><label>Telefone</label><input class="up-input" id="uf-telefone" value="${esc(u.telefone || '')}" placeholder="(62) 99999-9999"></div>
    <div class="up-field"><label>Observação</label><input class="up-input" id="uf-obs" value="${esc(u.observacao || '')}"></div>
    ${editando ? '' : '<div class="up-modal-aviso">A senha temporária será exibida apenas nesta tela — anote-a antes de salvar. Não reutilize esta conta simultaneamente para duas pessoas.</div>'}
    <div class="up-modal-btns">
      <button class="up-btn" onclick="window.__upFecharModal()">Cancelar</button>
      <button class="up-btn up-btn-primary" id="uf-salvar">Salvar</button>
    </div>
  `);

  $('uf-salvar').addEventListener('click', (e) => {
    const nome = $('uf-nome').value.trim();
    const email = $('uf-email').value.trim();
    const perfilId = $('uf-perfil').value;
    const setor = $('uf-setor').value.trim();
    const telefone = $('uf-telefone').value.trim();
    const observacao = $('uf-obs').value.trim();
    if (!nome || !email || !perfilId) { toast('Preencha nome, e-mail e perfil.'); return; }
    if (!editando) {
      const senha = $('uf-senha').value;
      if (senha.length < 6) { toast('Senha temporária deve ter ao menos 6 caracteres.'); return; }
      const errosSenha = validarSenhaPoliticas(senha);
      if (errosSenha.length) { toast('❌ Senha não atende às políticas: ' + errosSenha.join(', ')); return; }
    }

    comCarregamento(e.currentTarget, 'Salvando...', async () => {
      if (editando) {
        const perfilAnterior = u.perfil_operacional_id;
        await updateDoc(doc(db, 'usuarios', u.id), {
          nome_exibicao: nome, setor, telefone, observacao,
          perfil_operacional_id: perfilId,
          perfil: kernelPerfilPara(perfilId),
          ultima_alteracao: serverTimestamp()
        });
        if (perfilAnterior !== perfilId) {
          await registrarAuditoria('perfil_alterado', u.id, nome, { de: perfilAnterior, para: perfilId });
        } else {
          await registrarAuditoria('usuario_editado', u.id, nome, { setor, telefone });
        }
        toast('Usuário atualizado.');
        fecharModal();
      } else {
        const senha = $('uf-senha').value;
        const uid = await criarContaSecundaria(email, senha);
        await setDoc(doc(db, 'usuarios', uid), {
          email, nome, nome_exibicao: nome, setor, telefone, observacao,
          perfil_operacional_id: perfilId,
          perfil: kernelPerfilPara(perfilId),
          status: 'ativo',
          criado_por: getUid(),
          ultima_alteracao: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge: true });
        await registrarAuditoria('usuario_criado', uid, nome, { perfil: perfilId });
        fecharModal();
        abrirModal('Conta criada', `
          <p style="font-size:13px;color:var(--text-secondary)">Anote a senha abaixo — ela não será mostrada novamente.</p>
          <div class="up-modal-senha">${esc(email)}<br>${esc(senha)}</div>
          <div class="up-modal-btns"><button class="up-btn up-btn-primary" onclick="window.__upFecharModal()">Entendi</button></div>
        `);
      }
    });
  });
}

async function toggleStatusUsuario(u) {
  const novoStatus = u.status === 'inativo' ? 'ativo' : 'inativo';
  // Guarda só se aplica a DESATIVAR — reativar nunca reduz a capacidade de
  // admin disponível, então nunca precisa ser bloqueado.
  if (novoStatus === 'inativo') {
    const ativos = usuarios.filter(x => x.status !== 'inativo');
    if (bloqueadoPorProtecaoAdmin(u, ativos,
        'Você não pode desativar a conta com a qual está logado.',
        'Não é possível desativar o último administrador ativo do sistema.')) return;
  }
  await updateDoc(doc(db, 'usuarios', u.id), { status: novoStatus, ultima_alteracao: serverTimestamp() });
  await registrarAuditoria(novoStatus === 'inativo' ? 'usuario_desativado' : 'usuario_reativado', u.id, u.nome_exibicao);
  toast(novoStatus === 'inativo' ? 'Usuário desativado.' : 'Usuário reativado.');
}

function abrirRedefinirSenha(u) {
  abrirModal('Redefinir senha — ' + (u.nome_exibicao || u.email), `
    <div class="up-modal-aviso">Sem Cloud Functions/Admin SDK neste projeto, redefinir a senha exige informar a senha atual da conta (o admin é quem a define e controla). Se não souber a senha atual, use "Enviar link por e-mail" abaixo.</div>
    <div class="up-field"><label>Senha atual</label><input class="up-input" id="rs-atual" type="text"></div>
    <div class="up-field"><label>Nova senha</label><input class="up-input" id="rs-nova" type="text" value="${gerarSenhaTemp()}"></div>
    <div class="up-modal-btns">
      <button class="up-btn" id="rs-email">Enviar link por e-mail</button>
      <button class="up-btn up-btn-primary" id="rs-salvar">Redefinir</button>
    </div>
  `);

  $('rs-salvar').addEventListener('click', (e) => {
    const atual = $('rs-atual').value;
    const nova = $('rs-nova').value;
    if (!atual || nova.length < 6) { toast('Informe a senha atual e uma nova senha com 6+ caracteres.'); return; }
    const errosSenha = validarSenhaPoliticas(nova);
    if (errosSenha.length) { toast('❌ Senha não atende às políticas: ' + errosSenha.join(', ')); return; }
    comCarregamento(e.currentTarget, 'Redefinindo...', async () => {
      await redefinirSenhaSecundaria(u.email, atual, nova);
      await registrarAuditoria('senha_redefinida', u.id, u.nome_exibicao, { via: 'senha_atual' });
      fecharModal();
      abrirModal('Senha redefinida', `
        <div class="up-modal-senha">${esc(u.email)}<br>${esc(nova)}</div>
        <div class="up-modal-btns"><button class="up-btn up-btn-primary" onclick="window.__upFecharModal()">Entendi</button></div>
      `);
    });
  });

  $('rs-email').addEventListener('click', (e) => {
    comCarregamento(e.currentTarget, 'Enviando...', async () => {
      await enviarResetPorEmail(u.email);
      await registrarAuditoria('senha_redefinida', u.id, u.nome_exibicao, { via: 'email' });
      toast('Link de redefinição enviado por e-mail.');
      fecharModal();
    });
  });
}

function abrirExcluirUsuario(u) {
  // "Último administrador" = último usuário com perfil de kernel admin/master_admin
  // entre os geridos por este módulo (usuarios[] só contém quem tem
  // perfil_operacional_id — ver iniciarListeners). Contas legadas sem esse
  // campo não entram na contagem, o que só torna o bloqueio mais restritivo,
  // nunca menos seguro. Conta TODOS (não só ativos) — excluir é definitivo,
  // independe do status atual do admin restante.
  if (bloqueadoPorProtecaoAdmin(u, usuarios,
      'Você não pode excluir a conta com a qual está logado.',
      'Não é possível excluir o último administrador do sistema.')) return;

  abrirModal('Excluir usuário — ' + (u.nome_exibicao || u.email), `
    <div class="up-modal-aviso up-aviso-danger">Esta ação é <b>definitiva</b>: o cadastro e o login (Firebase Auth) do usuário serão removidos e não poderão ser recuperados.</div>
    <div class="up-field"><label>Senha administrativa *</label><input class="up-input" id="ex-senha-admin" type="password" autocomplete="off" placeholder="Informe a senha para confirmar"></div>
    <div class="up-modal-btns">
      <button class="up-btn" onclick="window.__upFecharModal()">Cancelar</button>
      <button class="up-btn up-btn-danger" id="ex-confirmar">Excluir definitivamente</button>
    </div>
  `);

  $('ex-confirmar').addEventListener('click', (e) => {
    const senhaAdmin = $('ex-senha-admin').value;
    if (senhaAdmin !== SENHA_ADMIN_EXCLUSAO) {
      toast('Senha administrativa incorreta — exclusão cancelada.');
      return;
    }
    comCarregamento(e.currentTarget, 'Excluindo...', async () => {
      // Cloud Function (Admin SDK) faz a checagem real de quem pode excluir
      // e remove Auth + Firestore + auditoria no servidor — ver functions/index.js.
      await excluirUsuarioAdminFn({ uid: u.id });
      fecharModal();
      toast('Usuário e login excluídos definitivamente.');
    });
  });
}

// =================================================================
// ABA PERFIS
// =================================================================
function setupPerfisUI() {
  $('up-btn-novo-perfil').addEventListener('click', () => abrirFormPerfil(null));
  $('up-perfis-lista').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-acao]');
    if (!btn) return;
    const p = perfis.find(x => x.id === btn.dataset.id);
    if (!p) return;
    if (btn.dataset.acao === 'editar-perfil') abrirFormPerfil(p);
    if (btn.dataset.acao === 'toggle-perfil') comCarregamento(btn, '...', () => toggleAtivoPerfil(p));
  });
}

function renderPerfis() {
  $('up-perfis-info').textContent = `${perfis.length} perfil(is) cadastrado(s).`;
  $('up-perfis-lista').innerHTML = perfis.map(p => `
    <div class="up-perfil-card">
      <div class="up-perfil-nome">🗂️ ${esc(p.nome)} ${p.sistema ? '<span class="up-badge up-badge-sistema">padrão</span>' : ''} <span class="up-badge ${p.ativo === false ? 'up-badge-inativo' : 'up-badge-ativo'}">${p.ativo === false ? 'Inativo' : 'Ativo'}</span></div>
      <div class="up-perfil-desc">${esc(p.descricao || '—')}</div>
      <div class="up-perfil-acoes">
        <button class="up-btn up-btn-sm" data-acao="editar-perfil" data-id="${p.id}">Editar</button>
        <button class="up-btn up-btn-sm" data-acao="toggle-perfil" data-id="${p.id}">${p.ativo === false ? 'Ativar' : 'Desativar'}</button>
      </div>
    </div>
  `).join('') || '<div class="up-vazio-inline">Nenhum perfil cadastrado — use "Novo perfil".</div>';
}

function abrirFormPerfil(perfilExistente) {
  const editando = !!perfilExistente;
  const p = perfilExistente || {};
  abrirModal(editando ? 'Editar perfil' : 'Novo perfil', `
    <div class="up-field"><label>Nome *</label><input class="up-input" id="pf-nome" value="${esc(p.nome || '')}" required></div>
    <div class="up-field"><label>Descrição</label><input class="up-input" id="pf-desc" value="${esc(p.descricao || '')}"></div>
    ${editando ? '' : '<div class="up-modal-aviso">O perfil é criado com permissão apenas de visualização em todos os módulos. Ajuste a matriz na aba Permissões depois de salvar.</div>'}
    <div class="up-modal-btns">
      <button class="up-btn" onclick="window.__upFecharModal()">Cancelar</button>
      <button class="up-btn up-btn-primary" id="pf-salvar">Salvar</button>
    </div>
  `);

  $('pf-salvar').addEventListener('click', (e) => {
    const nome = $('pf-nome').value.trim();
    const descricao = $('pf-desc').value.trim();
    if (!nome) { toast('Informe o nome do perfil.'); return; }
    comCarregamento(e.currentTarget, 'Salvando...', async () => {
      if (editando) {
        await updateDoc(doc(db, 'perfis_operacionais', p.id), { nome, descricao, atualizadoEm: serverTimestamp() });
        await registrarAuditoria('perfil_editado', null, nome);
      } else {
        const id = nome.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || ('perfil-' + Date.now());
        await setDoc(doc(db, 'perfis_operacionais', id), {
          nome, descricao, sistema: false, ativo: true, permissoes: matrizVazia(true),
          criadoEm: serverTimestamp(), criadoPor: getUid(), atualizadoEm: serverTimestamp()
        });
        await registrarAuditoria('perfil_criado', null, nome);
      }
      toast('Perfil salvo.');
      fecharModal();
    });
  });
}

async function toggleAtivoPerfil(p) {
  const novo = p.ativo === false ? true : false;
  await updateDoc(doc(db, 'perfis_operacionais', p.id), { ativo: novo, atualizadoEm: serverTimestamp() });
  await registrarAuditoria('perfil_editado', null, p.nome, { ativo: novo });
  toast(novo ? 'Perfil ativado.' : 'Perfil desativado.');
}

// =================================================================
// ABA PERMISSÕES
// =================================================================
function setupPermissoesUI() {
  $('up-perm-select').addEventListener('change', (e) => carregarMatrizPerfil(e.target.value));
  $('up-btn-salvar-permissoes').addEventListener('click', (e) => comCarregamento(e.currentTarget, 'Salvando...', salvarMatrizPerfil));
  $('up-perm-tbody').addEventListener('change', (e) => {
    const chk = e.target.closest('input[type=checkbox]');
    if (!chk || !matrizEdicao) return;
    matrizEdicao[chk.dataset.modulo][chk.dataset.acao] = chk.checked;
  });
}

function renderPermissoesSelect() {
  const sel = $('up-perm-select');
  const atual = sel.value || perfilPermissoesSelecionadoId;
  sel.innerHTML = perfis.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
  if (atual && perfis.some(p => p.id === atual)) sel.value = atual;
  carregarMatrizPerfil(sel.value);
}

function carregarMatrizPerfil(perfilId) {
  perfilPermissoesSelecionadoId = perfilId;
  const perfil = perfis.find(p => p.id === perfilId);
  // Perfis salvos antes da ampliação de MODULOS (2026-07-11, 9→25) só têm
  // entrada para os módulos antigos — sem o merge abaixo, salvarMatrizPerfil()
  // e o listener de checkbox quebram ao acessar matrizEdicao[moduloNovo]
  // (undefined). Default 'false' fecha o fail-open assim que o perfil for
  // salvo, em vez de perpetuar o acesso liberado com um valor explícito 'true'.
  matrizEdicao = perfil ? { ...matrizVazia(false), ...JSON.parse(JSON.stringify(perfil.permissoes || {})) } : null;
  renderTabelaPermissoes();
}

function renderTabelaPermissoes() {
  if (!matrizEdicao) { $('up-perm-tbody').innerHTML = ''; return; }
  $('up-perm-tbody').innerHTML = MODULOS.map(mod => {
    const perm = matrizEdicao[mod.id] || { visualizar: false, criar: false, editar: false, excluir: false, aprovar: false };
    const acoes = ['visualizar', 'criar', 'editar', 'excluir'];
    const cols = acoes.map(acao => `<td><input type="checkbox" class="up-check" data-modulo="${mod.id}" data-acao="${acao}" ${perm[acao] ? 'checked' : ''}></td>`).join('');
    const aprovarCol = `<td><input type="checkbox" class="up-check" data-modulo="${mod.id}" data-acao="aprovar" ${perm.aprovar ? 'checked' : ''} ${mod.temAprovar ? '' : 'disabled'}></td>`;
    return `<tr><td>${esc(mod.nome)}</td>${cols}${aprovarCol}</tr>`;
  }).join('');
}

async function salvarMatrizPerfil() {
  if (!perfilPermissoesSelecionadoId || !matrizEdicao) { toast('Selecione um perfil.'); return; }
  // Módulos sem conceito de aprovação nunca gravam aprovar:true (campo fica no
  // documento por consistência, mas não é editável nem ativo nesses módulos).
  MODULOS.forEach(mod => { if (!mod.temAprovar) matrizEdicao[mod.id].aprovar = false; });
  const perfil = perfis.find(p => p.id === perfilPermissoesSelecionadoId);
  await updateDoc(doc(db, 'perfis_operacionais', perfilPermissoesSelecionadoId), {
    permissoes: matrizEdicao, atualizadoEm: serverTimestamp()
  });
  await registrarAuditoria('permissoes_alteradas', null, perfil ? perfil.nome : perfilPermissoesSelecionadoId);
  toast('Permissões salvas.');
}

// =================================================================
// ABA LOGS
// =================================================================
function setupLogsUI() {
  $('up-log-periodo').addEventListener('click', (e) => {
    const btn = e.target.closest('.up-chip');
    if (!btn) return;
    document.querySelectorAll('#up-log-periodo .up-chip').forEach(b => b.classList.toggle('active', b === btn));
    periodoLogs = btn.dataset.periodo;
    renderLogs();
  });
}

function dentroDoPeriodo(ts) {
  if (!ts || !ts.toDate) return false;
  const d = ts.toDate();
  const agora = new Date();
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  if (periodoLogs === 'hoje') return d >= inicioHoje;
  if (periodoLogs === 'ontem') {
    const inicioOntem = new Date(inicioHoje); inicioOntem.setDate(inicioOntem.getDate() - 1);
    return d >= inicioOntem && d < inicioHoje;
  }
  if (periodoLogs === '7dias') { const lim = new Date(inicioHoje); lim.setDate(lim.getDate() - 7); return d >= lim; }
  if (periodoLogs === '30dias') { const lim = new Date(inicioHoje); lim.setDate(lim.getDate() - 30); return d >= lim; }
  return true;
}

function renderLogs() {
  const lista = logs.filter(l => dentroDoPeriodo(l.timestamp));
  $('up-log-vazio').style.display = lista.length ? 'none' : 'block';
  $('up-log-tbody').innerHTML = lista.map(l => `
    <tr>
      <td>${fmtData(l.timestamp)}</td>
      <td>${esc(descricaoAcao(l.acao))}</td>
      <td>${esc(l.admin_nome || '—')}</td>
      <td>${esc(l.alvo_nome || '—')}</td>
      <td>${l.detalhes ? esc(JSON.stringify(l.detalhes)) : '—'}</td>
    </tr>
  `).join('');
}
