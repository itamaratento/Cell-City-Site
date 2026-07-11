// Suíte de estrutura do Cell City Control Center — Fase 1 + Fase 1.1
// (2026-07-11: "Refinamento da Arquitetura" e "Ajuste de Arquitetura —
// Padronização dos Menus e Submenus").
//
// Fase 1 entregou só a arquitetura + o menu principal (módulos são
// placeholders). Fase 1.1 substituiu o menu hardcoded por um Manifesto
// (config/modules.conf), moveu a versão pra um arquivo único (VERSION),
// preparou o Estado do Sistema (state/), implementou o Plugin Loader
// (lib/plugin-loader.sh) e padronizou visualmente todo menu/submenu com
// moldura em caixa (lib/ui-box.sh). Ver scripts/control-center/README.md.
//
// Esta suíte não depende de nada fora do repo (não lê ~/.bashrc, não
// precisa do comando `cellcity` instalado — CI roda numa máquina que nunca
// teve esse arquivo). A verificação do comando `cellcity` em si é manual,
// feita na máquina de desenvolvimento antes de cada promoção (ver
// README.md, "Padrão de testes").
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

const ESTADOS = ['release', 'backup', 'homologacao', 'restauracao', 'health-check', 'sincronizacao'];

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

function lerManifesto() {
    const src = readFileSync(join(CC, 'config/modules.conf'), 'utf8');
    return src.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))
        .map(l => {
            const [ordem, slug, rotulo] = l.split('|');
            return { ordem, slug, rotulo };
        });
}

function rodarMenu(stdin, env = {}) {
    return execSync(`bash core/menu.sh`, { cwd: CC, input: stdin, encoding: 'utf8', env: { ...process.env, ...env } });
}

test('estrutura de pastas obrigatória existe (core/modules/lib/state/logs/docs/config/plugins)', () => {
    for (const pasta of ['core', 'modules', 'lib', 'state', 'logs', 'docs', 'config', 'plugins']) {
        assert.ok(existsSync(join(CC, pasta)) && statSync(join(CC, pasta)).isDirectory(),
            `pasta obrigatória ausente: scripts/control-center/${pasta}/`);
    }
});

test('core/menu.sh, lib/common.sh e lib/ui-box.sh existem e são executáveis/legíveis', () => {
    assert.ok(existsSync(join(CC, 'core/menu.sh')), 'core/menu.sh ausente');
    assert.ok(ehExecutavel(join(CC, 'core/menu.sh')), 'core/menu.sh precisa ser executável (chmod +x)');
    assert.ok(existsSync(join(CC, 'lib/common.sh')), 'lib/common.sh ausente');
    assert.ok(existsSync(join(CC, 'lib/ui-box.sh')), 'lib/ui-box.sh ausente (padronização visual da Fase 1.1)');
    assert.match(readFileSync(join(CC, 'lib/common.sh'), 'utf8'), /source "\$CC_ROOT\/lib\/ui-box\.sh"/,
        'lib/common.sh precisa carregar lib/ui-box.sh (todo módulo ganha a moldura via _cc_placeholder)');
});

test('VERSION existe e segue semver (com sufixo opcional tipo -alpha)', () => {
    const versao = readFileSync(join(CC, 'VERSION'), 'utf8').trim();
    assert.match(versao, /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/, `VERSION inválida: "${versao}"`);
});

test('config/control-center.conf define CC_FASE (versão não mora mais aqui)', () => {
    const src = readFileSync(join(CC, 'config/control-center.conf'), 'utf8');
    assert.match(src, /CC_FASE="[^"]+"/);
    assert.doesNotMatch(src, /CC_VERSION=/, 'CC_VERSION não deve mais estar em control-center.conf — fonte única é VERSION');
});

test('Manifesto (config/modules.conf) tem as 9 entradas esperadas, na ordem', () => {
    const manifesto = lerManifesto();
    assert.equal(manifesto.length, 9, `esperava 9 entradas no manifesto, achou ${manifesto.length}`);
    manifesto.forEach((m, i) => {
        assert.equal(m.ordem, String(i + 1), `entrada ${i} do manifesto tem ordem "${m.ordem}", esperava "${i + 1}"`);
        assert.equal(m.slug, MODULOS[i], `entrada ${i} do manifesto tem slug "${m.slug}", esperava "${MODULOS[i]}"`);
        assert.ok(m.rotulo && m.rotulo.trim().length > 0, `entrada ${i} do manifesto sem rótulo`);
    });
});

