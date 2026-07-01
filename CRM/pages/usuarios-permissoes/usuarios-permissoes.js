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
   usuarios/{uid}.perfil (senão o kernel.js assume 'admin' por padrão
   na sessão — ver _buildContext), mapeamos cada perfil operacional
   para o nível mínimo sensato do kernel em PERFIL_OPERACIONAL_PARA_KERNEL.
   A aplicação fina de permissões dentro dos módulos existentes fica
   para fases futuras (gradual, um módulo por vez).
   ============================================================ */
import { initModulo, temPermissao, getUid, getNome } from '../../scripts/kernel.js';
import {
  db, collection, addDoc, doc, setDoc, updateDoc,
  query, orderBy, onSnapshot, serverTimestamp, limit
} from '../../scripts/firebase.js';
import { criarContaSecundaria, redefinirSenhaSecundaria, enviarResetPorEmail } from './firebase-secondary.js';

// ── Catálogo de módulos (matriz de permissões) ─────────────────
const MODULOS = [
  { id: 'dashboard',     nome: 'Dashboard',      temAprovar: false },
  { id: 'os',            nome: 'OS',              temAprovar: false },
  { id: 'caixa',         nome: 'Caixa',           temAprovar: true  },
  { id: 'estoque',       nome: 'Estoque',         temAprovar: false },
  { id: 'financeiro',    nome: 'Financeiro',      temAprovar: true  },
  { id: 'crm',           nome: 'CRM',             temAprovar: false },
  { id: 'agenda',        nome: 'Agenda',          temAprovar: false },
  { id: 'relatorios',    nome: 'Relatórios',      temAprovar: false },
  { id: 'configuracoes', nome: 'Configurações',   temAprovar: false },
];

function matrizVazia(padraoVisualizar = true) {
  const m = {};
  MODULOS.forEach(mod => {
    m[mod.id] = { visualizar: padraoVisualizar, criar: false, editar: false, excluir: false, aprovar: false };
  });
  return m;
}
function matrizComExtras(extras) {
  const m = matrizVazia(true);
  Object.entries(extras || {}).forEach(([modId, perms]) => {
    if (m[modId]) Object.assign(m[modId], perms);
  });
  return m;
}
function matrizTotal() {
  const m = {};
  MODULOS.forEach(mod => { m[mod.id] = { visualizar: true, criar: true, editar: true, excluir: true, aprovar: true }; });
  return m;
}

// ── Perfis padrão (Seed) ────────────────────────────────────────
const PERFIS_SEED = [
  { id: 'administrador', nome: 'Administrador', descricao: 'Acesso total a todos os módulos.', matriz: matrizTotal() },
  { id: 'financeiro',    nome: 'Financeiro',     descricao: 'Contas a pagar/receber, caixa e relatórios financeiros.',
    matriz: matrizComExtras({ financeiro: { criar: true, editar: true, excluir: true, aprovar: true }, caixa: { criar: true, editar: true, aprovar: true } }) },
  { id: 'caixa',         nome: 'Caixa',          descricao: 'Operação do caixa e abertura de OS.',
    matriz: matrizComExtras({ caixa: { criar: true, editar: true, aprovar: true }, os: { criar: true, editar: true } }) },
  { id: 'estoque',       nome: 'Estoque',        descricao: 'Cadastro e controle de produtos em estoque.',
    matriz: matrizComExtras({ estoque: { criar: true, editar: true, excluir: true } }) },
  { id: 'tecnico',       nome: 'Técnico',        descricao: 'Execução e atualização de ordens de serviço.',
    matriz: matrizComExtras({ os: { criar: true, editar: true, excluir: true }, agenda: { criar: true, editar: true } }) },
  { id: 'comercial',     nome: 'Comercial',      descricao: 'CRM comercial, leads e relacionamento com clientes.',
    matriz: matrizComExtras({ crm: { criar: true, editar: true, excluir: true }, agenda: { criar: true, editar: true } }) },
  { id: 'atendimento',   nome: 'Atendimento',    descricao: 'Recepção, abertura de atendimento e agenda.',
    matriz: matrizComExtras({ agenda: { criar: true, editar: true }, os: { criar: true } }) },
];

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

