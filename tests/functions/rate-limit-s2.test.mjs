// Teste unitário do rate limit dedicado de consultarOSPublica (achado S2).
// Não precisa de emulador — só o módulo in-memory.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { aplicarRateLimit, clearRateLimitStore, LIMITES } = require('../../functions/lib/rate-limit.js');

beforeEach(() => clearRateLimitStore());

function fakeRequest(ip = '203.0.113.10', data = {}) {
  return {
    rawRequest: { ip, headers: {} },
    data,
  };
}

test('LIMITES.consulta_os_publica é mais restrito que leitura', () => {
  assert.equal(LIMITES.consulta_os_publica.ip, 5);
  assert.ok(LIMITES.consulta_os_publica.ip < LIMITES.leitura.ip);
});

test('consulta_os_publica: permite até 5 req/min no mesmo IP', () => {
  const req = fakeRequest();
  for (let i = 0; i < 5; i++) {
    assert.doesNotThrow(() => aplicarRateLimit(req, 'consulta_os_publica'));
  }
});

test('consulta_os_publica: a 6ª req no mesmo IP → resource-exhausted', () => {
  const req = fakeRequest();
  for (let i = 0; i < 5; i++) aplicarRateLimit(req, 'consulta_os_publica');
  assert.throws(
    () => aplicarRateLimit(req, 'consulta_os_publica'),
    (err) => err.code === 'resource-exhausted'
  );
});

test('consulta_os_publica: IPs distintos não compartilham o contador', () => {
  for (let i = 0; i < 5; i++) aplicarRateLimit(fakeRequest('198.51.100.1'), 'consulta_os_publica');
  assert.doesNotThrow(() => aplicarRateLimit(fakeRequest('198.51.100.2'), 'consulta_os_publica'));
});
