#!/usr/bin/env node
/* ============================================================
   TESTES — Central de Módulos V2 (Sprint MOD-V2-001)

   Valida o gerador, o JSON publicado, a compatibilidade da API
   de shared/central-modulos.js e a descoberta automática de
   módulos novos (cria uma pasta temporária, regenera, confere,
   remove e regenera de volta — sempre com cleanup).

   Uso: node scripts/central-modulos/test-catalogo.mjs
   Sai com código 1 se qualquer teste falhar.
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GERADOR = path.join(ROOT, 'scripts', 'central-modulos', 'gerar-catalogo.mjs');
const JSON_PATH = path.join(ROOT, 'CRM', 'shared', 'modulos.catalogo.json');
const LIB_PATH = path.join(ROOT, 'CRM', 'shared', 'central-modulos.js');
const PAGE_JS = path.join(ROOT, 'CRM', 'pages', 'central-modulos', 'central-modulos-page.js');

let passou = 0, falhou = 0;
function teste(nome, fn) {
  try { fn(); console.log(`  ✅ ${nome}`); passou++; }
  catch (e) { console.error(`  ❌ ${nome}\n     ${e.message}`); falhou++; }
}
function esperar(cond, msg) { if (!cond) throw new Error(msg); }
function rodarGerador(args = []) {
  return execFileSync(process.execPath, [GERADOR, ...args], { cwd: ROOT, encoding: 'utf8' });
}

console.log('— Sintaxe (node --check) —');
for (const f of [GERADOR, LIB_PATH, PAGE_JS]) {
  teste(path.relative(ROOT, f), () => execFileSync(process.execPath, ['--check', f], { encoding: 'utf8' }));
}

console.log('— Catálogo gerado em dia com o código (--check) —');
teste('gerar-catalogo.mjs --check', () => rodarGerador(['--check']));

console.log('— Estrutura do JSON —');
const cat = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const visiveis = cat.modulos.filter((m) => !m.oculto);

teste('tem resumo, anomalias e modulos', () =>
  esperar(cat.resumo && Array.isArray(cat.anomalias) && Array.isArray(cat.modulos), 'campo raiz ausente'));

teste('ids são únicos', () => {
  const ids = cat.modulos.map((m) => m.id);
  esperar(new Set(ids).size === ids.length, 'há id duplicado');
});

teste('campos obrigatórios da Etapa 2 presentes em todo módulo', () => {
  const campos = ['id', 'pasta', 'nome', 'grupo', 'descricao', 'versao', 'autor', 'status', 'dependencias',
    'rbac', 'url', 'menu', 'icone', 'categoria', 'atualizadoEm', 'arquivosPrincipais', 'checklist', 'score'];
  for (const m of cat.modulos) {
    for (const c of campos) esperar(m[c] !== undefined, `módulo '${m.pasta}' sem campo '${c}'`);
    esperar(['ok', 'atencao', 'erro'].includes(m.status), `status inválido em '${m.pasta}': ${m.status}`);
    esperar(m.score >= 0 && m.score <= 100, `score fora de 0-100 em '${m.pasta}'`);
  }
});

teste('toda URL do catálogo aponta para arquivo real', () => {
  for (const m of cat.modulos) esperar(existsSync(path.join(ROOT, m.url)), `URL sem arquivo: ${m.url}`);
});

console.log('— Regressão: compatibilidade com o catálogo antigo (RAW_MODULOS) —');
// 28 dos 29 ids do RAW_MODULOS antigo; 'chat' fica fora de propósito —
// o dono desativou o módulo em 2026-07-10 (TECHDOC §31) e a entrada no
// catálogo tinha sido adicionada por engano um dia depois (ea44c0a).
const IDS_ANTIGOS = ['os', 'caixa', 'central-alertas', 'central-comandos', 'crm-comercial', 'clientes',
  'estoque', 'financeiro', 'compras', 'fornecedor', 'pos-venda', 'config', 'contas', 'agenda',
  'portal-cliente', 'portal-tecnico', 'central-automacao', 'central-informacoes', 'catalogo',
  'relatorios', 'diario', 'auditoria', 'autoatendimento', 'analise', 'campanhas', 'importar',
  'minha-semana', 'usuarios-permissoes'];

teste('os 28 ids ativos do catálogo antigo continuam visíveis (nada removido)', () => {
  const ids = new Set(visiveis.map((m) => m.id));
  const faltando = IDS_ANTIGOS.filter((i) => !ids.has(i));
  esperar(faltando.length === 0, `ids sumidos: ${faltando.join(', ')}`);
});

teste('chat existe no catálogo mas oculto (desativado, TECHDOC §31)', () => {
  const chat = cat.modulos.find((m) => m.id === 'chat');
  esperar(chat && chat.oculto && /TECHDOC §31/.test(chat.motivoOculto || ''), 'chat deveria estar oculto com motivo apontando ao TECHDOC §31');
});

teste('ids legados de favoritos preservados (agenda, central-automacao)', () => {
  esperar(cat.modulos.some((m) => m.id === 'agenda' && m.pasta === 'acaodasemana'), 'agenda→acaodasemana perdido');
  esperar(cat.modulos.some((m) => m.id === 'central-automacao' && m.pasta === 'central-organizacao'), 'central-automacao→central-organizacao perdido');
});

teste('módulos internos continuam ocultos com motivo', () => {
  for (const p of ['dashboard', 'kernel-test', 'em-breve', 'central-modulos', 'estrategia']) {
    const m = cat.modulos.find((x) => x.pasta === p);
    esperar(m && m.oculto && m.motivoOculto, `'${p}' deveria estar oculto com motivoOculto`);
  }
});

teste('portal-cliente entra pelo admin.html (painel interno)', () =>
  esperar(cat.modulos.find((m) => m.id === 'portal-cliente').url.endsWith('/admin.html'), 'url do portal-cliente mudou'));

console.log('— Compatibilidade da API de shared/central-modulos.js —');
const libSrc = readFileSync(LIB_PATH, 'utf8');
teste('exports consumidos por menu-favoritos.js/página preservados', () => {
  for (const exp of ['export const TODOS_MODULOS', 'export function init', 'export function getFavoritos',
    'export function isFavorito', 'export async function toggleFavorito']) {
    esperar(libSrc.includes(exp), `export sumiu: ${exp}`);
  }
});
teste('evento cc-modulos-changed continua sendo disparado', () =>
  esperar(libSrc.includes("cc-modulos-changed"), 'evento de re-render removido'));
teste('caminho Firestore de favoritos inalterado (usuarios/{uid}/preferencias/modulos)', () =>
  esperar(libSrc.includes("doc(db, 'usuarios', uid, 'preferencias', 'modulos')"), 'caminho de favoritos mudou'));

console.log('— Descoberta automática (Etapa 3, fim a fim) —');
const PASTA_TESTE = path.join(ROOT, 'CRM', 'pages', 'zz-teste-descoberta');
teste('pasta nova em CRM/pages/ aparece no catálogo sem editar lista nenhuma', () => {
  try {
    mkdirSync(PASTA_TESTE, { recursive: true });
    writeFileSync(path.join(PASTA_TESTE, 'index.html'), '<!DOCTYPE html><html><head><title>Cell City - Teste Descoberta</title></head><body></body></html>\n');
    rodarGerador();
    const novo = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
    const m = novo.modulos.find((x) => x.pasta === 'zz-teste-descoberta');
    esperar(m, 'módulo novo não foi descoberto');
    esperar(m.nome === 'Teste Descoberta', `nome não derivado do <title>: '${m.nome}'`);
    esperar(!m.oculto, 'módulo novo deveria nascer visível');
    esperar(m.grupo === 'Sem grupo', 'módulo novo sem meta deveria cair em "Sem grupo"');
  } finally {
    rmSync(PASTA_TESTE, { recursive: true, force: true });
    rodarGerador(); // restaura o catálogo real
  }
  const restaurado = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
  esperar(!restaurado.modulos.some((x) => x.pasta === 'zz-teste-descoberta'), 'cleanup não restaurou o catálogo');
});

console.log(`\n${falhou === 0 ? '✅' : '❌'} ${passou} passou / ${falhou} falhou`);
process.exit(falhou === 0 ? 0 : 1);