test('core/menu.sh não hardcoda nenhum módulo — só lê o Manifesto', () => {
    const src = readFileSync(join(CC, 'core/menu.sh'), 'utf8');
    assert.match(src, /config\/modules\.conf/, 'core/menu.sh precisa carregar config/modules.conf');
    for (const modulo of MODULOS) {
        assert.ok(!src.includes(modulo), `core/menu.sh não pode citar o módulo "${modulo}" diretamente — isso é hardcode, some no Manifesto`);
    }
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

test('state/ tem os 6 arquivos de controle esperados, com schema válido', () => {
    for (const nome of ESTADOS) {
        const caminho = join(CC, 'state', `${nome}.json`);
        assert.ok(existsSync(caminho), `state/${nome}.json ausente`);
        const dados = JSON.parse(readFileSync(caminho, 'utf8'));
        assert.ok('descricao' in dados && 'status' in dados, `state/${nome}.json precisa ter "descricao" e "status"`);
    }
});

test('sintaxe bash válida em todos os scripts do Control Center', () => {
    const scripts = listarShellScripts(CC);
    assert.ok(scripts.length >= 12, `esperava pelo menos 12 scripts (core + 9 módulos + lib com 3 arquivos), achou ${scripts.length}`);
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

test('README.md cobre todas as seções obrigatórias', () => {
    const src = readFileSync(join(CC, 'README.md'), 'utf8');
    const secoes = [
        'Objetivo', 'Arquitetura', 'Fluxo de inicialização', 'Roadmap', 'Princípios',
        'Como adicionar um novo módulo', 'Padrão de desenvolvimento',
        'Padrão de menus', 'Padrão de logs', 'Padrão de testes',
        'Padrão de documentação',
    ];
    const ausentes = secoes.filter(s => !src.includes(s));
    assert.deepEqual(ausentes, [], `seções ausentes no README.md: ${ausentes.join(', ')}`);
});

test('menu principal exibe a versão (VERSION) e a Fase automaticamente', () => {
    const versao = readFileSync(join(CC, 'VERSION'), 'utf8').trim();
    const saida = rodarMenu('0\n');
    assert.ok(saida.includes(versao), `cabeçalho do menu não exibiu a versão "${versao}"`);
    assert.match(saida, /Fase \d+/);
});

test('Plugin Loader roda sem nenhum plugin instalado e não quebra', () => {
    rodarMenu('0\n');
    const log = readFileSync(join(CC, 'logs/control-center.log'), 'utf8');
    assert.match(log, /Nenhum plugin encontrado em plugins\//);
});

test('toda tela usa a moldura padrão (lib/ui-box.sh) — bordas presentes, sem cabeçalho antigo', () => {
    const stdin = '1\n\n0\n';
    const saida = rodarMenu(stdin);
    assert.ok(saida.includes('╔') && saida.includes('║') && saida.includes('╚'),
        'saída não contém moldura em caixa (╔/║/╚) — todo menu/submenu precisa usar lib/ui-box.sh');
    assert.doesNotMatch(saida, /^=+$/m, 'cabeçalho antigo (linha só de "=") não pode mais aparecer — ver Fase 1.1');
});

test('moldura fica com bordas alinhadas (todas as linhas da caixa com a mesma largura)', () => {
    const linhas = [];
    for (let i = 1; i <= 9; i++) { linhas.push(String(i)); linhas.push(''); }
    linhas.push('0');
    const saida = rodarMenu(linhas.join('\n') + '\n', { COLUMNS: '80' });
    const linhasCaixa = saida.split('\n').filter(l => /^[║╔╚╠]/.test(l));
    assert.ok(linhasCaixa.length > 20, `esperava várias linhas de caixa, achou ${linhasCaixa.length}`);
    const larguras = new Set(linhasCaixa.map(l => l.length));
    assert.equal(larguras.size, 1, `linhas de caixa com larguras diferentes: ${[...larguras].join(', ')}`);
});

test('moldura é responsiva ao terminal (COLUMNS estreito e largo)', () => {
    const estreita = rodarMenu('0\n', { COLUMNS: '40' });
    const larga = rodarMenu('0\n', { COLUMNS: '200' });
    const topoEstreita = estreita.split('\n').find(l => l.startsWith('╔'));
    const topoLarga = larga.split('\n').find(l => l.startsWith('╔'));
    assert.ok(topoEstreita.length < topoLarga.length,
        'a caixa não se adaptou: terminal estreito deveria gerar uma caixa mais estreita que o terminal largo');
    assert.ok(topoLarga.length <= 60, 'terminal largo não pode deixar a caixa maior que o teto (56 de conteúdo + 4)');
});

test('navegação completa do menu principal (opções 1 a 9 e saída pela opção 0) não crasha', () => {
    const linhas = [];
    for (let i = 1; i <= 9; i++) { linhas.push(String(i)); linhas.push(''); }
    linhas.push('0');
    const stdin = linhas.join('\n') + '\n';

    const saida = rodarMenu(stdin);

    assert.match(saida, /CELL CITY CONTROL CENTER/);
    assert.match(saida, /Saindo do Control Center\./);
    const ocorrencias = [...saida.matchAll(/Módulo em construção\./g)];
    assert.equal(ocorrencias.length, 9, `esperava as 9 telas de placeholder, achou ${ocorrencias.length}`);
});

test('menu principal rejeita opção inválida sem travar', () => {
    const saida = rodarMenu('99\n0\n');
    assert.match(saida, /Opção inválida\./);
    assert.match(saida, /Saindo do Control Center\./);
});
