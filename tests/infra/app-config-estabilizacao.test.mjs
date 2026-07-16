// P2.2-C — Validação da infraestrutura app-config.js (shared + ponte CC_CONFIG).
// Node puro, sem browser — complementa npm run auditar-arquitetura.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHARED = join(ROOT, 'CRM/shared');

function read(rel) { return readFileSync(join(ROOT, rel), 'utf8'); }

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// Scripts clássicos (IIFE) — literais cc_* permitidos apenas com fallback CC_CONFIG.
const CLASSIC_SCRIPTS = new Set([
  'brand-header.js',
  'theme.js',
  'sidebar.js',
  'env-config.js', // boot: define CC_ENV antes de app-config
]);

// ESM em shared/ que devem importar app-config quando usam chaves cc_* em runtime.
const ESM_STORAGE_ADOPTED = new Set([
  'app-config.js',
  'tenant-context.js',
  'tenant-resolver.js',
  'cc-sync.js',
  'central-modulos.js',
  'dock.js',
  'favoritos.js',
  'portal-sync.js',
]);

test('app-config: STORAGE_KEYS sem duplicatas de valor', () => {
  const src = read('CRM/shared/app-config.js');
  const vals = [...src.matchAll(/^\s+[A-Z_0-9]+:\s*'(cc_[^']+)'/gm)].map(m => m[1]);
  const dupes = vals.filter((v, i) => vals.indexOf(v) !== i);
  assert.deepEqual([...new Set(dupes)], [], `valores duplicados: ${dupes.join(', ')}`);
});

test('app-config: FLAGS expõe filtrosTenant, CHAT_ATIVO e SAAS_ONBOARDING_ATIVO', () => {
  const src = read('CRM/shared/app-config.js');
  assert.match(src, /export const FLAGS = \{[\s\S]*filtrosTenant:/);
  assert.match(src, /CHAT_ATIVO:\s*false/);
  assert.match(src, /SAAS_ONBOARDING_ATIVO:\s*false/);
  assert.match(src, /registerTenantFiltersChecker/);
  assert.doesNotMatch(src, /import\s+\{[^}]*areTenantFiltersEnabled[^}]*\}\s+from\s+['"]\.\/tenant-context\.js['"]/,
    'app-config não pode importar tenant-context (ciclo P2.2-B)');
});

test('tenant-context: registra checker e usa STORAGE_KEYS.TENANT_CACHE', () => {
  const src = read('CRM/shared/tenant-context.js');
  assert.match(src, /import\s+\{[^}]*STORAGE_KEYS[^}]*registerTenantFiltersChecker[^}]*\}\s+from\s+['"]\.\/app-config\.js['"]/);
  assert.match(src, /STORAGE_KEYS\.TENANT_CACHE/);
  assert.match(src, /registerTenantFiltersChecker\(areTenantFiltersEnabled\)/);
});

test('window.CC_CONFIG: side effect lista chaves obrigatórias', () => {
  const src = read('CRM/shared/app-config.js');
  const required = [
    'ENV', 'URLS', 'TEMPOS', 'PAGINACAO', 'CACHE', 'STORAGE_KEYS', 'COLECOES',
    'LOGS', 'AUDITORIA', 'FLAGS', 'DEFAULT_TENANT_ID', 'devPrefix', 'registerTenantFiltersChecker',
  ];
  for (const key of required) {
    assert.match(src, new RegExp(`window\\.CC_CONFIG\\s*=\\s*\\{[\\s\\S]*\\b${key}\\b`));
  }
});

test('scripts clássicos: fallback window.CC_CONFIG documentado no código', () => {
  for (const file of ['theme.js', 'sidebar.js', 'brand-header.js']) {
    const src = read(`CRM/shared/${file}`);
    assert.match(src, /window\.CC_CONFIG/, `${file} deve consultar window.CC_CONFIG`);
  }
});

test('shared ESM adotados: importam app-config quando usam storage cc_*', () => {
  const files = readdirSync(SHARED).filter(f => f.endsWith('.js') && !CLASSIC_SCRIPTS.has(f));
  const violacoes = [];
  for (const file of files) {
    const src = stripComments(read(`CRM/shared/${file}`));
    const usaStorageCc = /(?:localStorage|sessionStorage)\.(?:get|set|remove)Item\(\s*['"]cc_/.test(src);
    if (!usaStorageCc) continue;
    const importaConfig = /from\s+['"]\.\/app-config\.js['"]/.test(src);
    if (!importaConfig && !ESM_STORAGE_ADOPTED.has(file)) {
      violacoes.push(`${file}: usa chave cc_* literal sem import de app-config`);
    }
  }
  assert.deepEqual(violacoes, []);
});

test('shared ESM: sem literais cc_* soltos fora de app-config (exceto clássicos)', () => {
  const violacoes = [];
  for (const file of readdirSync(SHARED).filter(f => f.endsWith('.js'))) {
    if (file === 'app-config.js' || CLASSIC_SCRIPTS.has(file)) continue;
    const src = stripComments(read(`CRM/shared/${file}`));
    const literais = [...src.matchAll(/['"](cc_[a-z0-9_]+)['"]/g)].map(m => m[1]);
    // cc_backup_ em gdrive é boundary MIME, não storage key
    const storageLike = literais.filter(k => !k.startsWith('cc_backup_'));
    if (storageLike.length) violacoes.push(`${file}: ${storageLike.join(', ')}`);
  }
  assert.deepEqual(violacoes, []);
});

test('portal-sync: PORTAL_SYNC_KEYS alinhado a STORAGE_KEYS', () => {
  const src = read('CRM/shared/portal-sync.js');
  assert.match(src, /tutoriais:\s*STORAGE_KEYS\.PT_TUTORIAIS/);
  assert.match(src, /favoritos:\s*STORAGE_KEYS\.PT_FAVORITOS/);
});

test('cc-sync: coleções via COLECOES de app-config', () => {
  const src = read('CRM/shared/cc-sync.js');
  assert.match(src, /COLECOES\.CC_LIXEIRA/);
  assert.match(src, /COLECOES\.CC_GDRIVE_LOGS/);
  assert.doesNotMatch(src, /import\s+\{[^}]*\bdevPrefix\b[^}]*\}\s+from/, 'sem import morto devPrefix');
});

test('kernel.js: FLAG_AUTH ainda literal — pendência documentada (arquivo protegido)', () => {
  const src = read('CRM/scripts/kernel.js');
  assert.match(src, /cc_kernel_v1/);
  assert.match(read('CRM/shared/app-config.js'), /KERNEL_GATE:\s*'cc_kernel_v1'/,
    'STORAGE_KEYS.KERNEL_GATE deve manter o mesmo valor para merge futuro do kernel');
});
