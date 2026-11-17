/**
 * Entrada por texto — parser da Nova OS.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEntradaTextoOS } from '../../CRM/pages/os/entrada-texto.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(__dirname, '../../CRM/pages/os/index.html'), 'utf8');
const OS_JS = readFileSync(join(__dirname, '../../CRM/pages/os/os.js'), 'utf8');

test('caso pedido: Maria, telefone, A10, não liga, troca de tela, senha 111', () => {
  const p = parseEntradaTextoOS('Maria, 62 99999-9999, A10, não liga, troca de tela, senha 111');
  assert.equal(p.nome, 'Maria');
  assert.match(p.telefone.replace(/\D/g, ''), /^62\d{8,9}$/);
  assert.equal(p.modelo, 'A10');
  assert.match(p.defeito, /não liga/i);
  assert.match(p.defeito, /troca de tela/i);
  assert.equal(p.senha, '111');
  assert.equal(p.categoria, 'celular');
  assert.ok(p.camposPreenchidos.includes('nome'));
  assert.ok(p.camposPreenchidos.includes('telefone'));
  assert.ok(p.camposPreenchidos.includes('modelo'));
  assert.ok(p.camposPreenchidos.includes('defeito'));
  assert.ok(p.camposPreenchidos.includes('senha'));
});

test('iPhone / notebook sugerem categoria', () => {
  const ip = parseEntradaTextoOS('João, (11) 98888-7777, iPhone 11, tela quebrada, senha 1234');
  assert.equal(ip.modelo, 'iPhone 11');
  assert.equal(ip.categoria, 'celular');

  const nb = parseEntradaTextoOS('Ana, 61988887777, Notebook Dell, não liga');
  assert.match(nb.modelo, /Notebook Dell/i);
  assert.equal(nb.categoria, 'notebook');
  assert.equal(nb.senha, '');
});

test('texto vazio não preenche', () => {
  const p = parseEntradaTextoOS('   ');
  assert.deepEqual(p.camposPreenchidos, []);
});

test('HTML e os.js expõem Entrada por texto', () => {
  assert.match(HTML, /f-entrada-texto/);
  assert.match(HTML, /Entrada por texto/);
  assert.match(HTML, /aplicarEntradaTexto/);
  assert.match(OS_JS, /parseEntradaTextoOS|entrada-texto\.js/);
  assert.match(OS_JS, /aplicarEntradaTexto/);
});
