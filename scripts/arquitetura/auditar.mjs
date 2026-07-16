#!/usr/bin/env node
// ============================================================
// Cell City CRM — Auditor de Arquitetura (Sprint 1 · Fase 1.1)
// Uso: npm run auditar-arquitetura
//
// Invariantes (violação ⇒ exit 1):
//  1. Nenhum import quebrado (alvo inexistente) no client (CRM/**.js)
//  2. Nenhuma dependência circular
//  3. Nenhum import página→página (módulos de pages/ são isolados;
//     compartilhamento só via shared/, scripts/, services/,
//     repositories/, firebase/)
//  4. initializeApp somente nos pontos autorizados
//  5. Import direto do SDK Firebase (CDN) somente na allowlist
//     (novos arquivos devem usar scripts/firebase.js / firebase/client.js)
//
// Métricas informativas: fan-in do núcleo, adoção kernel/repository
// por módulo. Parser: ESM estático + dynamic import; comentários
// removidos antes da análise (doc-headers citam imports de exemplo).
// ============================================================
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CRM = join(ROOT, 'CRM');
const rel = (f) => relative(ROOT, f);

// ---- Exceções conhecidas (auditadas na Fase 1.1 — ver CRM/ARQUITETURA.md §6)
const CDN_ALLOWLIST = new Set([
  'CRM/scripts/firebase.js',                              // hub oficial do SDK
  'CRM/scripts/kernel.js',                                // primitivas auth/firestore (mesma URL do SDK ⇒ módulo único)
  'CRM/shared/session.js',                                // LEGADO (config/Ferramentas) — migração recomendada
  'CRM/pages/catalogo/public/catalogo-publico.js',        // página pública sem kernel (usa env-config)
  'CRM/pages/central-informacoes/informacoes.js',         // storage direto — dívida registrada (usar getFirebaseStorage)
  'CRM/pages/usuarios-permissoes/firebase-secondary.js',  // app secundário deliberado (criar usuário sem derrubar sessão)
  'CRM/pages/usuarios-permissoes/usuarios-permissoes.js', // functions/callable
]);
const INIT_APP_ALLOWLIST = new Set([
  'CRM/scripts/firebase.js',
  'CRM/pages/catalogo/public/catalogo-publico.js',
  'CRM/pages/usuarios-permissoes/firebase-secondary.js',
]);
const CAMADAS_COMPARTILHADAS = ['shared', 'scripts', 'repositories', 'services', 'firebase'];

const strip = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

const js = execSync(`find "${CRM}" -name "*.js" -not -path "*/node_modules/*"`, { encoding: 'utf8' })
  .trim().split('\n').sort();

let erros = 0;
const falha = (msg) => { erros++; console.error(`  ❌ ${msg}`); };

// ---- Grafo de imports
const graph = new Map();
const cdnPorArquivo = new Map();
for (const f of js) {
  const src = strip(readFileSync(f, 'utf8'));
  const deps = new Set(); const cdns = new Set();
  const re = /import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of src.matchAll(re)) {
    const spec = m[1] || m[2];
    if (!spec) continue;
    if (spec.startsWith('http')) { cdns.add(spec); continue; }
    if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
    let p = spec.split('?')[0];
    p = p.startsWith('/') ? join(ROOT, p) : resolve(dirname(f), p);
    if (!/\.(js|mjs|cjs|json)$/.test(p)) p += '.js';
    deps.add(p);
  }
  graph.set(f, deps);
  if (cdns.size) cdnPorArquivo.set(f, cdns);
}

// ---- 1. Imports quebrados
console.log(`\n[1/5] Imports quebrados (${js.length} arquivos JS)`);
let ok = true;
for (const [f, deps] of graph) for (const d of deps) {
  if (!existsSync(d)) { falha(`${rel(f)} -> ${rel(d)}`); ok = false; }
}
if (ok) console.log('  ✅ nenhum');

