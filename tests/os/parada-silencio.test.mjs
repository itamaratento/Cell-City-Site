/**
 * OS paradas / silêncio / aguardando retirada — helpers + wiring.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STATUS_AGUARDANDO_RETIRADA,
  DIAS_PARADA,
  DIAS_COBRANCA_RETIRADA,
  SILENCIO_ATE_STATUS,
  isSilencioAtivo,
  payloadLimparSilencio,
  payloadSilenciar,
  textoSeloSilencio,
  deveAlertarParada,
  deveAlertarCobrancaRetirada,
} from '../../CRM/pages/os/os-parada-silencio.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OS_JS = readFileSync(join(__dirname, '../../CRM/pages/os/os.js'), 'utf8');
const PANEL = readFileSync(join(__dirname, '../../CRM/pages/dashboard/dashboard-alertas-panel.js'), 'utf8');
const PORTAL = readFileSync(join(__dirname, '../../CRM/pages/portal-cliente/portal.js'), 'utf8');

const agora = Date.parse('2026-11-17T12:00:00.000Z');

test('payloadSilenciar: 15/30 dias e até status', () => {
  const d15 = payloadSilenciar('15', 'cliente não veio buscar', 'Itamar', agora);
  assert.equal(d15.silenciadoMotivo, 'cliente não veio buscar');
  assert.equal(d15.silenciadoPor, 'Itamar');
  assert.equal(Date.parse(d15.silenciadoAte), agora + 15 * 86400000);

  const ate = payloadSilenciar('ate_status', 'aguardando peça do cliente', 'Ana', agora);
  assert.equal(ate.silenciadoAte, SILENCIO_ATE_STATUS);
  assert.throws(() => payloadSilenciar('15', '  ', 'X'), /motivo/i);
});

test('isSilencioAtivo: timed + ate_status + expirado', () => {
  assert.equal(isSilencioAtivo({ silenciadoAte: new Date(agora + 86400000).toISOString() }, agora), true);
  assert.equal(isSilencioAtivo({ silenciadoAte: new Date(agora - 1000).toISOString() }, agora), false);
  assert.equal(isSilencioAtivo({ silenciadoAte: SILENCIO_ATE_STATUS, silenciadoMotivo: 'x', silenciadoPor: 'y' }, agora), true);
  assert.equal(isSilencioAtivo(payloadLimparSilencio(), agora), false);
});

test('deveAlertarParada: +15 dias, exclui aguardando_retirada e silêncio', () => {
  const base = { status: 'em_reparo' };
  assert.equal(deveAlertarParada(base, DIAS_PARADA - 1, agora), false);
  assert.equal(deveAlertarParada(base, DIAS_PARADA, agora), true);
  assert.equal(deveAlertarParada({ status: STATUS_AGUARDANDO_RETIRADA }, 60, agora), false);
  assert.equal(
    deveAlertarParada({ status: 'em_reparo', silenciadoAte: SILENCIO_ATE_STATUS, silenciadoMotivo: 'ok' }, 60, agora),
    false
  );
});

test('deveAlertarCobrancaRetirada: só aguardando_retirada a partir de 30 dias', () => {
  assert.equal(deveAlertarCobrancaRetirada({ status: 'concluido' }, 60, agora), false);
  assert.equal(deveAlertarCobrancaRetirada({ status: STATUS_AGUARDANDO_RETIRADA }, 29, agora), false);
  assert.equal(deveAlertarCobrancaRetirada({ status: STATUS_AGUARDANDO_RETIRADA }, DIAS_COBRANCA_RETIRADA, agora), true);
  // Caso real: OS parada 60 dias em aguardando_retirada → cobrança
  assert.equal(deveAlertarCobrancaRetirada({ status: STATUS_AGUARDANDO_RETIRADA }, 60, agora), true);
  assert.equal(
    deveAlertarCobrancaRetirada({
      status: STATUS_AGUARDANDO_RETIRADA,
      silenciadoAte: new Date(agora + 86400000).toISOString(),
      silenciadoMotivo: 'liguei',
    }, 60, agora),
    false
  );
});

test('textoSeloSilencio não vazio quando ativo', () => {
  const t = textoSeloSilencio({ silenciadoAte: SILENCIO_ATE_STATUS, silenciadoMotivo: 'cliente não veio buscar' }, agora);
  assert.match(t, /silenciado/i);
  assert.match(t, /cliente não veio buscar/);
});

test('os.js: STATUS_FLOW tem aguardando_retirada; changeStatus limpa silêncio; modal sem confirm', () => {
  assert.match(OS_JS, /STATUS_AGUARDANDO_RETIRADA|aguardando_retirada/);
  assert.match(OS_JS, /Aguardando retirada/);
  assert.match(OS_JS, /payloadLimparSilencio/);
  assert.match(OS_JS, /abrirModalSilenciarAlerta/);
  assert.match(OS_JS, /Silenciar alerta/);
  assert.match(OS_JS, /reativarAlertaOS/);
  // O modal novo não usa confirm/prompt
  assert.match(OS_JS, /confirmarSilenciarAlerta/);
});

test('painel do sino: paradas + cobrança + silêncio', () => {
  assert.match(PANEL, /osCobrancaRetiradaPendentes|Cobrança — aguardando retirada/);
  assert.match(PANEL, /silenciadoAte|isSilencioAtivo|silencioAtivoLocal/);
  assert.match(PANEL, /STATUS_AGUARDANDO_RETIRADA|aguardando_retirada/);
});

test('portal expõe label aguardando_retirada', () => {
  assert.match(PORTAL, /aguardando_retirada/);
  assert.match(PORTAL, /Aguardando Retirada/);
});
