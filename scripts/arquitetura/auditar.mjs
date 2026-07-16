#!/usr/bin/env node
// ============================================================
// Cell City CRM — Auditor de Arquitetura (Sprint 1 · Fase 1.1 + 1.3)
// Uso: npm run auditar-arquitetura
//
// Invariantes (violação ⇒ exit 1):
//  1. Nenhum import quebrado (alvo inexistente) no client
//  2. Nenhuma dependência circular
//  3. Nenhum import página→página (módulos de pages/ são isolados;
//     compartilhamento só via shared/, scripts/, services/,
//     repositories/, firebase/)
//  4. initializeApp somente nos pontos autorizados
//  5. Import direto do SDK Firebase (CDN) somente na allowlist
//     (novos arquivos devem usar scripts/firebase.js / firebase/client.js)
//  6. Nenhum import absoluto '/CRM/...' (H-008: resolve sempre para
//     produção, mesmo dentro de /dev — caminhos devem ser relativos)
//
// Fase 1.3 (2026-07-16, Kernel): a Fase 1.1 só analisava CRM/**.js —
// invisível aos <script type="module"> INLINE de .html, que são pontos
// de bootstrap reais. Isso escondia 3 initializeApp legítimos
// (garantia.html, saas-onboarding/index.html, portal-cliente/index.html),
// um 2º onAuthStateChanged legítimo (auth anônima do cliente do Portal,
// bounded context próprio) e um import absoluto real (kernel-test/index.html,
// corrigido nesta fase). O parser agora extrai e audita esses blocos como
// se fossem arquivos (chave = caminho do .html). Ver CRM/ARQUITETURA.md §6.
//
// Métricas informativas: fan-in do núcleo, adoção kernel/repository por
// módulo — calculada por ALCANÇABILIDADE TRANSITIVA no grafo (Fase 1.3),
// não mais por regex no próprio arquivo (que dava falso negativo quando
// o módulo só chega ao kernel via um helper de shared/, ex.:
// central-modulos.js, portal-sync.js, ou via bloco inline de .html, ex.:
// portal-cliente/admin.html).
//
// Parser: ESM estático + dynamic import; comentários removidos antes da
// análise (doc-headers citam imports de exemplo — inclusive alguns com
// caminho absoluto, por isso não viram falso-positivo do invariante 6).
// ============================================================
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CRM = join(ROOT, 'CRM');
const rel = (f) => relative(ROOT, f);

// ---- Exceções conhecidas (auditadas nas Fases 1.1/1.3 — ver CRM/ARQUITETURA.md §6)
const CDN_ALLOWLIST = new Set([
  'CRM/scripts/firebase.js',                              // hub oficial do SDK
  'CRM/scripts/kernel.js',                                // primitivas auth/firestore (mesma URL do SDK ⇒ módulo único)
  'CRM/shared/session.js',                                // LEGADO (config/Ferramentas) — migração recomendada
  'CRM/pages/catalogo/public/catalogo-publico.js',        // página pública sem kernel (usa env-config)
  'CRM/pages/central-informacoes/informacoes.js',         // storage direto — dívida registrada (usar getFirebaseStorage)
  'CRM/pages/usuarios-permissoes/firebase-secondary.js',  // app secundário deliberado (criar usuário sem derrubar sessão)
  'CRM/pages/usuarios-permissoes/usuarios-permissoes.js', // functions/callable
  'CRM/garantia.html',                                    // Fase 1.3: página pública (Cloud Function, sem Auth)
  'CRM/pages/saas-onboarding/index.html',                 // Fase 1.3: cadastro público de empresa (Cloud Function)
  'CRM/pages/portal-cliente/index.html',                  // Fase 1.3: app anônima do cliente — bounded context próprio.
                                                           // NOTA: usa <script type="importmap"> (bare specifier "firebase/app"),
                                                           // que este parser não resolve — entrada mantida por documentação;
                                                           // o invariante 5 nunca a aciona de fato (ver relatório A2, §5 Riscos).
  'CRM/pages/kernel-test/index.html',                     // Fase 1.3: diagnóstico — signOut() cru p/ não redirecionar
]);
const INIT_APP_ALLOWLIST = new Set([
  'CRM/scripts/firebase.js',
  'CRM/pages/catalogo/public/catalogo-publico.js',
  'CRM/pages/usuarios-permissoes/firebase-secondary.js',
  'CRM/garantia.html',                     // Fase 1.3
  'CRM/pages/saas-onboarding/index.html',  // Fase 1.3
  'CRM/pages/portal-cliente/index.html',   // Fase 1.3
]);

