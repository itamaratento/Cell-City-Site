/**
 * Ficha do cliente — telefone canônico, OS, garantias, Caixa sem duplicar.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findClientePorTelefone,
  filtrarOSDoCliente,
  filtrarGarantiasAtivas,
  filtrarComprasCaixaDoCliente,
  indiceClienteSemDuplicar,
} from '../../CRM/pages/os/cliente-ficha.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OS_JS = readFileSync(join(__dirname, '../../CRM/pages/os/os.js'), 'utf8');
const norm = (s) => String(s || '').replace(/\D/g, '');

test('findClientePorTelefone: mesma pessoa com máscaras diferentes', () => {
  const clients = [
    { name: 'Maria', phone: '(62) 99999-9999', phoneDigits: '62999999999' },
  ];
  assert.equal(findClientePorTelefone(clients, '62 99999-9999', norm)?.name, 'Maria');
  assert.equal(findClientePorTelefone(clients, '62999999999', norm)?.name, 'Maria');
  assert.equal(findClientePorTelefone(clients, '11988887777', norm), null);
});

test('filtrarOSDoCliente por phoneDigits', () => {
  const os = [
    { id: 'OS-1', phone: '(62) 99999-9999', phoneDigits: '62999999999', createdAt: '2026-01-02' },
    { id: 'OS-2', phone: '11988887777', phoneDigits: '11988887777', createdAt: '2026-01-03' },
    { id: 'OS-3', phone: '62999999999', phoneDigits: '62999999999', createdAt: '2026-02-01' },
  ];
  const list = filtrarOSDoCliente(os, '62 99999-9999', norm);
  assert.deepEqual(list.map(o => o.id), ['OS-3', 'OS-1']);
});

test('filtrarGarantiasAtivas: entregue dentro do prazo', () => {
  const agora = Date.parse('2026-11-17T12:00:00Z');
  const orders = [
    { id: 'A', status: 'entregue', updatedAt: '2026-10-01T12:00:00Z', prazoGarantia: 90 },
    { id: 'B', status: 'entregue', updatedAt: '2025-01-01T12:00:00Z', prazoGarantia: 90 },
    { id: 'C', status: 'em_reparo', updatedAt: '2026-10-01T12:00:00Z' },
  ];
  const g = filtrarGarantiasAtivas(orders, agora);
  assert.deepEqual(g.map(o => o.id), ['A']);
});

test('filtrarComprasCaixaDoCliente por osId e descrição', () => {
  const lanc = [
    { id: '1', osId: 'OS-1', descricao: 'Venda', valor: 10 },
    { id: '2', descricao: 'OS OS-2 - Maria - A10', valor: 20 },
    { id: '3', osId: 'OS-9', descricao: 'Outro', valor: 5 },
  ];
  const r = filtrarComprasCaixaDoCliente(lanc, ['OS-1', 'OS-2']);
  assert.equal(r.length, 2);
});

test('indiceClienteSemDuplicar evita segundo doc do mesmo telefone', () => {
  const clients = [{ phone: '(62) 99999-9999', phoneDigits: '62999999999' }];
  assert.equal(indiceClienteSemDuplicar(clients, '62 99999-9999', '62999999999', norm), 0);
  assert.equal(indiceClienteSemDuplicar(clients, '11 98888-7777', '11988887777', norm), -1);
});

test('os.js: ficha + sync edição + deep-link #cliente-', () => {
  assert.match(OS_JS, /cliente-ficha\.js/);
  assert.match(OS_JS, /carregarComprasCaixaPorOS/);
  assert.match(OS_JS, /updateClientHistory\(pCanon/);
  assert.match(OS_JS, /getHashCliente|#cliente-/);
  assert.match(OS_JS, /indiceClienteSemDuplicar/);
});
