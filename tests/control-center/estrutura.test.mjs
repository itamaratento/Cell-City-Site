// Suíte de estrutura do Cell City Control Center — Fase 1 (2026-07-11).
//
// Fase 1 entrega só a arquitetura + o menu principal (módulos são
// placeholders — ver scripts/control-center/README.md, seção Roadmap).
// Esta suíte valida exatamente isso, sem depender de nada fora do repo
// (não lê ~/.bashrc, não precisa do comando `cellcity` instalado — CI roda
// numa máquina que nunca teve esse arquivo). A verificação do comando
// `cellcity` em si é manual, feita na máquina de desenvolvimento antes de
// cada promoção (ver README.md, "Padrão de testes").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CC = join(ROOT, 'scripts/control-center');

const MODULOS = [
    'desenvolvimento', 'release', 'backup-recuperacao', 'banco-dados',
    'branches-sincronizacao', 'diagnostico', 'ferramentas', 'central-ias',
    'configuracoes',
];

function ehExecutavel(caminho) {
    return (statSync(caminho).mode & 0o111) !== 0;
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

test('estrutura de pastas obrigatória existe (core/modules/lib/logs/docs/config/plugins)', () => {
    for (const pasta of ['core', 'modules', 'lib', 'logs', 'docs', 'config', 'plugins']) {
        assert.ok(existsSync(join(CC, pasta)) && statSync(join(CC, pasta)).isDirectory(),
            `pasta obrigatória ausente: scripts/control-center/${pasta}/`);
    }
});

test('core/menu.sh e lib/common.sh existem e são executáveis/legíveis', () => {
    assert.ok(existsSync(join(CC, 'core/menu.sh')), 'core/menu.sh ausente');
    assert.ok(ehExecutavel(join(CC, 'core/menu.sh')), 'core/menu.sh precisa ser executável (chmod +x)');
    assert.ok(existsSync(join(CC, 'lib/common.sh')), 'lib/common.sh ausente');
});

test('config/control-center.conf define CC_VERSION e CC_FASE', () => {
    const src = readFileSync(join(CC, 'config/control-center.conf'), 'utf8');
    assert.match(src, /CC_VERSION="[^"]+"/);
    assert.match(src, /CC_FASE="[^"]+"/);
});

test('todo módulo do menu principal tem um menu.sh executável e isolado', () => {
    for (const modulo of MODULOS) {
        const caminho = join(CC, 'modules', modulo, 'menu.sh');
        assert.ok(existsSync(caminho), `módulo sem menu.sh: modules/${modulo}/`);
        assert.ok(ehExecutavel(caminho), `menu.sh não executável: modules/${modulo}/menu.sh (chmod +x)`);
        const src = readFileSync(caminho, 'utf8');
        assert.match(src, /source "\$CC_ROOT\/lib\/common\.sh"/,
            `modules/${modulo}/menu.sh precisa carregar lib/common.sh`);
    }
});

test('core/menu.sh despacha as 9 opções do menu para os 9 módulos esperados', () => {
    const src = readFileSync(join(CC, 'core/menu.sh'), 'utf8');
    MODULOS.forEach((modulo, i) => {
        const opcao = i + 1;
        assert.match(src, new RegExp(`${opcao}\\)\\s*bash "\\$MODULES_DIR/${modulo}/menu\\.sh"`),
            `core/menu.sh não despacha a opção ${opcao} para modules/${modulo}/menu.sh`);
    });
});

test('sintaxe bash válida em todos os scripts do Control Center', () => {
    const scripts = listarShellScripts(CC);
    assert.ok(scripts.length >= 10, `esperava pelo menos 10 scripts (core + 9 módulos + lib), achou ${scripts.length}`);
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

test('README.md cobre todas as seções obrigatórias da Fase 1', () => {
    const src = readFileSync(join(CC, 'README.md'), 'utf8');
    const secoes = [
        'Objetivo', 'Arquitetura', 'Roadmap', 'Princípios',
        'Como adicionar um novo módulo', 'Padrão de desenvolvimento',
        'Padrão de menus', 'Padrão de logs', 'Padrão de testes',
        'Padrão de documentação',
    ];
    const ausentes = secoes.filter(s => !src.includes(s));
    assert.deepEqual(ausentes, [], `seções ausentes no README.md: ${ausentes.join(', ')}`);
});

test('navegação completa do menu principal (opções 1 a 9 e saída pela opção 0) não crasha', () => {
    const linhas = [];
    for (let i = 1; i <= 9; i++) { linhas.push(String(i)); linhas.push(''); }
    linhas.push('0');
    const stdin = linhas.join('\n') + '\n';

    const saida = execSync(`bash core/menu.sh`, { cwd: CC, input: stdin, encoding: 'utf8' });

    assert.match(saida, /CELL CITY CONTROL CENTER/);
    assert.match(saida, /Saindo do Control Center\./);
    const ocorrencias = [...saida.matchAll(/🚧 Módulo em construção\./g)];
    assert.equal(ocorrencias.length, 9, `esperava as 9 telas de placeholder, achou ${ocorrencias.length}`);
});

test('menu principal rejeita opção inválida sem travar', () => {
    const stdin = '99\n0\n';
    const saida = execSync(`bash core/menu.sh`, { cwd: CC, input: stdin, encoding: 'utf8' });
    assert.match(saida, /Opção inválida\./);
    assert.match(saida, /Saindo do Control Center\./);
});
