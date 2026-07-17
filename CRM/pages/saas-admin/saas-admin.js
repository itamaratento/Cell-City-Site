/* ============================================================
   SAAS-ADMIN.JS — Console do Operador da Plataforma (Sprint 4)
   Cell City Gestão Empresarial

   CRUD de empresas (Sprint 1, extraído do <script> inline do
   index.html) + fluxo de aprovação de empresas criadas pelo
   onboarding self-service (Sprint 3).

   Dependência declarada em functions/saas.js (saasOnboardingCriarEmpresa):
   "a empresa nasce com status 'pendente_aprovacao'... o operador
   (master_admin) aprova no saas-admin" — esta é a primeira
   implementação desse lado da promessa.

   Aprovar uma empresa pendente:
   1. Cria a conta Auth do responsável (firebase-secondary.js, app
      isolado — não derruba a sessão do master_admin).
   2. Grava usuarios/{uid} com empresa_id = empresa aprovada e
      perfil 'admin' (primeiro usuário da empresa, dono da conta).
   3. Atualiza empresas/{id}.status para 'ativo' (ou 'trial' se o
      plano escolhido for trial) e registra data/quem aprovou.
   4. Loga em auditoria_saas via shared/saas-auditoria.js (módulo já
      existente desde PS-5, sem nenhum consumidor até esta sprint).
   ============================================================ */
import { initModulo } from '../../scripts/kernel.js';
import { db, collection, getDocs, doc, setDoc, updateDoc, query, orderBy, serverTimestamp } from '../../scripts/firebase.js';
import { getPlano } from '../../shared/saas-planos.js';
import { logAcao } from '../../shared/saas-auditoria.js';
import { criarContaSecundaria } from './firebase-secondary.js';

const COL = 'empresas';

const STATUS_LABEL = {
  ativo: 'ativo',
  trial: 'trial',
  bloqueado: 'bloqueado',
  cancelado: 'cancelado',
  inativa: 'inativa',
  pendente_aprovacao: 'aguardando aprovação',
  rejeitada: 'rejeitada',
};

function gerarSenhaTemp() {
  // crypto.getRandomValues() em vez de Math.random() — achado da auditoria
  // técnica independente 2026-07-17: Math.random() não é criptograficamente
  // seguro, e isto gera a senha temporária de uma credencial real.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[bytes[i] % chars.length];
  return s;
}

