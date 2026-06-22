#!/usr/bin/env node
// ============================================================
//  CC Backup Server — Cell City CRM
//  Ponte entre o browser e o backup.sh local.
//  Inicia: node backup-server.js
//  Porta : 9731 (localhost apenas)
// ============================================================

import { createServer } from 'http';
import { exec }         from 'child_process';
import { readdir, stat, createReadStream } from 'fs';
import { promisify }    from 'util';
import path             from 'path';

const readdirP = promisify(readdir);
const statP    = promisify(stat);

const PORT        = 9731;
const BACKUP_DIR  = '/home/cellcity/Músicas/backups';
const SCRIPT      = '/home/cellcity/Músicas/backup.sh';

const ALLOWED = [
  'https://www.cellcityinformatica.com.br',
  'http://localhost',
  'http://127.0.0.1',
];

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED.some(o => origin.startsWith(o))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function listarBackups() {
  try {
    const files = await readdirP(BACKUP_DIR);
    const zips  = files.filter(f => f.endsWith('.zip'));
    const infos = await Promise.all(zips.map(async f => {
      const s = await statP(path.join(BACKUP_DIR, f));
      return { nome: f, tamanho: s.size, data: s.mtime.toISOString() };
    }));
    return infos.sort((a, b) => new Date(b.data) - new Date(a.data));
  } catch { return []; }
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── GET /status ────────────────────────────────────────────
  if (url.pathname === '/status' && req.method === 'GET') {
    json(res, 200, { ok: true });
    return;
  }

  // ── GET /backups — lista ZIPs ──────────────────────────────
  if (url.pathname === '/backups' && req.method === 'GET') {
    const lista = await listarBackups();
    json(res, 200, { ok: true, backups: lista });
    return;
  }

  // ── GET /backups/ultimo — baixa o ZIP mais recente ─────────
  if (url.pathname === '/backups/ultimo' && req.method === 'GET') {
    const lista = await listarBackups();
    if (!lista.length) {
      json(res, 404, { ok: false, erro: 'Nenhum backup encontrado' });
      return;
    }
    const ultimo   = lista[0];
    const filePath = path.join(BACKUP_DIR, ultimo.nome);
    res.writeHead(200, {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${ultimo.nome}"`,
      'Content-Length':      ultimo.tamanho,
    });
    createReadStream(filePath).pipe(res);
    return;
  }

  // ── POST /backup — executa backup.sh ──────────────────────
  if (url.pathname === '/backup' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let versao = 'v1.0', observacao = '';
      try {
        const d = JSON.parse(body);
        versao     = (d.versao     || 'v1.0').replace(/"/g, '');
        observacao = (d.observacao || '')    .replace(/"/g, '');
      } catch {}

      const cmd = `bash "${SCRIPT}" "${versao}" "${observacao}"`;
      exec(cmd, { timeout: 120000 }, async (err, stdout, stderr) => {
        if (err) {
          json(res, 500, { ok: false, erro: stderr || err.message, saida: stdout });
          return;
        }
        const match  = stdout.match(/✅ BACKUP CONCLUÍDO: (.+\.zip)/);
        const nomeZip = match ? match[1].trim() : '';
        const lista  = await listarBackups();
        json(res, 200, {
          ok: true,
          nomeZip,
          mensagem: stdout.trim(),
          ultimoBackup: lista[0] || null,
          totalBackups: lista.length,
        });
      });
    });
    return;
  }

  // ── POST /abrir-pasta — xdg-open ──────────────────────────
  if (url.pathname === '/abrir-pasta' && req.method === 'POST') {
    exec(`xdg-open "${BACKUP_DIR}"`);
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { erro: 'Rota não encontrada' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🛡️  CC Backup Server rodando em http://localhost:${PORT}`);
  console.log(`   Script : ${SCRIPT}`);
  console.log(`   Pasta  : ${BACKUP_DIR}`);
});
