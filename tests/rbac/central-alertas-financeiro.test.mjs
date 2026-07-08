// Testes de integração Financeiro → Central de Alertas (Sprint 6).
// Verifica que o bloco de alertas financeiros em gerarAlertas() produz
// os cards corretos com base nos dados seedados no Firestore mock.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as fsMock from './mocks/firestore-mock.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/central-alertas/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/central-alertas/central-alertas.js')).href;

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function diasAtras(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function diasAFrente(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

function setup() { fsMock.__reset(); return mountPage(HTML_PATH, '/CRM/pages/central-alertas/index.html'); }

function getAlertTitles(doc) {
    return Array.from(doc.querySelectorAll('.alr-card-titulo')).map(el => el.textContent.trim());
}
function getAlertCards(doc) { return doc.querySelectorAll('.alr-card'); }

test('financeiro: contas a pagar vencidas geram alerta crítico', async () => {
    const h = setup();
    fsMock.__seed('financeiro_pagar', 'pag_v1', { descricao: 'Aluguel', vencimento: diasAtras(5), valor: 1500, status: 'pendente' });
    fsMock.__seed('financeiro_pagar', 'pag_p1', { descricao: 'Internet', vencimento: diasAtras(3), valor: 200, status: 'pago' });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 200));
    const t = getAlertTitles(h.document);
    assert.equal(t.some(x => x.includes('conta(s) a pagar vencida(s)')), true, 'Deveria ter alerta de pagar vencido');
    const cards = getAlertCards(h.document);
    const card = Array.from(cards).find(c => c.textContent.includes('conta(s) a pagar vencida(s)'));
    assert.ok(card, 'Card existe');
    assert.ok(card.classList.contains('cat-critico'), 'Categoria crítico');
});

test('financeiro: contas a pagar próximas geram alerta atenção', async () => {
    const h = setup();
    fsMock.__seed('financeiro_pagar', 'pag_p2', { descricao: 'Fornecedor', vencimento: diasAFrente(2), valor: 3000, status: 'pendente' });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 200));
    const t = getAlertTitles(h.document);
    assert.equal(t.some(x => x.includes('conta(s) a pagar vencendo em breve')), true);
});

test('financeiro: contas a receber vencidas geram alerta atenção', async () => {
    const h = setup();
    fsMock.__seed('financeiro_receber', 'rec_v1', { descricao: 'João', vencimento: diasAtras(2), valor: 800, status: 'pendente' });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 200));
    const t = getAlertTitles(h.document);
    assert.equal(t.some(x => x.includes('conta(s) a receber vencida(s)')), true);
});

test('financeiro: recebimentos previstos geram alerta info', async () => {
    const h = setup();
    fsMock.__seed('financeiro_receber', 'rec_p1', { descricao: 'Maria', vencimento: diasAFrente(1), valor: 1200, status: 'pendente' });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 200));
    const t = getAlertTitles(h.document);
    assert.equal(t.some(x => x.includes('recebimento(s) previsto(s)')), true);
});

test('financeiro: fluxo de caixa negativo gera alerta crítico', async () => {
    const h = setup();
    const hoje = hojeISO();
    fsMock.__seed('financeiro_pagar', 'pag_f1', { descricao: 'Aluguel', vencimento: hoje, valor: 5000, status: 'pendente' });
    fsMock.__seed('financeiro_pagar', 'pag_f2', { descricao: 'Folha', vencimento: diasAFrente(3), valor: 8000, status: 'pendente' });
    fsMock.__seed('financeiro_receber', 'rec_f1', { descricao: 'Pequeno', vencimento: hoje, valor: 1000, status: 'pendente' });
    fsMock.__seed('financeiro_fixas', 'fix_f1', { descricao: 'Internet', dia: 10, valor: 500 });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 200));
    const t = getAlertTitles(h.document);
    assert.equal(t.some(x => x.includes('FLUXO DE CAIXA PROJETADO NEGATIVO')), true);
    const cards = getAlertCards(h.document);
    const card = Array.from(cards).find(c => c.textContent.includes('FLUXO DE CAIXA PROJETADO NEGATIVO'));
    assert.ok(card, 'Card fluxo existe');
    assert.ok(card.classList.contains('cat-critico'), 'Categoria crítico');
});

test('financeiro: sem dados financeiros, nenhum alerta financeiro', async () => {
    const h = setup();
    fsMock.__seed('agenda', 'evt_1', { titulo: 'Reunião', data: hojeISO(), alertaDashboard: false });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 200));
    const t = getAlertTitles(h.document);
    assert.equal(t.some(x => x.startsWith('FINANCEIRO') || x.includes('FLUXO DE CAIXA')), false, 'Sem dados financeiros');
});

test('financeiro: contas todas pagas/recebidas sem alertas', async () => {
    const h = setup();
    fsMock.__seed('financeiro_pagar', 'pag_p3', { descricao: 'Agua', vencimento: diasAtras(10), valor: 150, status: 'pago' });
    fsMock.__seed('financeiro_receber', 'rec_p2', { descricao: 'OK', vencimento: diasAtras(5), valor: 500, status: 'recebido' });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 200));
    const t = getAlertTitles(h.document);
    assert.equal(t.some(x => x.startsWith('FINANCEIRO') || x.includes('FLUXO DE CAIXA')), false, 'Tudo pago');
});
