// Testes do módulo Chat — CRM/pages/chat/chat.js.
//
// ⚠️ MÓDULO DESATIVADO (2026-07-10): chat.js tem CHAT_ENABLED=false e o
// boot mostra "Módulo desativado." sem tocar kernel/Firestore. Os testes
// abaixo asseveram ESSE estado. Ao reativar (CHAT_ENABLED=true), restaurar
// o bloco "comportamento ativo" comentado no fim deste arquivo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as fsMock from './mocks/firestore-mock.js';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/chat/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/chat/chat.js')).href;

function setup(matriz) {
    fsMock.__reset();
    perm.__reset();
    fsMock.__seed('usuarios', 'u1', { nome_exibicao: 'Admin', email: 'admin@test.com', status: 'ativo' });
    fsMock.__seed('chat_mensagens', 'msg1', { de: 'u1', para: 'uid_teste', participantes: ['u1', 'uid_teste'], texto: 'Olá!', criadoEm: new Date() });
    perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/chat/index.html');
}

test('Chat desativado: acesso direto mostra "Módulo desativado." mesmo com permissão total', async () => {
    const { document } = setup({ chat: { visualizar: true, criar: true } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 100));
    assert.ok(document.body.innerHTML.includes('Módulo desativado.'));
});

test('Chat desativado: não redireciona nem renderiza a UI do chat', async () => {
    const harness = setup({ chat: { visualizar: false } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 100));
    // O gate de desativação roda ANTES do gate RBAC — sem redirect
    assert.doesNotMatch(harness.getCapturedHref(), /dashboard\/index\.html/);
    assert.equal(harness.document.getElementById('ch-input'), null, 'UI do chat não deve existir');
    assert.ok(harness.document.body.innerHTML.includes('Módulo desativado.'));
});

test('Chat desativado: dados de conversa não são carregados nem exibidos', async () => {
    const { document } = setup({ chat: { visualizar: true, criar: true } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 100));
    // A mensagem seedada em chat_mensagens não pode aparecer — o boot
    // desativado retorna antes de qualquer acesso a dados.
    assert.ok(!document.body.innerHTML.includes('Olá!'), 'mensagem do Firestore não deve ser renderizada');
    assert.ok(document.body.innerHTML.includes('Voltar ao Dashboard'));
});

/* ── COMPORTAMENTO ATIVO (restaurar ao reativar com CHAT_ENABLED=true) ──
test('Chat: elementos essenciais no HTML', async () => {
    const { document } = setup({ chat: { visualizar: true, criar: true } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 100));
    assert.ok(document.getElementById('ch-sidebar'));
    assert.ok(document.getElementById('ch-messages'));
    assert.ok(document.getElementById('ch-input'));
    assert.ok(document.getElementById('ch-send'));
});

test('Chat visualizar:false: redirect para Dashboard', async () => {
    const harness = setup({ chat: { visualizar: false } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 100));
    assert.match(harness.getCapturedHref(), /dashboard/);
});
──────────────────────────────────────────────────────────────────── */
