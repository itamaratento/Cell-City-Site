// Fase 2 — Testes automatizados, em sequência, com tempo e resumo por suíte.
// Não altera nenhum arquivo do sistema — só executa suítes já existentes no
// repositório mais os 2 checks novos (polling gating + smoke do cache da Fase 2).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function parseNodeTestSummary(output) {
  const pass = Number((/ℹ pass (\d+)/.exec(output) || [])[1] ?? NaN);
  const fail = Number((/ℹ fail (\d+)/.exec(output) || [])[1] ?? NaN);
  const durationMs = Number((/ℹ duration_ms ([\d.]+)/.exec(output) || [])[1] ?? NaN);
  const failedTests = [...new Set([...output.matchAll(/^✖ (.+?) \(\d/gm)].map(m => m[1]))];
  return { pass, fail, durationMs, failedTests };
}

function step(name, fn) {
  const t0 = Date.now();
  try {
    const result = fn();
    return { name, ms: Date.now() - t0, ...result };
  } catch (e) {
    return { name, ms: Date.now() - t0, ok: false, error: e.message };
  }
}

function runSuite(cwd, cmd, args, env) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  const output = `${r.stdout || ''}\n${r.stderr || ''}`;
  const parsed = parseNodeTestSummary(output);
  const ok = Number.isFinite(parsed.pass) && Number.isFinite(parsed.fail) && parsed.fail === 0;
  return { ok, pass: parsed.pass, fail: parsed.fail, ms: parsed.durationMs, failedTests: parsed.failedTests, exitCode: r.status, rawTail: output.slice(-2000) };
}

export function runTests({ cwd = process.cwd(), filesToCheck = [] } = {}) {
  const startedAt = new Date().toISOString();
  const steps = [];

  // 1. node --check nos arquivos .js modificados (sintaxe)
  steps.push(step('node --check (arquivos modificados)', () => {
    const jsFiles = filesToCheck.filter(f => f.endsWith('.js'));
    if (jsFiles.length === 0) return { ok: true, files: [], note: 'nenhum .js modificado — nada a checar' };
    const results = jsFiles.map(f => {
      const r = spawnSync('node', ['--check', f], { cwd, encoding: 'utf8' });
      return { file: f, ok: r.status === 0, error: r.status === 0 ? null : (r.stderr || '').split('\n')[0] };
    });
    return { ok: results.every(r => r.ok), files: results };
  }));

  // 2. Firestore Rules
  steps.push(step('Firestore Rules', () => runSuite(join(cwd, 'tests/firestore-rules'), 'npm', ['test'])));

  // 3. Cloud Functions do Portal (via emulador)
  steps.push(step('Cloud Functions (Portal)', () => {
    const rootBin = join(cwd, 'node_modules/.bin');
    return runSuite(
      join(cwd, 'tests/functions'),
      'firebase',
      ['emulators:exec', '--only', 'firestore', '--project', 'cellcity-rules-test', 'node --test'],
      { PATH: `${rootBin}:${process.env.PATH}` }
    );
  }));

  // 4. RBAC
  steps.push(step('RBAC', () => runSuite(join(cwd, 'tests/rbac'), 'npm', ['test'])));

  // 5. Polling gating (padrão isolado, permanente — tests/performance/)
  steps.push(step('Polling gating (padrão isolado)', () => runSuite(cwd, 'node', ['--test', 'tests/performance/polling-gating.test.mjs'])));

  // 6. Smoke do cache persistente (Fase 2) — checagem estática, sem navegador.
  // Confirma que a API esperada continua presente em firebase.js; a validação
  // comportamental de verdade (IndexedDB/offline/multi-tab) é feita na Fase 3
  // (Puppeteer), que exige um navegador real.
  steps.push(step('Cache Fase 2 (smoke estático)', () => {
    const src = readFileSync(join(cwd, 'CRM/scripts/firebase.js'), 'utf8');
    const checks = {
      initializeFirestore: /initializeFirestore/.test(src),
      persistentLocalCache: /persistentLocalCache/.test(src),
      persistentMultipleTabManager: /persistentMultipleTabManager/.test(src),
      fallbackTryCatch: /catch[\s\S]{0,200}getFirestore\(app\)/.test(src),
      exportaDb: /export\s*\{[\s\S]*\bdb\b/.test(src),
    };
    return { ok: Object.values(checks).every(Boolean), checks };
  }));

  const finishedAt = new Date().toISOString();
  const totalMs = steps.reduce((acc, s) => acc + (Number.isFinite(s.ms) ? s.ms : 0), 0);
  return { startedAt, finishedAt, totalMs, steps };
}
