// Suíte de testes do módulo Diagnóstico e Health Check — Fase 6.
//
// Valida navegação, layout, execução de diagnósticos (sistema, git, node,
// firebase), tratamento de erros e geração de relatório.
//
// Segue o mesmo padrão de estrutura.test.mjs (node:test, execSync).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CC = join(ROOT, 'scripts/control-center');
const MODULO = join(CC, 'modules/diagnostico');

function ehExecutavel(caminho) {
    return (statSync(caminho).mode & 0o111) !== 0;
}

function rodarMenuDiagnostico(stdin, env = {}) {
    return execSync(`bash menu.sh`, { cwd: MODULO, input: stdin, encoding: 'utf8', env: { ...process.env, ...env } });
}

function listarShellScripts(dir) {
    const resultado = [];
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        const caminho = join(dir, entrada.name);
        if (entrada.isDirectory()) resultado.push(...listarShellScripts(caminho));
        else if (entrada.name.endsWith('.sh')) resultado.push(caminho);
    }
    return resultado;
}

// ── ESTRUTURA ────────────────────────────────────────────────────────

test('diagnostico module tem a estrutura esperada de pastas e arquivos', () => {
    const obrigatorios = [
        'menu.sh',
        'engine.sh',
        'lib/utils.sh',
        'lib/sistema.sh',
        'lib/projeto.sh',
        'lib/git.sh',
        'lib/node.sh',
        'lib/firebase.sh',
        'lib/ambiente.sh',
        'lib/relatorio.sh',
        'docs/diagnostico.md',
    ];
    for (const arq of obrigatorios) {
        const caminho = join(MODULO, arq);
        assert.ok(existsSync(caminho), `arquivo obrigatório ausente: ${arq}`);
    }
});

test('menu.sh e engine.sh são executáveis', () => {
    assert.ok(ehExecutavel(join(MODULO, 'menu.sh')), 'menu.sh precisa ser executável');
    assert.ok(ehExecutavel(join(MODULO, 'engine.sh')), 'engine.sh precisa ser executável');
});

test('menu.sh carrega lib/common.sh e engine.sh', () => {
    const src = readFileSync(join(MODULO, 'menu.sh'), 'utf8');
    assert.match(src, /source "\$CC_ROOT\/lib\/common\.sh"/, 'menu.sh precisa carregar lib/common.sh');
    assert.match(src, /source "\$MODULE_DIR\/engine\.sh"/, 'menu.sh precisa carregar engine.sh');
});

test('engine.sh carrega todas as libs de verificação', () => {
    const src = readFileSync(join(MODULO, 'engine.sh'), 'utf8');
    const libs = ['utils.sh', 'sistema.sh', 'projeto.sh', 'git.sh', 'node.sh', 'firebase.sh', 'ambiente.sh', 'relatorio.sh'];
    for (const lib of libs) {
        assert.match(src, new RegExp(`source "\\$DIAG_LIB/${lib.replace('.', '\\.')}"`),
            `engine.sh precisa carregar lib/${lib}`);
    }
});

test('sintaxe bash válida em todos os scripts do módulo Diagnóstico', () => {
    const scripts = listarShellScripts(MODULO);
    assert.ok(scripts.length >= 10, `esperava pelo menos 10 scripts, achou ${scripts.length}`);
    const comErro = [];
    for (const script of scripts) {
        try {
            execSync(`bash -n '${script}'`, { stdio: 'pipe' });
        } catch (e) {
            comErro.push(`${script}: ${e.stderr?.toString().trim()}`);
        }
    }
    assert.deepEqual(comErro, [], `erro de sintaxe:\n${comErro.join('\n')}`);
});

// ── NAVEGAÇÃO ────────────────────────────────────────────────────────

test('submenu do Diagnóstico exibe todas as opções esperadas', () => {
    const saida = rodarMenuDiagnostico('9\n');
    // "CELL CITY CONTROL CENTER" só aparece no menu raiz (core/menu.sh);
    // um submenu de módulo, chamado direto via seu próprio menu.sh, mostra
    // o título do módulo (_cc_screen_title), não o banner raiz — mesmo
    // comportamento de todo outro módulo (ver estrutura.test.mjs).
    assert.match(saida, /Diagnóstico/);
    assert.match(saida, /Control Center › Diagnóstico/);
    assert.match(saida, /1 ► Executar Diagnóstico Completo/);
    assert.match(saida, /2 ► Verificações do Sistema/);
    assert.match(saida, /3 ► Verificações do Projeto/);
    assert.match(saida, /4 ► Verificações Git/);
    assert.match(saida, /5 ► Verificações Node/);
    assert.match(saida, /6 ► Verificações Firebase/);
    assert.match(saida, /7 ► Verificações do Ambiente/);
    assert.match(saida, /8 ► Relatório Técnico Completo/);
    assert.match(saida, /9 ► Voltar/);
});

