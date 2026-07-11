// Testes de RBAC (Fase 2, Sprint 5 — moduloId 'os') — ver CRM/TECHDOC.md §7.5.
// Importa CRM/pages/os/os.js REAL (não uma cópia) via tests/rbac/loader.mjs —
// se o código mudar, este teste roda contra a mudança na próxima execução.
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
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/os/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/os/os.js')).href;

function setup({ matriz = null, adminLegado = false } = {}) {
    fsMock.__reset();
    perm.__reset();
    fsMock.__seed('os', 'os_1', {
        id: 'os_1', clientName: 'João Teste', phone: '11999998888', phoneDigits: '11999998888',
        category: 'celular', brand: 'Samsung', model: 'Galaxy S21', defect: 'Tela quebrada',
        status: 'em_reparo', createdAt: new Date().toISOString(), timeline: [],
    });
    fsMock.__seed('clientes', '11999998888', { name: 'João Teste', phone: '11999998888', phoneDigits: '11999998888', history: ['os_1'] });
    perm.__setMatriz(matriz);
    perm.__setAdminLegado(adminLegado);
    return mountPage(HTML_PATH, '/CRM/pages/os/index.html');
}

// openDetail é exposta em window pelo próprio módulo — chamamos direto (mais
// confiável no harness do que depender de location.hash, que o dom-harness
// não simula por completo) e aguardamos o próximo microtask/render.
async function abrirDetalhe(window) {
    window.openDetail('os_1');
    await new Promise(r => setTimeout(r, 30));
}