// ── Contas padrão (Seed) ────────────────────────────────────────
const CONTAS_SEED = [
  { local: 'caixa01',       nome: 'Caixa 01',       perfilId: 'caixa',       setor: 'Caixa' },
  { local: 'caixa02',       nome: 'Caixa 02',       perfilId: 'caixa',       setor: 'Caixa' },
  { local: 'tecnico01',     nome: 'Técnico 01',     perfilId: 'tecnico',     setor: 'Técnico' },
  { local: 'tecnico02',     nome: 'Técnico 02',     perfilId: 'tecnico',     setor: 'Técnico' },
  { local: 'financeiro01',  nome: 'Financeiro 01',  perfilId: 'financeiro',  setor: 'Financeiro' },
  { local: 'financeiro02',  nome: 'Financeiro 02',  perfilId: 'financeiro',  setor: 'Financeiro' },
  { local: 'estoque01',     nome: 'Estoque 01',     perfilId: 'estoque',     setor: 'Estoque' },
  { local: 'atendimento01', nome: 'Atendimento 01', perfilId: 'atendimento', setor: 'Atendimento' },
];

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
const fmtData = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

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
  return (e && e.message) || 'Falha na operação.';
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
    if (btn.dataset.acao === 'toggle-status') toggleStatusUsuario(u);
    if (btn.dataset.acao === 'redefinir-senha') abrirRedefinirSenha(u);
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
      <td>${fmtData(u.ultima_alteracao)}</td>
      <td style="white-space:nowrap">
        <button class="up-btn up-btn-sm" data-acao="editar" data-uid="${u.id}">Editar</button>
        <button class="up-btn up-btn-sm" data-acao="redefinir-senha" data-uid="${u.id}">Senha</button>
        <button class="up-btn up-btn-sm ${inativo ? '' : 'up-btn-danger'}" data-acao="toggle-status" data-uid="${u.id}">${inativo ? 'Reativar' : 'Desativar'}</button>
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

  $('uf-salvar').addEventListener('click', async () => {
    const nome = $('uf-nome').value.trim();
    const email = $('uf-email').value.trim();
    const perfilId = $('uf-perfil').value;
    const setor = $('uf-setor').value.trim();
    const telefone = $('uf-telefone').value.trim();
    const observacao = $('uf-obs').value.trim();
    if (!nome || !email || !perfilId) { toast('Preencha nome, e-mail e perfil.'); return; }

    try {
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
        if (senha.length < 6) { toast('Senha temporária deve ter ao menos 6 caracteres.'); return; }
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
    } catch (e) {
      console.error(e);
      toast(traduzErroAuth(e));
    }
  });
}

async function toggleStatusUsuario(u) {
  const novoStatus = u.status === 'inativo' ? 'ativo' : 'inativo';
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

  $('rs-salvar').addEventListener('click', async () => {
    const atual = $('rs-atual').value;
    const nova = $('rs-nova').value;
    if (!atual || nova.length < 6) { toast('Informe a senha atual e uma nova senha com 6+ caracteres.'); return; }
    try {
      await redefinirSenhaSecundaria(u.email, atual, nova);
      await registrarAuditoria('senha_redefinida', u.id, u.nome_exibicao, { via: 'senha_atual' });
      fecharModal();
      abrirModal('Senha redefinida', `
        <div class="up-modal-senha">${esc(u.email)}<br>${esc(nova)}</div>
        <div class="up-modal-btns"><button class="up-btn up-btn-primary" onclick="window.__upFecharModal()">Entendi</button></div>
      `);
    } catch (e) {
      console.error(e);
      toast(traduzErroAuth(e));
    }
  });

  $('rs-email').addEventListener('click', async () => {
    try {
      await enviarResetPorEmail(u.email);
      await registrarAuditoria('senha_redefinida', u.id, u.nome_exibicao, { via: 'email' });
      toast('Link de redefinição enviado por e-mail.');
      fecharModal();
    } catch (e) {
      console.error(e);
      toast(traduzErroAuth(e));
    }
  });
}

