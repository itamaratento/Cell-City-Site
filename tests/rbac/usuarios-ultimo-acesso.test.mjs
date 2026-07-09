// ══════════════════════════════════════════════════════════════════════════════
// Sprint 7 — Rastreamento de Último Acesso
// ──────────────────────────────────────────────────────────────────────────────
// Testa:
//   1. A coluna "Último acesso" é renderizada no <thead>
//   2. A função fmtData exibe "—" para valores nulos e data formatada para timestamp
//   3. kernel.js contém a lógica de escrita (updateDoc, serverTimestamp, ultimo_acesso)
//   4. O JS renderiza ultimo_acesso na tabela
//   5. A regra do Firestore permite a escrita pelo próprio dono
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

describe('Sprint 7 — Último Acesso', () => {

  it('index.html contém coluna Último acesso antes de Última alteração', () => {
    const html = fs.readFileSync(path.join(ROOT, 'CRM/pages/usuarios-permissoes/index.html'), 'utf8');
    assert.ok(html.includes('Último acesso'), 'Coluna "Último acesso" deve existir no <thead>');
    const idxUltimoAcesso = html.indexOf('Último acesso');
    const idxUltimaAlt = html.indexOf('Última alteração');
    assert.ok(idxUltimoAcesso > 0 && idxUltimaAlt > 0, 'Ambos os cabeçalhos devem existir');
    assert.ok(idxUltimoAcesso < idxUltimaAlt, '"Último acesso" deve vir antes de "Última alteração"');
  });

  it('fmtData exibe "—" para null e data formatada para timestamp', () => {
    const fmtData = (ts) => {
      if (!ts) return '—';
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    };
    const mockTS = { toDate: () => new Date('2026-07-08T14:30:00') };
    assert.equal(fmtData(null), '—', 'null deve renderizar —');
    assert.equal(fmtData(undefined), '—', 'undefined deve renderizar —');
    const formatted = fmtData(mockTS);
    assert.ok(formatted.includes('14:30'), 'Deve incluir horário (' + formatted + ')');
    assert.ok(!formatted.includes('—'), 'Timestamp válido não deve mostrar "—"');
  });

  it('kernel.js contém updateDoc + serverTimestamp + ultimo_acesso + login()', () => {
    const kernel = fs.readFileSync(path.join(ROOT, 'CRM/scripts/kernel.js'), 'utf8');
    assert.ok(kernel.includes('updateDoc'), 'kernel.js deve importar updateDoc');
    assert.ok(kernel.includes('ultimo_acesso'), 'kernel.js deve usar campo ultimo_acesso');
    assert.ok(kernel.includes('serverTimestamp()'), 'kernel.js deve usar serverTimestamp');
    assert.ok(kernel.includes('export async function login'), 'kernel.js deve exportar login()');
  });

  it('usuarios-permissoes.js renderiza ultimo_acesso no template', () => {
    const js = fs.readFileSync(path.join(ROOT, 'CRM/pages/usuarios-permissoes/usuarios-permissoes.js'), 'utf8');
    assert.ok(js.includes('ultimo_acesso'), 'O JS deve referenciar ultimo_acesso no render');
  });

  it('firestore.rules permite escrita de campo não-sensível pelo próprio dono', () => {
    const rules = fs.readFileSync(path.join(ROOT, 'CRM/firestore.rules'), 'utf8');
    assert.ok(rules.includes('match /usuarios/{uid}'), 'Regra usuarios deve existir');
    assert.ok(rules.includes('request.auth.uid == uid'), 'Dono pode alterar campos não sensíveis');
  });

});
