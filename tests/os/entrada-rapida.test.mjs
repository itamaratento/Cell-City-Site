/**
 * Entrada rápida da Nova OS — helpers + presença no HTML.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  osFaltaSenha,
  acessoriosTexto,
  badgeFaltaSenhaHtml,
} from '../../CRM/pages/os/entrada-rapida.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(__dirname, '../../CRM/pages/os/index.html'), 'utf8');
const OS_JS = readFileSync(join(__dirname, '../../CRM/pages/os/os.js'), 'utf8');

test('osFaltaSenha: vazio com lock numérico → true (não bloqueia, só avisa)', () => {
  assert.equal(osFaltaSenha({ password: '', lockType: 'Numerica' }), true);
  assert.equal(osFaltaSenha({ password: '   ', lockType: 'Numerica' }), true);
});

test('osFaltaSenha: senha, padrão ou Sem senha → false', () => {
  assert.equal(osFaltaSenha({ password: '1234', lockType: 'Numerica' }), false);
  assert.equal(osFaltaSenha({ password: '', lockType: 'Padrao', patternSequence: [0, 1, 2, 4] }), false);
  assert.equal(osFaltaSenha({ password: '', lockType: 'Sem senha' }), false);
  assert.equal(osFaltaSenha({ password: '', lockType: 'sem senha' }), false);
});

test('osFaltaSenha: impressora e categorias sem bloqueio → false; celular/tablet/notebook → true', () => {
  assert.equal(osFaltaSenha({ category: 'impressora', password: '', lockType: 'Numerica' }), false);
  assert.equal(osFaltaSenha({ category: 'outro', password: '', lockType: 'Numerica' }), false);
  assert.equal(osFaltaSenha({ category: 'celular', password: '', lockType: 'Numerica' }), true);
  assert.equal(osFaltaSenha({ category: 'tablet', password: '', lockType: 'Numerica' }), true);
  assert.equal(osFaltaSenha({ category: 'notebook', password: '', lockType: 'Numerica' }), true);
});

test('acessoriosTexto junta lista e ignora vazios', () => {
  assert.equal(acessoriosTexto({ acessoriosDeixados: ['Chip', 'Capinha'] }), 'Chip, Capinha');
  assert.equal(acessoriosTexto({ acessoriosDeixados: ['Chip', '', null] }), 'Chip');
  assert.equal(acessoriosTexto({}), '');
});

test('badge FALTA SENHA contém o texto esperado', () => {
  assert.match(badgeFaltaSenhaHtml(), /FALTA SENHA/);
  assert.match(badgeFaltaSenhaHtml(), /os-falta-senha/);
});

test('HTML Nova OS: Criar e Imprimir, Tudo OK, acessórios, Mais detalhes', () => {
  assert.match(HTML, /Criar e Imprimir/);
  assert.match(HTML, /saveOS\(\{\s*imprimirEntrada:\s*true\s*\}\)/);
  assert.match(HTML, /marcarChecklistTudoOk/);
  assert.match(HTML, /✓ Tudo OK/);
  assert.match(HTML, /f-ac-chip/);
  assert.match(HTML, /f-ac-carregador/);
  assert.match(HTML, /nova-os-mais-detalhes/);
  assert.match(HTML, /toggleMaisDetalhesNovaOS/);
});

test('os.js: saveOS grava acessoriosDeixados e dispara impressão', () => {
  assert.match(OS_JS, /acessoriosDeixados/);
  assert.match(OS_JS, /imprimirEntrada/);
  assert.match(OS_JS, /printOSEntrada\(1\)/);
  assert.match(OS_JS, /osFaltaSenha/);
  assert.match(OS_JS, /badgeFaltaSenhaHtml/);
});

test('os.js: impressão usa QR local e cache de config (sem api.qrserver)', () => {
  assert.match(OS_JS, /qrcode-local\.js/);
  assert.match(OS_JS, /_getPrintConfigCached/);
  assert.match(OS_JS, /_prefetchPrintConfig/);
  assert.equal(/api\.qrserver\.com/.test(OS_JS), false);
});
