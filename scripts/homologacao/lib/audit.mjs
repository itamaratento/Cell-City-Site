// Fase 1 — Auditoria automática do repositório.
// Coleta estado do git (branch, commit, divergência com origin, arquivos
// modificados, arquivos protegidos e presença de backup) sem alterar nada.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';

// Mesma lista do CLAUDE.md §1 ("Arquivos protegidos — não alterar sem
// autorização explícita"). Mantida aqui como cópia curta e explícita — se o
// CLAUDE.md mudar essa lista, atualizar aqui também.
export const PROTECTED_BASENAMES = ['firebase.js', 'auth.js', 'config.js', 'global.css'];

function git(cwd, args) {
  // Só apara espaço em branco no FIM da saída (o "\n" final do processo).
  // Nunca no início: `git status --porcelain` usa colunas de largura fixa
  // (ex.: " M arquivo") e um `.trim()` geral cortava o espaço inicial só da
  // primeira linha da string inteira, deslocando o parsing por posição em
  // `runAudit()` e comendo o 1º caractere do 1º arquivo modificado/não
  // rastreado da lista (achado ao validar a correção do BL-008).
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).replace(/\s+$/, '');
}

function parseAheadBehind(cwd, branch) {
  try {
    const out = git(cwd, ['rev-list', '--left-right', '--count', `origin/${branch}...${branch}`]);
    const [behind, ahead] = out.split(/\s+/).map(Number);
    return { ahead, behind };
  } catch {
    return { ahead: null, behind: null }; // sem upstream configurado
  }
}

function findBackupFor(cwd, relPath) {
  const dir = join(cwd, dirname(relPath));
  const base = basename(relPath);
  let files = [];
  try { files = readdirSync(dir); } catch { return []; }
  return files
    .filter(f => f.startsWith(`${base}.bak-`) || f.startsWith(`${base}.bak_`))
    .sort()
    .reverse();
}

export function runAudit({ cwd = process.cwd() } = {}) {
  const branch = git(cwd, ['branch', '--show-current']);
  const commit = git(cwd, ['rev-parse', 'HEAD']);
  const commitShort = commit.slice(0, 7);
  const commitMsg = git(cwd, ['log', '-1', '--format=%s']);
  const commitDate = git(cwd, ['log', '-1', '--format=%ci']);

  const porcelain = git(cwd, ['status', '--porcelain=v1', '--untracked-files=all']);
  const lines = porcelain ? porcelain.split('\n') : [];
  const modifiedFiles = [];
  const untrackedFiles = [];
  for (const line of lines) {
    const status = line.slice(0, 2);
    const file = line.slice(3);
    if (status.trim() === '??') untrackedFiles.push(file);
    else modifiedFiles.push(file);
  }

  const protectedFilesModified = modifiedFiles.filter(f => PROTECTED_BASENAMES.includes(basename(f)));
  const protectedFilesBackup = protectedFilesModified.map(f => ({
    file: f,
    backups: findBackupFor(cwd, f),
  }));
  const protectedFilesMissingBackup = protectedFilesBackup
    .filter(x => x.backups.length === 0)
    .map(x => x.file);

  let stashCount = 0;
  try {
    const stash = git(cwd, ['stash', 'list']);
    stashCount = stash ? stash.split('\n').length : 0;
  } catch { /* sem stash */ }

  return {
    branch,
    commit,
    commitShort,
    commitMsg,
    commitDate,
    aheadBehindOrigin: parseAheadBehind(cwd, branch),
    workingTreeClean: modifiedFiles.length === 0 && untrackedFiles.length === 0,
    modifiedFiles,
    untrackedFiles,
    protectedFilesModified,
    protectedFilesBackup,
    protectedFilesMissingBackup,
    stashCount,
  };
}
