// Testa o padrão exato de gating introduzido em 2026-07-08 (Fase 1 do plano de
// performance, CRM/TECHDOC.md §24): `setInterval(() => { if (!document.hidden)
// fn(); }, MS)` + `document.addEventListener('visibilitychange', () => { if
// (!document.hidden) fn(); })`, usado em central-alertas.js e dashboard-alertas.js.
// Não reimplementa a lógica de negócio de carregar()/verificar()/atualizarAlertas()
// (essas não fazem parte deste padrão) — só o gating por aba oculta em si.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';

function makeFakeDocument() {
  const emitter = new EventEmitter();
  return {
    hidden: false,
    addEventListener: (evt, cb) => emitter.on(evt, cb),
    _setHidden(v) { this.hidden = v; emitter.emit('visibilitychange'); },
  };
}

test('timer não chama fn quando document.hidden = true', () => {
  const doc = makeFakeDocument();
  let chamadas = 0;
  const gated = () => { if (!doc.hidden) chamadas++; };

  doc._setHidden(true);
  gated(); gated(); gated();
  assert.equal(chamadas, 0);
});

test('timer chama fn quando document.hidden = false', () => {
  const doc = makeFakeDocument();
  let chamadas = 0;
  const gated = () => { if (!doc.hidden) chamadas++; };

  gated(); gated();
  assert.equal(chamadas, 2);
});

test('visibilitychange dispara fn imediatamente ao voltar a ficar visível', () => {
  const doc = makeFakeDocument();
  let chamadas = 0;
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) chamadas++; });

  doc._setHidden(true);
  assert.equal(chamadas, 0);
  doc._setHidden(false);
  assert.equal(chamadas, 1);
});

test('visibilitychange NÃO dispara fn ao ocultar a aba', () => {
  const doc = makeFakeDocument();
  let chamadas = 0;
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) chamadas++; });

  doc._setHidden(true);
  assert.equal(chamadas, 0);
});