const strip = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

const js = execSync(`find "${CRM}" -name "*.js" -not -path "*/node_modules/*"`, { encoding: 'utf8' })
  .trim().split('\n').sort();
const htmlTodos = execSync(`find "${CRM}" -name "*.html" -not -path "*/node_modules/*"`, { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean).sort();

// Extrai o(s) bloco(s) <script type="module"> inline (ignora type="importmap"
// e <script type="module" src="..."> externo, que não tem corpo relevante).
const INLINE_MODULE_RE = /<script\s+type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi;
function inlineModuleSrc(f) {
  const raw = readFileSync(f, 'utf8');
  let out = '';
  let m;
  INLINE_MODULE_RE.lastIndex = 0;
  while ((m = INLINE_MODULE_RE.exec(raw))) out += m[1] + '\n';
  return out;
}

// ---- Grafo de imports (arquivos .js + blocos <script type="module"> de .html)
const graph = new Map();
const cdnPorArquivo = new Map();
const absPorArquivo = new Map();
const IMPORT_RE = /import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function registrar(f, srcOriginal) {
  const src = strip(srcOriginal);
  const deps = new Set(); const cdns = new Set(); const abs = new Set();
  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1] || m[2];
    if (!spec) continue;
    if (spec.startsWith('http')) { cdns.add(spec); continue; }
    if (spec.startsWith('/')) abs.add(spec);
    if (!spec.startsWith('.') && !spec.startsWith('/')) continue; // bare specifier (ex.: "firebase/app" via importmap) — não resolvível como arquivo
    let p = spec.split('?')[0];
    p = p.startsWith('/') ? join(ROOT, p) : resolve(dirname(f), p);
    if (!/\.(js|mjs|cjs|json)$/.test(p)) p += '.js';
    deps.add(p);
  }
  graph.set(f, deps);
  if (cdns.size) cdnPorArquivo.set(f, cdns);
  if (abs.size) absPorArquivo.set(f, abs);
}

for (const f of js) registrar(f, readFileSync(f, 'utf8'));
for (const f of htmlTodos) {
  const inline = inlineModuleSrc(f);
  if (inline.trim()) registrar(f, inline);
}

const html = htmlTodos.filter((f) => graph.has(f));

// ---- 1. Imports quebrados
console.log(`\n[1/6] Imports quebrados (${js.length} arquivos JS + ${html.length} blocos inline de .html)`);
let ok = true;
let erros = 0;
const falha = (msg) => { erros++; console.error(`  ❌ ${msg}`); };
for (const [f, deps] of graph) for (const d of deps) {
  if (!existsSync(d)) { falha(`${rel(f)} -> ${rel(d)}`); ok = false; }
}
if (ok) console.log('  ✅ nenhum');

// ---- 2. Circulares
console.log('\n[2/6] Dependências circulares');
const todosArquivos = [...js, ...html];
const color = new Map(todosArquivos.map(f => [f, 0]));
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
  for (const f of todosArquivos) if (color.get(f) === 0) dfs(f, []);
})();
if (ciclos.length) ciclos.forEach(c => falha(c.map(rel).join(' -> ')));
else console.log('  ✅ nenhuma (grafo acíclico)');

