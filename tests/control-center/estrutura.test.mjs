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
import { existsSync, statSync, readFileSync, readdirSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CC = join(ROOT, 'scripts/control-center');

// Registro de Fases real (fonte única do módulo Central de IAs). Os testes
// abaixo derivam as contagens daqui — a intenção deles sempre foi "números
// coerentes com fases.conf", mas pinavam valores (5/11, 45%, Pendente) que
// ficaram obsoletos quando 5f9a64d marcou as fases 6-11 como CONCLUIDA.
const FASES = readFileSync(join(CC, 'modules/central-ias/config/fases.conf'), 'utf8')
    .split('\n').filter((l) => /^\d+\|/.test(l))
    .map((l) => { const [num, nome, ia, status] = l.split('|'); return { num: +num, nome, ia, status }; });
const FASES_CONCLUIDAS = FASES.filter((f) => f.status === 'CONCLUIDA').length;
const FASES_PCT = Math.floor((FASES_CONCLUIDAS * 100) / FASES.length); // divisão inteira, igual ao dashboard.sh

// Derivado do Manifesto real (config/modules.conf), não hardcoded: outras
// Sprints/sessões adicionam módulos novos o tempo todo (ver README.md,
// "Como adicionar um novo módulo") — travar esta lista quebraria a suíte
// a cada módulo novo sem ligação nenhuma com o que esta suíte realmente
// precisa garantir (ver teste "Manifesto ... é internamente consistente").
const MODULOS = lerManifesto().map(m => m.slug);

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

test('Manifesto (config/modules.conf) é internamente consistente: ordem sequencial, slugs existentes, rótulos preenchidos', () => {
    // Não trava um total nem uma lista fixa de slugs — o Manifesto cresce
    // por Sprint (ver README.md, "Como adicionar um novo módulo") e mais de
    // uma sessão pode adicionar módulo aqui na mesma janela de tempo. O que
    // importa é que ele continue bem formado, não que tenha um tamanho
    // específico.
    const manifesto = lerManifesto();
    assert.ok(manifesto.length >= 10, `esperava pelo menos 10 entradas (as da Fase 1-3), achou ${manifesto.length}`);
    manifesto.forEach((m, i) => {
        assert.equal(m.ordem, String(i + 1), `entrada ${i} do manifesto tem ordem "${m.ordem}", esperava "${i + 1}" (sequência quebrada)`);
        assert.ok(m.rotulo && m.rotulo.trim().length > 0, `entrada ${i} (slug "${m.slug}") sem rótulo`);
        const menuPath = join(CC, 'modules', m.slug, 'menu.sh');
        assert.ok(existsSync(menuPath), `entrada ${i} do manifesto aponta pro slug "${m.slug}", mas modules/${m.slug}/menu.sh não existe`);
    });
    const slugsUnicos = new Set(manifesto.map(m => m.slug));
    assert.equal(slugsUnicos.size, manifesto.length, 'há slug duplicado no Manifesto');
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
    const stdin = '4\n\n0\n'; // 4 = Banco de Dados, ainda placeholder na Fase 3
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
    const saida = rodarMenu('4\n\n0\n'); // 4 = Banco de Dados (placeholder)
    assert.match(saida, /Control Center › Banco de Dados/);
});

test('toda tela tem rodapé com mensagem de ajuda antes da borda final', () => {
    const principal = rodarMenu('0\n');
    assert.match(principal, /Use os números para navegar/);
    // Desde a certificação 1.0 (CCC-V1.0-FINAL-001) não existe mais módulo
    // placeholder — os 10 módulos do Manifesto são reais. O rodapé padrão
    // de submenu é o do _cc_run_submenu; a asserção antiga ("volta ao menu
    // principal", rodapé do _cc_placeholder) ficou obsoleta pelo próprio
    // avanço do Roadmap.
    const bancoDados = rodarMenu('4\n\n0\n');
    assert.match(bancoDados, /volta · 0 sai do Control Center/);
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
    // git status sai no locale do usuário — inglês ("On branch") ou
    // português ("No ramo", pt_BR.UTF-8, locale real desta máquina); o
    // regex original só aceitava inglês e falhava em qualquer sistema em
    // português (corrigido na certificação CCC-V1.0-FINAL-001).
    assert.match(saida, /On branch|Your branch|No ramo|Seu ramo/, 'Git Status precisa mostrar a saída real de "git status"');
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

// ── Fase 3 — "Backup e Recuperação" ──────────────────────────────────
//
// Cuidado deliberado nesta seção: o Sistema Oficial de Backup publica de
// verdade no repositório remoto Cell-City-Backup (push de tags/branches).
// Esta suíte NUNCA executa de verdade uma ação que crie/apague um backup
// remoto — só verifica estaticamente (grep) que a delegação existe, e
// executa ao vivo apenas os caminhos garantidamente seguros: cancelamento
// (nunca chega a tocar em git) e leitura pura (Validar Integridade/
// Listar/Informações, que só fazem fetch/ls-remote, nunca push).

test('módulo Backup e Recuperação: interface (menu.sh) só desenha — nenhuma chamada direta a git/npm/bash fora da camada de serviço', () => {
    const src = readFileSync(join(CC, 'modules/backup-recuperacao/menu.sh'), 'utf8');
    assert.doesNotMatch(src, /\bgit\s|\bnpm\s|\bbash\s+"/, 'menu.sh (Interface) não pode chamar git/npm/bash diretamente — pertence à camada de Serviço (lib/*.sh)');
    for (const lib of ['backup.sh', 'recuperacao.sh', 'validacao.sh', 'listagem.sh', 'utilitarios.sh']) {
        const caminho = join(CC, 'modules/backup-recuperacao/lib', lib);
        assert.ok(existsSync(caminho), `modules/backup-recuperacao/lib/${lib} ausente`);
        assert.ok(ehExecutavel(caminho), `modules/backup-recuperacao/lib/${lib} precisa ser executável`);
    }
});

test('módulo Backup e Recuperação: as 6 delegações pro Sistema Oficial de Backup existem (nenhuma reimplementada)', () => {
    const backup = readFileSync(join(CC, 'modules/backup-recuperacao/lib/backup.sh'), 'utf8');
    const recuperacao = readFileSync(join(CC, 'modules/backup-recuperacao/lib/recuperacao.sh'), 'utf8');
    const listagem = readFileSync(join(CC, 'modules/backup-recuperacao/lib/listagem.sh'), 'utf8');

    assert.match(backup, /scripts\/backup\/backup-manual\.sh"/, 'Backup Manual precisa delegar pra scripts/backup/backup-manual.sh');
    assert.match(backup, /scripts\/backup\/backup-automatic\.sh"/, 'Backup Automático precisa delegar pra scripts/backup/backup-automatic.sh');
    assert.match(backup, /node backup-dados\.js --dev/, 'Backup do Firebase (dev) precisa delegar pra backup-dados.js --dev');
    assert.match(backup, /node backup-dados\.js --prod/, 'Backup do Firebase (prod) precisa delegar pra backup-dados.js --prod');
    assert.match(backup, /bash "\$REPO_DIR\/backup\.sh"/, 'Backup do Projeto precisa delegar pra backup.sh (raiz do repo)');
    assert.match(recuperacao, /scripts\/backup\/restore-backup\.sh"/, 'Restaurar Backup precisa delegar pra scripts/backup/restore-backup.sh');
    assert.match(listagem, /restore-backup\.sh/, 'Listar Backups precisa reaproveitar restore-backup.sh (nunca reimplementar a listagem)');

    for (const src of [backup, recuperacao]) {
        assert.doesNotMatch(src, /git\s+push\s+--force\s+origin\s+main|git\s+tag\s+-f.*main/, 'não pode reimplementar lógica de publicação direta em main');
    }
});

test('módulo Backup e Recuperação: Backup Manual detecta working tree sujo e pede confirmação (achado de segurança desta Sprint)', () => {
    const src = readFileSync(join(CC, 'modules/backup-recuperacao/lib/backup.sh'), 'utf8');
    assert.match(src, /status --porcelain/, '_bkp_manual precisa checar se o working tree está sujo antes de delegar');
    assert.match(src, /_cc_confirm/, '_bkp_manual precisa confirmar antes de commitar/publicar alterações pendentes de terceiros');
});

test('módulo Backup e Recuperação: ações destrutivas/de rede (automático, restaurar, limpeza, projeto, firebase) cancelam de verdade sem tocar em git remoto', () => {
    const antesTags = execSync("git ls-remote --tags https://github.com/itamaratento/Cell-City-Backup.git 2>/dev/null | wc -l", { encoding: 'utf8' }).trim();

    const automatico = rodarModulo('backup-recuperacao', '2\nn\n\n11\n0\n');
    assert.match(automatico, /Cancelado\./);

    const restaurar = rodarModulo('backup-recuperacao', '3\nn\n\n11\n0\n');
    assert.match(restaurar, /Cancelado\./);

    const projeto = rodarModulo('backup-recuperacao', '7\n1\nn\n\n11\n0\n');
    assert.match(projeto, /Cancelado\./);

    const firebaseEnvInvalido = rodarModulo('backup-recuperacao', '6\nx\n\n11\n0\n');
    assert.match(firebaseEnvInvalido, /Cancelado\./);

    const firebaseProd = rodarModulo('backup-recuperacao', '6\n2\nn\n\n11\n0\n');
    assert.match(firebaseProd, /Cancelado\./);

    const limpeza = rodarModulo('backup-recuperacao', '9\nn\n\n11\n0\n');
    assert.match(limpeza, /Cancelado\.|Nada para limpar/);

    const depoisTags = execSync("git ls-remote --tags https://github.com/itamaratento/Cell-City-Backup.git 2>/dev/null | wc -l", { encoding: 'utf8' }).trim();
    assert.equal(depoisTags, antesTags, 'nenhuma tag do repositório de backup pode mudar quando toda confirmação é recusada');
});

test('módulo Backup e Recuperação: Validar Integridade/Listar/Informações são leitura real (sem crashar, sem precisar confirmação)', () => {
    const validar = rodarModulo('backup-recuperacao', '5\n\n11\n0\n');
    assert.match(validar, /Validar Integridade/);
    assert.match(validar, /git fsck|Repositório local íntegro/);

    const listar = rodarModulo('backup-recuperacao', '4\n\n11\n0\n');
    assert.match(listar, /Listar Backups/);

    const info = rodarModulo('backup-recuperacao', '10\n\n11\n0\n');
    assert.match(info, /Informações dos Backups/);
    assert.match(info, /Backups locais do projeto/);
});

test('módulo Backup e Recuperação: Backup das Configurações executa de verdade (seguro — só cópia local, sem rede)', () => {
    // _BACKUPS/ é gitignored — em checkout limpo (CI) a pasta não existe ainda.
    const dirBackups = join(ROOT, '_BACKUPS');
    if (!existsSync(dirBackups)) mkdirSync(dirBackups, { recursive: true });
    const antes = new Set(readdirSync(dirBackups).filter(n => n.startsWith('configuracoes-')));
    const saida = rodarModulo('backup-recuperacao', '8\n\n11\n0\n');
    assert.match(saida, /Backup das configurações concluído/i);
    const depois = readdirSync(dirBackups).filter(n => n.startsWith('configuracoes-'));
    const novas = depois.filter(n => !antes.has(n));
    assert.equal(novas.length, 1, `esperava 1 pasta nova de configuracoes-*, achou ${novas.length}`);
    try {
        const conteudo = readdirSync(join(dirBackups, novas[0]));
        assert.ok(conteudo.includes('CLAUDE.md'), 'backup das configurações precisa incluir CLAUDE.md');
    } finally {
        rmSync(join(dirBackups, novas[0]), { recursive: true, force: true });
    }
});

// ── Fase 5 — "Branches e Sincronização" ──────────────────────────────
//
// Regra de ouro (mesma das Fases 2 e 3): nenhuma lógica de tag/push/merge/
// promoção é reimplementada aqui — publicar/promover continua sendo papel
// exclusivo do módulo Release (subir/subir-ok/rollback). Este módulo só
// inspeciona, compara e busca atualizações (fetch); as ações de branch/
// stash (alternar/criar/excluir/aplicar/remover) são novas de propósito
// (não existia nenhum script de sincronização de branch antes desta
// Sprint), mas sempre com confirmação e nunca tocando develop/main.

const BRS_LIBS = ['status.sh', 'branches.sh', 'sync.sh', 'compare.sh', 'history.sh',
    'tags.sh', 'stash.sh', 'integrity.sh', 'statistics.sh', 'export.sh', 'tools.sh', 'config.sh'];

test('módulo Branches e Sincronização: interface (menu.sh) só desenha — nenhuma chamada direta a git fora da camada de serviço', () => {
    const src = readFileSync(join(CC, 'modules/branches-sincronizacao/menu.sh'), 'utf8');
    assert.doesNotMatch(src, /\bgit\s/, 'menu.sh (Interface) não pode chamar git diretamente — pertence à camada de Serviço (lib/*.sh)');
    for (const lib of BRS_LIBS) {
        const caminho = join(CC, 'modules/branches-sincronizacao/lib', lib);
        assert.ok(existsSync(caminho), `modules/branches-sincronizacao/lib/${lib} ausente`);
        assert.ok(ehExecutavel(caminho), `modules/branches-sincronizacao/lib/${lib} precisa ser executável`);
    }
});

test('módulo Branches e Sincronização: regra de ouro — nenhuma lógica de tag/push/merge/promoção é reimplementada', () => {
    for (const lib of BRS_LIBS) {
        const src = readFileSync(join(CC, 'modules/branches-sincronizacao/lib', lib), 'utf8');
        assert.doesNotMatch(src, /git\s+push\s+origin\s+main\b/, `${lib}: não pode reimplementar push direto pra main`);
        assert.doesNotMatch(src, /git\s+tag\s+-a\b/, `${lib}: não pode reimplementar criação de tag`);
        assert.doesNotMatch(src, /git\s+merge\b/, `${lib}: não pode reimplementar merge/promoção — isso é papel do subir-ok existente`);
    }
    const syncSrc = readFileSync(join(CC, 'modules/branches-sincronizacao/lib/sync.sh'), 'utf8');
    assert.match(syncSrc, /git -C "\$REPO_DIR" fetch/, 'Sincronização precisa usar git fetch (leitura)');
    // Verifica invocação real (sempre no padrão `git -C "$REPO_DIR" <verbo>`
    // usado em todo o módulo), não texto — a tela de Sincronização orienta o
    // usuário em português a rodar "git pull"/publicar via Release, o que é
    // uma string informativa, não uma chamada de comando.
    assert.doesNotMatch(syncSrc, /git -C "\$REPO_DIR" (pull|push)\b/, 'Sincronização não pode fazer pull/push — publicar continua sendo papel do Release');
});

test('módulo Branches e Sincronização: "Voltar" dinâmico é 14 (13 itens reais)', () => {
    const saida = rodarModulo('branches-sincronizacao', '14\n');
    assert.match(saida, /14 ► Voltar/);
});

test('módulo Branches e Sincronização: Status do Repositório/Branch Atual/Histórico/Tags/Integridade/Estatísticas mostram dados reais do Git', () => {
    const branchReal = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const saida = rodarModulo('branches-sincronizacao', '1\n\n2\n\n6\n\n\n7\n\n9\n\n10\n\n14\n');
    assert.ok(saida.includes(`Branch atual        : ${branchReal}`), 'Status do Repositório precisa mostrar a branch real');
    assert.match(saida, /Resultado: (SAUDÁVEL|ATENÇÃO|CRÍTICO)/);
    assert.ok(saida.includes(`Nome                    : ${branchReal}`), 'Branch Atual precisa mostrar a branch real');
    assert.match(saida, /commit\(s\) no total\./, 'Histórico precisa mostrar o total real de commits');
    assert.match(saida, /Tags locais:/);
    assert.match(saida, /git fsck não encontrou problemas|git fsck encontrou problemas/);
    assert.match(saida, /Total de branches locais/);
});

test('módulo Branches e Sincronização: Comparar Branches aceita os defaults e mostra diff real entre develop e main', () => {
    // Em checkout de uma branch só (CI) apenas a branch do push existe como
    // ref local; a outra fica só em origin/*. Os defaults de Comparar
    // Branches usam nomes curtos "develop"/"main" — materializa AMBAS
    // quando necessário (idempotente; push na main não traz refs/heads/develop
    // e vice-versa — causa da main 100% vermelha de 07-14 a 07-18).
    for (const b of ['main', 'develop']) {
        try {
            execSync(`git rev-parse --verify --quiet refs/heads/${b}`, { cwd: ROOT, stdio: 'pipe' });
        } catch {
            execSync(`git branch --track ${b} origin/${b}`, { cwd: ROOT, stdio: 'pipe' });
        }
    }
    const saida = rodarModulo('branches-sincronizacao', '5\n\n\n\n14\n');
    assert.match(saida, /Commits exclusivos de 'develop'/);
    assert.match(saida, /Resumo de arquivos/);
});

test('módulo Branches e Sincronização: Sincronização busca atualizações de verdade (git fetch) sem travar', () => {
    const saida = rodarModulo('branches-sincronizacao', '4\n\n14\n');
    assert.match(saida, /Fetch concluído\.|Fetch falhou/);
});

test('módulo Branches e Sincronização: Ferramentas Git (validar config/.gitignore/config atual) são leitura real', () => {
    const saida = rodarModulo('branches-sincronizacao', '12\n5\n\n6\n\n7\n\n0\n\n14\n');
    assert.match(saida, /user\.name: |user\.name não configurado/);
    assert.match(saida, /\.gitignore encontrado\.|\.gitignore não encontrado/);
    assert.match(saida, /core\.repositoryformatversion/);
});

test('módulo Branches e Sincronização: Configurações mostra o branches.conf real e cancela edição sem alterar o arquivo', () => {
    const arquivoConf = join(CC, 'modules/branches-sincronizacao/branches.conf');
    const antes = readFileSync(arquivoConf, 'utf8');
    const saida = rodarModulo('branches-sincronizacao', '13\n6\n99\nn\n0\n\n14\n');
    assert.match(saida, /Timeout de rede \(segundos\)\s*: \d+/);
    const depois = readFileSync(arquivoConf, 'utf8');
    assert.equal(depois, antes, 'edição cancelada não pode alterar branches.conf');
});

test('módulo Branches e Sincronização: Alternar/Criar/Excluir Branch cancelam sem nome informado (Enter vazio), sem tocar em git', () => {
    const antesHead = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const antesBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();

    const alternar = rodarModulo('branches-sincronizacao', '3\n4\n\n0\n\n14\n');
    assert.match(alternar, /Cancelado\./);

    const criar = rodarModulo('branches-sincronizacao', '3\n5\n\n0\n\n14\n');
    assert.match(criar, /Cancelado\./);

    const excluir = rodarModulo('branches-sincronizacao', '3\n6\n\n0\n\n14\n');
    assert.match(excluir, /Cancelado\./);

    const depoisHead = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const depoisBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    assert.equal(depoisHead, antesHead, 'HEAD não pode mudar quando a confirmação nunca chega a ser pedida (nome vazio)');
    assert.equal(depoisBranch, antesBranch, 'branch atual não pode mudar quando Alternar Branch é cancelado');
});

test('módulo Branches e Sincronização: Excluir Branch nunca remove develop/main, mesmo pedindo diretamente', () => {
    const antes = execSync('git branch --list develop main', { cwd: ROOT, encoding: 'utf8' });
    const saida = rodarModulo('branches-sincronizacao', '3\n6\ndevelop\n\n0\n\n14\n');
    assert.match(saida, /branch protegida/);
    const depois = execSync('git branch --list develop main', { cwd: ROOT, encoding: 'utf8' });
    assert.equal(depois, antes, 'develop/main precisam continuar existindo exatamente como antes');
});

test('módulo Branches e Sincronização: Aplicar/Remover Stash pedem confirmação e cancelam de verdade (stash real e descartável, criado e removido pelo próprio teste)', () => {
    const arquivoTeste = join(ROOT, 'cellcity-teste-stash-fase5.tmp');
    writeFileSync(arquivoTeste, 'descartável — teste automatizado da Fase 5, nunca commitado\n');
    execSync('git add cellcity-teste-stash-fase5.tmp', { cwd: ROOT });
    try {
        execSync('git stash push -m "teste-fase5-descartavel"', { cwd: ROOT, stdio: 'pipe' });
        try {
            assert.ok(!existsSync(arquivoTeste), 'git stash push precisa ter limpado o arquivo do working tree');

            const aplicar = rodarModulo('branches-sincronizacao', '8\n3\n0\nn\n0\n\n14\n');
            assert.match(aplicar, /Cancelado\./);
            assert.ok(!existsSync(arquivoTeste), 'Aplicar Stash cancelado não pode restaurar o arquivo');

            const remover = rodarModulo('branches-sincronizacao', '8\n4\n0\nn\n0\n\n14\n');
            assert.match(remover, /Cancelado\./);
            const stashesDepois = execSync('git stash list', { cwd: ROOT, encoding: 'utf8' });
            assert.match(stashesDepois, /teste-fase5-descartavel/, 'Remover Stash cancelado não pode remover o stash de teste');
        } finally {
            execSync('git stash drop', { cwd: ROOT, stdio: 'pipe' });
        }
    } finally {
        rmSync(arquivoTeste, { force: true });
    }
});

// Auditoria CCC-F05-AUD-002 (2026-07-12): corrigiu 2 desvios frente à
// CCC-F05-001 — Exportação (não existia) e Logs de detalhe por operação
// (o framework _cc_run_submenu já logava a seleção de menu genericamente;
// faltava branch/commit/resultado por operação). Os 2 testes abaixo
// cobrem essas correções.

test('módulo Branches e Sincronização: Exportação gera TXT/Markdown/JSON reais em _reports/git/ (removidos pelo próprio teste)', () => {
    const dir = join(ROOT, '_reports', 'git');
    rmSync(dir, { recursive: true, force: true });
    const saida = rodarModulo('branches-sincronizacao', '11\n1\n\n2\n\n3\n\n0\n\n14\n');
    assert.match(saida, /Relatório exportado: .*\.txt/);
    assert.match(saida, /Relatório exportado: .*\.md/);
    assert.match(saida, /Relatório exportado: .*\.json/);
    const gerados = existsSync(dir) ? readdirSync(dir) : [];
    assert.ok(gerados.some(f => f.endsWith('.txt')), 'TXT não foi gerado em _reports/git/');
    assert.ok(gerados.some(f => f.endsWith('.md')), 'Markdown não foi gerado em _reports/git/');
    assert.ok(gerados.some(f => f.endsWith('.json')), 'JSON não foi gerado em _reports/git/');
    const jsonPath = join(dir, gerados.find(f => f.endsWith('.json')));
    const jsonConteudo = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert.equal(jsonConteudo.modulo, 'Branches e Sincronização');
    assert.ok(jsonConteudo.branch, 'JSON exportado precisa registrar a branch');
    rmSync(dir, { recursive: true, force: true });
});

test('módulo Branches e Sincronização: operações relevantes ficam registradas em logs/control-center.log com branch/resultado (não só a seleção genérica de menu)', () => {
    rodarModulo('branches-sincronizacao', '4\n\n14\n');
    const log = readFileSync(join(CC, 'logs/control-center.log'), 'utf8');
    assert.match(log, /Branches e Sincronização: Sincronização — fetch (falhou|ok)/);
});

// ── Fase 4 — "Banco de Dados" (CCC-F04-001) ──────────────────────────
//
// Todo o módulo é somente leitura: nenhuma ação cria/altera/publica/
// remove coleção, documento, Rule, índice ou Cloud Function. Checagens
// ao vivo usam gcloud (describe/list) ou GET em firebaserules.googleapis.com
// — nunca `firebase deploy`, nunca escrita via Admin SDK. Como o ambiente
// de CI não tem gcloud instalado/autenticado, os testes abaixo cobrem os
// dois cenários sem exigir nenhum dos dois: navegação, heurísticas locais
// (Coleções/Rules/Integridade/Estatísticas/Exportações/Configurações) e a
// degradação graciosa das ações que dependem de gcloud, sem travar.

const BD_LIBS = ['utils.sh', 'status.sh', 'collections.sh', 'indexes.sh', 'rules.sh',
    'functions.sh', 'integrity.sh', 'statistics.sh', 'export.sh', 'config.sh'];

test('módulo Banco de Dados: interface (menu.sh) só desenha — nenhuma chamada direta a git/gcloud/curl fora da camada de serviço', () => {
    const src = readFileSync(join(CC, 'modules/banco-dados/menu.sh'), 'utf8');
    assert.doesNotMatch(src, /\bgcloud\s|\bcurl\s|\bgit\s/, 'menu.sh (Interface) não pode chamar gcloud/curl/git diretamente — pertence à camada de Serviço (lib/*.sh)');
    assert.ok(existsSync(join(CC, 'modules/banco-dados/engine.sh')), 'engine.sh ausente');
    assert.ok(existsSync(join(CC, 'modules/banco-dados/docs/database.md')), 'docs/database.md ausente');
    for (const lib of BD_LIBS) {
        const caminho = join(CC, 'modules/banco-dados/lib', lib);
        assert.ok(existsSync(caminho), `modules/banco-dados/lib/${lib} ausente`);
        assert.ok(ehExecutavel(caminho), `modules/banco-dados/lib/${lib} precisa ser executável`);
    }
});

test('módulo Banco de Dados: nenhum lib/*.sh escreve/publica no Firestore/Firebase — só describe/list/GET (CCC-F04-001 §17)', () => {
    for (const lib of BD_LIBS) {
        // Só invocação real (início de comando/pipe/subshell), nunca texto —
        // comentários e strings de sugestão deste módulo citam "firebase
        // deploy" de propósito, pra explicar ao usuário que publicar
        // continua sendo papel exclusivo de fora dele (nunca executado
        // daqui). Comentários também são excluídos por completo.
        const codigo = readFileSync(join(CC, 'modules/banco-dados/lib', lib), 'utf8')
            .split('\n')
            .filter(linha => !linha.trim().startsWith('#'))
            .join('\n');
        const inicioDeComando = /(?:^|[\n;&|`]|\$\()\s*/.source;
        assert.doesNotMatch(codigo, new RegExp(inicioDeComando + 'firebase\\s+deploy'), `${lib}: não pode chamar firebase deploy — publicar é sempre fora deste módulo`);
        assert.doesNotMatch(codigo, new RegExp(inicioDeComando + 'gcloud\\s+firestore\\s+(indexes\\s+composite\\s+)?(create|delete|update)\\b'), `${lib}: não pode criar/remover/atualizar índice via gcloud`);
        assert.doesNotMatch(codigo, new RegExp(inicioDeComando + 'gcloud\\s+functions\\s+(deploy|delete)\\b'), `${lib}: não pode publicar/remover Cloud Function via gcloud`);
        assert.doesNotMatch(codigo, /curl\b[^\n]*-X\s*['"]?(POST|PUT|DELETE|PATCH)/, `${lib}: chamada HTTP não pode ser de escrita — só GET`);
    }
});

test('módulo Banco de Dados: "Voltar" dinâmico é 11 (10 itens reais)', () => {
    const saida = rodarModulo('banco-dados', '11\n');
    assert.match(saida, /11 ► Voltar/);
});

test('módulo Banco de Dados: ações que dependem de ambiente cancelam de verdade com tecla inválida, sem crash', () => {
    const status = rodarModulo('banco-dados', '1\nx\n\n11\n0\n');
    assert.match(status, /Cancelado\./);

    const indices = rodarModulo('banco-dados', '3\nx\n\n11\n0\n');
    assert.match(indices, /Cancelado\./);

    const rules = rodarModulo('banco-dados', '4\nx\n\n11\n0\n');
    assert.match(rules, /Cancelado\./);

    const functions = rodarModulo('banco-dados', '5\nx\n\n11\n0\n');
    assert.match(functions, /Cancelado\./);
});

test('módulo Banco de Dados: Status do Banco (ambiente dev) mostra dados reais dos arquivos locais e degrada sem gcloud', () => {
    const saida = rodarModulo('banco-dados', '1\n1\n\n11\n0\n');
    assert.match(saida, /Projeto Firebase ativo: cellcity-crm-dev/);
    assert.match(saida, /Database ID: \(default\)/);
    assert.match(saida, /Região: southamerica-east1/);
    assert.match(saida, /Estado geral: (SAUDÁVEL|ATENÇÃO|CRÍTICO)/);
});

test('módulo Banco de Dados: Coleções (Listar/Sem Rules/Vazias/Órfãs/Duplicadas) rodam de verdade, sem crash', () => {
    const saida = rodarModulo('banco-dados', '2\n1\n\n2\n\n3\n\n4\n\n5\n\n0\n\n11\n0\n');
    assert.match(saida, /COLEÇÕES\b/);
    assert.match(saida, /COLEÇÕES SEM RULES/);
    assert.match(saida, /Não disponível: contar documentos exige Admin SDK/);
    assert.match(saida, /COLEÇÕES ÓRFÃS/);
    assert.match(saida, /COLEÇÕES\/PADRÕES DUPLICADOS/);
});

test('módulo Banco de Dados: Índices não acusa mais duplicado na raiz (arquivo vazio removido em 5f9a64d) e aponta o arquivo oficial', () => {
    const saida = rodarModulo('banco-dados', '3\n1\n\n11\n0\n');
    assert.match(saida, /Arquivo de índices/);
    assert.doesNotMatch(saida, /Arquivo duplicado/);
});

test('módulo Banco de Dados: Firestore Rules identifica sintaxe válida e os 3 "if true" documentados como acesso público', () => {
    const saida = rodarModulo('banco-dados', '4\n1\n\n11\n0\n');
    assert.match(saida, /Sintaxe \(heurística\)/);
    assert.match(saida, /Permissões abertas.*3 linha\(s\)/);
    assert.match(saida, /config:\d+/);
});

test('módulo Banco de Dados: Integridade e Estatísticas rodam de verdade e nunca travam, com ou sem gcloud', () => {
    const integridade = rodarModulo('banco-dados', '6\n\n11\n0\n');
    assert.match(integridade, /Resultado: (OK|WARNING|ERRO)/);
    assert.match(integridade, /Arquivo obrigatório — firebase\.json presente/);

    const estatisticas = rodarModulo('banco-dados', '7\n\n11\n0\n');
    assert.match(estatisticas, /Coleções conhecidas: \d+/);
    assert.match(estatisticas, /não mensurável sem Admin SDK\/ADC/);
});

test('módulo Banco de Dados: Ferramentas (atalhos) reaproveitam as mesmas funções de Coleções/Rules/Índices/Functions/Integridade', () => {
    const saida = rodarModulo('banco-dados', '9\n1\n\n5\n\n0\n\n11\n0\n');
    assert.match(saida, /COLEÇÕES VAZIAS/);
    assert.match(saida, /Resultado: (OK|WARNING|ERRO)/);
});

test('módulo Banco de Dados: Exportações gera TXT/Markdown/JSON reais em _reports/database/ (removidos pelo próprio teste)', () => {
    const dir = join(ROOT, '_reports', 'database');
    rmSync(dir, { recursive: true, force: true });
    const saida = rodarModulo('banco-dados', '8\n1\n\n2\n\n3\n\n0\n\n11\n0\n');
    assert.match(saida, /Relatório exportado: .*\.txt/);
    assert.match(saida, /Relatório exportado: .*\.md/);
    assert.match(saida, /Relatório exportado: .*\.json/);
    const gerados = existsSync(dir) ? readdirSync(dir) : [];
    assert.ok(gerados.some(f => f.endsWith('.txt')), 'TXT não foi gerado em _reports/database/');
    assert.ok(gerados.some(f => f.endsWith('.md')), 'Markdown não foi gerado em _reports/database/');
    assert.ok(gerados.some(f => f.endsWith('.json')), 'JSON não foi gerado em _reports/database/');
    const jsonPath = join(dir, gerados.find(f => f.endsWith('.json')));
    const jsonConteudo = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert.equal(jsonConteudo.modulo, 'Banco de Dados');
    rmSync(dir, { recursive: true, force: true });
});

test('módulo Banco de Dados: Configurações persiste em config/local.json (escopo isolado, nunca em state/) e Restaurar Padrões limpa o arquivo', () => {
    const arquivoConf = join(CC, 'modules/banco-dados/config/local.json');
    rmSync(arquivoConf, { force: true });
    const definir = rodarModulo('banco-dados', '10\n4\n25\n\n0\n\n11\n0\n');
    assert.match(definir, /Timeout definido: 25s/);
    assert.ok(existsSync(arquivoConf), 'config/local.json precisa existir depois de definir uma configuração');
    const conteudo = JSON.parse(readFileSync(arquivoConf, 'utf8'));
    assert.equal(conteudo.timeout_segundos, '25');

    const restaurar = rodarModulo('banco-dados', '10\n6\ns\n\n0\n\n11\n0\n');
    assert.match(restaurar, /Configurações restauradas ao padrão\./);
    assert.ok(!existsSync(arquivoConf), 'Restaurar Padrões precisa remover config/local.json');
});

// ── Fase 10 — "Central de IAs" (CCC-F10-001) ─────────────────────────
//
// Somente leitura sobre o próprio Control Center e o repositório Git —
// nenhuma tela cria/altera/remove arquivo, commit ou módulo alheio. As
// únicas escritas são as próprias do módulo: config/local.json
// (Configurações) e _reports/ai-center/ (Exportações), mesmo princípio
// já usado no Banco de Dados. Fonte de dados: config/{fases,registry,
// workflow}.conf — nenhuma fase/IA/estágio hardcoded em lib/*.sh.

const CIA_LIBS = ['utils.sh', 'dashboard.sh', 'agents.sh', 'skills.sh',
    'responsibilities.sh', 'workflow.sh', 'tasks.sh', 'history.sh',
    'audit.sh', 'documentation.sh', 'statistics.sh', 'export.sh', 'config.sh'];

test('módulo Central de IAs: interface (menu.sh) só desenha — nenhuma chamada direta a git fora da camada de serviço', () => {
    const src = readFileSync(join(CC, 'modules/central-ias/menu.sh'), 'utf8');
    assert.doesNotMatch(src, /\bgit\s/, 'menu.sh (Interface) não pode chamar git diretamente — pertence à camada de Serviço (lib/*.sh)');
    assert.ok(existsSync(join(CC, 'modules/central-ias/engine.sh')), 'engine.sh ausente');
    assert.ok(existsSync(join(CC, 'modules/central-ias/docs/central-ias.md')), 'docs/central-ias.md ausente');
    for (const lib of CIA_LIBS) {
        const caminho = join(CC, 'modules/central-ias/lib', lib);
        assert.ok(existsSync(caminho), `modules/central-ias/lib/${lib} ausente`);
        assert.ok(ehExecutavel(caminho), `modules/central-ias/lib/${lib} precisa ser executável`);
    }
    for (const conf of ['fases.conf', 'registry.conf', 'workflow.conf']) {
        assert.ok(existsSync(join(CC, 'modules/central-ias/config', conf)), `config/${conf} ausente`);
    }
});

test('módulo Central de IAs: nenhum lib/*.sh escreve/altera commit, arquivo ou módulo alheio (CCC-F10-001, "Segurança")', () => {
    for (const lib of CIA_LIBS) {
        const codigo = readFileSync(join(CC, 'modules/central-ias/lib', lib), 'utf8')
            .split('\n')
            .filter(linha => !linha.trim().startsWith('#'))
            .join('\n');
        const inicioDeComando = /(?:^|[\n;&|`]|\$\()\s*/.source;
        assert.doesNotMatch(codigo, new RegExp(inicioDeComando + 'git\\s+(commit|push|checkout|reset|merge|rebase|tag|branch\\s+-D)\\b'), `${lib}: não pode alterar commit/branch/tag — só leitura (git log)`);
        assert.doesNotMatch(codigo, /\brm\s+-rf?\s+(?!.*CC_CIA_CONFIG_FILE)/, `${lib}: não pode remover arquivo fora do próprio config local`);
    }
});

test('módulo Central de IAs: "Voltar" dinâmico é 12 (11 itens reais)', () => {
    const saida = rodarModulo('central-ias', '12\n');
    assert.match(saida, /12 ► Voltar/);
});

test('módulo Central de IAs: Dashboard mostra números reais e coerentes com o Registro de Fases (config/fases.conf)', () => {
    const saida = rodarModulo('central-ias', '1\n\n12\n0\n');
    assert.match(saida, /IAs cadastradas: 2/);
    assert.match(saida, new RegExp(`Fases do Roadmap: ${FASES.length}`));
    assert.match(saida, new RegExp(`Fases concluídas: ${FASES_CONCLUIDAS}`));
    assert.match(saida, new RegExp(`Percentual de conclusão do projeto: ${FASES_PCT}%`));
    assert.match(saida, /Estado geral: (SAUDÁVEL|ATENÇÃO|CRÍTICO)/);
});

test('módulo Central de IAs: IAs Cadastradas lista Claude e DeepSeek com módulos atribuídos derivados de fases.conf (sem truncar)', () => {
    const saida = rodarModulo('central-ias', '2\n\n12\n0\n');
    assert.match(saida, /Claude \(Sonnet 5\)/);
    assert.match(saida, /DeepSeek \(-\)/);
    // Regressão do achado de truncamento silencioso: a lista de módulos
    // do Claude tem 5+ entradas — precisa aparecer inteira, não cortada
    // na primeira (era o bug antes de juntar com ", " em vez de ",").
    assert.match(saida, /branches-sincronizacao/);
    assert.match(saida, /central-ias/);
});

test('módulo Central de IAs: Especialidades/Responsabilidades/Fluxo de Desenvolvimento/Distribuição de Tarefas rodam de verdade, sem crash', () => {
    const especialidades = rodarModulo('central-ias', '3\n\n12\n0\n');
    assert.match(especialidades, /Diagnóstico/);

    const responsabilidades = rodarModulo('central-ias', '4\n\n12\n0\n');
    assert.match(responsabilidades, /Fase 6/);
    assert.match(responsabilidades, /Status: (Pendente|CONCLUÍDA)/);

    const workflow = rodarModulo('central-ias', '5\n\n12\n0\n');
    assert.match(workflow, /Fase 1 — Estrutura Base, UX e Arquitetura: Release/);
    assert.match(workflow, /Fase 11 — Configurações: \S+/);

    const tarefas = rodarModulo('central-ias', '6\n\n12\n0\n');
    assert.match(tarefas, /Aguardando revisão técnica/);
});

test('módulo Central de IAs: Histórico filtra por IA/Fase reais via git log (nenhum evento fabricado)', () => {
    const semFiltro = rodarModulo('central-ias', '7\n\n\n\n\n\n12\n0\n');
    assert.match(semFiltro, /Fase 5.*Branches e Sincronização/);

    const filtrado = rodarModulo('central-ias', '7\nclaude\n5\n\n\n12\n0\n');
    assert.match(filtrado, /Fase 5/);
    assert.doesNotMatch(filtrado, /Fase 4/);

    // Filtro por um valor que garantidamente não existe em fases.conf —
    // "deepseek" não serve mais aqui: o Histórico atribui a IA de um
    // commit pelo mapeamento estático fases.conf (quem foi designado pra
    // fase), não pelo autor real do commit; qualquer revisão técnica do
    // Claude em módulo atribuído ao DeepSeek (ex.: Fases 6/7) aparece
    // rotulada "(deepseek)" no Histórico — achado de design registrado
    // no parecer da Fase 10, não uma regressão desta suíte.
    const semResultado = rodarModulo('central-ias', '7\niaqueninguemcadastrou\n\n\n\n12\n0\n');
    assert.match(semResultado, /Nenhum registro encontrado/);
});

test('módulo Central de IAs: Auditorias lista os Pareceres Executivos reais e as fases aguardando revisão', () => {
    const saida = rodarModulo('central-ias', '8\n\n12\n0\n');
    assert.match(saida, /PARECER-CCC-HOM-001\.md/);
    assert.match(saida, /PARECER-CCC-HOM-001-BANCO-DE-DADOS\.md/);
    if (FASES_CONCLUIDAS === FASES.length) {
        assert.match(saida, /Pendências \(fases aguardando revisão técnica\):[\s\S]*Nenhuma\./);
    } else {
        assert.match(saida, /aguardando revisão/i);
    }
});

test('módulo Central de IAs: Documentação enumera README.md e a documentação por módulo (nomes completos, sem corte)', () => {
    const saida = rodarModulo('central-ias', '9\n\n12\n0\n');
    assert.match(saida, /README\.md/);
    assert.match(saida, /banco-dados\/docs\/database\.md/);
    // Regressão do truncamento: o nome completo do Parecer mais longo
    // precisa aparecer inteiro (era cortado quando prefixado pelo
    // caminho completo).
    assert.match(saida, /PARECER-CCC-HOM-001-BANCO-DE-DADOS\.md/);
});

test('módulo Central de IAs: Estatísticas rodam de verdade e batem com o Dashboard', () => {
    // Contagem de pareceres é dinâmica de propósito (não hardcoded) — o
    // número de PARECER-CCC-HOM-001*.md cresce a cada fase homologada
    // (3 na Fase 5, 5 depois das Fases 6/7 nesta mesma Sprint).
    const totalPareceres = readdirSync(join(CC, 'docs')).filter(f => f.startsWith('PARECER-CCC-HOM-001')).length;
    const saida = rodarModulo('central-ias', '10\n\n12\n0\n');
    assert.match(saida, new RegExp(`Fases concluídas: ${FASES_CONCLUIDAS}/${FASES.length} \\(${FASES_PCT}%\\)`));
    assert.match(saida, new RegExp(`Homologações \\(Pareceres Executivos\\): ${totalPareceres}`));
});

test('módulo Central de IAs: Exportações (via Configurações) geram TXT/Markdown/JSON reais em _reports/ai-center/ (removidos pelo próprio teste)', () => {
    const dir = join(ROOT, '_reports', 'ai-center');
    rmSync(dir, { recursive: true, force: true });
    const arquivoConf = join(CC, 'modules/central-ias/config/local.json');
    rmSync(arquivoConf, { force: true });

    rodarModulo('central-ias', '11\n5\nmd\n\n6\n\n0\n12\n0\n');
    rodarModulo('central-ias', '11\n5\njson\n\n6\n\n0\n12\n0\n');
    rodarModulo('central-ias', '11\n5\ntxt\n\n6\n\n0\n12\n0\n');

    const gerados = existsSync(dir) ? readdirSync(dir) : [];
    assert.ok(gerados.some(f => f.endsWith('.txt')), 'TXT não foi gerado em _reports/ai-center/');
    assert.ok(gerados.some(f => f.endsWith('.md')), 'Markdown não foi gerado em _reports/ai-center/');
    assert.ok(gerados.some(f => f.endsWith('.json')), 'JSON não foi gerado em _reports/ai-center/');
    const jsonPath = join(dir, gerados.find(f => f.endsWith('.json')));
    const jsonConteudo = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert.equal(jsonConteudo.modulo, 'Central de IAs');
    rmSync(dir, { recursive: true, force: true });
    rmSync(arquivoConf, { force: true });
});

test('módulo Central de IAs: Configurações persiste em config/local.json (escopo isolado, nunca em state/) e Restaurar Padrões limpa o arquivo', () => {
    const arquivoConf = join(CC, 'modules/central-ias/config/local.json');
    rmSync(arquivoConf, { force: true });

    const definir = rodarModulo('central-ias', '11\n3\ndetalhada\n\n0\n12\n0\n');
    assert.match(definir, /Verbosidade definida: detalhada/);
    assert.ok(existsSync(arquivoConf), 'config/local.json precisa existir depois de definir uma configuração');
    const conteudo = JSON.parse(readFileSync(arquivoConf, 'utf8'));
    assert.equal(conteudo.verbosidade, 'detalhada');

    const restaurar = rodarModulo('central-ias', '11\n8\ns\n\n0\n12\n0\n');
    assert.match(restaurar, /Configurações restauradas ao padrão\./);
    assert.ok(!existsSync(arquivoConf), 'Restaurar Padrões precisa remover config/local.json');
});

// ── Fase 11 — "Configurações" (CCC-F11-001) ──────────────────────────
//
// Escopo confirmado com o dono do projeto antes da implementação: só
// leitura de status (Backup/Git/Firebase/Banco de Dados, sempre lidos
// dos mesmos arquivos/comandos reais, nunca reimplementando a lógica
// desses módulos) + preferências locais deste módulo, sempre em
// config/local.json (nunca em state/ nem em arquivo de outro módulo).
//
// Telas de tiro único (Geral/Tema/Status×4/Ambiente/Validação) NÃO
// chamam _cc_pause internamente — o wrapper de _cc_run_submenu já pausa
// uma vez sozinho ao retornar (mesmo padrão de branches-sincronizacao/
// lib/status.sh); só as telas com loop próprio (Logs/Exportações/
// Importar-Exportar-Reset, com "0 = voltar local") pausam por ação.

const CFG_LIBS = ['utils.sh', 'geral.sh', 'logs.sh', 'status.sh', 'ambiente.sh',
    'exportacao.sh', 'validacao.sh', 'importexport.sh'];

test('módulo Configurações: interface (menu.sh) só desenha — nenhuma chamada direta a git/jq fora da camada de serviço', () => {
    const src = readFileSync(join(CC, 'modules/configuracoes/menu.sh'), 'utf8');
    assert.doesNotMatch(src, /\bgit\s|\bjq\s/, 'menu.sh (Interface) não pode chamar git/jq diretamente — pertence à camada de Serviço (lib/*.sh)');
    assert.ok(existsSync(join(CC, 'modules/configuracoes/engine.sh')), 'engine.sh ausente');
    assert.ok(existsSync(join(CC, 'modules/configuracoes/docs/configuracoes.md')), 'docs/configuracoes.md ausente');
    for (const lib of CFG_LIBS) {
        const caminho = join(CC, 'modules/configuracoes/lib', lib);
        assert.ok(existsSync(caminho), `modules/configuracoes/lib/${lib} ausente`);
        assert.ok(ehExecutavel(caminho), `modules/configuracoes/lib/${lib} precisa ser executável`);
    }
});

test('módulo Configurações: nenhum lib/*.sh escreve em outro módulo, em state/ ou executa ação destrutiva sem confirmação', () => {
    for (const lib of CFG_LIBS) {
        const src = readFileSync(join(CC, 'modules/configuracoes/lib', lib), 'utf8');
        assert.doesNotMatch(src, />\s*"\$REPO_DIR"\/(?!_reports)/, `${lib}: não pode escrever em arquivo do repositório fora de _reports/`);
        assert.doesNotMatch(src, />\s*"\$CC_ROOT\/state\//, `${lib}: não pode escrever em state/ (escopo é config/local.json deste módulo)`);
    }
    const importSrc = readFileSync(join(CC, 'modules/configuracoes/lib/importexport.sh'), 'utf8');
    assert.match(importSrc, /_cc_confirm.*[Rr]eset|_cc_confirm.*[Ss]ubstituir/, 'Reset/Importar precisam pedir confirmação explícita');
});

test('módulo Configurações: "Voltar" dinâmico é 12 (11 itens reais)', () => {
    const saida = rodarModulo('configuracoes', '12\n');
    assert.match(saida, /12 ► Voltar/);
});

test('módulo Configurações: submenu principal exibe todas as 11 opções', () => {
    const saida = rodarModulo('configuracoes', '12\n');
    assert.match(saida, /Control Center › Configurações/);
    assert.match(saida, /1 ► Configuração Geral/);
    assert.match(saida, /2 ► Tema e Aparência/);
    assert.match(saida, /3 ► Logs/);
    assert.match(saida, /4 ► Status do Backup/);
    assert.match(saida, /5 ► Status do Git/);
    assert.match(saida, /6 ► Status do Firebase/);
    assert.match(saida, /7 ► Status do Banco de Dados/);
    assert.match(saida, /8 ► Exportações/);
    assert.match(saida, /9 ► Ambiente e Diagnóstico/);
    assert.match(saida, /10 ► Validação e Persistência/);
    assert.match(saida, /11 ► Importar \/ Exportar \/ Reset/);
});

test('módulo Configurações: Configuração Geral mostra dados reais do projeto (versão/branch)', () => {
    const versao = readFileSync(join(CC, 'VERSION'), 'utf8').trim();
    const branchReal = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const saida = rodarModulo('configuracoes', '1\n\n12\n');
    assert.ok(saida.includes(versao), 'Configuração Geral precisa mostrar a versão real do VERSION');
    assert.ok(saida.includes(`Branch atual        : ${branchReal}`), 'Configuração Geral precisa mostrar a branch real');
});

test('módulo Configurações: Status do Git/Firebase/Banco de Dados mostram dados reais, sem crash', () => {
    const branchReal = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const git = rodarModulo('configuracoes', '5\n\n12\n');
    assert.ok(git.includes(`Branch atual   : ${branchReal}`), 'Status do Git precisa mostrar a branch real');

    const firebase = rodarModulo('configuracoes', '6\n\n12\n');
    assert.match(firebase, /Projeto ativo|Firestore Rules/);

    const banco = rodarModulo('configuracoes', '7\n\n12\n');
    assert.match(banco, /firestore\.rules|firestore\.indexes\.json/);

    const backup = rodarModulo('configuracoes', '4\n\n12\n');
    assert.match(backup, /Último backup/);
});

test('módulo Configurações: Ambiente e Diagnóstico reflete state/health-check.json real (ou orienta a rodar o Diagnóstico)', () => {
    const saida = rodarModulo('configuracoes', '9\n\n12\n');
    assert.match(saida, /Última execução :|Nenhum diagnóstico foi executado ainda/);
});

test('módulo Configurações: Tema persiste a preferência em config/local.json (escopo isolado, nunca em state/)', () => {
    const arquivoConf = join(CC, 'modules/configuracoes/config/local.json');
    rmSync(arquivoConf, { force: true });

    const ligar = rodarModulo('configuracoes', '2\n1\n\n12\n');
    assert.match(ligar, /Preferência salva: on/);
    assert.ok(existsSync(arquivoConf), 'config/local.json precisa existir depois de definir uma preferência');
    let conteudo = JSON.parse(readFileSync(arquivoConf, 'utf8'));
    assert.equal(conteudo.tema_cores, 'on');

    const desligar = rodarModulo('configuracoes', '2\n2\n\n12\n');
    assert.match(desligar, /Preferência salva: off/);
    conteudo = JSON.parse(readFileSync(arquivoConf, 'utf8'));
    assert.equal(conteudo.tema_cores, 'off');

    rmSync(arquivoConf, { force: true });
});

test('módulo Configurações: Logs define verbosidade/retenção e mostra o log real', () => {
    const arquivoConf = join(CC, 'modules/configuracoes/config/local.json');
    rmSync(arquivoConf, { force: true });

    const saida = rodarModulo('configuracoes', '3\n1\ndetalhada\n\n2\n7\n\n3\n\n0\n\n12\n');
    assert.match(saida, /Verbosidade definida: detalhada/);
    assert.match(saida, /Retenção definida: 7 dia\(s\)/);
    const conteudo = JSON.parse(readFileSync(arquivoConf, 'utf8'));
    assert.equal(conteudo.logs_verbosidade, 'detalhada');
    assert.equal(conteudo.logs_retencao_dias, '7');

    rmSync(arquivoConf, { force: true });
});

test('módulo Configurações: Validação confirma JSON válido e o ciclo de persistência (escrever → ler)', () => {
    const saida = rodarModulo('configuracoes', '10\n\n12\n');
    assert.match(saida, /Persistência confirmada/);
});

test('módulo Configurações: Exportações gera TXT/Markdown/JSON reais em _reports/configuracoes/ (removidos pelo próprio teste)', () => {
    const dir = join(ROOT, '_reports', 'configuracoes');
    rmSync(dir, { recursive: true, force: true });
    const saida = rodarModulo('configuracoes', '8\n3\n\n4\n\n5\n\n0\n\n12\n');
    assert.match(saida, /Relatório exportado: .*\.txt/);
    assert.match(saida, /Relatório exportado: .*\.md/);
    assert.match(saida, /Relatório exportado: .*\.json/);
    const gerados = existsSync(dir) ? readdirSync(dir) : [];
    assert.ok(gerados.some(f => f.endsWith('.txt')), 'TXT não foi gerado em _reports/configuracoes/');
    assert.ok(gerados.some(f => f.endsWith('.md')), 'Markdown não foi gerado em _reports/configuracoes/');
    assert.ok(gerados.some(f => f.endsWith('.json')), 'JSON não foi gerado em _reports/configuracoes/');
    const jsonPath = join(dir, gerados.find(f => f.endsWith('.json')));
    const jsonConteudo = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert.equal(jsonConteudo.modulo, 'Configurações');
    rmSync(dir, { recursive: true, force: true });
});

test('módulo Configurações: Importar/Exportar/Reset — backup gera arquivo real, importação recusa JSON inválido, Reset seguro pede confirmação e remove local.json', () => {
    const arquivoConf = join(CC, 'modules/configuracoes/config/local.json');
    const dir = join(ROOT, '_reports', 'configuracoes');
    rmSync(dir, { recursive: true, force: true });

    // Backup real
    const backup = rodarModulo('configuracoes', '11\n1\n\n0\n\n12\n');
    assert.match(backup, /Cópia de segurança salva: .*config-backup_.*\.json/);
    const gerados = existsSync(dir) ? readdirSync(dir).filter(f => f.startsWith('config-backup_')) : [];
    assert.ok(gerados.length > 0, 'backup do local.json não foi gerado em _reports/configuracoes/');

    // Importação de arquivo inexistente/():
    const semArquivo = rodarModulo('configuracoes', '11\n2\n/caminho/que/nao/existe.json\n\n0\n\n12\n');
    assert.match(semArquivo, /Arquivo não encontrado/);

    // Reset seguro cancelado não remove o arquivo
    rodarModulo('configuracoes', '2\n1\n\n12\n'); // garante que local.json existe
    const cancelado = rodarModulo('configuracoes', '11\n3\nn\n\n0\n\n12\n');
    assert.match(cancelado, /Cancelado\./);
    assert.ok(existsSync(arquivoConf), 'Reset cancelado não pode remover config/local.json');

    // Reset seguro confirmado remove o arquivo
    const resetado = rodarModulo('configuracoes', '11\n3\ns\n\n0\n\n12\n');
    assert.match(resetado, /Configurações restauradas ao padrão\./);
    assert.ok(!existsSync(arquivoConf), 'Reset seguro precisa remover config/local.json');

    rmSync(dir, { recursive: true, force: true });
});
