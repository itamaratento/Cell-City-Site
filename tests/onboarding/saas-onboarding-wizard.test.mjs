// Testes de UI do wizard de onboarding SaaS (Sprint 3 — Polish do Wizard).
// Monta o HTML real em jsdom e importa saas-onboarding.js real (sem cópia),
// mesma ideia de tests/rbac/helpers/dom-harness.mjs, mas isolado aqui porque
// o wizard não precisa de firestore-mock/loader de RBAC — só document/window.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import { initOnboarding } from '../../CRM/pages/saas-onboarding/saas-onboarding.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/saas-onboarding/index.html');
const HTML = readFileSync(HTML_PATH, 'utf-8');

const activeDoms = [];
after(() => {
  while (activeDoms.length) {
    try { activeDoms.pop().window.close(); } catch { /* já fechado */ }
  }
});

function montar() {
  const dom = new JSDOM(HTML, {
    url: 'http://localhost/CRM/pages/saas-onboarding/index.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  activeDoms.push(dom);
  global.document = dom.window.document;
  global.window = dom.window;
  global.location = dom.window.location;
  dom.window.Element.prototype.scrollIntoView = () => {};

  const focosChamados = [];
  const focusOriginal = dom.window.HTMLElement.prototype.focus;
  dom.window.HTMLElement.prototype.focus = function focus(...args) {
    focosChamados.push(this.id || this.tagName);
    return focusOriginal.apply(this, args);
  };
  dom.focosChamados = focosChamados;
  return dom;
}

function preencherPasso1(document, { nome = 'Loja Teste', seuNome = 'Maria', email = 'maria@loja.com', whatsapp = '(62) 99999-8888' } = {}) {
  document.getElementById('s-nome').value = nome;
  document.getElementById('s-seu-nome').value = seuNome;
  document.getElementById('s-email').value = email;
  document.getElementById('s-whatsapp').value = whatsapp;
}

function stepAtivo(document) {
  return document.querySelector('.step.active')?.getAttribute('data-step');
}

test('fluxo feliz: passo 1 -> 2 -> 3 -> sucesso', async () => {
  const dom = montar();
  const { document } = dom.window;
  const criarEmpresa = async () => ({ data: { empresaId: 'emp_1' } });
  initOnboarding({}, { criarEmpresa });

  assert.equal(stepAtivo(document), '1');
  preencherPasso1(document);
  window.Onboarding.avancar(1);
  assert.equal(stepAtivo(document), '2');

  document.getElementById('s-plano').value = 'basico';
  window.Onboarding.avancar(2);
  assert.equal(stepAtivo(document), '3');
  assert.match(document.getElementById('s-resumo').innerHTML, /Loja Teste/);

  await window.Onboarding.finalizar();
  assert.equal(stepAtivo(document), 'success');
});

test('passo 1: nome vazio mostra erro e não avança', async () => {
  const dom = montar();
  const { document } = dom.window;
  initOnboarding({}, { criarEmpresa: async () => ({ data: {} }) });

  preencherPasso1(document, { nome: '' });
  window.Onboarding.avancar(1);

  assert.equal(stepAtivo(document), '1');
  const erro = document.getElementById('s-erro');
  assert.notEqual(erro.textContent, '');
  assert.equal(erro.style.display, 'block');
});

test('voltar: passo 2 -> passo 1 limpa erro', async () => {
  const dom = montar();
  const { document } = dom.window;
  initOnboarding({}, { criarEmpresa: async () => ({ data: {} }) });

  preencherPasso1(document);
  window.Onboarding.avancar(1);
  assert.equal(stepAtivo(document), '2');

  window.Onboarding.voltar(2);
  assert.equal(stepAtivo(document), '1');
  assert.equal(document.getElementById('s-erro').style.display, 'none');
});

test('finalizar: erro da Cloud Function reabilita o botão e mostra mensagem', async () => {
  const dom = montar();
  const { document } = dom.window;
  initOnboarding({}, { criarEmpresa: async () => { throw new Error('indisponível'); } });

  preencherPasso1(document);
  window.Onboarding.avancar(1);
  document.getElementById('s-plano').value = 'trial';
  window.Onboarding.avancar(2);
  assert.equal(stepAtivo(document), '3');

  await window.Onboarding.finalizar();
  assert.equal(stepAtivo(document), '3');
  assert.match(document.getElementById('s-erro').textContent, /indisponível/);
  const btn = document.querySelector('.step.active .btn-primary');
  assert.equal(btn.disabled, false);
});

test('polish: foco automático no primeiro campo ao carregar e ao trocar de passo', async () => {
  const dom = montar();
  const { document } = dom.window;
  initOnboarding({}, { criarEmpresa: async () => ({ data: {} }) });

  assert.ok(dom.focosChamados.includes('s-nome'), 'deveria focar s-nome ao iniciar');

  preencherPasso1(document);
  window.Onboarding.avancar(1);
  assert.ok(dom.focosChamados.includes('s-plano'), 'deveria focar s-plano ao entrar no passo 2');
});

test('polish: Enter no passo 1 avança quando válido, não avança quando inválido', async () => {
  const dom = montar();
  const { document } = dom.window;
  initOnboarding({}, { criarEmpresa: async () => ({ data: {} }) });

  const KeyboardEvent = dom.window.KeyboardEvent;
  preencherPasso1(document, { nome: '' });
  document.getElementById('s-nome').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(stepAtivo(document), '1', 'inválido: continua no passo 1');

  preencherPasso1(document);
  document.getElementById('s-whatsapp').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(stepAtivo(document), '2', 'válido: avança para o passo 2 via Enter');
});

test('polish: Enter no select de plano avança para o passo 3', async () => {
  const dom = montar();
  const { document } = dom.window;
  initOnboarding({}, { criarEmpresa: async () => ({ data: {} }) });

  preencherPasso1(document);
  window.Onboarding.avancar(1);
  document.getElementById('s-plano').value = 'profissional';
  document.getElementById('s-plano').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(stepAtivo(document), '3');
});

test('polish: erro recebe foco (region de alerta acessível)', async () => {
  const dom = montar();
  const { document } = dom.window;
  initOnboarding({}, { criarEmpresa: async () => ({ data: {} }) });

  preencherPasso1(document, { email: 'invalido' });
  window.Onboarding.avancar(1);

  assert.ok(dom.focosChamados.includes('s-erro'), 'deveria focar o bloco de erro ao falhar validação');
});

test('polish: indicador de passos atualiza aria-current e aria-valuenow', async () => {
  const dom = montar();
  const { document } = dom.window;
  initOnboarding({}, { criarEmpresa: async () => ({ data: {} }) });

  const indicador = document.getElementById('steps');
  assert.equal(indicador.getAttribute('aria-valuenow'), '1');
  assert.equal(document.querySelector('.step-dot[data-step="1"]').getAttribute('aria-current'), 'step');

  preencherPasso1(document);
  window.Onboarding.avancar(1);

  assert.equal(indicador.getAttribute('aria-valuenow'), '2');
  assert.equal(document.querySelector('.step-dot[data-step="2"]').getAttribute('aria-current'), 'step');
  assert.equal(document.querySelector('.step-dot[data-step="1"]').hasAttribute('aria-current'), false);
});

test('polish: campos têm maxlength alinhado à validação e erro tem role=alert', () => {
  const dom = montar();
  const { document } = dom.window;
  assert.equal(document.getElementById('s-nome').maxLength, 80);
  assert.equal(document.getElementById('s-seu-nome').maxLength, 80);
  assert.equal(document.getElementById('s-email').maxLength, 120);
  assert.equal(document.getElementById('s-erro').getAttribute('role'), 'alert');
});
