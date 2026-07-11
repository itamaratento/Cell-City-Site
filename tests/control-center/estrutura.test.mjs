// Suíte de estrutura do Cell City Control Center — Fase 1, Fase 1.1 e
// Fase 1.2 (2026-07-11: "Refinamento da Arquitetura", "Ajuste de
// Arquitetura — Padronização dos Menus e Submenus" e "UX do Terminal").
//
// Fase 1 entregou só a arquitetura + o menu principal (módulos são
// placeholders). Fase 1.1 substituiu o menu hardcoded por um Manifesto
// (config/modules.conf), moveu a versão pra um arquivo único (VERSION),
// preparou o Estado do Sistema (state/) e implementou o Plugin Loader
// (lib/plugin-loader.sh). Fase 1.2 separou a UX em componentes
// reutilizáveis (lib/ui-colors.sh, lib/ui-box.sh, lib/ui-status.sh,
// lib/ui-screen.sh, lib/ui-widgets.sh): moldura em caixa responsiva e
// consciente de ANSI, bloco de status (Projeto/Branch/Status via Git),
// breadcrumb, rodapé com mensagem de ajuda, confirmação e barra de
// progresso. Ver scripts/control-center/README.md.
//
// Esta suíte não depende de nada fora do repo (não lê ~/.bashrc, não
// precisa do comando `cellcity` instalado — CI roda numa máquina que nunca
// teve esse arquivo). A verificação do comando `cellcity` em si é manual,
// feita na máquina de desenvolvimento antes de cada promoção (ver
// README.md, "Padrão de testes").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
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

// Roda um trecho bash com lib/ui-box.sh já carregado — usado pelos testes
// que verificam o comportamento de baixo nível da moldura (alinhamento com
// ANSI embutido), sem precisar de um terminal real (pty).
function rodarComUiBox(script) {
    const preambulo = `CC_ROOT='${CC}'; source '${CC}/lib/ui-box.sh'; `;
    return execSync(`bash -c ${JSON.stringify(preambulo + script)}`, { encoding: 'utf8' });
}

function rodarComUiWidgets(script, stdin = '') {
    const preambulo = `CC_ROOT='${CC}'; source '${CC}/lib/ui-widgets.sh'; `;
    return execSync(`bash -c ${JSON.stringify(preambulo + script)}`, { encoding: 'utf8', input: stdin });
}

function rodarModulo(modulo, stdin, env = {}) {
    return execSync(`bash modules/${modulo}/menu.sh`, { cwd: CC, input: stdin, encoding: 'utf8', env: { ...process.env, ...env } });
}

// Roda _cc_run_submenu isolado, com uma função de teste registrada — prova
// que o motor genérico chama a função certa e devolve o controle (nunca
// sai do processo) quando o usuário escolhe "Voltar".
function rodarSubmenuSintetico(stdin) {
    // Statements separados por ";", nunca por newline real — newline dentro
    // de um argumento com aspas duplas de `bash -c` não sobrevive à camada
    // extra de shell que o execSync usa por padrão (mesma armadilha já
    // corrigida em rodarComUiBox/rodarComUiWidgets).
    const script = [
        `CC_ROOT='${CC}'`,
        `REPO_DIR='${ROOT}'`,
        `source '${CC}/lib/common.sh'`,
        `_teste_acao() { echo "ACAO_CHAMADA"; }`,
        `_cc_run_submenu "Teste" "Control Center › Teste" "1|Item|_teste_acao"`,
        `echo "SUBMENU_RETORNOU"`,
    ].join('; ');
    return execSync(`bash -c ${JSON.stringify(script)}`, { encoding: 'utf8', input: stdin });
}

test('estrutura de pastas obrigatória existe (core/modules/lib/state/logs/docs/config/plugins)', () => {
    for (const pasta of ['core', 'modules', 'lib', 'state', 'logs', 'docs', 'config', 'plugins']) {
        assert.ok(existsSync(join(CC, pasta)) && statSync(join(CC, pasta)).isDirectory(),
            `pasta obrigatória ausente: scripts/control-center/${pasta}/`);
    }
});

