#!/usr/bin/env node
// Comando único da Sprint de Automação da Homologação (Performance).
// Uso: npm run homologar-performance
//
// Variáveis de ambiente (todas opcionais, com default seguro para o DEV local):
//   HOMOLOG_SKIP_BROWSER=1        pula a Fase 3 (útil sem Chrome/credencial disponível)
//   HOMOLOG_SA_KEY_PATH           caminho da service account do DEV (default: ./sa-key-dev.json)
//   HOMOLOG_FIREBASE_PROJECT      projeto Firebase alvo (default: cellcity-crm-dev — NUNCA produção)
//   HOMOLOG_TEST_EMAIL            conta de homologação a usar (default: cellcityadmin@gmail.com)
//   HOMOLOG_CHROME_PATH           binário do Chrome/Chromium (default: /usr/bin/google-chrome)
//   HOMOLOG_SERVE_PORT            porta do servidor estático local (default: 8899)
//
// Não altera nenhuma funcionalidade do sistema — só lê, testa e documenta.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAudit } from './lib/audit.mjs';
import { runTests } from './lib/tests-runner.mjs';
import { runBrowserHomologation } from './lib/browser.mjs';
import { buildReport } from './lib/report.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cwd = join(__dirname, '..', '..'); // raiz do repositório

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function main() {
  const startedAt = Date.now();
  const ts = timestamp();
  const evidenceDir = join(cwd, 'evidencias', ts);
  mkdirSync(evidenceDir, { recursive: true });

  console.log(`\n== Homologação de Performance — ${ts} ==`);
  console.log(`Evidências em: ${join('evidencias', ts)}\n`);

  console.log('-- Fase 1: auditoria do repositório --');
  const audit = runAudit({ cwd });
  mkdirSync(join(evidenceDir, 'logs'), { recursive: true });
  writeFileSync(join(evidenceDir, 'logs', 'audit.json'), JSON.stringify(audit, null, 2));
  console.log(`   branch=${audit.branch} commit=${audit.commitShort} arquivos modificados=${audit.modifiedFiles.length}`);
  if (audit.protectedFilesMissingBackup.length) {
    console.log(`   ⚠️  Arquivo(s) protegido(s) SEM backup: ${audit.protectedFilesMissingBackup.join(', ')}`);
  }

  console.log('\n-- Fase 2: testes automatizados --');
  const jsFiles = audit.modifiedFiles.filter(f => f.endsWith('.js'));
  const tests = runTests({ cwd, filesToCheck: jsFiles });
  writeFileSync(join(evidenceDir, 'logs', 'tests.json'), JSON.stringify(tests, null, 2));
  for (const s of tests.steps) {
    console.log(`   ${s.ok === false ? '❌' : '✅'} ${s.name} (${Math.round(s.ms || 0)}ms)`);
  }

  console.log('\n-- Fase 3: homologação em navegador real --');
  let browser;
  try {
    browser = await runBrowserHomologation({ cwd, evidenceDir });
  } catch (e) {
    browser = { skipped: false, errors: [e.stack || e.message] };
  }
  writeFileSync(join(evidenceDir, 'logs', 'browser.json'), JSON.stringify(browser, null, 2));
  if (browser.skipped) console.log(`   ⏭️  pulada: ${browser.reason}`);
  else console.log(`   login=${browser.login?.ok ? 'OK' : 'FALHOU'} dashboard=${browser.dashboard?.ok ? 'OK' : 'FALHOU'} central=${browser.centralAlertas?.ok ? 'OK' : 'FALHOU'} cache=${browser.cache?.ok ? 'OK' : 'FALHOU'} multiaba=${browser.multiTab?.ok ? 'OK' : 'FALHOU'}`);

  console.log('\n-- Fase 4/6: relatório e critérios de aprovação --');
  const knownIssues = JSON.parse(readFileSync(join(__dirname, 'known-issues.json'), 'utf8'));
  const finishedAt = Date.now();
  const report = buildReport({
    audit, tests, browser, knownIssues,
    cwd,
    meta: { evidenceDir, navegador: browser.skipped ? undefined : 'Chrome headless (puppeteer-core)', finishedAt: new Date().toISOString(), totalMs: finishedAt - startedAt },
  });
  writeFileSync(join(evidenceDir, 'relatorio.md'), report.markdown);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`RECOMENDAÇÃO FINAL: ${report.verdict}`);
  console.log(`Relatório completo: evidencias/${ts}/relatorio.md`);
  console.log('='.repeat(50));

  process.exit(report.verdict === 'REPROVADO' ? 1 : 0);
}

main().catch((e) => {
  console.error('ERRO FATAL na homologação:', e);
  process.exit(2);
});