/** Empresa aprovada nasce 'trial' se o plano escolhido é o plano trial, senão 'ativo'. */
export function statusAposAprovacao(planoId) {
  const plano = getPlano(planoId);
  return plano.trial ? 'trial' : 'ativo';
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function initSaasAdmin() {
  let cache = [];
  let masterUid = null;

  function cardHtml(e) {
    const pendente = e.status === 'pendente_aprovacao';
    const acoesPendente = pendente ? `
        <button class="btn btn-primary" style="padding:6px 12px;font-size:12px;" data-acao="aprovar" data-id="${e.id}">✅ Aprovar</button>
        <button class="btn btn-danger" style="padding:6px 12px;font-size:12px;" data-acao="rejeitar" data-id="${e.id}">🚫 Rejeitar</button>
    ` : `
        <button class="btn" style="padding:6px 12px;font-size:12px;" data-acao="editar" data-id="${e.id}">✏️ Editar</button>
        <button class="btn btn-danger" style="padding:6px 12px;font-size:12px;" data-acao="desativar" data-id="${e.id}">🚫 Desativar</button>
    `;
    return `
      <div class="empresa-card${pendente ? ' empresa-card-pendente' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <div>
            <h3>${esc(e.nome_fantasia || e.id)}</h3>
            <div style="font-size:12px;color:#888;">${esc(e.id)} · ${esc(e.plano || '—')}</div>
          </div>
          <span class="status status-${e.status || 'ativo'}">${esc(STATUS_LABEL[e.status] || e.status || 'ativo')}</span>
        </div>
        <div style="font-size:13px;color:#666;margin:8px 0;">${esc(e.razao_social || '')}</div>
        ${pendente ? `<div style="font-size:12px;color:#666;">${esc(e.contato_nome || '')} · ${esc(e.contato_email || '')}</div>` : ''}
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">${acoesPendente}</div>
      </div>
    `;
  }

  async function carregar() {
    const snap = await getDocs(query(collection(db, COL), orderBy('nome_fantasia')));
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Pendentes de aprovação sempre no topo — é a fila de trabalho do operador.
    lista.sort((a, b) => (a.status === 'pendente_aprovacao' ? 0 : 1) - (b.status === 'pendente_aprovacao' ? 0 : 1));
    cache = lista;
    const grid = document.getElementById('saas-grid');
    if (grid) grid.innerHTML = lista.map(cardHtml).join('');
  }

  function mostrarForm(dados) {
    document.getElementById('saas-form').classList.remove('hidden');
    document.getElementById('form-titulo').textContent = dados ? 'Editar Empresa' : 'Nova Empresa';
    document.getElementById('f-id').value = dados?.id || '';
    document.getElementById('f-id').disabled = !!dados;
    document.getElementById('f-nome').value = dados?.nome_fantasia || '';
    document.getElementById('f-razao').value = dados?.razao_social || '';
    document.getElementById('f-plano').value = dados?.plano || 'enterprise';
    document.getElementById('f-status').value = dados?.status || 'ativo';
    document.getElementById('f-vencimento').value = dados?.data_vencimento || '';
  }

  function fecharForm() {
    document.getElementById('saas-form').classList.add('hidden');
    document.getElementById('f-id').disabled = false;
  }

  async function salvar() {
    const id = document.getElementById('f-id').value.trim();
    if (!id) { alert('ID da empresa é obrigatório'); return; }
    const editando = document.getElementById('f-id').disabled;
    const dados = {
      nome_fantasia: document.getElementById('f-nome').value.trim(),
      razao_social: document.getElementById('f-razao').value.trim(),
      plano: document.getElementById('f-plano').value,
      status: document.getElementById('f-status').value,
      data_vencimento: document.getElementById('f-vencimento').value || null,
      atualizadoEm: serverTimestamp(),
    };
    // Empresa NOVA nasce sem dado legado → filtros tenant ativos.
    // Nunca tocar em dados_migrados ao EDITAR: em produção o flag
    // só pode virar true depois do backfill validado.
    if (!editando) dados.dados_migrados = true;
    await setDoc(doc(db, COL, id), dados, { merge: true });
    fecharForm();
    await carregar();
  }

  // PS-6: exclusão física é proibida nas Rules (delete: false) — o
  // histórico da empresa é preservado; desativa via status.
  async function desativar(id) {
    if (!confirm(`Desativar a empresa ${id}? Os usuários dela perdem o acesso.`)) return;
    await updateDoc(doc(db, COL, id), { status: 'inativa', atualizadoEm: serverTimestamp() });
    await carregar();
  }

  function abrirModalAprovar(empresa) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const senha = gerarSenhaTemp();
    overlay.innerHTML = `
      <div class="modal-box">
        <h3>Aprovar ${esc(empresa.nome_fantasia || empresa.id)}</h3>
        <p style="font-size:13px;color:#666;">Cria a conta do administrador da empresa. Anote a senha — ela só aparece uma vez.</p>
        <label>Nome do responsável</label><input id="ap-nome" value="${esc(empresa.contato_nome || '')}">
        <label>E-mail (login)</label><input id="ap-email" type="email" value="${esc(empresa.contato_email || '')}">
        <label>Senha temporária</label><input id="ap-senha" value="${esc(senha)}">
        <div style="display:flex;gap:8px;margin-top:16px;">
          <button class="btn btn-primary" id="ap-confirmar">✅ Aprovar e criar conta</button>
          <button class="btn" id="ap-cancelar">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#ap-cancelar').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#ap-confirmar').addEventListener('click', async (ev) => {
      const nome = overlay.querySelector('#ap-nome').value.trim();
      const email = overlay.querySelector('#ap-email').value.trim().toLowerCase();
      const senhaEscolhida = overlay.querySelector('#ap-senha').value;
      if (!nome || !email || senhaEscolhida.length < 6) {
        alert('Informe nome, e-mail válido e senha com ao menos 6 caracteres.');
        return;
      }
      const btn = ev.currentTarget;
      btn.disabled = true;
      btn.textContent = '⏳ Criando...';
      try {
        const uid = await criarContaSecundaria(email, senhaEscolhida);
        await setDoc(doc(db, 'usuarios', uid), {
          email,
          nome,
          nome_exibicao: nome,
          empresa_id: empresa.id,
          perfil: 'admin',
          status: 'ativo',
          criado_por: masterUid,
          origem: 'saas-admin-aprovacao',
          ultima_alteracao: serverTimestamp(),
          createdAt: serverTimestamp(),
        }, { merge: true });
        const novoStatus = statusAposAprovacao(empresa.plano);
        await updateDoc(doc(db, COL, empresa.id), {
          status: novoStatus,
          data_aprovacao: serverTimestamp(),
          aprovado_por: masterUid,
          atualizadoEm: serverTimestamp(),
        });
        await logAcao('empresa_aprovada', { empresa_id: empresa.id, admin_uid: uid, admin_email: email, novo_status: novoStatus });
        overlay.remove();
        await carregar();
      } catch (e) {
        alert('Erro ao aprovar: ' + (e.message || e));
        btn.disabled = false;
        btn.textContent = '✅ Aprovar e criar conta';
      }
    });
  }

  async function rejeitar(empresa) {
    if (!confirm(`Rejeitar o cadastro de ${empresa.nome_fantasia || empresa.id}? A empresa não terá acesso liberado.`)) return;
    await updateDoc(doc(db, COL, empresa.id), {
      status: 'rejeitada',
      rejeitado_por: masterUid,
      data_rejeicao: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    await logAcao('empresa_rejeitada', { empresa_id: empresa.id });
    await carregar();
  }

  function editar(id) {
    const dados = cache.find(e => e.id === id);
    mostrarForm(dados || { id });
  }

  document.getElementById('saas-grid')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-acao]');
    if (!btn) return;
    const empresa = cache.find(e => e.id === btn.dataset.id);
    if (!empresa) return;
    if (btn.dataset.acao === 'editar') editar(empresa.id);
    if (btn.dataset.acao === 'desativar') desativar(empresa.id);
    if (btn.dataset.acao === 'aprovar') abrirModalAprovar(empresa);
    if (btn.dataset.acao === 'rejeitar') rejeitar(empresa);
  });

  window.SaaSAdmin = { carregar, mostrarForm, editar, fecharForm, salvar, desativar };

  return (async () => {
    const ctx = await initModulo();
    if (!ctx) { window.location.href = '../../login.html'; return; }
    // Console do operador da plataforma — só master_admin. As Rules já
    // barram escrita/leitura cross-empresa; o gate aqui é UX.
    if (ctx.perfil !== 'master_admin') {
      document.body.innerHTML = '<div style="padding:40px;text-align:center;font-family:sans-serif;">🔒 Acesso restrito ao operador da plataforma (master_admin).</div>';
      return;
    }
    masterUid = ctx.uid;
    await carregar();
  })();
}