// ---- 2. Circulares
console.log('\n[2/5] Dependências circulares');
const color = new Map(js.map(f => [f, 0]));
const ciclos = [];
(function run() {
  function dfs(f, stack) {
    color.set(f, 1); stack.push(f);
    for (const d of graph.get(f) || []) {
      if (!graph.has(d)) continue;
      if (color.get(d) === 1) ciclos.push([...stack.slice(stack.indexOf(d)), d]);
      else if (color.get(d) === 0) dfs(d, stack);
    }
    stack.pop(); color.set(f, 2);
  }
  for (const f of js) if (color.get(f) === 0) dfs(f, []);
})();
if (ciclos.length) ciclos.forEach(c => falha(c.map(rel).join(' -> ')));
else console.log('  ✅ nenhuma (grafo acíclico)');

// ---- 3. Isolamento entre módulos de página
console.log('\n[3/5] Isolamento página→página');
ok = true;
for (const f of js) {
  if (!f.includes('/pages/')) continue;
  const mod = rel(f).split('/')[2];
  for (const d of graph.get(f) || []) {
    const partes = rel(d).split('/');
    if (partes[1] === 'pages' && partes[2] !== mod) {
      falha(`${rel(f)} importa de pages/${partes[2]}`); ok = false;
    }
  }
}
if (ok) console.log('  ✅ módulos isolados (compartilhamento só pelas camadas comuns)');

// ---- 4. initializeApp autorizado
console.log('\n[4/5] Inicializações do Firebase App');
ok = true;
for (const f of js) {
  const src = strip(readFileSync(f, 'utf8'));
  if (src.includes('initializeApp(') && !INIT_APP_ALLOWLIST.has(rel(f))) {
    falha(`initializeApp fora da allowlist: ${rel(f)}`); ok = false;
  }
}
if (ok) console.log(`  ✅ somente pontos autorizados (${INIT_APP_ALLOWLIST.size})`);

// ---- 5. Import direto de SDK (CDN)
console.log('\n[5/5] Import direto do SDK Firebase (CDN)');
ok = true;
for (const [f] of cdnPorArquivo) {
  if (!CDN_ALLOWLIST.has(rel(f))) {
    falha(`novo import direto de CDN em ${rel(f)} — usar scripts/firebase.js`); ok = false;
  }
}
if (ok) console.log(`  ✅ restrito à allowlist auditada (${cdnPorArquivo.size} arquivos)`);

// ---- Métricas
console.log('\n[métricas]');
const fanIn = new Map();
for (const deps of graph.values()) for (const d of deps) fanIn.set(d, (fanIn.get(d) || 0) + 1);
console.log('  fan-in (top 6):');
[...fanIn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  .forEach(([f, n]) => console.log(`    ${String(n).padStart(3)}  ${rel(f)}`));

const porModulo = {};
for (const f of js) {
  if (!f.includes('/pages/')) continue;
  const mod = rel(f).split('/')[2];
  const src = strip(readFileSync(f, 'utf8'));
  porModulo[mod] ??= { kernel: false, repo: false, direto: false };
  if (/scripts\/kernel\.js/.test(src)) porModulo[mod].kernel = true;
  if (/repositories\//.test(src)) porModulo[mod].repo = true;
  if (/from\s+['"][^'"]*(scripts\/firebase\.js|firebase\/client\.js)['"]/.test(src) ||
      /firebasejs\/[\d.]+\/firebase-firestore/.test(src)) porModulo[mod].direto = true;
}
const mods = Object.entries(porModulo);
console.log(`  módulos de página: ${mods.length}`);
console.log(`  usam kernel: ${mods.filter(([, s]) => s.kernel).length}`);
console.log(`  usam repository: ${mods.filter(([, s]) => s.repo).length}`);
console.log(`  acesso direto ao Firestore (migração gradual): ${mods.filter(([, s]) => s.direto).length}`);

console.log(erros ? `\n🔴 ${erros} violação(ões) de arquitetura` : '\n🟢 Arquitetura íntegra');
process.exit(erros ? 1 : 0);
