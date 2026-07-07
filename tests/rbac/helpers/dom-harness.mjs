// Harness compartilhado por todos os testes de tests/rbac/ — monta uma
// página real (HTML de produção) em jsdom e importa o JS real da página
// (sem cópia — via tests/rbac/loader.mjs, registrado por register-loader.mjs).
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// Instâncias jsdom criadas por este arquivo de teste, para fechar com
// closeAllMounted() num hook after() — sem isso, timers/RAF de páginas com
// loop de animação (ex.: acaodasemana.js) continuam rodando indefinidamente
// e travam a próxima suíte quando vários arquivos *.test.mjs rodam juntos.
const activeDoms = [];
export function closeAllMounted() {
    while (activeDoms.length) {
        const dom = activeDoms.pop();
        try { dom.window.close(); } catch { /* já fechado */ }
    }
}

// jsdom não implementa navegação real (window.location.href = ...); um
// Proxy sobre window troca só a propriedade location por um objeto simples
// e permite simular window.top !== window.self (teste de iframe).
export function mountPage(htmlPath, urlPath) {
    const html = readFileSync(htmlPath, 'utf-8');
    const dom = new JSDOM(html, { url: `http://localhost${urlPath}`, runScripts: 'outside-only', pretendToBeVisual: true });
    activeDoms.push(dom);

    global.document = dom.window.document;
    global.confirm = () => true;
    global.alert = () => {};
    global.prompt = () => null;
    global.sessionStorage = dom.window.sessionStorage;
    global.localStorage = dom.window.localStorage;
    global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
    global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
    // Páginas com refresh periódico (ex.: `setInterval(renderCalendario, 60000)`
    // em acaodasemana.js) chamam o timer solto — sem isto, a referência solta
    // resolve para o setInterval do Node (não do jsdom) e o timer nunca é
    // cancelado por dom.window.close(), travando o processo indefinidamente.
    global.setInterval = dom.window.setInterval.bind(dom.window);
    global.clearInterval = dom.window.clearInterval.bind(dom.window);
    global.setTimeout = dom.window.setTimeout.bind(dom.window);
    global.clearTimeout = dom.window.clearTimeout.bind(dom.window);
    dom.window.confirm = () => true;
    dom.window.alert = () => {};

    const fakeLocation = { pathname: dom.window.location.pathname, href: dom.window.location.href };
    dom.window.__getCapturedHref = () => fakeLocation.href;

    const topSentinel = {};
    let insideIframe = false;
    const windowProxy = new Proxy(dom.window, {
        get(target, prop) {
            if (prop === 'location') return fakeLocation;
            if (prop === 'self') return windowProxy;
            if (prop === 'top') return insideIframe ? topSentinel : windowProxy;
            const value = target[prop];
            return typeof value === 'function' ? value.bind(target) : value;
        },
        // Módulos de página seguem o padrão `window.foo = function(){}` e
        // depois chamam `foo()` puro em outros pontos — no navegador isso
        // funciona porque window === globalThis. Aqui window é um objeto
        // à parte, então espelhamos a atribuição no globalThis real do
        // Node para que a referência solta resolva do mesmo jeito.
        set(target, prop, value) {
            target[prop] = value;
            globalThis[prop] = value;
            return true;
        }
    });
    global.window = windowProxy;
    global.location = fakeLocation;

    return {
        document: dom.window.document,
        window: dom.window,
        getCapturedHref: () => fakeLocation.href,
        setIframe(v) { insideIframe = v; }
    };
}

// Importa o módulo com cache-busting (cada cenário precisa de uma execução
// nova do top-level code + _boot()/init()). Alguns módulos só chamam o boot
// via `document.addEventListener('DOMContentLoaded', ...)` sem fallback de
// `readyState` (ex.: entrada.js, chips-entrada.js) — como o import ocorre
// fora do ciclo de vida nativo do jsdom, disparamos o evento manualmente
// logo após o import terminar, garantindo o boot de forma determinística
// nos dois estilos de inicialização usados no projeto.
export async function importFresh(modUrl, { document } = {}) {
    await import(modUrl + '?t=' + Date.now() + '_' + Math.random().toString(36).slice(2));
    if (document) {
        document.dispatchEvent(new document.defaultView.Event('DOMContentLoaded', { bubbles: true, cancelable: true }));
    }
    await new Promise(r => setTimeout(r, 90));
}
