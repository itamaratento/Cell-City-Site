// Testes unitários do segundo fator do Portal (CPF / portalAccessCode).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../functions/lib/portal-access.js', import.meta.url));
const {
  normalizarCodigoAcesso,
  codigoAcessoEsperado,
  verificarCodigoAcessoOS,
  algumaOSAceitaCodigo,
} = require('../../functions/lib/portal-access.js');

test('normalizarCodigoAcesso: só dígitos, máx 4', () => {
  assert.equal(normalizarCodigoAcesso('12a34'), '1234');
  assert.equal(normalizarCodigoAcesso('99999'), '9999');
  assert.equal(normalizarCodigoAcesso(null), '');
});

test('codigoAcessoEsperado: prefere últimos 4 do CPF', () => {
  assert.equal(codigoAcessoEsperado({ cpf: '123.456.789-00', portalAccessCode: '5555' }), '8900');
  assert.equal(codigoAcessoEsperado({ portalAccessCode: '4321' }), '4321');
  assert.equal(codigoAcessoEsperado({}), '');
});

test('verificarCodigoAcessoOS: CPF e pin', () => {
  assert.equal(verificarCodigoAcessoOS({ cpf: '111.222.333-44' }, '3344'), true);
  assert.equal(verificarCodigoAcessoOS({ cpf: '111.222.333-44' }, '9999'), false);
  assert.equal(verificarCodigoAcessoOS({ portalAccessCode: '7788' }, '7788'), true);
  assert.equal(verificarCodigoAcessoOS({ portalAccessCode: '7788' }, '778'), false);
});

test('algumaOSAceitaCodigo: qualquer OS do telefone basta', () => {
  const lista = [
    { cpf: null, portalAccessCode: '1111' },
    { cpf: '000.000.000-99', portalAccessCode: '2222' },
  ];
  assert.equal(algumaOSAceitaCodigo(lista, '1111'), true);
  assert.equal(algumaOSAceitaCodigo(lista, '0099'), true);
  assert.equal(algumaOSAceitaCodigo(lista, '2222'), false); // CPF presente → pin ignorado
  assert.equal(algumaOSAceitaCodigo(lista, '0000'), false);
});