test('core/menu.sh e todos os componentes de lib/ existem e são executáveis/legíveis', () => {
    assert.ok(existsSync(join(CC, 'core/menu.sh')), 'core/menu.sh ausente');
    assert.ok(ehExecutavel(join(CC, 'core/menu.sh')), 'core/menu.sh precisa ser executável (chmod +x)');
    const libComum = readFileSync(join(CC, 'lib/common.sh'), 'utf8');
    for (const lib of ['ui-colors.sh', 'ui-box.sh', 'ui-status.sh', 'ui-screen.sh', 'ui-widgets.sh', 'plugin-loader.sh', 'svc-git.sh']) {
        assert.ok(existsSync(join(CC, 'lib', lib)), `lib/${lib} ausente`);
    }
    for (const lib of ['ui-colors.sh', 'ui-box.sh', 'ui-status.sh', 'ui-screen.sh', 'ui-widgets.sh']) {
        assert.match(libComum, new RegExp(`source "\\$CC_ROOT/lib/${lib.replace('.', '\\.')}"`),
            `lib/common.sh precisa carregar lib/${lib} (ponto único de entrada da UX)`);
    }
    // svc-git.sh é opt-in (só Desenvolvimento/Release precisam de Git) —
    // não é transitivo via common.sh, ao contrário dos componentes de UX.
    assert.doesNotMatch(libComum, /source "\$CC_ROOT\/lib\/svc-git\.sh"/,
        'svc-git.sh deve ser carregado só pelos módulos que precisam (Desenvolvimento/Release), não por common.sh');
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
    assert.ok(scripts.length >= 22, `esperava pelo menos 22 scripts (core + 8 lib + 9 módulos + 3 lib/desenvolvimento + 1 lib/release), achou ${scripts.length}`);
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
    const stdin = '3\n\n0\n'; // 3 = Backup e Recuperação, ainda placeholder na Fase 2
    const saida = rodarMenu(stdin);
    assert.ok(saida.includes('╔') && saida.includes('║') && saida.includes('╚'),
        'saída não contém moldura em caixa (╔/║/╚) — todo menu/submenu precisa usar lib/ui-box.sh');
    assert.doesNotMatch(saida, /^=+$/m, 'cabeçalho antigo (linha só de "=") não pode mais aparecer — ver Fase 1.1');
});