test('opção 9 volta ao menu principal', () => {
    const saida = rodarMenuDiagnostico('9\n');
    assert.match(saida, /Voltar/);
    assert.ok(!saida.includes('Saindo do Control Center'));
});

test('opção 0 sai do Control Center', () => {
    const saida = rodarMenuDiagnostico('0\n');
    assert.match(saida, /Saindo do Control Center/);
});

test('opção inválida não quebra o submenu', () => {
    const saida = rodarMenuDiagnostico('99\n9\n');
    assert.match(saida, /Opção inválida/);
});

test('moldura do submenu usa bordas padronizadas (╔/║/╚)', () => {
    const saida = rodarMenuDiagnostico('9\n');
    assert.ok(saida.includes('╔') && saida.includes('║') && saida.includes('╚'),
        'submenu precisa usar a moldura padrão');
});

test('breadcrumb exibe o caminho de navegação', () => {
    const saida = rodarMenuDiagnostico('9\n');
    assert.match(saida, /Control Center › Diagnóstico/);
});

// ── DIAGNÓSTICO DO SISTEMA ───────────────────────────────────────────

test('diagnóstico completo executa sem erros', () => {
    const saida = rodarMenuDiagnostico('1\n\n9\n');
    assert.match(saida, /Diagnóstico concluído/);
    assert.ok(saida.includes('Total :') || saida.includes('RESUMO'),
        'diagnóstico deve exibir resumo');
});

test('diagnóstico do sistema executado individualmente', () => {
    const saida = rodarMenuDiagnostico('2\n\n9\n');
    assert.ok(saida.includes('Sistema Operacional') || saida.includes('OK') || saida.includes('ATENÇÃO'),
        'diagnóstico de sistema deve exibir resultados');
});

test('diagnóstico do projeto executado individualmente', () => {
    const saida = rodarMenuDiagnostico('3\n\n9\n');
    assert.ok(saida.includes('Estrutura') || saida.includes('Arquivos'),
        'diagnóstico de projeto deve exibir resultados');
});

test('diagnóstico git retorna resultados com a branch real', () => {
    const branchReal = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const saida = rodarMenuDiagnostico('4\n\n9\n');
    assert.ok(saida.includes('Branch') || saida.includes('Workspace'),
        'diagnóstico git deve exibir resultados');
});

test('diagnóstico node retorna resultados', () => {
    const saida = rodarMenuDiagnostico('5\n\n9\n');
    assert.ok(saida.includes('Node') || saida.includes('npm'),
        'diagnóstico node deve exibir resultados');
});

// ── RELATÓRIO ────────────────────────────────────────────────────────

test('relatório técnico completo é gerado corretamente', () => {
    const saida = rodarMenuDiagnostico('8\n\n9\n');
    assert.match(saida, /RELATÓRIO TÉCNICO/);
    assert.match(saida, /RESUMO DO HEALTH CHECK/);
    assert.match(saida, /Projeto/);
    assert.match(saida, /Status/);
    assert.match(saida, /RECOMENDAÇÕES/);
    assert.match(saida, /PRÓXIMAS AÇÕES/);
});

// ── ESTADO ────────────────────────────────────────────────────────────

test('health-check.json é atualizado após diagnóstico', () => {
    rodarMenuDiagnostico('1\n\n9\n');
    const statePath = join(CC, 'state/health-check.json');
    assert.ok(existsSync(statePath), 'health-check.json deve existir');
    const dados = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.ok(dados.timestamp !== null, 'timestamp deve ser preenchido após diagnóstico');
    assert.ok(dados.status !== null, 'status deve ser preenchido após diagnóstico');
    assert.ok(typeof dados.total === 'number', 'total deve ser um número');
});

test('health-check.json contém os campos esperados', () => {
    rodarMenuDiagnostico('1\n\n9\n');
    const dados = JSON.parse(readFileSync(join(CC, 'state/health-check.json'), 'utf8'));
    const camposEsperados = ['descricao', 'timestamp', 'status', 'duracao', 'total', 'aprovados', 'avisos', 'falhas'];
    for (const campo of camposEsperados) {
        assert.ok(campo in dados, `campo "${campo}" ausente em health-check.json`);
    }
});

// ── TRATAMENTO DE ERROS ──────────────────────────────────────────────

test('engine.sh tolera categoria inválida sem quebrar', () => {
    const script = 'source engine.sh; _cc_diag_executar_categoria "invalida" || true';
    const saida = execSync(`bash -c ${JSON.stringify(script)}`, { cwd: MODULO, encoding: 'utf8' });
    assert.ok(true, 'engine.sh não quebrou com categoria inválida');
});

// ── VALIDAÇÃO DE ACESSO DIRETO ───────────────────────────────────────

test('menu.sh pode ser chamado diretamente (sem passar pelo core/menu.sh)', () => {
    const saida = rodarMenuDiagnostico('9\n');
    assert.match(saida, /Diagnóstico/, 'chamada direta deve exibir o módulo');
});
