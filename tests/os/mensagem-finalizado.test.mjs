/**
 * Testes da mensagem WhatsApp de OS finalizada.
 * Cobre garantia (com/sem/geral/personalizada), portal, emojis e ausência de JS.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  montarMensagemFinalizado,
  msgFinalizadoPadrao,
  templateFinalizadoInvalido,
  formatarGarantia,
  formatarValidadeGarantia,
  PORTAL_CLIENTE_URL,
} from '../../CRM/pages/os/mensagem-finalizado.js';

const BASE_OS = {
  id: 'OS-2026-0042',
  clientName: 'Maria Silva Santos',
  brand: 'Samsung',
  model: 'Galaxy A54',
  defect: 'Troca de tela',
  createdAt: '2026-04-18T12:00:00.000Z',
  prazoGarantia: 90,
};

function assertSemJsVisivel(msg) {
  assert.doesNotMatch(msg, /\{validade\s*\?/);
  assert.doesNotMatch(msg, /\{\{#if/);
  assert.doesNotMatch(msg, /\{\{/);
  assert.doesNotMatch(msg, /\?\s*'📅/);
  assert.doesNotMatch(msg, /validade \?/);
}

function assertEstruturaBase(msg) {
  assert.match(msg, /Olá, Maria! 👋/);
  assert.match(msg, /Sua Ordem de Serviço foi finalizada com sucesso/);
  assert.match(msg, /OS Nº/);
  assert.match(msg, /OS-2026-0042/);
  assert.match(msg, /Aparelho/);
  assert.match(msg, /Samsung Galaxy A54/);
  assert.match(msg, /Serviço realizado/);
  assert.match(msg, /Troca de tela/);
  assert.match(msg, /Garantia/);
  assert.match(msg, /Portal do Cliente/);
  assert.ok(msg.includes(PORTAL_CLIENTE_URL));
  assert.match(msg, /mesmo telefone informado na Ordem de Serviço/);
  assert.match(msg, /Cell City Informática/);
  assert.match(msg, /📋/);
  assert.match(msg, /📱/);
  assert.match(msg, /🛠/);
  assert.match(msg, /🛡/);
  assert.match(msg, /🌐/);
  assert.match(msg, /📍/);
  assertSemJsVisivel(msg);
}

test('template padrão não contém expressão JavaScript', () => {
  const tpl = msgFinalizadoPadrao();
  assert.equal(templateFinalizadoInvalido(tpl), false);
  assert.doesNotMatch(tpl, /\{validade\s*\?/);
  assert.match(tpl, /\{validade_bloco\}/);
  assert.ok(tpl.includes(PORTAL_CLIENTE_URL));
});

test('detecta template legado quebrado com ternário JS', () => {
  const legado =
    "Olá, {nome}!\n🛡 Garantia: {garantia}\n{validade ? '📅 Válida até: ' + {validade} : ''\n\nCell City";
  assert.equal(templateFinalizadoInvalido(legado), true);
});

test('OS com garantia geral (90 dias, sem modelo nomeado)', () => {
  const msg = montarMensagemFinalizado(BASE_OS);
  assertEstruturaBase(msg);
  assert.match(msg, /90 dias/);
  assert.doesNotMatch(msg, /dias —/);
  assert.match(msg, /Válida até/);
  const validade = formatarValidadeGarantia(BASE_OS);
  assert.ok(validade);
  assert.ok(msg.includes(validade));
});

test('OS com garantia personalizada (modelo nomeado)', () => {
  const msg = montarMensagemFinalizado(BASE_OS, {
    garantiaModeloNome: 'Garantia Premium Display',
  });
  assertEstruturaBase(msg);
  assert.match(msg, /90 dias — Garantia Premium Display/);
  assert.match(msg, /Válida até/);
});

test('OS sem garantia (prazo 0): sem bloco de validade', () => {
  const os = { ...BASE_OS, prazoGarantia: 0 };
  const msg = montarMensagemFinalizado(os);
  assert.match(msg, /Sem garantia/);
  assert.doesNotMatch(msg, /Válida até/);
  assert.equal(formatarGarantia(os), 'Sem garantia');
  assert.equal(formatarValidadeGarantia(os), '');
  assertSemJsVisivel(msg);
  assert.ok(msg.includes(PORTAL_CLIENTE_URL));
});

test('template customizado inválido cai no padrão seguro', () => {
  const msg = montarMensagemFinalizado(BASE_OS, {
    template:
      "{validade ? '📅 Válida até: ' + {validade} : ''}\nCódigo sujo {foo}",
  });
  assertEstruturaBase(msg);
  assert.doesNotMatch(msg, /Código sujo/);
});

test('template customizado válido resolve placeholders sem JS', () => {
  const msg = montarMensagemFinalizado(BASE_OS, {
    template: 'Oi {nome} — OS {os} — {garantia} — fim',
    garantiaModeloNome: 'Padrão Loja',
  });
  assert.equal(msg, 'Oi Maria — OS OS-2026-0042 — 90 dias — Padrão Loja — fim');
  assertSemJsVisivel(msg);
});

test('link do Portal é exatamente a URL oficial', () => {
  const msg = montarMensagemFinalizado(BASE_OS);
  assert.ok(
    msg.includes(
      'https://www.cellcityinformatica.com.br/CRM/pages/portal-cliente/index.html'
    )
  );
});

test('formatação WhatsApp: negrito com * simples (não **)', () => {
  const msg = montarMensagemFinalizado(BASE_OS);
  assert.match(msg, /\*OS Nº:\*/);
  assert.match(msg, /\*Aparelho:\*/);
  assert.match(msg, /\*Serviço realizado:\*/);
  assert.match(msg, /\*Garantia:\*/);
  assert.match(msg, /\*Portal do Cliente\*/);
  assert.doesNotMatch(msg, /\*\*[^*]+\*\*/);
});
