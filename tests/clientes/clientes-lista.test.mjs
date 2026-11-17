import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filtrarClientesPorBusca,
  ordenarClientesPorNome,
  urlFichaCliente,
} from '../../CRM/pages/clientes/clientes-lista.js';

const norm = s => String(s || '').replace(/\D/g, '');

const base = [
  { name: 'Maria Silva', phone: '(62) 99999-1111', phoneDigits: '62999991111', history: ['os1'] },
  { name: 'João Souza', phone: '62988887777', phoneDigits: '62988887777', history: [] },
  { nome: 'Ana', phone: '11977776666', phoneDigits: '11977776666' },
];

test('filtrarClientesPorBusca por nome', () => {
  assert.equal(filtrarClientesPorBusca(base, 'maria', norm).length, 1);
  assert.equal(filtrarClientesPorBusca(base, 'ana', norm)[0].nome, 'Ana');
});

test('filtrarClientesPorBusca por telefone (parcial)', () => {
  assert.equal(filtrarClientesPorBusca(base, '99999', norm).length, 1);
  assert.equal(filtrarClientesPorBusca(base, '62 98888', norm)[0].name, 'João Souza');
});

test('ordenarClientesPorNome', () => {
  const ord = ordenarClientesPorNome(base);
  assert.equal(ord[0].nome || ord[0].name, 'Ana');
});

test('urlFichaCliente usa #cliente-{digits}', () => {
  assert.equal(urlFichaCliente('62 99999-1111', norm), '../os/index.html#cliente-62999991111');
  assert.match(urlFichaCliente('123', norm), /#fav-clientes/);
});
