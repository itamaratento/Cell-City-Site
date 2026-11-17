// Suíte de regressão — correções de segurança da Fase 2.2 (commit 4080ec2,
// 2026-07-17). Criada na validação de release para dar cobertura permanente
// ao que aquele commit corrigiu e que não tinha teste direto:
//
//   1. escHtml() (CRM/shared/sanitize.js) — comportamento real (unitário).
//   2. gerarSenhaTemp() de usuarios-permissoes.js usa CSPRNG
//      (crypto.getRandomValues), nunca Math.random() — mesmo padrão já
//      exigido de saas-admin.js.
//   3. PIN estático de exclusão ('1056') removido do cliente — repositório
//      é público, o PIN era visível no código-fonte.
//   4. functions/saas.js não usa Math.random() para gerar ID de empresa.
//   5. Pontos de XSS corrigidos continuam escapando: modal de alertas do
//      Dashboard (dashboard-ui.js) e cards de cliente/busca global (os.js).
//   6. Catálogo público: client filtra where('empresa_id'=='cellcity-master')
//      e as Rules (as duas cópias) só permitem leitura anônima dessa empresa.
//
// Node puro, sem Firestore, sem emulador — roda em qualquer CI. As checagens
// estáticas seguem o padrão desta pasta (integridade.test.mjs): comentários
// são removidos antes de escanear, para menção em comentário não dar falso
// positivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function read(f) { return readFileSync(join(ROOT, f), 'utf8'); }
function stripJsComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// ── 1. escHtml: comportamento real ───────────────────────────────────
const { escHtml } = await import(`file://${join(ROOT, 'CRM/shared/sanitize.js')}`);

test('escHtml: escapa os 5 metacaracteres de HTML/atributo', () => {
    assert.equal(
        escHtml(`<img src=x onerror=alert('xss')> & "aspas"`),
        '&lt;img src=x onerror=alert(&#39;xss&#39;)&gt; &amp; &quot;aspas&quot;'
    );
});

test('escHtml: payload típico de nome de cliente vira texto inerte', () => {
    const payload = '<script>document.location="//mal.example"</script>';
    const out = escHtml(payload);
    assert.ok(!out.includes('<'), 'não pode sobrar "<" na saída');
    assert.ok(!out.includes('>'), 'não pode sobrar ">" na saída');
});

test('escHtml: null/undefined viram string vazia; número vira string', () => {
    assert.equal(escHtml(null), '');
    assert.equal(escHtml(undefined), '');
    assert.equal(escHtml(42), '42');
});

test('escHtml: escapa aspas simples e duplas (uso em atributo HTML)', () => {
    assert.equal(escHtml(`a"b'c`), 'a&quot;b&#39;c');
});

// ── 2/3. usuarios-permissoes.js: CSPRNG + PIN removido ───────────────
const UP = 'CRM/pages/usuarios-permissoes/usuarios-permissoes.js';

