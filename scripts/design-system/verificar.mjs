#!/usr/bin/env node
// ============================================================
// Cell City CRM — Verificador do Design System (P2.4)
// Uso: npm run verificar-design-system
//
// Checagens (falha ⇒ exit 1):
//  1. Toda página HTML do CRM linka design-system.css e theme.js
//  2. Todo token var(--cc-*) referenciado existe no design-system.css
//  3. Chaves { } balanceadas em todos os CSS do CRM
//  4. Nenhum ID duplicado dentro de um mesmo HTML
//  5. Nenhum viewport com user-scalable=no / maximum-scale
// Métricas informativas (não falham): styles inline, !important,
// hex de marca fora do DS.
// ============================================================
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CRM = join(ROOT, 'CRM');
const DS = join(CRM, 'shared', 'design-system.css');

const list = (pattern) => execSync(
  `find "${CRM}" -name "${pattern}" -not -path "*/node_modules/*"`,
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean).sort();

const htmls = list('*.html');
const csss = list('*.css');
const dsCss = readFileSync(DS, 'utf8');

let erros = 0;
const falha = (msg) => { erros++; console.error(`  ❌ ${msg}`); };

// ---- 1. Integração do DS em todas as páginas
console.log(`\n[1/5] Integração do Design System (${htmls.length} páginas)`);
for (const f of htmls) {
  const html = readFileSync(f, 'utf8');
  if (!html.includes('design-system.css')) falha(`sem design-system.css: ${f}`);
  if (!html.includes('theme.js')) falha(`sem theme.js: ${f}`);
}
if (!erros) console.log('  ✅ todas as páginas linkam design-system.css + theme.js');

// ---- 2. Tokens referenciados existem
console.log('\n[2/5] Tokens --cc-* referenciados existem no DS');
const definidos = new Set([...dsCss.matchAll(/(--cc-[a-z0-9-]+)\s*:/g)].map(m => m[1]));
let refsOk = true;
for (const f of [...csss, ...htmls]) {
  const conteudo = readFileSync(f, 'utf8');
  for (const m of conteudo.matchAll(/var\((--cc-[a-z0-9-]+)[),]/g)) {
    if (!definidos.has(m[1])) { falha(`token inexistente ${m[1]} em ${f}`); refsOk = false; }
  }
}
if (refsOk) console.log(`  ✅ ${definidos.size} tokens definidos, todas as referências resolvem`);

// ---- 3. Chaves balanceadas
console.log('\n[3/5] Sintaxe CSS (balanceamento de chaves)');
let cssOk = true;
for (const f of csss) {
  const c = readFileSync(f, 'utf8');
  const abre = (c.match(/\{/g) || []).length;
  const fecha = (c.match(/\}/g) || []).length;
  if (abre !== fecha) { falha(`chaves desbalanceadas (${abre}x{ ${fecha}x}) em ${f}`); cssOk = false; }
}
if (cssOk) console.log(`  ✅ ${csss.length} arquivos CSS com chaves balanceadas`);

// ---- 4. IDs duplicados
console.log('\n[4/5] IDs duplicados por página');
let idsOk = true;
for (const f of htmls) {
  const html = readFileSync(f, 'utf8');
  const ids = [...html.matchAll(/[\s<]id="([^"]+)"/g)].map(m => m[1]);
  const vistos = new Set(), dups = new Set();
  for (const id of ids) (vistos.has(id) ? dups : vistos).add(id);
  if (dups.size) { falha(`IDs duplicados em ${f}: ${[...dups].join(', ')}`); idsOk = false; }
}
if (idsOk) console.log('  ✅ nenhum ID duplicado');

// ---- 5. Viewport acessível
console.log('\n[5/5] Viewport acessível (zoom permitido)');
let vpOk = true;
for (const f of htmls) {
  const html = readFileSync(f, 'utf8');
  if (/user-scalable\s*=\s*no|maximum-scale/i.test(html)) {
    falha(`viewport bloqueia zoom em ${f}`); vpOk = false;
  }
}
if (vpOk) console.log('  ✅ nenhuma página bloqueia zoom');

// ---- Métricas informativas
console.log('\n[métricas] (informativas, não falham a verificação)');
let inline = 0, important = 0, hexMarca = 0;
for (const f of htmls) inline += (readFileSync(f, 'utf8').match(/ style="/g) || []).length;
for (const f of csss) {
  if (f === DS) continue;
  const c = readFileSync(f, 'utf8');
  important += (c.match(/!important/g) || []).length;
  hexMarca += (c.match(/#00c853|#00e676|#009624|#ffcc00/gi) || []).length;
}
console.log(`  styles inline em HTML: ${inline}`);
console.log(`  !important em CSS de página: ${important}`);
console.log(`  hex de marca fora do DS: ${hexMarca}`);

console.log(erros ? `\n🔴 ${erros} erro(s)` : '\n🟢 Design System íntegro');
process.exit(erros ? 1 : 0);
