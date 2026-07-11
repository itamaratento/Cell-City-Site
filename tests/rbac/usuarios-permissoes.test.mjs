// Testes do módulo Usuários e Permissões
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
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/usuarios-permissoes/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/usuarios-permissoes/usuarios-permissoes.js')).href;
test('Usuarios: pagina carrega com header', async () => {
    const h = mountPage(HTML_PATH, '/CRM/pages/usuarios-permissoes/index.html');
    await importFresh(MOD_URL, { document: h.document });
    await new Promise(r => setTimeout(r, 150));
    assert.ok(h.document.querySelector('header'));
});
test('Usuarios: contem abas de navegacao', async () => {
    const h = mountPage(HTML_PATH, '/CRM/pages/usuarios-permissoes/index.html');
    await importFresh(MOD_URL, { document: h.document });
    await new Promise(r => setTimeout(r, 150));
    assert.ok(h.document.querySelector('.up-tab'));
});

// Achado da Revisão Técnica de 2026-07-11: a ampliação de MODULOS (9→25,
// commit 7b672d3) não fazia merge com o `permissoes` salvo de um perfil
// legado — matrizEdicao[moduloNovo] ficava undefined e tanto o listener de
// checkbox quanto salvarMatrizPerfil() quebravam ao acessar uma propriedade
// dele. O erro é engolido por comCarregamento() (try/catch + toast), então
// o sintoma real era "Salvar" não fazer nada, sem indicar o motivo.
test('Permissões: perfil legado (sem os módulos novos) salva sem quebrar e fecha o fail-open', async () => {
    fsMock.__reset();
    perm.__reset();
    fsMock.__seed('perfis_operacionais', 'legado1', {
        nome: 'Legado',
        sistema: false,
        ativo: true,
        // Formato salvo antes da ampliação de MODULOS: só os 9 módulos originais.
        permissoes: {
            dashboard: { visualizar: true, criar: false, editar: false, excluir: false, aprovar: false },
            os: { visualizar: true, criar: true, editar: true, excluir: false, aprovar: false },
        },
    });

    const h = mountPage(HTML_PATH, '/CRM/pages/usuarios-permissoes/index.html');
    await importFresh(MOD_URL, { document: h.document });
    await new Promise(r => setTimeout(r, 200));

    const chk = h.document.querySelector('input.up-check[data-modulo="compras"][data-acao="visualizar"]');
    assert.ok(chk, 'checkbox de um módulo novo (compras) deve existir na tabela renderizada');
    assert.equal(chk.checked, false, 'módulo novo não tocado começa desmarcado (fail-open fechado por padrão)');
    assert.doesNotThrow(
        () => chk.click(),
        'marcar um módulo novo não pode lançar exceção (matrizEdicao[modulo] não pode ser undefined)'
    );

    const btnSalvar = h.document.getElementById('up-btn-salvar-permissoes');
    btnSalvar.click();
    await new Promise(r => setTimeout(r, 150));

    const salvo = fsMock.__raw('perfis_operacionais', 'legado1');
    assert.ok(salvo.permissoes.compras, 'módulo novo precisa virar entrada explícita no documento salvo');
    assert.equal(salvo.permissoes.compras.visualizar, true, 'checkbox marcado antes de salvar deve persistir');
    assert.equal(salvo.permissoes.chat.visualizar, false, 'módulo novo não tocado deve fechar fail-open (default false), não sumir do documento');
});