test('usuarios-permissoes: gerarSenhaTemp usa crypto.getRandomValues, sem Math.random', () => {
    const codigo = stripJsComments(read(UP));
    assert.ok(codigo.includes('crypto.getRandomValues'),
        'gerarSenhaTemp deve usar crypto.getRandomValues (CSPRNG)');
    assert.ok(!/Math\.random\s*\(/.test(codigo),
        'Math.random() não pode voltar a este módulo (gera credencial real)');
});

test('usuarios-permissoes: PIN estático de exclusão não pode voltar', () => {
    const codigo = stripJsComments(read(UP));
    assert.ok(!codigo.includes("'1056'") && !codigo.includes('"1056"'),
        'PIN estático 1056 foi removido (repo público) — não reintroduzir');
    assert.ok(!/SENHA_ADMIN_EXCLUSAO/.test(codigo),
        'constante de senha de exclusão no cliente não pode voltar');
});

// ── 2. saas-admin.js: mesmo padrão CSPRNG ─────────────────────────────
test('saas-admin: geração de senha continua com CSPRNG, sem Math.random', () => {
    const codigo = stripJsComments(read('CRM/pages/saas-admin/saas-admin.js'));
    assert.ok(codigo.includes('crypto.getRandomValues'));
    assert.ok(!/Math\.random\s*\(/.test(codigo));
});

// ── 4. functions/saas.js: ID de empresa sem Math.random ──────────────
test('functions/saas.js: ID de empresa usa crypto, sem Math.random', () => {
    const codigo = stripJsComments(read('functions/saas.js'));
    assert.ok(/crypto\.randomBytes|randomBytes\s*\(/.test(codigo),
        'geração de sufixo de ID deve usar crypto.randomBytes');
    assert.ok(!/Math\.random\s*\(/.test(codigo));
});

// ── 5. Pontos de XSS corrigidos continuam escapando ───────────────────
test('dashboard-ui: modal de alertas escapa dados de OS/cliente', () => {
    const codigo = read('CRM/pages/dashboard/dashboard-ui.js');
    assert.ok(codigo.includes("from '../../shared/sanitize.js'"),
        'dashboard-ui.js deve importar escHtml de shared/sanitize.js');
    assert.ok(codigo.includes('escHtml(os.clientName'),
        'nome do cliente no modal de alertas deve passar por escHtml');
    assert.ok(codigo.includes('escHtml(os.phone)'),
        'telefone no modal de alertas deve passar por escHtml');
    assert.ok(!/\$\{os\.clientName\b/.test(stripJsComments(codigo)),
        'interpolação crua de os.clientName não pode voltar');
});

test('os.js: cards de cliente e busca global escapam nome/telefone', () => {
    const codigo = read('CRM/pages/os/os.js');
    assert.ok(codigo.includes('escHtml(cl.name'),
        'nome do cliente nos cards deve passar por escHtml');
    assert.ok(codigo.includes('escHtml(cl.phone)'),
        'telefone do cliente nos cards deve passar por escHtml');
    const semComentario = stripJsComments(codigo);
    assert.ok(!/client-card-name">\$\{cl\.name/.test(semComentario),
        'interpolação crua de cl.name no card não pode voltar');
});

test('os.js: startOSForClient não interpola phone/name crus no onclick (DT-20)', () => {
    const codigo = stripJsComments(read('CRM/pages/os/os.js'));
    assert.ok(!/startOSForClient\('\$\{client\.(phone|name)/.test(codigo),
        'onclick com phone/name crus reabre XSS em atributo HTML');
    assert.ok(codigo.includes('escHtml(JSON.stringify(client.phone'),
        'phone deve ir via escHtml(JSON.stringify(...))');
    assert.ok(codigo.includes('escHtml(JSON.stringify(client.name'),
        'name deve ir via escHtml(JSON.stringify(...))');
});

test('central-alertas: aparelhos não retirados incluem status legado pronto (DT-22)', () => {
    const codigo = stripJsComments(read('CRM/pages/central-alertas/central-alertas.js'));
    assert.ok(/os\.status\s*!==\s*'concluido'\s*&&\s*os\.status\s*!==\s*'pronto'/.test(codigo)
        || /os\.status\s*===\s*'pronto'/.test(codigo),
        'filtro deve aceitar status legado pronto além de concluido');
});

test('dashboard-alertas: query de não retirados inclui pronto (DT-22)', () => {
    const codigo = stripJsComments(read('CRM/pages/dashboard/dashboard-alertas.js'));
    assert.ok(/where\(\s*'status'\s*,\s*'in'\s*,\s*\[\s*'concluido'\s*,\s*'pronto'\s*\]\s*\)/.test(codigo)
        || /'concluido'\s*,\s*'pronto'/.test(codigo),
        'query Firestore deve incluir pronto via in [...]');
});

// ── 6. Catálogo público: filtro do client casa com a Rule ────────────
test('catalogo-publico: client filtra empresa_id == cellcity-master', () => {
    const codigo = stripJsComments(read('CRM/pages/catalogo/public/catalogo-publico.js'));
    assert.ok(/where\(\s*['"]empresa_id['"]\s*,\s*['"]==['"]\s*,\s*['"]cellcity-master['"]\s*\)/.test(codigo),
        'sem o where() a query anônima é negada pelas Rules (vitrine quebra)');
});

test('firestore.rules: leitura anônima do catálogo restrita a cellcity-master', () => {
    // Cópia canônica: CRM/firestore.rules (é a apontada pelo firebase.json).
    const rules = read('CRM/firestore.rules');
    const bloco = rules.match(/match \/catalogo_produtos\/\{docId\} \{[\s\S]*?\n    \}/);
    assert.ok(bloco, 'bloco match /catalogo_produtos não encontrado');
    assert.ok(bloco[0].includes('request.auth == null'),
        'leitura anônima da vitrine deve continuar prevista');
    assert.ok(bloco[0].includes("== 'cellcity-master'"),
        'leitura anônima deve ficar restrita a cellcity-master');
});
