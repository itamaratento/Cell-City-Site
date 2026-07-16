import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validarPassoEmpresa,
  validarPlano,
  normalizarEmail,
  digitosTelefone,
} from '../../CRM/shared/saas-onboarding-validacao.js';
import { PLANOS } from '../../CRM/shared/saas-planos.js';
import { provisionamentoPorPlano, PLANOS_VALIDOS } from '../../functions/lib/saas-planos.js';

const PLANOS_IDS = Object.keys(PLANOS);

test('validarPassoEmpresa: aceita dados válidos', () => {
  assert.equal(validarPassoEmpresa({
    nome: 'Loja Teste',
    seuNome: 'Maria',
    email: 'maria@loja.com',
    whatsapp: '(62) 99999-8888',
  }), null);
});

test('validarPassoEmpresa: rejeita e-mail inválido', () => {
  assert.match(validarPassoEmpresa({
    nome: 'Loja',
    seuNome: 'Maria',
    email: 'invalido',
    whatsapp: '62999998888',
  }), /e-mail/i);
});

test('validarPassoEmpresa: rejeita whatsapp curto', () => {
  assert.match(validarPassoEmpresa({
    nome: 'Loja',
    seuNome: 'Maria',
    email: 'a@b.co',
    whatsapp: '123',
  }), /WhatsApp/i);
});

test('validarPlano: aceita planos do catálogo', () => {
  for (const id of PLANOS_IDS) {
    assert.equal(validarPlano(id, PLANOS_IDS), null);
  }
});

test('validarPlano: rejeita plano desconhecido', () => {
  assert.match(validarPlano('inexistente', PLANOS_IDS), /plano/i);
});

test('normalizarEmail e digitosTelefone', () => {
  assert.equal(normalizarEmail('  Foo@Bar.COM '), 'foo@bar.com');
  assert.equal(digitosTelefone('(62) 9 9999-8888'), '62999998888');
});

test('provisionamentoPorPlano: basico tem modulos limitados', () => {
  const p = provisionamentoPorPlano('basico');
  assert.ok(Array.isArray(p.modulos_ativos));
  assert.ok(p.modulos_ativos.includes('os'));
  assert.equal(p.feature_flags.whatsapp, true);
});

test('provisionamentoPorPlano: enterprise tem modulos null (todos)', () => {
  const p = provisionamentoPorPlano('enterprise');
  assert.equal(p.modulos_ativos, null);
  assert.equal(p.feature_flags.portal_cliente, true);
});

test('PLANOS_VALIDOS espelha catálogo client', () => {
  assert.deepEqual([...PLANOS_VALIDOS].sort(), [...PLANOS_IDS].sort());
});

test('saas-onboarding.js existe e importa dependências esperadas', () => {
  const src = readFileSync('CRM/pages/saas-onboarding/saas-onboarding.js', 'utf8');
  assert.match(src, /saas-planos\.js/);
  assert.match(src, /FLAGS\.SAAS_ONBOARDING_ATIVO/);
  assert.doesNotMatch(src, /gstatic\.com\/firebasejs/);
});