// ---- 3. Isolamento entre módulos de página
console.log('\n[3/6] Isolamento página→página');
ok = true;
for (const f of todosArquivos) {
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
console.log('\n[4/6] Inicializações do Firebase App');
ok = true;
const htmlSet = new Set(html);
for (const f of todosArquivos) {
  const bruto = htmlSet.has(f) ? inlineModuleSrc(f) : readFileSync(f, 'utf8');
  const texto = strip(bruto);
  if (texto.includes('initializeApp(') && !INIT_APP_ALLOWLIST.has(rel(f))) {
    falha(`initializeApp fora da allowlist: ${rel(f)}`); ok = false;
  }
}
if (ok) console.log(`  ✅ somente pontos autorizados (${INIT_APP_ALLOWLIST.size})`);

// ---- 5. Import direto de SDK (CDN)
console.log('\n[5/6] Import direto do SDK Firebase (CDN)');
ok = true;
for (const [f] of cdnPorArquivo) {
  if (!CDN_ALLOWLIST.has(rel(f))) {
    falha(`novo import direto de CDN em ${rel(f)} — usar scripts/firebase.js`); ok = false;
  }
}
if (ok) console.log(`  ✅ restrito à allowlist auditada (${cdnPorArquivo.size} arquivos)`);

// ---- 6. Imports absolutos '/CRM/...' (H-008)
console.log('\n[6/6] Imports absolutos fora do padrão (H-008)');
ok = true;
for (const [f, specs] of absPorArquivo) {
  for (const s of specs) { falha(`import absoluto em ${rel(f)}: '${s}' — usar caminho relativo`); ok = false; }
}
if (ok) console.log('  ✅ nenhum (todos os imports são relativos)');

// ---- Métricas
console.log('\n[métricas]');
const fanIn = new Map();
for (const deps of graph.values()) for (const d of deps) fanIn.set(d, (fanIn.get(d) || 0) + 1);
console.log('  fan-in (top 6):');
[...fanIn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  .forEach(([f, n]) => console.log(`    ${String(n).padStart(3)}  ${rel(f)}`));

// Adoção kernel/repository por módulo — alcançabilidade transitiva no grafo
// (Fase 1.3), não regex no próprio arquivo (ver nota no topo do arquivo).
const KERNEL_FILE = join(CRM, 'scripts', 'kernel.js');
const FIREBASE_HUB = new Set([join(CRM, 'scripts', 'firebase.js'), join(CRM, 'firebase', 'client.js')]);

function alcancaveis(raizes) {
  const vistos = new Set();
  const fila = [...raizes];
  while (fila.length) {
    const f = fila.pop();
    if (vistos.has(f)) continue;
    vistos.add(f);
    for (const d of graph.get(f) || []) fila.push(d);
  }
  return vistos;
}

const porModulo = {};
for (const f of todosArquivos) {
  const r = rel(f);
  if (!r.startsWith('CRM/pages/')) continue;
  const mod = r.split('/')[2];
  porModulo[mod] ??= { raizes: [] };
  porModulo[mod].raizes.push(f);
}
for (const [, info] of Object.entries(porModulo)) {
  const alcance = alcancaveis(info.raizes);
  // kernel/repo: alcançabilidade TRANSITIVA — gate por kernel ou adoção de
  // Repository valem mesmo vindo de um helper de shared/ ou de outro arquivo
  // da cadeia (é uma garantia arquitetural, não importa quem a fornece).
  info.kernel = alcance.has(KERNEL_FILE);
  info.repo = [...alcance].some(f => rel(f).startsWith('CRM/repositories/'));
  // direto: import DIRETO (1º grau) do próprio módulo — proxy de dívida de
  // migração ("este módulo ainda faz Firestore cru"). Não pode ser
  // transitivo: kernel.js importa firebase.js, então TODO módulo que usa
  // kernel "alcançaria" firebase.js e o indicador perderia sentido.
  info.direto = info.raizes.some(f => {
    if ([...(graph.get(f) || [])].some(d => FIREBASE_HUB.has(d))) return true;
    const cdns = cdnPorArquivo.get(f);
    return cdns && [...cdns].some(c => /firebase-firestore/.test(c));
  });
}
const mods = Object.entries(porModulo);
console.log(`  módulos de página: ${mods.length}`);
console.log(`  usam kernel (alcançabilidade transitiva): ${mods.filter(([, s]) => s.kernel).length}`);
console.log(`  usam repository (alcançabilidade transitiva): ${mods.filter(([, s]) => s.repo).length}`);
console.log(`  acesso direto ao Firestore (migração gradual): ${mods.filter(([, s]) => s.direto).length}`);
const semKernel = mods.filter(([, s]) => !s.kernel).map(([m]) => m);
if (semKernel.length) console.log(`  sem kernel (ver exceções documentadas): ${semKernel.join(', ')}`);

console.log(erros ? `\n🔴 ${erros} violação(ões) de arquitetura` : '\n🟢 Arquitetura íntegra');
process.exit(erros ? 1 : 0);