test('OS restrito (visualizar✔ criar✘ editar✘ excluir✘): categorias ocultas; detalhe sem editar/excluir/lembrete', async () => {
    const { document, window } = setup({ matriz: { os: { visualizar: true, criar: false, editar: false, excluir: false } } });
    await importFresh(MOD_URL);
    await abrirDetalhe(window);

    document.querySelectorAll('.category-card').forEach(el => assert.equal(el.style.display, 'none'));

    const content = document.getElementById('detail-content').innerHTML;
    assert.match(content, /Galaxy S21/); // confirma que o detalhe realmente renderizou (não é falso-positivo de conteúdo vazio)
    assert.doesNotMatch(content, /toggleOSEdit\(\)/);
    assert.doesNotMatch(content, /abrirLembreteOS\(\)/);
    assert.doesNotMatch(content, /deleteOS\(/);
    assert.doesNotMatch(content, /saveInternalObservation\(\)/);
    assert.doesNotMatch(content, /saveObservation\(\)/);
    assert.doesNotMatch(content, /saveTechObservation\(\)/);
    assert.doesNotMatch(content, /markDelivered\(\)|markOrcamentoDevolvido\(\)/);
    // status-option não deve ter onclick de changeStatus quando sem editar
    assert.doesNotMatch(content, /onclick="changeStatus/);
});

test('OS matriz total (tudo true): categorias visíveis; detalhe com editar/excluir/lembrete', async () => {
    const { document, window } = setup({ matriz: { os: { visualizar: true, criar: true, editar: true, excluir: true } } });
    await importFresh(MOD_URL);
    await abrirDetalhe(window);

    document.querySelectorAll('.category-card').forEach(el => assert.notEqual(el.style.display, 'none'));

    const content = document.getElementById('detail-content').innerHTML;
    assert.match(content, /toggleOSEdit\(\)/);
    assert.match(content, /abrirLembreteOS\(\)/);
    assert.match(content, /deleteOS\(/);
    assert.match(content, /saveInternalObservation\(\)/);
    assert.match(content, /saveObservation\(\)/);
    assert.match(content, /saveTechObservation\(\)/);
    assert.match(content, /markDelivered\(\)/); // status 'em_reparo' não é terminal
    assert.match(content, /onclick="changeStatus/);
});

test('OS não migrado (matriz null): fail-open total', async () => {
    const { document, window } = setup({ matriz: null });
    await importFresh(MOD_URL);
    await abrirDetalhe(window);

    document.querySelectorAll('.category-card').forEach(el => assert.notEqual(el.style.display, 'none'));
    const content = document.getElementById('detail-content').innerHTML;
    assert.match(content, /toggleOSEdit\(\)/);
    assert.match(content, /deleteOS\(/);
});

test('OS visualizar:false: redirect para o Dashboard antes de renderizar', async () => {
    const harness = setup({ matriz: { os: { visualizar: false, criar: false, editar: false, excluir: false } } });
    await importFresh(MOD_URL);

    assert.match(harness.getCapturedHref(), /dashboard\/index\.html/);
    assert.equal(harness.document.getElementById('detail-content').innerHTML, '');
});

test('OS admin legado: bypass total independente da matriz', async () => {
    const { document, window } = setup({ matriz: { os: { visualizar: false, criar: false, editar: false, excluir: false } }, adminLegado: true });
    await importFresh(MOD_URL);
    await abrirDetalhe(window);

    document.querySelectorAll('.category-card').forEach(el => assert.notEqual(el.style.display, 'none'));
    const content = document.getElementById('detail-content').innerHTML;
    assert.match(content, /toggleOSEdit\(\)/);
    assert.match(content, /deleteOS\(/);
});

test('OS: cliente restrito sem editar/excluir na listagem', async () => {
    const { document, window } = setup({ matriz: { os: { visualizar: true, criar: false, editar: false, excluir: false } } });
    await importFresh(MOD_URL);
    // renderClients() só popula ao navegar até a tela de clientes — dispara via
    // showScreen (exposta em window pelo próprio módulo), mesmo caminho da UI real.
    window.showScreen('clientes');
    await new Promise(r => setTimeout(r, 30));
    const content = document.getElementById('client-list').innerHTML;
    assert.doesNotMatch(content, /editClient\(/);
    assert.doesNotMatch(content, /deleteClient\(/);
});

// ── Botão Portal do Cliente (substitui o clique-no-telefone que abria
// WhatsApp) — ver abrirPortalCliente() em os.js e ticket de 2026-07-11.
test('OS detalhe: telefone não abre mais WhatsApp, abre abrirPortalCliente()', async () => {
    const { document, window } = setup();
    await importFresh(MOD_URL);
    await abrirDetalhe(window);

    const content = document.getElementById('detail-content').innerHTML;
    assert.doesNotMatch(content, /wa\.me/, 'não pode restar nenhum link wa.me no detalhe da OS');
    assert.match(content, /onclick="abrirPortalCliente\('os_1','11999998888'\);return false;"/);
    assert.match(content, /title="Abrir Portal do Cliente"/);
});

test('abrirPortalCliente: abre o Portal com tel e os na URL, sem WhatsApp', async () => {
    const { document, window } = setup();
    await importFresh(MOD_URL);
    await abrirDetalhe(window);

    const chamadas = [];
    window.open = (url) => { chamadas.push(url); return null; };

    window.abrirPortalCliente('os_1', '11999998888');

    assert.equal(chamadas.length, 1);
    assert.match(chamadas[0], /\/CRM\/pages\/portal-cliente\/index\.html\?tel=11999998888&os=os_1/);
    assert.doesNotMatch(chamadas[0], /wa\.me|whatsapp/i);
});

test('abrirPortalCliente: telefone inválido mostra toast e não abre nada', async () => {
    const { document, window } = setup();
    await importFresh(MOD_URL);
    await abrirDetalhe(window);

    let abriu = false;
    window.open = () => { abriu = true; return null; };

    window.abrirPortalCliente('os_1', '123'); // menos de 10 dígitos

    assert.equal(abriu, false);
    assert.match(document.getElementById('toast').textContent, /Telefone da OS inválido/);
});

// ── Hardening XSS (Certificação v1.0) — campos que podem vir do formulário
// PÚBLICO de pré-OS (clientName/model/defect) não podem injetar HTML no
// console da equipe. Ver escHtml() em CRM/pages/os/os.js.
function setupComPayload(campo, payload) {
    fsMock.__reset();
    perm.__reset();
    fsMock.__seed('os', 'os_x', {
        id: 'os_x', clientName: 'Cliente', phone: '11999998888', phoneDigits: '11999998888',
        category: 'celular', brand: 'Marca', model: 'Modelo', defect: 'Defeito',
        status: 'em_reparo', createdAt: new Date().toISOString(), timeline: [],
        [campo]: payload,
    });
    perm.__setMatriz(null); // fail-open: renderiza tudo
    return mountPage(HTML_PATH, '/CRM/pages/os/index.html');
}

test('OS XSS: payload em clientName é escapado no detalhe (não vira nó DOM)', async () => {
    const { document, window } = setupComPayload('clientName', '<img src=x onerror="window.__xss=1">');
    await importFresh(MOD_URL);
    window.openDetail('os_x');
    await new Promise(r => setTimeout(r, 30));
    const container = document.getElementById('detail-content');
    // A tag não pode existir como elemento real; o texto escapado sim.
    assert.equal(container.querySelector('img'), null, 'payload não pode virar <img> real');
    assert.match(container.innerHTML, /&lt;img/, 'deve aparecer escapado como texto');
});

test('OS XSS: payload em defect é escapado na lista de OS', async () => {
    const { document, window } = setupComPayload('defect', '<script>window.__xss=1</script>');
    await importFresh(MOD_URL);
    window.showScreen('list');
    if (typeof window.renderList === 'function') window.renderList();
    await new Promise(r => setTimeout(r, 30));
    const list = document.getElementById('os-list');
    assert.equal(list.querySelector('script'), null, 'payload não pode virar <script> real');
});

test('OS render intacto: dados normais aparecem sem entidades', async () => {
    const { document, window } = setupComPayload('clientName', 'Maria & João');
    await importFresh(MOD_URL);
    window.openDetail('os_x');
    await new Promise(r => setTimeout(r, 30));
    const container = document.getElementById('detail-content');
    assert.match(container.innerHTML, /Modelo/); // detalhe renderizou
    assert.match(container.textContent, /Maria & João/); // texto legível preservado
});
