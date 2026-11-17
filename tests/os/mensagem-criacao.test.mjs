/**
 * Testes da mensagem de criação de OS + sugestão de categoria.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  montarMensagemCriacao,
  sugerirCategoriaPorModelo,
  linkPortalClienteOS,
  PORTAL_CLIENTE_URL,
} from '../../CRM/pages/os/mensagem-criacao.js';

const BASE_OS = {
  id: 'OS-0042',
  clientName: 'Maria Silva Santos',
  brand: 'Samsung',
  model: 'Galaxy A54',
  phone: '(11) 98765-4321',
  phoneDigits: '11987654321',
  valor: 350,
  prazoGarantia: 90,
};

test('mensagem de criação inclui nome, OS, aparelho, valor, garantia e link com tel/os', () => {
  const msg = montarMensagemCriacao(BASE_OS);
  assert.match(msg, /Olá, Maria!/);
  assert.match(msg, /OS Nº/);
  assert.match(msg, /OS-0042/);
  assert.match(msg, /Samsung Galaxy A54/);
  assert.match(msg, /R\$\s*350([.,]00)?/);
  assert.match(msg, /90 dias/);
  assert.ok(msg.includes(`${PORTAL_CLIENTE_URL}?tel=11987654321&os=OS-0042`));
  assert.doesNotMatch(msg, /wa\.me/);
});

test('sem valor: mensagem omite linha de valor', () => {
  const msg = montarMensagemCriacao({ ...BASE_OS, valor: 0 });
  assert.doesNotMatch(msg, /\*Valor:\*/);
  assert.match(msg, /90 dias/);
});

test('linkPortalClienteOS monta query tel e os', () => {
  assert.equal(
    linkPortalClienteOS(BASE_OS),
    `${PORTAL_CLIENTE_URL}?tel=11987654321&os=OS-0042`
  );
});

test('sugerirCategoriaPorModelo: notebook', () => {
  assert.equal(sugerirCategoriaPorModelo('Notebook Dell Inspiron'), 'notebook');
  assert.equal(sugerirCategoriaPorModelo('Acer Aspire 5'), 'notebook');
  assert.equal(sugerirCategoriaPorModelo('Lenovo Ideapad'), 'notebook');
});

test('sugerirCategoriaPorModelo: impressora', () => {
  assert.equal(sugerirCategoriaPorModelo('Impressora Epson EcoTank'), 'impressora');
  assert.equal(sugerirCategoriaPorModelo('HP Tank 416'), 'impressora');
});

test('sugerirCategoriaPorModelo: sem pista → null', () => {
  assert.equal(sugerirCategoriaPorModelo('iPhone 13'), null);
  assert.equal(sugerirCategoriaPorModelo(''), null);
});
