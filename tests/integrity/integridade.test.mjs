// Suíte de Integridade — Épico Observabilidade v1.1 (Fases 4 e 5).
//
// Automatiza as auditorias que até hoje eram manuais (e que já pegaram
// problemas reais em revisão: 4 coleções sem rule na release v2026.07.10,
// garantia.html deletado mas linkado, import dinâmico com path errado):
//
//   1. Todo <script src> / <link href> / <a href> relativo ou absoluto
//      (/CRM/...) nas páginas aponta para arquivo que existe no repo.
//   2. Todo import ESM relativo em CRM/**/*.js resolve para arquivo real.
//   3. Toda coleção Firestore referenciada no código (literal ou via
//      constante) tem `match /colecao/` em CRM/firestore.rules.
//   4. As duas cópias de rules (raiz e CRM/) são idênticas — drift entre
//      elas já causou análise errada de auditoria (COLECOES_FIRESTORE.md,
//      nota de 2026-07-07).
//   5. URLs do catálogo da Central de Módulos apontam para páginas reais.
//
// Node puro, sem Firestore, sem emulador — roda em qualquer CI.
// Exceções conhecidas/documentadas: known-issues.json ao lado deste arquivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const known = JSON.parse(readFileSync(join(__dirname, 'known-issues.json'), 'utf8'));

// git ls-files ignora node_modules/artefatos; arquivos deletados no working
// tree (ex.: outra sessão em andamento) são pulados na leitura.
function lsFiles(pattern) {
    return execSync(`git ls-files '${pattern}'`, { cwd: ROOT, encoding: 'utf8' })
        .trim().split('\n').filter(Boolean)
        .filter(f => !/BACKUP|_BACKUPS|\.bak/i.test(f))
        .filter(f => existsSync(join(ROOT, f)));
}
function read(f) { return readFileSync(join(ROOT, f), 'utf8'); }

// Remove comentários antes de escanear código — senão exemplos de uso em
// JSDoc/comentário (ex.: kernel.js mostra `import ... from '../../scripts/
// kernel.js'`; base.repository.js cita `collection(db,'x')`) viram falsos
// positivos. Preserva `://` de URLs ao cortar comentários de linha.
function stripJsComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')      // blocos /* ... */
        .replace(/(^|[^:])\/\/.*$/gm, '$1');    // linha // ... (não toca em ://)
}
function stripHtmlComments(src) {
    return src.replace(/<!--[\s\S]*?-->/g, '');
}