// =================================================================
// ABA PERFIS
// =================================================================
function setupPerfisUI() {
  $('up-btn-novo-perfil').addEventListener('click', () => abrirFormPerfil(null));
  $('up-btn-seed').addEventListener('click', executarSeed);
  $('up-perfis-lista').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-acao]');
    if (!btn) return;
    const p = perfis.find(x => x.id === btn.dataset.id);
    if (!p) return;
    if (btn.dataset.acao === 'editar-perfil') abrirFormPerfil(p);
    if (btn.dataset.acao === 'toggle-perfil') toggleAtivoPerfil(p);
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
  `).join('') || '<div class="up-vazio-inline">Nenhum perfil cadastrado — use "Seed inicial" ou "Novo perfil".</div>';
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

  $('pf-salvar').addEventListener('click', async () => {
    const nome = $('pf-nome').value.trim();
    const descricao = $('pf-desc').value.trim();
    if (!nome) { toast('Informe o nome do perfil.'); return; }
    try {
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
    } catch (e) {
      console.error(e);
      toast('Falha ao salvar perfil: ' + (e.message || e));
    }
  });
}

async function toggleAtivoPerfil(p) {
  const novo = p.ativo === false ? true : false;
  await updateDoc(doc(db, 'perfis_operacionais', p.id), { ativo: novo, atualizadoEm: serverTimestamp() });
  await registrarAuditoria('perfil_editado', null, p.nome, { ativo: novo });
  toast(novo ? 'Perfil ativado.' : 'Perfil desativado.');
}

async function executarSeed() {
  abrirModal('Seed inicial', `
    <p style="font-size:13px;color:var(--text-secondary)">Cria os 7 perfis padrão e as 8 contas funcionais padrão. Contas já existentes (mesmo e-mail) são ignoradas.</p>
    <div class="up-field"><label>Modelo de e-mail (use <code>{conta}</code> como marcador)</label>
      <input class="up-input" id="seed-modelo" placeholder="seuemail+{conta}@gmail.com" value="seuemail+{conta}@gmail.com"></div>
    <div class="up-modal-aviso">Dica: com Gmail, "seuemail+caixa01@gmail.com" chega na mesma caixa de entrada de "seuemail@gmail.com", mas o Firebase trata como e-mails distintos.</div>
    <div class="up-modal-btns">
      <button class="up-btn" onclick="window.__upFecharModal()">Cancelar</button>
      <button class="up-btn up-btn-primary" id="seed-executar">Executar Seed</button>
    </div>
  `);

  $('seed-executar').addEventListener('click', async () => {
    const modelo = $('seed-modelo').value.trim();
    if (!modelo.includes('{conta}')) { toast('O modelo de e-mail precisa conter {conta}.'); return; }
    fecharModal();
    toast('Executando seed — aguarde...');

    for (const perfil of PERFIS_SEED) {
      await setDoc(doc(db, 'perfis_operacionais', perfil.id), {
        nome: perfil.nome, descricao: perfil.descricao, sistema: true, ativo: true,
        permissoes: perfil.matriz, criadoEm: serverTimestamp(), criadoPor: getUid(), atualizadoEm: serverTimestamp()
      }, { merge: true });
    }
    await registrarAuditoria('perfil_criado', null, 'Seed de 7 perfis padrão');

    const credenciais = [];
    for (const conta of CONTAS_SEED) {
      const email = modelo.replace('{conta}', conta.local);
      const senha = gerarSenhaTemp();
      try {
        const uid = await criarContaSecundaria(email, senha);
        await setDoc(doc(db, 'usuarios', uid), {
          email, nome: conta.nome, nome_exibicao: conta.nome, setor: conta.setor,
          perfil_operacional_id: conta.perfilId, perfil: kernelPerfilPara(conta.perfilId),
          status: 'ativo', conta_padrao: true, criado_por: getUid(),
          ultima_alteracao: serverTimestamp(), createdAt: serverTimestamp()
        }, { merge: true });
        credenciais.push({ email, senha, ok: true });
      } catch (e) {
        credenciais.push({ email, senha: '—', ok: false, erro: traduzErroAuth(e) });
      }
    }
    await registrarAuditoria('usuario_criado', null, 'Seed de 8 contas padrão');

    abrirModal('Seed concluído — anote as credenciais', `
      <p style="font-size:13px;color:var(--text-secondary)">Estas senhas não serão exibidas novamente.</p>
      <table class="up-senha-tabela">${credenciais.map(c => `<tr><td>${esc(c.email)}</td><td>${c.ok ? esc(c.senha) : 'já existia / erro'}</td></tr>`).join('')}</table>
      <div class="up-modal-btns"><button class="up-btn up-btn-primary" onclick="window.__upFecharModal()">Entendi</button></div>
    `);
  });
}

// =================================================================
// ABA PERMISSÕES
// =================================================================
function setupPermissoesUI() {
  $('up-perm-select').addEventListener('change', (e) => carregarMatrizPerfil(e.target.value));
  $('up-btn-salvar-permissoes').addEventListener('click', salvarMatrizPerfil);
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
  matrizEdicao = perfil ? JSON.parse(JSON.stringify(perfil.permissoes || matrizVazia())) : null;
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
