// Testes do Relatório Mensal + Fluxo de Caixa — CRM/pages/financeiro/financeiro.js.
// Cobre: renderRelatorio, renderFluxoCaixa, ymKey, fmtDataRel, atualizarResumoCompleto.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as fsMock from './mocks/firestore-mock.js';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/financeiro/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/financeiro/financeiro.js')).href;

function setup() {
    fsMock.__reset();
    perm.__reset();
    perm.__setMatriz({ financeiro: { visualizar: true, criar: true, editar: true, excluir: true } });
    const now = new Date();
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const ano = now.getFullYear();
    const dia = String(now.getDate()).padStart(2, '0');
    // Último dia do mês corrente. pag_pend precisa continuar no mês (para
    // renderRelatorio somar despesa=2450) E nunca ser reclassificado como
    // 'vencido' pelo código (financeiro.js:90 marca vencido quando
    // vencimento < hoje(), e hoje() usa toISOString() = UTC). Datar no dia
    // 10 fixo quebrava o teste sempre que rodava do dia 10 em diante — ou,
    // como hoje, num fuso atrás de UTC (Brasil UTC-3), em que o UTC já é o
    // dia 11 à noite. O último dia do mês é sempre >= hoje, nunca < hoje().
    const ultimoDia = String(new Date(ano, now.getMonth() + 1, 0).getDate()).padStart(2, '0');
    // Despesas do mês
    fsMock.__seed('financeiro_pagar', 'pag_paga',   { descricao: 'Aluguel', categoria: 'Aluguel', vencimento: `${ano}-${mes}-05`, valor: 1500, status: 'pago' });
    fsMock.__seed('financeiro_pagar', 'pag_pend',   { descricao: 'Internet', categoria: 'Serviços', vencimento: `${ano}-${mes}-${ultimoDia}`, valor: 200, status: 'pendente' });
    fsMock.__seed('financeiro_pagar', 'pag_vencida', { descricao: 'Fornecedor', categoria: 'Fornecedor', vencimento: `${ano}-${mes}-01`, valor: 500, status: 'vencido' });
    // Despesas de outro mês (não devem contar)
    const mes2 = String(now.getMonth()).padStart(2, '0');
    fsMock.__seed('financeiro_pagar', 'pag_outro', { descricao: 'Outro mês', categoria: 'Outro', vencimento: `${ano}-${mes2}-05`, valor: 999, status: 'pendente' });
    // Receitas do mês
    fsMock.__seed('financeiro_receber', 'rec_recebida', { descricao: 'Cliente A', vencimento: `${ano}-${mes}-05`, valor: 3000, status: 'recebido' });
    fsMock.__seed('financeiro_receber', 'rec_pendente', { descricao: 'Cliente B', vencimento: `${ano}-${mes}-15`, valor: 1500, status: 'pendente' });
    // Fixas
    fsMock.__seed('financeiro_fixas', 'fix_1', { descricao: 'Internet Fixa', categoria: 'Serviços', dia: 10, valor: 200 });
    fsMock.__seed('financeiro_fixas', 'fix_2', { descricao: 'Assinatura', categoria: 'Assinatura', dia: 5, valor: 50 });
    return mountPage(HTML_PATH, '/CRM/pages/financeiro/index.html');
}