// ── 1. Referências de HTML (src/href) ────────────────────────────────
test('HTML: todo src/href local aponta para arquivo existente', () => {
    const quebrados = [];
    for (const html of lsFiles('CRM/**/*.html')) {
        const dir = dirname(html);
        const src = stripHtmlComments(read(html));
        const refs = [...src.matchAll(/(?:src|href)="([^"#?]+?\.(?:js|css|html|png|svg|ico|webmanifest|json))(?:[?#][^"]*)?"/g)]
            .map(m => m[1]);
        for (const ref of refs) {
            if (/^(https?:)?\/\//.test(ref) || ref.startsWith('mailto:')) continue;
            const alvo = ref.startsWith('/') ? ref.slice(1) : join(dir, ref);
            if (known.htmlRefs.includes(`${html} -> ${ref}`)) continue;
            if (!existsSync(join(ROOT, alvo))) quebrados.push(`${html} -> ${ref}`);
        }
    }
    assert.deepEqual(quebrados, [], `Referências quebradas:\n${quebrados.join('\n')}`);
});

// ── 2. Imports ESM relativos ─────────────────────────────────────────
test('JS: todo import ESM relativo resolve para arquivo existente', () => {
    const quebrados = [];
    for (const js of lsFiles('CRM/**/*.js')) {
        const dir = dirname(js);
        const src = stripJsComments(read(js));
        const refs = [...src.matchAll(/(?:^|\n)\s*(?:import[^'"]*?from\s*|import\s*\(\s*|export[^'"]*?from\s*)['"]([^'"]+)['"]/g)]
            .map(m => m[1]);
        for (const ref of refs) {
            if (!ref.startsWith('.')) continue; // CDN/bare specifiers fora do escopo
            const alvo = join(dir, ref.split('?')[0]);
            if (!existsSync(join(ROOT, alvo))) quebrados.push(`${js} -> ${ref}`);
        }
    }
    assert.deepEqual(quebrados, [], `Imports quebrados:\n${quebrados.join('\n')}`);
});

// ── 3. Coleções do código × Firestore Rules ──────────────────────────
test('Firestore: toda coleção usada no código tem rule correspondente', () => {
    const rules = read('CRM/firestore.rules');
    const comRule = new Set([...rules.matchAll(/match \/([a-zA-Z_0-9]+)\//g)].map(m => m[1]));
    const semRule = new Set();
    for (const js of lsFiles('CRM/**/*.js')) {
        const src = stripJsComments(read(js));
        // Literais diretos: collection(db, 'x') / doc(db, 'x', ...)
        const literais = [...src.matchAll(/(?:collection|doc)\(\s*(?:db|_db)\s*,\s*['"]([a-zA-Z_0-9]+)['"]/g)].map(m => m[1]);
        // Constantes: collection(db, COL_X) com COL_X = 'x' no mesmo arquivo
        const porConst = [...src.matchAll(/(?:collection|doc)\(\s*(?:db|_db)\s*,\s*([A-Z][A-Z_0-9]*)\s*[,)]/g)].map(m => m[1]);
        for (const c of porConst) {
            const def = src.match(new RegExp(`${c}\\s*=\\s*['"]([a-zA-Z_0-9]+)['"]`));
            if (def) literais.push(def[1]);
        }
        // Camada Repository: createRepository('x')
        literais.push(...[...src.matchAll(/createRepository\(\s*['"]([a-zA-Z_0-9]+)['"]/g)].map(m => m[1]));
        for (const col of literais) {
            if (known.colecoesSemRule.includes(col)) continue;
            if (!comRule.has(col)) semRule.add(`${col} (em ${js})`);
        }
    }
    assert.deepEqual([...semRule], [],
        `Coleções sem rule (módulo quebraria por deny-by-default):\n${[...semRule].join('\n')}`);
});

// ── 4. Cópias de rules idênticas ─────────────────────────────────────
test('Firestore: firestore.rules (raiz) é idêntico a CRM/firestore.rules', () => {
    assert.equal(read('firestore.rules'), read('CRM/firestore.rules'),
        'As duas cópias divergiram — sincronizar antes de promover (drift já causou auditoria errada em 2026-07-07)');
});

// ── 5. Catálogo da Central de Módulos ────────────────────────────────
test('Central de Módulos: toda URL do catálogo aponta para página existente', () => {
    const src = read('CRM/shared/central-modulos.js');
    const urls = [...src.matchAll(/url:\s*'\/CRM\/([^']+)'/g)].map(m => m[1]);
    const quebradas = urls.filter(u => !existsSync(join(ROOT, 'CRM', u.split('?')[0])));
    assert.deepEqual(quebradas, [], `URLs quebradas no catálogo:\n${quebradas.join('\n')}`);
});

// ── 6. XSS: campos de entrada pública em garantia.html precisam de escHTML() ──
// Achado da Revisão Técnica de 2026-07-11: clientName/phone/cpf/model/defect
// vêm do formulário PÚBLICO de pré-OS (mesma origem do XSS armazenado já
// corrigido em os.js na Certificação v1.0) e são renderizados via innerHTML
// em renderGarantiaHTML() — página sem login. `technician` já usava escHTML()
// nesta mesma função; os outros 5 pontos não. Escopo só na função de render
// (copiarGarantia() usa os mesmos campos como texto puro de clipboard, não
// innerHTML — não é um sink de XSS).
test('garantia.html: campos públicos (clientName/phone/cpf/model/defect) escapados em renderGarantiaHTML', () => {
    const full = read('CRM/garantia.html');
    const inicio = full.indexOf('function renderGarantiaHTML');
    const fim = full.indexOf('window.copiarGarantia');
    assert.ok(inicio > -1 && fim > inicio, 'renderGarantiaHTML não encontrada em garantia.html');
    const src = full.slice(inicio, fim);
    const camposPublicos = ['clientName', 'phone', 'cpf', 'model', 'defect'];
    const naoEscapados = [];
    for (const campo of camposPublicos) {
        const re = new RegExp(`\\$\\{[^}]*\\bos\\.${campo}\\b[^}]*\\}`, 'g');
        for (const m of src.matchAll(re)) {
            if (!m[0].includes(`escHTML(os.${campo}`)) naoEscapados.push(`os.${campo}: ${m[0].trim()}`);
        }
    }
    assert.deepEqual(naoEscapados, [],
        `Campos de entrada pública sem escHTML() em garantia.html (XSS armazenado explorável por qualquer visitante):\n${naoEscapados.join('\n')}`);
});

// ── 7. Integração OS → Portal do Cliente (2026-07-11) ────────────────
// Checagem estrutural leve (sem harness jsdom+Firebase para portal.js, que
// não existe ainda) — garante que a peça do lado do Portal do fluxo
// "clique no telefone da OS abre o Portal já logado" não seja removida ou
// desconectada silenciosamente. A cobertura funcional real está em
// tests/rbac/os.test.mjs (lado do CRM, com mutation test provado); o lado
// do portal.js foi verificado manualmente por rastreamento de código
// (reaproveita doLogin()/_autenticarComDigits() já testados em produção).
test('portal.js: auto-login por ?tel= existe e roteia para os-detalhe', () => {
    const src = read('CRM/pages/portal-cliente/portal.js');
    assert.match(src, /_autenticarComDigits\(digits\)/, 'função de login reutilizável não pode ser removida');
    assert.match(src, /paramsAuto\.get\(['"]tel['"]\)/, '_boot() precisa ler ?tel= da URL (vem de os.js::abrirPortalCliente)');
    assert.match(src, /#\/os-detalhe\/\$\{osAuto\}/, 'auto-login precisa rotear direto pra OS quando ?os= vier junto');
});

test('os.js: abrirPortalCliente aponta para portal-cliente/index.html, nunca wa.me', () => {
    const src = read('CRM/pages/os/os.js');
    assert.match(src, /function abrirPortalCliente\(osId, phoneDigits\)/);
    assert.match(src, /portal-cliente\/index\.html\?tel=\$\{phoneDigits\}&os=/);
});

// Achado de 2026-07-11 (mesmo dia da Sprint de Nota Fiscal): o link colado
// manualmente pela equipe (Google Drive, campo os.nfLink) era exibido no
// Portal do Cliente abaixo de Garantias antes do rollback do SaaS de 27/06 —
// perdido no rollback, restaurado nesta Sprint. Checagem estrutural evita
// que suma de novo silenciosamente (sem harness jsdom+Firebase pra
// portal.js — mesma limitação já registrada acima).
test('portal.js: link da Nota Fiscal (os.nfLink) exibido em renderOSDetalhe e renderGarantias', () => {
    const src = read('CRM/pages/portal-cliente/portal.js');
    const ocorrencias = [...src.matchAll(/o\.nfLink/g)];
    assert.ok(ocorrencias.length >= 2, `esperava pelo menos 2 usos de o.nfLink (detalhe da OS + lista de garantias), achou ${ocorrencias.length}`);
    assert.match(src, /Visualizar Nota Fiscal/);
});

// Achado da homologação de 2026-07-11: OS com orçamento recusado (garantiaId
// preenchido na criação, sem entrega) aparecia em "Minhas Garantias" —
// _emGarantia() e o filtro de "pendentes" não checavam o status. Ver
// _STATUS_SEM_GARANTIA em portal.js. Estas checagens são estruturais
// (sem harness jsdom para portal.js); a lógica foi verificada manualmente
// por rastreamento de código linha a linha nos dois pontos afetados.
test('portal.js: OS com orçamento recusado nunca conta como garantia (nem pendente nem ativa)', () => {
    const src = read('CRM/pages/portal-cliente/portal.js');
    assert.match(src, /_STATUS_SEM_GARANTIA:\s*\[['"]orcamento_recusado['"],\s*['"]devolvido_orcamento['"]\]/,
        '_STATUS_SEM_GARANTIA precisa cobrir os 2 status de recusa (oficial + legado)');
    assert.match(src, /_emGarantia\(os\)\s*{\s*if \(this\._STATUS_SEM_GARANTIA\.includes\(os\.status\)\) return false;/,
        '_emGarantia precisa negar logo no início pra status recusado, antes do fallback de garantiaId');
    assert.match(src, /const pendentes = this\.currentOS\.filter\(o =>\s*\n\s*o\.garantiaId && !this\._getDeliveryDate\(o\) && !this\._STATUS_SEM_GARANTIA\.includes\(o\.status\)/,
        'filtro de "pendentes" (Garantias Vinculadas) também precisa excluir status recusado — mesma causa raiz do bug em _emGarantia');
});

test('portal.js: Nota Fiscal em Minhas Garantias só com garantia válida', () => {
    const src = read('CRM/pages/portal-cliente/portal.js');
    assert.match(src, /if \(o\.nfLink && this\._emGarantia\(o\)\)/,
        'bloco de Nota Fiscal dentro de acoesDoc() precisa exigir _emGarantia(o), não só nfLink');
});

// Sprint 2026-07-11: "Garantias Expiradas" não gera benefício operacional
// pro cliente — dados continuam computados/armazenados, só a renderização
// foi retirada. O estado vazio ("nenhum serviço encontrado") não pode mais
// depender de `expiradas` (cliente só com garantias expiradas deve ver o
// estado vazio, já que nenhuma delas aparece de qualquer forma).
test('portal.js: seção de Garantias Expiradas não é renderizada ao cliente', () => {
    const src = read('CRM/pages/portal-cliente/portal.js');
    assert.doesNotMatch(src, /Garantias Expiradas \(\$\{expiradas\.length\}\)/,
        'o cabeçalho "Garantias Expiradas" não pode mais ser renderizado');
    assert.doesNotMatch(src, /expiradas\.slice\(0, 5\)\.forEach/,
        'o loop que renderizava cards de garantia expirada precisa estar removido');
    assert.match(src, /if \(pendentes\.length === 0 && ativas\.length === 0\) {/,
        'estado vazio não pode mais exigir expiradas.length === 0 (cliente só com expiradas deve ver a tela vazia)');
});
