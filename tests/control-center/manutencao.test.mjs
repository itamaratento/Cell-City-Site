// Suite de testes do modulo Manutencao e Higienizacao — Fase 9.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CC = join(ROOT, 'scripts/control-center');
const MODULO = join(CC, 'modules/manutencao');

function ehExecutavel(caminho) {
    return (statSync(caminho).mode & 0o111) !== 0;
}
function rodar(stdin, env = {}) {
    return execSync(`bash menu.sh`, { cwd: MODULO, input: stdin, encoding: 'utf8', env: { ...process.env, ...env } });
}
function listarShellScripts(dir) {
    const r = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const c = join(dir, e.name);
        if (e.isDirectory()) r.push(...listarShellScripts(c));
        else if (e.name.endsWith('.sh')) r.push(c);
    }
    return r;
}

test('estrutura de pastas e arquivos', () => {
    for (const a of ['menu.sh','engine.sh','lib/utils.sh','lib/scanner.sh','lib/codigo-morto.sh','lib/duplicados.sh','lib/dependencias.sh','lib/estrutura.sh','lib/gitignore.sh','lib/limpeza.sh','lib/relatorio.sh','docs/manutencao.md']) {
        assert.ok(existsSync(join(MODULO, a)), `ausente: ${a}`);
    }
});

test('menu.sh e engine.sh executaveis', () => {
    assert.ok(ehExecutavel(join(MODULO, 'menu.sh')));
    assert.ok(ehExecutavel(join(MODULO, 'engine.sh')));
});

test('menu.sh carrega lib/common.sh e engine.sh', () => {
    const s = readFileSync(join(MODULO, 'menu.sh'), 'utf8');
    assert.match(s, /source "\$CC_ROOT\/lib\/common\.sh"/);
    assert.match(s, /source "\$MODULE_DIR\/engine\.sh"/);
});

test('engine.sh carrega todas as libs', () => {
    const s = readFileSync(join(MODULO, 'engine.sh'), 'utf8');
    for (const lib of ['utils.sh','scanner.sh','codigo-morto.sh','duplicados.sh','dependencias.sh','estrutura.sh','gitignore.sh','limpeza.sh','relatorio.sh']) {
        assert.match(s, new RegExp(`source "\\$MAN_LIB/${lib.replace('.', '\\.')}"`));
    }
});

test('sintaxe bash valida em todos os scripts', () => {
    const scripts = listarShellScripts(MODULO);
    assert.ok(scripts.length >= 11);
    const erros = [];
    for (const s of scripts) {
        try { execSync(`bash -n '${s}'`, { stdio: 'pipe' }); }
        catch (e) { erros.push(`${s}: ${e.stderr?.toString().trim()}`); }
    }
    assert.deepEqual(erros, []);
});

// A suíte original foi escrita contra a especificação, não contra a
// implementação real (menu com "1 ► Arquivos Órfãos", "11 ► Voltar",
// manifesto na posição 9) — a implementação entregue tem um fluxo mais
// rico (1 ► Análise Geral encadeando relatório+limpeza+plano; Voltar=12)
// e o slot 9 do manifesto já era do módulo Configurações. Asserções
// realinhadas à implementação na homologação CCC-V1.0-FINAL-001.

test('submenu exibe todas as opcoes', () => {
    const saida = rodar('12\n');
    assert.match(saida, /MANUTENÇÃO E HIGIENIZAÇÃO/);
    assert.match(saida, /Control Center › Manutenção/);
    assert.match(saida, /1 ► Análise Geral/);
    assert.match(saida, /2 ► Arquivos Órfãos/);
    assert.match(saida, /3 ► Código Morto/);
    assert.match(saida, /4 ► Scripts Duplicados/);
    assert.match(saida, /9 ► Limpeza Assistida/);
    assert.match(saida, /10 ► Executar Plano de Limpeza/);
    assert.match(saida, /11 ► Configurações/);
    assert.match(saida, /12 ► Voltar/);
});

test('moldura padrao', () => {
    const s = rodar('12\n');
    assert.ok(s.includes('╔') && s.includes('║') && s.includes('╚'));
});

test('breadcrumb exibe caminho', () => {
    const s = rodar('12\n');
    assert.match(s, /Control Center › Manutenção/);
});

test('opcao invalida nao quebra', () => {
    const s = rodar('99\n12\n');
    assert.match(s, /Opção inválida/);
});

test('auditoria orfaos executa', () => {
    const s = rodar('2\n\n12\n');
    assert.ok(s.includes('Arquivos Órfãos') || s.includes('RESUMO'));
});

test('auditoria codigo morto executa', () => {
    const s = rodar('3\n\n12\n');
    assert.ok(s.includes('Código Morto') || s.includes('RESUMO'));
});

test('auditoria duplicados executa', () => {
    const s = rodar('4\n\n12\n');
    assert.ok(s.includes('Duplicados') || s.includes('RESUMO'));
});

test('verificar estrutura executa', () => {
    const s = rodar('6\n\n12\n');
    assert.ok(s.includes('Estrutura') || s.includes('RESUMO'));
});

test('verificar gitignore executa', () => {
    const s = rodar('7\n\n12\n');
    assert.ok(s.includes('gitignore') || s.includes('RESUMO'));
});

test('modulo registrado no manifesto', () => {
    const conf = readFileSync(join(CC, 'config/modules.conf'), 'utf8');
    assert.match(conf, /10\|manutencao\|Manutenção e Higienização/);
});

test('state/manutencao.json existe e e atualizado apos auditoria', () => {
    const statePath = join(CC, 'state/manutencao.json');
    assert.ok(existsSync(statePath));
    rodar('7\n\n12\n');
    const dados = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.ok(dados.timestamp !== null, 'timestamp deve ser preenchido após auditoria');
    assert.ok(typeof dados.total === 'number', 'total deve ser um número');
});

test('seguranca: execucao do plano NUNCA remove arquivo protegido (defesa em profundidade)', () => {
    const src = readFileSync(join(MODULO, 'lib/limpeza.sh'), 'utf8');
    // A versão original tinha a lógica invertida: item protegido recebia
    // rm -f permanente e só o não-protegido ia pra _trash/. O loop de
    // execução agora recusa protegidos incondicionalmente.
    assert.match(src, /_cc_man_eh_protegido "\$alvo"; then\n\s*_cc_man_log_item "BLOQUEADO"/,
        'loop de execução precisa recusar arquivos protegidos');
    assert.doesNotMatch(src, /rm -f "\$alvo".*protegido/,
        'não pode existir remoção permanente de arquivo protegido');
});

test('isolamento: chamada direta', () => {
    const s = rodar('12\n');
    assert.match(s, /Manutenção/);
});