describe('Relatório Mensal — renderRelatorio', () => {
    test('calcula receita/despesa/saldo corretamente', async () => {
        const { document, window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));
        window.renderRelatorio();
        window.renderFluxoCaixa();

        const relRecTotal = document.getElementById('rel-rec-total');
        const relDespTotal = document.getElementById('rel-desp-total');
        const relSaldo = document.getElementById('rel-saldo');

        assert.ok(relRecTotal);
        assert.ok(relDespTotal);
        assert.ok(relSaldo);

        // Receita: 3000 recebido + 1500 pendente = 4500
        assert.match(relRecTotal.textContent, /4\.500/);
        // Despesa: 1500 pago + 200 pendente + 500 vencido + 250 fixas = 2450
        assert.match(relDespTotal.textContent, /2\.450/);
        // Saldo: 4500 - 2450 = 2050
        assert.match(relSaldo.textContent, /2\.050/);
    });

    test('renderFluxoCaixa cria 3 cards de projeção', async () => {
        const { document, window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));
        window.renderRelatorio();
        window.renderFluxoCaixa();

        const fluxo30 = document.getElementById('fluxo-30');
        const fluxo60 = document.getElementById('fluxo-60');
        const fluxo90 = document.getElementById('fluxo-90');

        assert.ok(fluxo30);
        assert.ok(fluxo60);
        assert.ok(fluxo90);
        assert.ok(fluxo30.innerHTML.includes('30 dias'));
        assert.ok(fluxo60.innerHTML.includes('60 dias'));
        assert.ok(fluxo90.innerHTML.includes('90 dias'));
    });

    test('gerarMesesOption popula o select com 14 opções', async () => {
        const { document, window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        const sel = document.getElementById('fin-rel-mes');
        assert.ok(sel);
        assert.equal(sel.options.length, 14);
    });
});

describe('Relatório Mensal — atualizarResumoCompleto', () => {
    test('expande o resumo com vencidos e pendentes', async () => {
        const { document, window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        const elVencido = document.getElementById('res-vencido');
        const elPendente = document.getElementById('res-pendente');

        assert.ok(elVencido);
        assert.ok(elPendente);
        // pag_vencida (500) + pag_outro mês passado (999) = 1499
        assert.match(elVencido.textContent, /1\.499/);
    });
});

describe('Fechamento Mensal — fecharMes', () => {
    test('fecharMes calcula saldo corretamente e cria fechamento', async () => {
        const { document, window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        const mes = ymKey(new Date());
        await window.fecharMes(mes);
        await new Promise(r => setTimeout(r, 100));

        // Verifica que o fechamento foi criado no mock
        const fechamentos = fsMock.__all('financeiro_fechamentos');
        assert.equal(fechamentos.length, 1);
        assert.equal(fechamentos[0].id, mes);
        assert.ok(fechamentos[0].receitaTotal > 0);
        assert.ok(fechamentos[0].saldoFinal !== undefined);
    });

    test('renderHistoricoFechamentos exibe mês fechado', async () => {
        const { document, window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        const mes = ymKey(new Date());
        await window.fecharMes(mes);
        await new Promise(r => setTimeout(r, 100));

        window.renderHistoricoFechamentos();
        const container = document.getElementById('fin-historico-fechamentos');
        assert.ok(container);
        assert.ok(container.innerHTML.includes('Fechado') || container.querySelector('.fin-hist-card'));
    });
});

describe('Análise por Categoria — renderAnaliseCategoria', () => {
    test('renderiza barras de categoria para despesas do mês', async () => {
        const { document, window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));
        window.renderAnaliseCategoria();

        const container = document.getElementById('fin-analise-categoria');
        assert.ok(container);
        // Deve conter categorias com barras
        assert.ok(container.innerHTML.includes('Aluguel') || container.innerHTML.includes('Serviços'));
    });
});

describe('Fechamento Mensal — carregarFechamentos', () => {
    test('carrega fechamentos existentes do Firestore', async () => {
        const { document, window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        // Seed após setup (setup reseta o mock)
        fsMock.__seed('financeiro_fechamentos', '2026-06', { mes: '2026-06', label: 'Junho de 2026', receitaTotal: 5000, despesaTotal: 3000, saldoFinal: 2000 });
        await window.carregarFechamentos();
        window.renderHistoricoFechamentos();

        const container = document.getElementById('fin-historico-fechamentos');
        assert.ok(container);
        assert.ok(container.innerHTML.includes('2026-06') || container.innerHTML.includes('Junho'));
    });
});
