#!/usr/bin/env node
/**
 * Cell City — Roteador Oficial da Hierarquia de Programação (Antigravity AI Hub)
 *
 * Cérebro Estratégico: Claude Opus 5.5 (High) — coordena, planeja, distribui e revisa.
 * Hierarquia Obrigatória de Programação:
 *   1. Cursor (programador principal — Cursor CLI `agent` ou Cursor IDE Task Pack)
 *   2. DP/DeepSeek (segundo programador — DeepSeek API ou Handoff Pack)
 *   3. Gemini/Antigravity (terceiro recurso — executor auxiliar Gemini 4 Hydrogen)
 *   4. Claude Opus (último recurso — exige `--allow-opus-fallback` + justificativa)
 *
 * Segurança:
 *   - Nunca imprime tokens, API keys ou segredos em stdout/stderr/arquivos.
 *   - Bloqueia alteração em arquivos protegidos da Cell City sem flag explícita.
 *   - Nunca realiza push em `main` nem deploy em produção.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PROTECTED_FILES = [
  'firebase.js',
  'auth.js',
  'config.js',
  'global.css',
  'firestore.rules',
  'storage.rules',
];

export const HIERARCHY = [
  { tier: 1, id: 'cursor', name: 'Cursor', role: 'Programador Principal' },
  { tier: 2, id: 'deepseek', name: 'DP/DeepSeek', role: 'Segundo Programador' },
  { tier: 3, id: 'gemini', name: 'Gemini/Antigravity', role: 'Terceiro Recurso (Executor Auxiliar)' },
  { tier: 4, id: 'claude-opus', name: 'Claude Opus 5.5', role: 'Último Recurso para Programação (Cérebro Estratégico / Revisor)' },
];

function findBinary(names) {
  const extraDirs = [
    path.join(os.homedir(), '.local', 'bin'),
    '/opt/antigravity/bin',
    '/opt/nvm/current/bin',
    '/usr/local/bin',
    '/usr/bin',
  ];
  const envPaths = (process.env.PATH || '').split(path.delimiter);
  const allDirs = [...new Set([...extraDirs, ...envPaths])];

  for (const name of names) {
    for (const dir of allDirs) {
      if (!dir) continue;
      const full = path.join(dir, name);
      try {
        fs.accessSync(full, fs.constants.X_OK);
        return full;
      } catch {
        // continue
      }
    }
  }
  return null;
}

function safeExec(bin, args, timeoutMs = 10000) {
  const res = spawnSync(bin, args, {
    encoding: 'utf8',
    timeout: timeoutMs,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const combined = ((res.stdout || '') + '\n' + (res.stderr || '')).trim();
  return {
    ok: res.status === 0 && !res.error,
    output: combined,
    code: res.status ?? 1,
  };
}

function loadEnvFileIfPresent(repoDir) {
  const candidates = [
    path.join(os.homedir(), '.gemini', 'config', 'cellcity.env'),
    path.join(os.homedir(), 'cell-city-intelligence', '.env'),
    repoDir ? path.join(repoDir, '.env.ai-hub') : null,
  ].filter(Boolean);

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key] && val && !val.startsWith('COLE_SUA_')) {
        process.env[key] = val;
      }
    }
  }
}

export function checkProtectedFiles(files = []) {
  const hits = [];
  for (const file of files) {
    const normalized = String(file).replace(/\\/g, '/').replace(/^\.\//, '');
    const base = path.posix.basename(normalized);
    if (
      PROTECTED_FILES.includes(base) ||
      normalized === 'functions' ||
      normalized.startsWith('functions/') ||
      normalized.includes('/functions/')
    ) {
      hits.push(file);
    }
  }
  return hits;
}

function appendAuditLog(entry) {
  try {
    const logDir = process.env.CELLCITY_AUDIT_DIR || path.join(os.homedir(), 'cell-city-intelligence', 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, 'dispatch-audit.jsonl');
    const safeEntry = {
      timestamp: new Date().toISOString(),
      requested_tier: entry.requested_tier,
      chosen_tier: entry.chosen_tier,
      status: entry.status,
      executed: Boolean(entry.executed),
      allow_fallback: Boolean(entry.allow_fallback),
      routing_trace: entry.routing_trace || [],
      protected_files: entry.protected_files || [],
      handoff_file: entry.handoff_file || null,
      response_file: entry.response_file || null,
    };
    fs.appendFileSync(logFile, JSON.stringify(safeEntry) + '\n', { encoding: 'utf8', mode: 0o600 });
  } catch {
    // audit log failure must not crash dispatch
  }
}

export function getHierarchyStatus(repoDir = process.cwd()) {
  loadEnvFileIfPresent(repoDir);

  let cursorBin = null;
  if (process.env.CELLCITY_CURSOR_BIN) {
    try {
      fs.accessSync(process.env.CELLCITY_CURSOR_BIN, fs.constants.X_OK);
      cursorBin = process.env.CELLCITY_CURSOR_BIN;
    } catch {
      cursorBin = null;
    }
  } else {
    cursorBin = findBinary(['agent', 'cursor-agent']);
  }
  let cursorVersion = null;
  let cursorAuthed = false;
  if (cursorBin) {
    const v = safeExec(cursorBin, ['--version']);
    cursorVersion = v.ok ? v.output.split('\n')[0] : null;
    if (process.env.CURSOR_API_KEY) {
      cursorAuthed = true;
    } else {
      const st = safeExec(cursorBin, ['status'], 3000);
      cursorAuthed = st.ok && !/not logged in|unauthenticated|login/i.test(st.output);
    }
  }

  const deepseekKeySet = Boolean(process.env.DEEPSEEK_API_KEY);
  const deepseekModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  const deepseekBaseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

  const ghBin = findBinary(['gh']);
  const ghAuthed = ghBin ? safeExec(ghBin, ['auth', 'status'], 10000).ok : false;

  const gdriveBin = findBinary(['gdrive']);
  const gdriveAuthed = gdriveBin
    ? /logged in/i.test(safeExec(gdriveBin, ['auth', 'status'], 10000).output)
    : false;

  const gdocsBin = findBinary(['gdocs']);
  const gdocsAuthed = gdocsBin
    ? /logged in/i.test(safeExec(gdocsBin, ['auth', 'status'], 10000).output)
    : false;

  const gslidesBin = findBinary(['gslides']);
  const gslidesAuthed = gslidesBin
    ? /logged in/i.test(safeExec(gslidesBin, ['auth', 'status'], 10000).output)
    : false;

  const firebaseBin = findBinary(['firebase']);
  const firebaseVersion = firebaseBin ? safeExec(firebaseBin, ['--version'], 10000).output : null;
  let firebaseProjects = null;
  const rcPath = path.join(repoDir, '.firebaserc');
  if (fs.existsSync(rcPath)) {
    try {
      firebaseProjects = JSON.parse(fs.readFileSync(rcPath, 'utf8')).projects || null;
    } catch {
      firebaseProjects = null;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    strategist: {
      model: 'Claude Opus 5.5 (High)',
      auxiliary_executor: 'Gemini 4 Hydrogen',
      role: 'Orquestração, planejamento, distribuição, supervisão e revisão técnica',
    },
    programming_hierarchy: [
      {
        tier: 1,
        id: 'cursor',
        name: 'Cursor',
        role: 'Programador Principal',
        cli_installed: Boolean(cursorBin),
        cli_path: cursorBin,
        cli_version: cursorVersion,
        authenticated: cursorAuthed,
        mode: cursorAuthed ? 'cli-headless-ready' : 'handoff-task-pack (aguardando CURSOR_API_KEY ou agent login)',
      },
      {
        tier: 2,
        id: 'deepseek',
        name: 'DP/DeepSeek',
        role: 'Segundo Programador',
        api_endpoint: `${deepseekBaseUrl}/chat/completions`,
        model: deepseekModel,
        authenticated: deepseekKeySet,
        mode: deepseekKeySet ? 'api-ready' : 'handoff-task-pack (aguardando DEEPSEEK_API_KEY)',
      },
      {
        tier: 3,
        id: 'gemini',
        name: 'Gemini/Antigravity',
        role: 'Terceiro Recurso (Executor Auxiliar)',
        authenticated: true,
        mode: 'native-antigravity-ready (Gemini 4 Hydrogen)',
      },
      {
        tier: 4,
        id: 'claude-opus',
        name: 'Claude Opus 5.5',
        role: 'Último Recurso para Programação',
        authenticated: true,
        mode: 'locked-last-resort (requer falha dos níveis 1-3 + justificativa + revisão independente)',
      },
    ],
    integrations: {
      github: { installed: Boolean(ghBin), authenticated: ghAuthed },
      google_drive: { installed: Boolean(gdriveBin), authenticated: gdriveAuthed },
      google_docs: { installed: Boolean(gdocsBin), authenticated: gdocsAuthed },
      google_slides: { installed: Boolean(gslidesBin), authenticated: gslidesAuthed },
      firebase_cli: {
        installed: Boolean(firebaseBin),
        version: firebaseVersion,
        projects: firebaseProjects,
        mcp_command: 'npx -y firebase-tools@latest mcp',
      },
    },
  };
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'tarefa';
}

export function buildSprintBrief({ task, tier, files = [], reason = '', branch = '' }) {
  const slug = slugify(task);
  const targetBranch = branch || `${tier === 'cursor' ? 'cursor' : tier === 'deepseek' ? 'deepseek' : 'feat'}/${slug}`;
  const protectedHits = checkProtectedFiles(files);

  return `# Sprint Brief — Cell City Intelligence Hub

- **Data:** ${new Date().toISOString()}
- **Coordenador Estratégico:** Claude Opus 5.5 (High)
- **Programador Designado:** ${tier.toUpperCase()}
- **Branch Obrigatória:** \`${targetBranch}\` (a partir de \`develop\` — NUNCA \`main\`)
${reason ? `- **Justificativa de Escalonamento:** ${reason}\n` : ''}
## 1. Objetivo / Problema
${task}

## 2. Arquivos-Alvo Permitidos
${files.length ? files.map((f) => `- \`${f}\``).join('\n') : '- (A definir pelo programador após leitura mínima — máximo 1 módulo por vez)'}

${protectedHits.length ? `> [!WARNING]\n> Arquivos críticos/protegidos detectados: ${protectedHits.map((f) => `\`${f}\``).join(', ')}. EXIGE autorização explícita e backup prévio!\n` : ''}
## 3. Regras Invioláveis (ENGINEERING.md + CLAUDE.md)
- Trabalhar de forma isolada (máximo 1 módulo por vez).
- Nunca alterar \`firebase.js\`, \`auth.js\`, \`config.js\`, \`global.css\`, \`CRM/firestore.rules\`, \`storage.rules\` ou \`functions/*\` sem autorização explícita.
- Eficiência Firebase: proibido loops de leitura Firestore, queries sem \`limit()\`, \`onSnapshot\` sem unsubscribe, polling desnecessário e uploads duplicados.
- Nunca expor credenciais, tokens ou chaves.
- Nunca fazer push em \`main\` nem deploy em produção.

## 4. Verificação Obrigatória Antes de Entregar
\`\`\`bash
npm run auditar-arquitetura
npm run validar-infra-app-config
npm run testar-central-modulos
\`\`\`

## 5. Formato de Entrega para Revisão Técnica (Claude Opus 5.5)
Retornar:
1. Problema e causa raiz
2. Arquivos alterados e motivo
3. Testes executados e resultados
4. Riscos identificados e pendências
`;
}

export async function dispatchTask(options) {
  const {
    task,
    tier = 'auto',
    files = [],
    model = '',
    repo = process.cwd(),
    apply = false,
    dryRun = false,
    allowProtected = false,
    allowFallback = false,
    allowOpusFallback = false,
    reason = '',
  } = options;

  if (!task || !task.trim()) {
    throw new Error('O parâmetro --task é obrigatório.');
  }

  loadEnvFileIfPresent(repo);

  const finalize = (result, chosenTier = tier, trace = []) => {
    const payload = { ...result, routing_trace: trace };
    appendAuditLog({
      requested_tier: tier,
      chosen_tier: chosenTier,
      status: payload.status,
      executed: payload.executed,
      allow_fallback: allowFallback,
      routing_trace: trace,
      protected_files: payload.protected_files,
      handoff_file: payload.handoff_file,
      response_file: payload.response_file,
    });
    return payload;
  };

  const protectedHits = checkProtectedFiles(files);
  if (protectedHits.length > 0 && !allowProtected) {
    return finalize({
      status: 'blocked_protected_files',
      executed: false,
      message: `Bloqueado por segurança: arquivos protegidos detectados (${protectedHits.join(', ')}). Requer autorização explícita (--allow-protected) e backup prévio.`,
      protected_files: protectedHits,
    }, tier, ['blocked:protected_files']);
  }

  const allowedTiers = new Set(['auto', 'cursor', 'deepseek', 'gemini', 'claude-opus']);
  if (!allowedTiers.has(tier)) {
    return finalize({
      status: 'blocked_invalid_tier',
      executed: false,
      message: `Tier inválido: "${tier}". Valores aceitos: auto, cursor, deepseek, gemini, claude-opus.`,
    }, tier, [`blocked:invalid_tier(${tier})`]);
  }

  if (tier === 'claude-opus' && (!allowOpusFallback || !reason.trim())) {
    return finalize({
      status: 'blocked_hierarchy_violation',
      executed: false,
      message: 'Violação de hierarquia: Claude Opus é o ÚLTIMO RECURSO (Nível 4) para programação. Use Cursor (1), DeepSeek (2) ou Gemini (3). Para emergência real, informe --allow-opus-fallback e --reason "<justificativa>".',
    }, 'claude-opus', ['blocked:claude-opus_requires_fallback_and_reason']);
  }

  const status = getHierarchyStatus(repo);
  const t1 = status.programming_hierarchy[0];
  const t2 = status.programming_hierarchy[1];
  const routingTrace = [];

  const handoffDir = fs.existsSync(path.join(repo, '.agents'))
    ? path.join(repo, '.agents', 'handoffs')
    : path.join(os.homedir(), 'cell-city-intelligence', 'handoffs');
  fs.mkdirSync(handoffDir, { recursive: true });

  const writeHandoff = (targetTier, extraReason = reason) => {
    const brief = buildSprintBrief({ task, tier: targetTier, files, reason: extraReason });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const handoffFile = path.join(handoffDir, `${ts}-${targetTier}-${slugify(task)}.md`);
    fs.writeFileSync(handoffFile, brief, 'utf8');
    return { brief, handoffFile };
  };

  const runCursor = (brief, handoffFile) => {
    const args = ['-p', '--output-format', 'json'];
    if (apply) args.push('--force');
    if (model) args.push('--model', model);
    args.push(brief);

    // Isolamento estrito de credenciais: remove segredos de outros provedores antes de invocar Cursor CLI
    const cursorEnv = { ...process.env };
    for (const secretKey of [
      'DEEPSEEK_API_KEY',
      'ANTHROPIC_API_KEY',
      'OPENAI_API_KEY',
      'GEMINI_API_KEY',
      'GOOGLE_API_KEY',
      'FIREBASE_TOKEN',
    ]) {
      delete cursorEnv[secretKey];
    }

    const res = spawnSync(t1.cli_path, args, {
      cwd: repo,
      encoding: 'utf8',
      timeout: 180000,
      env: cursorEnv,
    });

    return {
      ok: res.status === 0 && !res.error,
      exit_code: res.status ?? 1,
      handoff_file: handoffFile,
      stdout: (res.stdout || '').slice(0, 8000),
      stderr: (res.stderr || '').slice(0, 2000),
    };
  };

  const runDeepSeek = async (brief, handoffFile) => {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const endpoint = `${(process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/$/, '')}/chat/completions`;
    const dsModel = model || process.env.DEEPSEEK_MODEL || 'deepseek-chat';

    let fileContext = '';
    for (const f of files.slice(0, 6)) {
      const abs = path.isAbsolute(f) ? f : path.join(repo, f);
      if (fs.existsSync(abs) && fs.statSync(abs).size < 40000) {
        fileContext += `\n### Arquivo: ${f}\n\`\`\`\n${fs.readFileSync(abs, 'utf8')}\n\`\`\`\n`;
      }
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: dsModel,
          messages: [
            {
              role: 'system',
              content: 'Você é o Segundo Programador (DP/DeepSeek) da Cell City sob coordenação estratégica do Claude Opus 5.5. Produza código cirúrgico, seguro, eficiente para Firebase e estritamente aderente ao ENGINEERING.md e CLAUDE.md.',
            },
            {
              role: 'user',
              content: `${brief}\n${fileContext}`,
            },
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return {
          ok: false,
          http_status: response.status,
          handoff_file: handoffFile,
          error: errText.slice(0, 1000),
        };
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || '';
      const outFile = handoffFile.replace(/\.md$/, '-response.md');
      fs.writeFileSync(outFile, content, 'utf8');

      return {
        ok: true,
        model: dsModel,
        usage: data.usage || null,
        handoff_file: handoffFile,
        response_file: outFile,
        preview: content.slice(0, 1500),
      };
    } catch (err) {
      return {
        ok: false,
        http_status: 0,
        handoff_file: handoffFile,
        error: err.message,
      };
    }
  };

  // Resolução de ordem de tentativa respeitando 1. Cursor -> 2. DeepSeek -> 3. Gemini (nunca auto-Opus)
  let candidateOrder;
  if (tier === 'auto') {
    candidateOrder = allowFallback ? ['cursor', 'deepseek', 'gemini'] : ['cursor', 'deepseek'];
  } else if (allowFallback && tier === 'cursor') {
    candidateOrder = ['cursor', 'deepseek', 'gemini'];
  } else if (allowFallback && tier === 'deepseek') {
    candidateOrder = ['deepseek', 'gemini'];
  } else {
    candidateOrder = [tier];
  }

  if (dryRun) {
    let previewTier = candidateOrder[0];
    if (tier === 'auto') {
      if (t1.cli_installed && t1.authenticated) {
        previewTier = 'cursor';
        routingTrace.push('tier1:cursor:authenticated');
      } else if (t2.authenticated) {
        previewTier = 'deepseek';
        routingTrace.push('tier1:cursor:unauthenticated', 'tier2:deepseek:authenticated');
      } else if (allowFallback) {
        previewTier = 'gemini';
        routingTrace.push('tier1:cursor:unauthenticated', 'tier2:deepseek:unauthenticated', 'tier3:gemini:fallback_allowed');
      } else {
        previewTier = 'cursor';
        routingTrace.push('tier1:cursor:handoff_priority_preserved');
      }
    } else {
      routingTrace.push(`explicit:${previewTier}:dry_run`);
    }
    const { handoffFile } = writeHandoff(previewTier);
    return finalize({
      status: 'dry_run_ok',
      tier: previewTier,
      handoff_file: handoffFile,
      executed: false,
      note: 'Dry-run concluído. Handoff Brief gerado sem invocar APIs externas.',
    }, previewTier, routingTrace);
  }

  let lastError = null;
  for (const current of candidateOrder) {
    if (current === 'cursor') {
      if (t1.cli_installed && t1.authenticated) {
        const { brief, handoffFile } = writeHandoff('cursor');
        const res = runCursor(brief, handoffFile);
        if (res.ok) {
          routingTrace.push('tier1:cursor:executed_ok');
          return finalize({
            status: 'executed_cursor_cli',
            tier: 'cursor',
            executed: true,
            exit_code: res.exit_code,
            handoff_file: res.handoff_file,
            stdout: res.stdout,
            stderr: res.stderr,
          }, 'cursor', routingTrace);
        }
        routingTrace.push(`tier1:cursor:failed(exit=${res.exit_code})`);
        lastError = {
          status: 'cursor_cli_error',
          tier: 'cursor',
          executed: false,
          exit_code: res.exit_code,
          handoff_file: res.handoff_file,
          stdout: res.stdout,
          stderr: res.stderr,
        };
        if (allowFallback) continue;
        return finalize(lastError, 'cursor', routingTrace);
      }

      routingTrace.push(t1.cli_installed ? 'tier1:cursor:unauthenticated' : 'tier1:cursor:not_installed');
      if (tier === 'auto' || allowFallback) {
        continue;
      }
      const { handoffFile } = writeHandoff('cursor');
      return finalize({
        status: 'handoff_generated',
        tier: 'cursor',
        executed: false,
        handoff_file: handoffFile,
        next_action: t1.cli_installed
          ? 'Cursor CLI instalado, porém sem autenticação ativa. Configure CURSOR_API_KEY ou rode `agent login`, ou cole o arquivo de handoff diretamente no Cursor IDE.'
          : 'Cursor CLI não instalado neste host. Instale com `curl https://cursor.com/install -fsS | bash` ou cole o arquivo de handoff diretamente no Cursor IDE.',
      }, 'cursor', routingTrace);
    }

    if (current === 'deepseek') {
      if (t2.authenticated) {
        const fallbackNote = routingTrace.length ? `Fallback automático após: ${routingTrace.join(' -> ')}` : reason;
        const { brief, handoffFile } = writeHandoff('deepseek', fallbackNote);
        const res = await runDeepSeek(brief, handoffFile);
        if (res.ok) {
          routingTrace.push('tier2:deepseek:executed_ok');
          return finalize({
            status: 'executed_deepseek_api',
            tier: 'deepseek',
            executed: true,
            model: res.model,
            usage: res.usage,
            handoff_file: res.handoff_file,
            response_file: res.response_file,
            preview: res.preview,
          }, 'deepseek', routingTrace);
        }
        routingTrace.push(`tier2:deepseek:failed(http=${res.http_status})`);
        lastError = {
          status: 'deepseek_api_error',
          tier: 'deepseek',
          executed: false,
          http_status: res.http_status,
          handoff_file: res.handoff_file,
          error: res.error,
        };
        if (allowFallback) continue;
        return finalize(lastError, 'deepseek', routingTrace);
      }

      routingTrace.push('tier2:deepseek:unauthenticated');
      if (allowFallback) continue;
      if (tier === 'auto') {
        // Sem autenticação em Cursor nem DeepSeek e sem --allow-fallback: preserva prioridade Nível 1 gerando Handoff Pack para Cursor
        routingTrace.push('fallback_disabled:generating_tier1_cursor_handoff');
        const { handoffFile } = writeHandoff('cursor');
        return finalize({
          status: 'handoff_generated',
          tier: 'cursor',
          executed: false,
          handoff_file: handoffFile,
          next_action: 'Cursor CLI e DeepSeek sem chave ativa. Handoff Pack gerado para o Programador Principal (Cursor). Use --allow-fallback para escalar ao Nível 3 (Gemini/Antigravity) ou configure ~/.gemini/config/cellcity.env.',
        }, 'cursor', routingTrace);
      }
      const { handoffFile } = writeHandoff('deepseek');
      return finalize({
        status: 'handoff_generated',
        tier: 'deepseek',
        executed: false,
        handoff_file: handoffFile,
        next_action: 'DEEPSEEK_API_KEY não configurada. Defina DEEPSEEK_API_KEY em ~/.gemini/config/cellcity.env para execução automática via API, ou use o arquivo de handoff gerado.',
      }, 'deepseek', routingTrace);
    }

    if (current === 'gemini') {
      const fallbackNote = routingTrace.length ? `Fallback autorizado após: ${routingTrace.join(' -> ')}` : reason;
      routingTrace.push('tier3:gemini:handoff_ready');
      const { handoffFile } = writeHandoff('gemini', fallbackNote);
      return finalize({
        status: 'handoff_generated',
        tier: 'gemini',
        executed: false,
        handoff_file: handoffFile,
        next_action: 'Executar no Antigravity usando executor auxiliar Gemini 4 Hydrogen (`cellcity-executor-gemini`) e submeter diff à Revisão Técnica do Claude Opus 5.5 (`cellcity-revisor-tecnico`).',
      }, 'gemini', routingTrace);
    }

    if (current === 'claude-opus') {
      routingTrace.push('tier4:claude-opus:emergency_override_authorized');
      const { handoffFile } = writeHandoff('claude-opus', reason);
      return finalize({
        status: 'handoff_generated',
        tier: 'claude-opus',
        executed: false,
        requires_human_review_before_main: true,
        handoff_file: handoffFile,
        next_action: 'EMERGÊNCIA NÍVEL 4 (Claude Opus): após implementação, aprovação humana obrigatória antes de qualquer promoção para main.',
      }, 'claude-opus', routingTrace);
    }
  }

  return finalize(
    lastError || {
      status: 'handoff_generated',
      tier: 'cursor',
      executed: false,
      next_action: 'Nenhum programador autenticado; revisar configuração de credenciais.',
    },
    lastError?.tier || 'cursor',
    routingTrace,
  );
}

function parseCliArgs(argv) {
  const cmd = argv[0] || 'status';
  const opts = { files: [] };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--apply') opts.apply = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--allow-protected') opts.allowProtected = true;
    else if (a === '--allow-fallback') opts.allowFallback = true;
    else if (a === '--allow-opus-fallback') opts.allowOpusFallback = true;
    else if (a === '--task') opts.task = argv[++i];
    else if (a === '--tier') opts.tier = argv[++i];
    else if (a === '--model') opts.model = argv[++i];
    else if (a === '--repo') opts.repo = argv[++i];
    else if (a === '--reason') opts.reason = argv[++i];
    else if (a === '--files') {
      opts.files = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return { cmd, opts };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { cmd, opts } = parseCliArgs(process.argv.slice(2));
  const repoDir = opts.repo || (fs.existsSync('/home/antigravity/Cell-City-Site') ? '/home/antigravity/Cell-City-Site' : process.cwd());

  if (cmd === 'status') {
    const st = getHierarchyStatus(repoDir);
    if (opts.json) {
      console.log(JSON.stringify(st, null, 2));
    } else {
      console.log('=== CELL CITY — CENTRO ESTRATÉGICO DE INTELIGÊNCIA ===');
      console.log(`Estrategista: ${st.strategist.model} | Executor Auxiliar: ${st.strategist.auxiliary_executor}`);
      console.log('\n[Hierarquia Obrigatória de Programação]');
      for (const h of st.programming_hierarchy) {
        const flag = h.authenticated ? '✅ PRONTO' : '⏳ PENDENTE AUTH';
        console.log(`  ${h.tier}. ${h.name.padEnd(20)} (${h.role}) — ${flag} | ${h.mode}`);
      }
      console.log('\n[Integrações]');
      console.log(`  GitHub (gh):        ${st.integrations.github.authenticated ? '✅ Conectado' : '❌ Desconectado'}`);
      console.log(`  Google Drive:       ${st.integrations.google_drive.authenticated ? '✅ Conectado' : '❌ Desconectado'}`);
      console.log(`  Google Docs:        ${st.integrations.google_docs.authenticated ? '✅ Conectado' : '❌ Desconectado'}`);
      console.log(`  Google Slides:      ${st.integrations.google_slides.authenticated ? '✅ Conectado' : '❌ Desconectado'}`);
      console.log(`  Firebase CLI:       ${st.integrations.firebase_cli.installed ? `✅ v${st.integrations.firebase_cli.version}` : '❌ Não instalado'}`);
      if (st.integrations.firebase_cli.projects) {
        console.log(`  Firebase Projetos:  ${JSON.stringify(st.integrations.firebase_cli.projects)}`);
      }
    }
  } else if (cmd === 'dispatch') {
    const result = await dispatchTask({ ...opts, repo: repoDir });
    console.log(JSON.stringify(result, null, 2));
    if (result.status.startsWith('blocked_') || result.status.endsWith('_error')) {
      process.exitCode = 1;
    }
  } else if (cmd === 'sprint-brief') {
    console.log(buildSprintBrief({
      task: opts.task || 'Definir objetivo da Sprint',
      tier: opts.tier || 'cursor',
      files: opts.files,
      reason: opts.reason || '',
    }));
  } else {
    console.error('Uso: hierarchy-router.mjs <status|dispatch|sprint-brief> [opções]');
    process.exitCode = 2;
  }
}
