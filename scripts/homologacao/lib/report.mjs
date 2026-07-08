// Fase 4 + Fase 6 — Gera o relatório em Markdown e aplica os critérios de
// aprovação (APROVADO / APROVADO COM RESSALVAS / REPROVADO).
import { relative } from 'node:path';

function crossReferenceFailures(steps, knownIssues) {
  const known = [];
  const novas = [];
  for (const s of steps) {
    for (const name of s.failedTests || []) {
      const match = knownIssues.find(k => k.test === name);
      if (match) known.push({ suite: s.name, test: name, ...match });
      else novas.push({ suite: s.name, test: name });
    }
  }
  return { known, novas };
}

export function buildReport({ audit, tests, browser, knownIssues = [], meta = {}, cwd = process.cwd() }) {
  const { known: knownFailures, novas: newFailures } = crossReferenceFailures(tests.steps, knownIssues);

  const blockers = [];
  const warnings = [];

  if (audit.protectedFilesMissingBackup.length > 0) {
    blockers.push(`Arquivo(s) protegido(s) modificado(s) sem backup: ${audit.protectedFilesMissingBackup.join(', ')}`);
  }
  if (newFailures.length > 0) {
    blockers.push(`Falha(s) NOVA(S) não registrada(s) em known-issues.json: ${newFailures.map(f => `${f.suite} → ${f.test}`).join('; ')}`);
  }
  for (const s of tests.steps) {
    if (s.ok === false && (!s.failedTests || s.failedTests.length === 0)) {
      blockers.push(`Etapa "${s.name}" falhou sem detalhar testes individuais (${s.error || `exit ${s.exitCode}`})`);
    }
  }

  if (!audit.workingTreeClean) {
    warnings.push(`Working tree não está limpo (${audit.modifiedFiles.length} modificado(s), ${audit.untrackedFiles.length} não rastreado(s)) — normal ao homologar um diff ainda não commitado.`);
  }
  if (knownFailures.length > 0) {
    warnings.push(`Falha(s) pré-existente(s) e já registrada(s), não bloqueante(s): ${knownFailures.map(f => f.test).join(', ')}.`);
  }

  if (!browser || browser.skipped) {
    warnings.push('Fase 3 (navegador real) não executada nesta rodada (HOMOLOG_SKIP_BROWSER=1 ou não configurada) — login/Dashboard/Central de Alertas/cache/multiaba não verificados fim-a-fim.');
  } else {
    if (browser.errors?.length) blockers.push(`Erro(s) na homologação de navegador: ${browser.errors.join(' | ')}`);
    if (browser.login && browser.login.ok === false) blockers.push(`Login falhou: ${browser.login.error}`);
    if (browser.dashboard && browser.dashboard.ok === false) blockers.push('Dashboard não carregou corretamente.');
    if (browser.centralAlertas && browser.centralAlertas.ok === false) blockers.push('Central de Alertas: document.hidden/visibilitychange não respondeu como esperado.');
    if (browser.cache && browser.cache.ok === false) blockers.push(`Cache persistente/offline falhou: ${JSON.stringify(browser.cache)}`);
    if (browser.multiTab && browser.multiTab.ok === false) blockers.push('Multiaba: failed-precondition detectado (persistentMultipleTabManager não está funcionando).');
    warnings.push('Supressão do polling durante os 300s/600s de aba oculta não é medida em toda execução (janela longa demais) — coberta pelo teste isolado de padrão em tests/performance/polling-gating.test.mjs.');
  }

  const verdict = blockers.length > 0 ? 'REPROVADO' : (warnings.length > 0 ? 'APROVADO COM RESSALVAS' : 'APROVADO');

  const testsSummaryRows = tests.steps.map(s => {
    const status = s.ok === false ? '❌' : (s.ok === true ? '✅' : '⚠️');
    const detalhe = s.pass !== undefined ? `${s.pass} pass / ${s.fail} fail` : (s.files ? `${s.files.length} arquivo(s)` : '—');
    const ms = Number.isFinite(s.ms) ? `${Math.round(s.ms)}ms` : '—';
    return `| ${s.name} | ${status} | ${detalhe} | ${ms} |`;
  }).join('\n');

  const screenshotLinks = (browser?.screenshots || [])
    .map(p => `- [${relative(cwd, p)}](${relative(meta.evidenceDir || cwd, p)})`)
    .join('\n') || '_nenhuma (Fase 3 não executada)_';

  const md = `# Relatório de Homologação — Performance

**Data:** ${meta.finishedAt || new Date().toISOString()}
**Branch:** \`${audit.branch}\`
**Commit:** \`${audit.commitShort}\` — ${audit.commitMsg}
**Ambiente:** ${browser?.firebaseProject || 'não executado'} (via \`${browser?.baseUrl || '—'}\`)
**Navegador:** ${meta.navegador || (browser?.skipped ? '— (fase pulada)' : 'Chrome headless (puppeteer-core)')}
**Tempo total:** ${(meta.totalMs / 1000).toFixed(1)}s (testes: ${(tests.totalMs / 1000).toFixed(1)}s)

## Auditoria (Fase 1)

- Divergência com origin: ${audit.aheadBehindOrigin.ahead ?? '?'} à frente / ${audit.aheadBehindOrigin.behind ?? '?'} atrás
- Arquivos modificados: ${audit.modifiedFiles.length} — ${audit.modifiedFiles.join(', ') || '_nenhum_'}
- Arquivos não rastreados: ${audit.untrackedFiles.length}
- Arquivos protegidos alterados: ${audit.protectedFilesModified.join(', ') || '_nenhum_'}
- Backup de arquivo(s) protegido(s) ausente: ${audit.protectedFilesMissingBackup.join(', ') || '_nenhum — OK_'}
- Stashes pendentes: ${audit.stashCount}

## Testes automatizados (Fase 2)

| Etapa | Status | Resultado | Tempo |
|---|---|---|---|
${testsSummaryRows}

${newFailures.length ? `**Falhas novas (bloqueiam aprovação):**\n${newFailures.map(f => `- ${f.suite} → ${f.test}`).join('\n')}` : ''}
${knownFailures.length ? `**Falhas pré-existentes (não bloqueiam):**\n${knownFailures.map(f => `- ${f.test} — ${f.reason} (desde ${f.since})`).join('\n')}` : ''}

## Homologação em navegador (Fase 3)

${(!browser || browser.skipped) ? '_Não executada nesta rodada._' : `
- Login: ${browser.login?.ok ? `✅ ${browser.login.email} (perfil ${browser.login.perfil})` : `❌ ${browser.login?.error}`}
- Dashboard: ${browser.dashboard?.ok ? `✅ carregado em ${Math.round(browser.dashboard.loadMs)}ms, ${browser.dashboard.firestoreRequests} requisição(ões) Firestore em 4s, ${browser.dashboard.consoleErrors} erro(s) de console` : '❌'}
- Central de Alertas: ${browser.centralAlertas?.ok ? '✅ document.hidden/visibilitychange OK' : '❌'}
- Cache/offline: ${browser.cache?.ok ? `✅ leitura online (${browser.cache.onlineRead.source}), offline (${browser.cache.offlineRead.source}), reconexão (${browser.cache.reconnectRead.source})` : `❌ ${JSON.stringify(browser.cache)}`}
- Multiaba: ${browser.multiTab?.ok ? '✅ sem failed-precondition' : '❌ failed-precondition detectado'}
`}

### Evidências (screenshots)

${screenshotLinks}

## Riscos e pendências

${[...blockers.map(b => `- 🔴 ${b}`), ...warnings.map(w => `- 🟡 ${w}`)].join('\n') || '_nenhum_'}

## Recomendação final

## **${verdict}**
`;

  return { verdict, markdown: md, blockers, warnings, knownFailures, newFailures };
}
