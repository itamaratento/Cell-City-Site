/**
 * Regressão: tela preta na 1ª abertura de "Em Andamento".
 * Garante loader/erro e swap atômico (nunca zerar cache antes do fetch).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    listLoadingHtml,
    listErrorHtml,
    loadCacheAtomic,
} from '../../CRM/pages/os/os-list-state.js';

describe('os-list-state — loader e erro', () => {
    it('loader traz o texto Carregando OS…', () => {
        const html = listLoadingHtml();
        assert.match(html, /Carregando OS…/);
        assert.match(html, /os-list-loading/);
        assert.match(html, /role="status"/);
    });

    it('erro de andamento oferece Tentar de novo com showList(andamento)', () => {
        const html = listErrorHtml('andamento');
        assert.match(html, /Não foi possível carregar as OS/);
        assert.match(html, /Tentar de novo/);
        assert.match(html, /showList\('andamento'\)/);
    });

    it('erro de finalizados chama showList(finalizados)', () => {
        const html = listErrorHtml('finalizados');
        assert.match(html, /showList\('finalizados'\)/);
    });

    it('filtro desconhecido cai em andamento (safe)', () => {
        const html = listErrorHtml('@@@');
        assert.match(html, /showList\('andamento'\)/);
    });
});

describe('os-list-state — swap atômico (corrida load × lista)', () => {
    it('não entrega cache vazio enquanto o fetch ainda não resolveu', async () => {
        let cache = { os: [{ id: 'OS-0001' }], clients: [], counter: 1 };
        let midFlightSaw = null;

        const fetchAll = () => new Promise((resolve) => {
            // Durante o await, o cache antigo deve permanecer (não zerado).
            midFlightSaw = cache.os.length;
            setTimeout(() => resolve({
                os: [{ id: 'OS-0001' }, { id: 'OS-0002' }],
                clients: [{ phone: '1' }],
                counter: 2,
            }), 20);
        });

        const pending = loadCacheAtomic(fetchAll).then((next) => {
            cache = next;
        });

        // Simula showList/renderList no meio do fetch
        await new Promise((r) => setTimeout(r, 5));
        assert.equal(midFlightSaw, 1, 'cache antigo intacto no meio do fetch');
        assert.equal(cache.os.length, 1, 'UI ainda vê dados anteriores, não lista vazia');

        await pending;
        assert.equal(cache.os.length, 2);
        assert.equal(cache.counter, 2);
    });

    it('falha no fetch não devolve objeto parcial quebrado', async () => {
        await assert.rejects(
            () => loadCacheAtomic(async () => { throw new Error('offline'); }),
            /offline/
        );
    });
});
