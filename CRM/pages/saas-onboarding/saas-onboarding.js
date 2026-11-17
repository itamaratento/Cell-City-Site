/* ============================================================
   SAAS ONBOARDING — Wizard 3 passos (Sprint 3)
   Cadastro público via Cloud Function saasOnboardingCriarEmpresa.
   ============================================================ */
import { FLAGS, URLS } from '../../shared/app-config.js';
import { PLANOS } from '../../shared/saas-planos.js';
import {
  validarPassoEmpresa,
  validarPlano,
  normalizarEmail,
  digitosTelefone,
} from '../../shared/saas-onboarding-validacao.js';
import { escHtml } from '../../shared/sanitize.js';

const PLANOS_VALIDOS = Object.keys(PLANOS);

function $(id) {
  return document.getElementById(id);
}

function mostrarErro(msg) {
  const el = $('s-erro');
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.style.display = 'block';
    el.focus();
  } else {
    el.textContent = '';
    el.style.display = 'none';
  }
}

const STEP_LABELS = { 1: 'Dados da empresa', 2: 'Escolha do plano', 3: 'Confirmação' };

function focarPrimeiroCampo(step) {
  const alvo = document.querySelector(`.step[data-step="${step}"] input, .step[data-step="${step}"] select`);
  alvo?.focus();
}

function ativarAvancoPorEnter(inputId, avancarStep) {
  $(inputId)?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      window.Onboarding?.avancar(avancarStep);
    }
  });
}

function montarSelectPlanos() {
  const sel = $('s-plano');
  if (!sel || sel.options.length > 0) return;
  const ordem = ['trial', 'basico', 'profissional', 'enterprise'];
  sel.innerHTML = ordem.map((id) => {
    const p = PLANOS[id];
    return `<option value="${id}">${p.nome}${p.trial ? ' — 30 dias grátis' : ''}</option>`;
  }).join('');
  sel.value = 'enterprise';
}

function textoPreco(planoId) {
  const p = PLANOS[planoId];
  if (!p) return '';
  const trial = p.trial || planoId === 'trial';
  const subtitulo = trial ? 'Período de teste: 30 dias' : (p.modulos ? `${p.modulos.length} módulos incluídos` : 'Todos os módulos');
  return `<div style="font-size:28px;font-weight:700;color:#1a237e;">Grátis</div><div style="font-size:13px;color:#666;">${subtitulo}</div>`;
}

export function initOnboarding(_firebaseApp, { criarEmpresa }) {
  if (!criarEmpresa || typeof criarEmpresa !== 'function') {
    throw new Error('initOnboarding: criarEmpresa callable é obrigatório');
  }
  if (!FLAGS.SAAS_ONBOARDING_ATIVO) {
    document.querySelector('.onboard-card')?.replaceWith(
      Object.assign(document.createElement('div'), {
        className: 'onboard-card',
        innerHTML: '<h1>Onboarding indisponível</h1><p class="sub">O cadastro self-service está temporariamente desativado. Fale com o suporte Cell City.</p>',
      })
    );
    return;
  }

  montarSelectPlanos();
  $('s-plano')?.addEventListener('change', () => {
    const el = $('s-preco');
    if (el) el.innerHTML = textoPreco($('s-plano').value);
  });
  const precoEl = $('s-preco');
  if (precoEl) precoEl.innerHTML = textoPreco($('s-plano')?.value || 'enterprise');

  const dados = { currentStep: 1 };

  function irPara(step) {
    document.querySelectorAll('.step').forEach((s) => s.classList.remove('active'));
    document.querySelectorAll('.step-dot').forEach((d) => { d.classList.remove('active', 'done'); d.removeAttribute('aria-current'); });
    const target = step === 4 ? 'success' : step;
    document.querySelector(`.step[data-step="${target}"]`)?.classList.add('active');
    for (let i = 1; i < step; i++) {
      document.querySelector(`.step-dot[data-step="${i}"]`)?.classList.add('done');
    }
    const dotAtual = Math.min(step, 3);
    document.querySelector(`.step-dot[data-step="${dotAtual}"]`)?.classList.add('active');
    document.querySelector(`.step-dot[data-step="${dotAtual}"]`)?.setAttribute('aria-current', 'step');
    const indicador = $('steps');
    if (indicador) {
      indicador.setAttribute('aria-valuenow', String(dotAtual));
      indicador.setAttribute('aria-label', `Passo ${dotAtual} de 3: ${STEP_LABELS[dotAtual] || ''}`);
    }
    dados.currentStep = step;
    if (step <= 3) focarPrimeiroCampo(step);
  }

  function montarResumo() {
    const planoId = $('s-plano')?.value || dados.plano;
    const plano = PLANOS[planoId];
    $('s-resumo').innerHTML = `
      <div><strong>Empresa:</strong> ${escHtml(dados.nome)}</div>
      <div><strong>Responsável:</strong> ${escHtml(dados.seuNome)}</div>
      <div><strong>E-mail:</strong> ${escHtml(dados.email)}</div>
      <div><strong>WhatsApp:</strong> ${escHtml(dados.whatsapp)}</div>
      <div><strong>Plano:</strong> ${escHtml(plano?.nome || planoId)}</div>
      <div style="margin-top:8px;font-size:12px;color:#666;">Após aprovação do operador, você receberá instruções de acesso.</div>
    `;
  }

  window.Onboarding = {
    avancar(from) {
      if (from === 1) {
        const err = validarPassoEmpresa({
          nome: $('s-nome')?.value,
          seuNome: $('s-seu-nome')?.value,
          email: $('s-email')?.value,
          whatsapp: $('s-whatsapp')?.value,
        });
        if (err) { mostrarErro(err); return; }
        mostrarErro(null);
        dados.nome = $('s-nome').value.trim();
        dados.seuNome = $('s-seu-nome').value.trim();
        dados.email = normalizarEmail($('s-email').value);
        dados.whatsapp = digitosTelefone($('s-whatsapp').value);
      }
      if (from === 2) {
        const planoId = $('s-plano')?.value;
        const err = validarPlano(planoId, PLANOS_VALIDOS);
        if (err) { mostrarErro(err); return; }
        mostrarErro(null);
        dados.plano = planoId;
        montarResumo();
      }
      irPara(from + 1);
    },
    voltar(from) {
      mostrarErro(null);
      irPara(from - 1);
    },
    atualizarPreco() {
      const el = $('s-preco');
      if (el) el.innerHTML = textoPreco($('s-plano')?.value);
    },
    async finalizar() {
      const btn = document.querySelector('.step.active .btn-primary');
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Criando...'; }
      try {
        const resp = await criarEmpresa({
          nome: dados.nome,
          seuNome: dados.seuNome,
          email: dados.email,
          whatsapp: dados.whatsapp,
          plano: dados.plano || 'trial',
        });
        dados.empresaId = resp.data?.empresaId || null;
        irPara(4);
      } catch (err) {
        mostrarErro('Erro: ' + (err.message || 'Não foi possível criar a conta.'));
        if (btn) { btn.disabled = false; btn.textContent = '✅ Criar Conta'; }
      }
    },
    irParaLogin() {
      window.location.href = URLS.login();
    },
  };

  $('btn-login')?.addEventListener('click', () => window.Onboarding.irParaLogin());

  ['s-nome', 's-seu-nome', 's-email', 's-whatsapp'].forEach((id) => ativarAvancoPorEnter(id, 1));
  ativarAvancoPorEnter('s-plano', 2);
  focarPrimeiroCampo(1);
}
