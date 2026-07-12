// Suíte de testes do módulo Ferramentas, Auditorias e Relatórios — Fase 7.
//
// Valida navegação, layout, execução de auditorias, relatórios, exportações
// e utilitários. Segue o padrão de diagnostico.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CC = join(ROOT, 'scripts/control-center');
const MODULO = join(CC, 'modules/ferramentas');

function ehExecutavel(caminho) {
    return (statSync(caminho).mode & 0o111) !== 0;
}

function rodarMenuFerramentas(stdin, env = {}) {
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

test('ferramentas module tem a estrutura esperada de pastas e arquivos', () => {
    const obrigatorios = [
        'menu.sh',
        'engine.sh',
        'lib/utils.sh',
        'lib/auditoria-geral.sh',
        'lib/auditoria-seguranca.sh',
        'lib/auditoria-git.sh',
        'lib/auditoria-firebase.sh',
        'lib/auditoria-node.sh',
        'lib/auditoria-bash.sh',
        'lib/relatorios.sh',
        'lib/exportacao.sh',
        'lib/utilitarios.sh',
        'docs/ferramentas.md',
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
    const libs = ['utils.sh', 'auditoria-geral.sh', 'auditoria-seguranca.sh', 'auditoria-git.sh',
                  'auditoria-firebase.sh', 'auditoria-node.sh', 'auditoria-bash.sh',
                  'relatorios.sh', 'exportacao.sh', 'utilitarios.sh'];
    for (const lib of libs) {
        assert.match(src, new RegExp(`source "\\$FERR_LIB/${lib.replace('.', '\\.')}"`),
            `engine.sh precisa carregar lib/${lib}`);
    }
});

test('sintaxe bash válida em todos os scripts do módulo Ferramentas', () => {
    const scripts = listarShellScripts(MODULO);
    assert.ok(scripts.length >= 12, `esperava pelo menos 12 scripts, achou ${scripts.length}`);
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

test('submenu exibe todas as opções esperadas', () => {
    const saida = rodarMenuFerramentas('10\n');
    // "CELL CITY CONTROL CENTER" só aparece no menu raiz (core/menu.sh) —
    // um submenu de módulo mostra seu próprio título (mesmo padrão de
    // todo outro módulo, ver estrutura.test.mjs/diagnostico.test.mjs).
    assert.match(saida, /Ferramentas/);
    assert.match(saida, /Control Center › Ferramentas/);
    assert.match(saida, /1 ► Auditoria Geral/);
    assert.match(saida, /2 ► Auditoria de Segurança/);
    assert.match(saida, /3 ► Auditoria do Git/);
    assert.match(saida, /4 ► Auditoria Firebase/);
    assert.match(saida, /5 ► Auditoria Node/);
    assert.match(saida, /6 ► Auditoria Bash/);
    assert.match(saida, /7 ► Gerar Relatórios/);
    assert.match(saida, /8 ► Exportações/);
    assert.match(saida, /9 ► Utilitários/);
    assert.match(saida, /10 ► Voltar/);
});

// "Voltar" é dinâmico (N+1 = 10, 9 itens reais — mesmo framework
// _cc_run_submenu de todo outro módulo); "0" sempre sai do Control
// Center inteiro, nunca só "volta ao menu principal" (a implementação
// original tinha um loop próprio com "0 = Voltar", inconsistente com o
// resto do projeto — corrigido nesta revisão, ver docs/ferramentas.md).
test('"Voltar" (10) retorna sem sair do Control Center', () => {
    const saida = rodarMenuFerramentas('10\n');
    assert.match(saida, /10 ► Voltar/);
    assert.ok(!saida.includes('Saindo do Control Center'));
});

test('opção 0 sai do Control Center', () => {
    const saida = rodarMenuFerramentas('0\n');
    assert.match(saida, /Saindo do Control Center/);
});

test('opção inválida não quebra o submenu', () => {
    const saida = rodarMenuFerramentas('99\n10\n');
    assert.match(saida, /Opção inválida/);
});

test('moldura do submenu usa bordas padronizadas (╔/║/╚)', () => {
    const saida = rodarMenuFerramentas('10\n');
    assert.ok(saida.includes('╔') && saida.includes('║') && saida.includes('╚'));
});

test('breadcrumb exibe o caminho de navegação', () => {
    const saida = rodarMenuFerramentas('10\n');
    assert.match(saida, /Control Center › Ferramentas/);
});

// ── AUDITORIAS ───────────────────────────────────────────────────────

test('auditoria geral executa sem erros', () => {
    const saida = rodarMenuFerramentas('1\n\n0\n');
    assert.ok(saida.includes('Total :') || saida.includes('RESUMO'),
        'auditoria deve exibir resumo');
});

test('auditoria segurança executa sem erros', () => {
    const saida = rodarMenuFerramentas('2\n\n0\n');
    assert.ok(saida.includes('Arquivos Sensíveis') || saida.includes('RESUMO'),
        'auditoria de segurança deve exibir resultados');
});

test('auditoria git retorna resultados', () => {
    const saida = rodarMenuFerramentas('3\n\n0\n');
    assert.ok(saida.includes('Branch') || saida.includes('Commits'),
        'auditoria git deve exibir resultados');
});

test('auditoria firebase executa sem erros', () => {
    const saida = rodarMenuFerramentas('4\n\n0\n');
    assert.ok(true, 'auditoria firebase executou sem crash');
});

test('auditoria node executa sem erros', () => {
    const saida = rodarMenuFerramentas('5\n\n0\n');
    assert.ok(saida.includes('package.json') || saida.includes('Dependências'),
        'auditoria node deve exibir resultados');
});

test('auditoria bash executa sem erros', () => {
    const saida = rodarMenuFerramentas('6\n\n0\n');
    assert.ok(saida.includes('Sintaxe Bash') || saida.includes('Permissões'),
        'auditoria bash deve exibir resultados');
});

// ── RELATÓRIOS ───────────────────────────────────────────────────────

// Sub-telas de Relatórios/Exportações/Utilitários (7/8/9) têm loop local
// próprio (9=Voltar local, 0=Sair) — ao retornar pra `_cc_run_submenu`
// (nível principal), o framework sempre insere uma pausa extra
// ("Pressione ENTER...") antes de aceitar a próxima opção do menu
// principal. Cada `\n` a mais nas sequências abaixo é essa pausa.

test('menu de relatórios abre corretamente', () => {
    const saida = rodarMenuFerramentas('7\n9\n\n0\n');
    assert.match(saida, /GERAR RELATÓRIOS/);
    assert.match(saida, /Relatório Geral/);
    assert.match(saida, /Relatório Técnico/);
    assert.match(saida, /Relatório Executivo/);
    assert.match(saida, /Relatório de Segurança/);
});

test('relatório geral é exibido', () => {
    const saida = rodarMenuFerramentas('7\n1\n\n9\n\n0\n');
    assert.match(saida, /RELATÓRIO GERAL/);
    assert.match(saida, /Cell City CRM/);
});

test('relatório executivo é exibido', () => {
    const saida = rodarMenuFerramentas('7\n3\n\n9\n\n0\n');
    assert.match(saida, /RELATÓRIO EXECUTIVO/);
    assert.match(saida, /Módulos disponíveis/);
});

// ── EXPORTAÇÕES ─────────────────────────────────────────────────────

test('menu de exportações abre corretamente', () => {
    const saida = rodarMenuFerramentas('8\n9\n\n0\n');
    assert.match(saida, /EXPORTAÇÕES/);
});

// ── UTILITÁRIOS ──────────────────────────────────────────────────────

test('menu de utilitários abre corretamente', () => {
    const saida = rodarMenuFerramentas('9\n9\n\n0\n');
    assert.match(saida, /UTILITÁRIOS/);
});

test('informações do ambiente são exibidas', () => {
    const saida = rodarMenuFerramentas('9\n4\n\n9\n\n0\n');
    assert.ok(saida.includes('Sistema') || saida.includes('Hostname'),
        'info ambiente deve exibir dados do sistema');
});

test('informações do projeto são exibidas', () => {
    const saida = rodarMenuFerramentas('9\n5\n\n9\n\n0\n');
    assert.ok(saida.includes('Projeto') || saida.includes('Diretório'),
        'info projeto deve exibir dados do projeto');
});

// ── VALIDAÇÃO DE ISOLAMENTO ──────────────────────────────────────────

test('menu.sh pode ser chamado diretamente (sem core/menu.sh)', () => {
    const saida = rodarMenuFerramentas('0\n');
    assert.match(saida, /Ferramentas/, 'chamada direta deve exibir o módulo');
});