test('moldura fica com bordas alinhadas (todas as linhas da caixa com a mesma largura)', () => {
    // Só navega no menu principal (nunca entra em outro módulo) — isolado
    // de propósito de qualquer módulo além do que este teste precisa
    // validar (moldura do menu principal já tem dezenas de linhas de caixa).
    const saida = rodarMenu('0\n', { COLUMNS: '80' });
    const linhasCaixa = saida.split('\n').filter(l => /^[║╔╚╠]/.test(l));
    assert.ok(linhasCaixa.length > 15, `esperava várias linhas de caixa, achou ${linhasCaixa.length}`);
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

test('navegação completa pelo menu principal: entra e volta dos módulos Desenvolvimento e Release, sai pela opção 0', () => {
    // Restrito de propósito aos módulos 1 (Desenvolvimento) e 2 (Release) —
    // são os únicos cujo conteúdo esta suíte controla. Os módulos 3 a 9 são
    // isolados por design (cada um roda como processo próprio via
    // core/menu.sh) e não são exercidos aqui: não há garantia de que
    // continuem placeholder (outras Sprints podem implementá-los a
    // qualquer momento) e testar a interação deles é responsabilidade da
    // suíte de cada módulo, não desta.
    const stdin = ['1', '14', '2', '11', '0'].join('\n') + '\n';

    const saida = rodarMenu(stdin);

    assert.match(saida, /CELL CITY CONTROL CENTER/);
    assert.match(saida, /Saindo do Control Center\./);
    assert.match(saida, /Control Center › Desenvolvimento/);
    assert.match(saida, /Control Center › Release/);
    // depois de voltar dos dois módulos, o menu principal precisa
    // reaparecer (prova que o dispatch devolveu o controle de verdade).
    const aparicoesMenu = [...saida.matchAll(/CELL CITY CONTROL CENTER/g)];
    assert.ok(aparicoesMenu.length >= 3, `esperava o menu principal reaparecer após cada módulo, achou ${aparicoesMenu.length} aparições`);
});

test('menu principal rejeita opção inválida sem travar', () => {
    const saida = rodarMenu('99\n0\n');
    assert.match(saida, /Opção inválida\./);
    assert.match(saida, /Saindo do Control Center\./);
});

// ── Fase 1.2 — "UX do Terminal" ──────────────────────────────────────

test('menu principal exibe o bloco Projeto/Branch/Status com dados reais do Git', () => {
    const branchReal = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const saida = rodarMenu('0\n');
    assert.match(saida, /Projeto\s*: Cell City CRM/);
    assert.ok(saida.includes(`Branch  : ${branchReal}`), `esperava a branch real "${branchReal}" no bloco de status`);
    assert.match(saida, /Status\s*:/);
});

test('telas de módulo exibem breadcrumb (localização atual)', () => {
    const saida = rodarMenu('3\n\n0\n'); // 3 = Backup e Recuperação (placeholder)
    assert.match(saida, /Control Center › Backup e Recuperação/);
});

test('toda tela tem rodapé com mensagem de ajuda antes da borda final', () => {
    const principal = rodarMenu('0\n');
    assert.match(principal, /Use os números para navegar/);
    const placeholder = rodarMenu('3\n\n0\n');
    assert.match(placeholder, /volta ao menu principal/);
    const submenuReal = rodarMenu('1\n14\n0\n');
    assert.match(submenuReal, /volta · 0 sai do Control Center/);
});

test('_cc_visible_len ignora sequências ANSI reais (inclusive \\e(B do tput sgr0) — a mesma classe de bug já encontrada e corrigida nesta Fase', () => {
    const largura = Number(rodarComUiBox('_cc_box_width').trim());
    const textoComAnsi = '\x1b[32mAtenção\x1b(B\x1b[m';
    const linha = rodarComUiBox(`_cc_box_line $'${textoComAnsi.replace(/\x1b/g, '\\x1b')}'`);
    // eslint-disable-next-line no-control-regex
    const semAnsi = linha.replace(/\x1b\[[0-9;]*m|\x1b[()][A-Za-z0-9]/g, '').replace(/\n$/, '');
    assert.equal(semAnsi.length, largura + 4,
        `linha com ANSI saiu com largura visível ${semAnsi.length}, esperava ${largura + 4} (a borda direita desalinharia)`);
});

test('moldura com texto colorido real (pty via `script`) continua alinhada', { skip: !existsSync('/usr/bin/script') && !existsSync('/bin/script') }, () => {
    const log = '/tmp/cc-test-color-align.log';
    execSync(`script -qec "TERM=xterm-256color COLUMNS=80 bash -c \\"printf '0\\\\n' | bash core/menu.sh\\"" ${log}`,
        { cwd: CC, stdio: 'pipe' });
    const bruto = readFileSync(log, 'utf8');
    // eslint-disable-next-line no-control-regex
    const ansi = /\x1b\[[0-9;]*m|\x1b[()][A-Za-z0-9]/g;
    const linhasCaixa = bruto.split(/\r\n|\n/)
        .map(l => l.replace(ansi, ''))
        .filter(l => /^[║╔╚╠]/.test(l));
    assert.ok(linhasCaixa.length > 15, `esperava várias linhas de caixa com pty, achou ${linhasCaixa.length}`);
    const larguras = new Set(linhasCaixa.map(l => l.length));
    assert.equal(larguras.size, 1, `linhas de caixa com cor real e larguras diferentes: ${[...larguras].join(', ')}`);
});

test('ui-colors.sh degrada graciosamente sem tty (execução normal, sem pty)', () => {
    // Toda esta suíte já roda sem tty (execSync não aloca pty) — confirma que,
    // nessa condição real e comum (CI, script chamado de outro script), as
    // variáveis de cor saem vazias e nada quebra ao sourcing.
    const cor = execSync(`bash -c "CC_ROOT='${CC}'; source '${CC}/lib/ui-colors.sh'; echo -n \\"[\\$_CC_C_VERDE]\\""`, { encoding: 'utf8' });
    assert.equal(cor, '[]', 'sem tty, as variáveis de cor precisam ficar vazias (nunca quebrar)');
});

test('ui-colors.sh também respeita a convenção NO_COLOR explicitamente no código', () => {
    const src = readFileSync(join(CC, 'lib/ui-colors.sh'), 'utf8');
    assert.match(src, /NO_COLOR/, 'ui-colors.sh precisa checar a variável de convenção NO_COLOR');
});

test('_cc_confirm interpreta s/S como sim e qualquer outra resposta (inclusive vazia) como não', () => {
    const sim = rodarComUiWidgets('_cc_confirm "?" && echo SIM || echo NAO', 's\n');
    const nao = rodarComUiWidgets('_cc_confirm "?" && echo SIM || echo NAO', '\n');
    assert.match(sim, /SIM/);
    assert.match(nao, /NAO/);
});

test('_cc_bar não imprime caractere sobrando nos limites (0% e 100%) — armadilha real do printf com seq vazio', () => {
    const zero = rodarComUiWidgets('_cc_bar 0 10 10');
    const cem = rodarComUiWidgets('_cc_bar 10 10 10');
    assert.equal(zero.trim(), '[----------] 0%');
    assert.equal(cem.trim(), '[██████████] 100%');
});

// ── Fase 2 — "Desenvolvimento + Release" ─────────────────────────────

test('_cc_run_submenu: "Voltar" é o número seguinte ao último item e devolve o controle (nunca sai do processo)', () => {
    const saida = rodarSubmenuSintetico('1\n\n2\n');
    assert.match(saida, /1 ► Item/);
    assert.match(saida, /2 ► Voltar/, 'com 1 item real, Voltar precisa ser "2" (não um número fixo como "9")');
    assert.match(saida, /ACAO_CHAMADA/, 'a função associada ao item 1 precisa ser chamada');
    assert.match(saida, /SUBMENU_RETORNOU/, '_cc_run_submenu precisa retornar (return), nunca chamar exit, quando o usuário escolhe Voltar');
});

test('_cc_run_submenu: opção "0" sai do Control Center inteiro, de dentro de qualquer submenu', () => {
    const saida = rodarSubmenuSintetico('0\n');
    assert.match(saida, /Saindo do Control Center\./);
    assert.doesNotMatch(saida, /SUBMENU_RETORNOU/, 'opção 0 precisa sair do processo, não retornar pro chamador');
});

test('módulo Desenvolvimento: interface (menu.sh) só desenha — nenhuma chamada direta a git/npm fora da camada de serviço', () => {
    const src = readFileSync(join(CC, 'modules/desenvolvimento/menu.sh'), 'utf8');
    assert.doesNotMatch(src, /\bgit\s|\bnpm\s/, 'menu.sh (Interface) não pode chamar git/npm diretamente — isso é regra de negócio, pertence à camada de Serviço (lib/*.sh)');
    for (const lib of ['status.sh', 'comandos.sh', 'utilitarios.sh']) {
        const caminho = join(CC, 'modules/desenvolvimento/lib', lib);
        assert.ok(existsSync(caminho), `modules/desenvolvimento/lib/${lib} ausente`);
        assert.ok(ehExecutavel(caminho), `modules/desenvolvimento/lib/${lib} precisa ser executável`);
    }
});

test('módulo Release: interface (menu.sh) só desenha — nenhuma chamada direta a git fora da camada de serviço', () => {
    const src = readFileSync(join(CC, 'modules/release/menu.sh'), 'utf8');
    assert.doesNotMatch(src, /\bgit\s/, 'menu.sh (Interface) não pode chamar git diretamente — pertence à camada de Serviço (lib/release.sh)');
    const caminho = join(CC, 'modules/release/lib/release.sh');
    assert.ok(existsSync(caminho) && ehExecutavel(caminho), 'modules/release/lib/release.sh ausente ou não executável');
});

test('módulo Release: "Executar Testes"/"Checklist"/"Build Final" delegam pro pipeline existente (não reimplementam)', () => {
    const src = readFileSync(join(CC, 'modules/release/lib/release.sh'), 'utf8');
    assert.match(src, /release-center\.sh"\s*$/m, 'precisa chamar scripts/release/release-center.sh, não reimplementar');
    assert.match(src, /printf '2\\n0\\n' \| bash/, '"Executar Testes" precisa selecionar a opção 2 (Release Completa) de forma não-interativa');
    assert.match(src, /printf '3\\n0\\n' \| bash/, '"Checklist de Release" precisa selecionar a opção 3 (Certificação) de forma não-interativa');
    assert.match(src, /validar-deploy\.sh/, '"Build Final" precisa chamar scripts/release/validar-deploy.sh, não reimplementar');
});

test('módulo Release: "Enviar Alterações"/"Criar Tag e Publicar" envelopam subir/subir-ok — não reimplementam tag/push/promoção', () => {
    const src = readFileSync(join(CC, 'modules/release/lib/release.sh'), 'utf8');
    assert.match(src, /type subir\b.*>\/dev\/null/s, 'precisa checar se a função subir existe antes de chamar (bash -i -c)');
    assert.match(src, /type subir-ok\b.*>\/dev\/null/s, 'precisa checar se a função subir-ok existe antes de chamar (bash -i -c)');
    assert.doesNotMatch(src, /git\s+tag\s|git\s+push\s+origin\s+main/, 'não pode reimplementar criação de tag nem push direto pra main — isso é trabalho do subir-ok existente');
});

test('módulo Release: ações destrutivas (subir/subir-ok/rollback) pedem confirmação e cancelam de verdade (sem tocar em git)', () => {
    const antesHead = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const antesTags = execSync("git tag -l 'v*'", { cwd: ROOT, encoding: 'utf8' }).trim();

    const subir = rodarModulo('release', '8\nn\n\n11\n0\n');
    assert.match(subir, /Cancelado\./);

    const subirOk = rodarModulo('release', '9\nn\n\n11\n0\n');
    assert.match(subirOk, /Cancelado\./);

    const rollback = rodarModulo('release', '10\nn\n\n11\n0\n');
    assert.match(rollback, /Cancelado\./);

    const depoisHead = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const depoisTags = execSync("git tag -l 'v*'", { cwd: ROOT, encoding: 'utf8' }).trim();
    assert.equal(depoisHead, antesHead, 'HEAD não pode mudar quando a confirmação é recusada');
    assert.equal(depoisTags, antesTags, 'nenhuma tag nova pode ser criada quando a confirmação é recusada');
});

test('módulo Release: Validar Branch/Workspace/Changelog/Histórico mostram dados reais do Git', () => {
    const branchReal = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const saida = rodarModulo('release', '1\n\n2\n\n3\n\n7\n\n11\n0\n');
    assert.ok(saida.includes(`Branch atual: ${branchReal}`), 'Validar Branch precisa mostrar a branch real');
    assert.match(saida, /Working tree (limpo|com \d+ arquivo)/);
    assert.match(saida, /commit\(s\) desde/);
    assert.match(saida, /Últimas \d+ versões|Nenhuma release/);
    assert.match(saida, /11 ► Voltar/, 'Release tem 10 itens reais — Voltar precisa ser "11"');
});

test('módulo Desenvolvimento: Status/Git Status/Diff/Log/Alterações Locais mostram dados reais do Git', () => {
    const branchReal = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const saida = rodarModulo('desenvolvimento', '1\n\n2\n\n4\n\n5\n\n14\n0\n');
    assert.ok(saida.includes(`Branch atual   : ${branchReal}`), 'Status do Projeto precisa mostrar a branch real');
    assert.match(saida, /Último commit  : [0-9a-f]{7,}/, 'Status do Projeto precisa mostrar um hash de commit real');
    assert.match(saida, /On branch|Your branch/, 'Git Status precisa mostrar a saída real de "git status"');
    assert.match(saida, /14 ► Voltar/, 'Desenvolvimento tem 13 itens reais — Voltar precisa ser "14"');
});

test('módulo Desenvolvimento: Limpeza de Cache pede confirmação e cancela sem apagar nada', () => {
    // Cria um alvo garantido (firestore-debug.log na raiz é um dos caminhos
    // que _dev_limpeza_cache já procura) — sem isso, o teste dependeria do
    // estado ambiente (se alguém já rodou a limpeza antes, "Nada para
    // limpar" também seria uma resposta honesta, só que não a que este
    // teste quer verificar).
    const alvo = join(ROOT, 'firestore-debug.log');
    const jaExistia = existsSync(alvo);
    if (!jaExistia) writeFileSync(alvo, 'log de teste — descartável\n');
    try {
        const saida = rodarModulo('desenvolvimento', '10\nn\n\n14\n0\n');
        assert.match(saida, /Itens a remover:/);
        assert.match(saida, /Cancelado\./);
        assert.ok(existsSync(alvo), 'o arquivo não pode ser removido quando a confirmação é recusada');
    } finally {
        if (!jaExistia) rmSync(alvo, { force: true });
    }
});

test('módulo Desenvolvimento: Atualizar Dependências pede confirmação e cancela sem rodar npm', () => {
    const deps = rodarModulo('desenvolvimento', '11\nn\n\n14\n0\n');
    assert.match(deps, /Cancelado\./);
});

test('módulo Desenvolvimento: Build/Lint/Formatação relatam honestamente o que existe no projeto (sem fingir ferramenta que não existe)', () => {
    const saida = rodarModulo('desenvolvimento', '6\n\n8\n\n9\n\n14\n0\n');
    assert.match(saida, /não tem build step/);
    assert.match(saida, /Lint não configurado|ESLint encontrada/);
    assert.match(saida, /Formatação automática não configurada|Prettier encontrada/);
});

test('lib/svc-git.sh: funções de serviço retornam dados consistentes com o estado real do repositório', () => {
    const branchReal = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const preambulo = `CC_ROOT='${CC}'; REPO_DIR='${ROOT}'; source '${CC}/lib/common.sh'; source '${CC}/lib/svc-git.sh'; `;
    const rodar = (script) => execSync(`bash -c ${JSON.stringify(preambulo + script)}`, { encoding: 'utf8' }).trim();

    const total = Number(rodar('_cc_svc_git_arquivos_alterados_count'));
    assert.ok(Number.isInteger(total) && total >= 0, `contagem de arquivos alterados inválida: ${total}`);

    const ultimo = rodar('_cc_svc_git_ultimo_commit');
    assert.match(ultimo, /^[0-9a-f]{7,}\s/, `_cc_svc_git_ultimo_commit não parece um commit real: "${ultimo}"`);

    let reconhecida;
    try {
        execSync(`bash -c ${JSON.stringify(preambulo + '_cc_svc_git_branch_reconhecida')}`, { stdio: 'pipe' });
        reconhecida = 0;
    } catch (e) {
        reconhecida = e.status;
    }
    const esperado = /^(develop|main)$/.test(branchReal) ? 0 : 1;
    assert.equal(reconhecida, esperado, `_cc_svc_git_branch_reconhecida deveria refletir a branch real (${branchReal})`);
});
