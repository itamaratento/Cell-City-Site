/**
 * MIGRAÇÃO — padronização de telefone (clientes, os, mensagens_portal,
 * avaliacoes, agendamentos)
 *
 * Corrige o bug de raiz: cada tela tinha sua própria função de máscara de
 * telefone, e a de os.js montava sempre "(XX) XXXXX-XXXX" mesmo quando o
 * número tinha só 10 dígitos — gerando máscaras quebradas (ex: OS-0095,
 * "(61) 91071-912") que o Portal do Cliente nunca conseguia casar.
 *
 * A partir de agora shared/phone-utils.js é a única fonte de verdade:
 *   - `phoneDigits`/`telefoneDigits` (só dígitos) = campo canônico, usado
 *     em TODAS as consultas/joins/doc-IDs.
 *   - `phone`/`telefone` (com máscara) = só para EXIBIÇÃO.
 *
 * Esta migração:
 *   1. Faz backup local de `clientes` e `os` antes de qualquer escrita.
 *   2. Agrupa `clientes` por telefone canônico e detecta duplicados criados
 *      só por divergência de máscara (ex: "(61) 91071-912" vs "6191071912"
 *      vs doc já correto "61991071912") — mescla preservando todos os
 *      dados e o histórico de O.S., usando o telefone canônico como doc-ID.
 *   3. Corrige `phone`/`phoneDigits` em todos os documentos de `os`.
 *   4. Faz backfill de `telefoneDigits` em mensagens_portal/avaliacoes/agendamentos.
 *
 * Uso:
 *   cd CRM/scripts
 *   node migrate-phone-canonico.cjs              -> dry-run (não grava nada)
 *   node migrate-phone-canonico.cjs --apply       -> aplica as mudanças
 */

const path = require('path');
const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const APPLY = process.argv.includes('--apply');
const ROOT = path.resolve(__dirname, '..', '..'); // Cell-City-Site/
const serviceAccount = require(path.join(ROOT, 'sa-key.json'));

initializeApp({ credential: cert(serviceAccount), projectId: 'cellcity-crm' });
const db = getFirestore();

const BATCH_SIZE = 400;

async function commitInBatches(ops) {
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = db.batch();
    ops.slice(i, i + BATCH_SIZE).forEach(op => op(batch));
    await batch.commit();
  }
}

async function main() {
  const phoneUtilsUrl = 'file://' + path.join(__dirname, '..', 'shared', 'phone-utils.js');
  const { normalizePhoneDigits, maskPhone } = await import(phoneUtilsUrl);

  console.log(APPLY ? '=== MODO APLICAR (vai gravar no Firestore) ===' : '=== MODO DRY-RUN (nenhuma escrita será feita) ===');

  // ── 1. BACKUP ──────────────────────────────────────────────
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(ROOT, '_BACKUPS', `PHONE_MIGRATION_${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const [clientesSnap, osSnap, mensagensSnap, avaliacoesSnap, agendamentosSnap] = await Promise.all([
    db.collection('clientes').get(),
    db.collection('os').get(),
    db.collection('mensagens_portal').get(),
    db.collection('avaliacoes').get(),
    db.collection('agendamentos').get(),
  ]);
  const dump = (name, snap) => fs.writeFileSync(
    path.join(backupDir, `${name}.json`),
    JSON.stringify(snap.docs.map(d => ({ id: d.id, data: d.data() })), null, 2)
  );
  dump('clientes', clientesSnap);
  dump('os', osSnap);
  dump('mensagens_portal', mensagensSnap);
  dump('avaliacoes', avaliacoesSnap);
  dump('agendamentos', agendamentosSnap);
  console.log(`Backup salvo em ${backupDir}`);
  console.log(`  clientes=${clientesSnap.size} os=${osSnap.size} mensagens_portal=${mensagensSnap.size} avaliacoes=${avaliacoesSnap.size} agendamentos=${agendamentosSnap.size}`);

  // ── 2. CLIENTES: agrupar por telefone canônico ────────────
  const clusters = new Map(); // digits -> [{id, data}]
  const invalid = [];
  clientesSnap.docs.forEach(d => {
    const data = d.data();
    const source = data.phone || d.id;
    const digits = normalizePhoneDigits(source);
    if (digits.length < 10) { invalid.push({ id: d.id, phone: data.phone }); return; }
    if (!clusters.has(digits)) clusters.set(digits, []);
    clusters.get(digits).push({ id: d.id, data });
  });

  const clientPlan = [];
  for (const [digits, docs] of clusters) {
    const canonicalPhone = maskPhone(digits);
    const jaCorreto = docs.length === 1
      && docs[0].id === digits
      && docs[0].data.phoneDigits === digits
      && docs[0].data.phone === canonicalPhone;
    if (jaCorreto) continue;

    // Base = doc mais antigo (createdAt). Demais entram como "doadores" de campos vazios.
    const sorted = [...docs].sort((a, b) => new Date(a.data.createdAt || '9999') - new Date(b.data.createdAt || '9999'));
    const merged = { ...sorted[0].data };
    const history = new Set(merged.history || []);
    const crmLeads = new Set(merged.crmLeads || []);
    for (const { data } of sorted.slice(1)) {
      (data.history || []).forEach(h => history.add(h));
      (data.crmLeads || []).forEach(l => crmLeads.add(l));
      for (const [k, v] of Object.entries(data)) {
        const vazio = merged[k] === undefined || merged[k] === null || merged[k] === '';
        if (vazio && v !== undefined && v !== null && v !== '') merged[k] = v;
      }
    }
    merged.phone = canonicalPhone;
    merged.phoneDigits = digits;
    if (history.size) merged.history = [...history];
    if (crmLeads.size) merged.crmLeads = [...crmLeads];

    clientPlan.push({
      digits, canonicalPhone,
      oldIds: docs.map(d => d.id),
      keepId: digits,
      merged,
      isDuplicate: docs.length > 1,
    });
  }

  // ── 3. OS: corrigir phone/phoneDigits ──────────────────────
  const osPlan = [];
  osSnap.docs.forEach(d => {
    const data = d.data();
    const digits = normalizePhoneDigits(data.phone);
    if (digits.length < 10) return; // sem telefone válido — não mexe, fica para revisão manual
    const canonicalPhone = maskPhone(digits);
    if (data.phoneDigits !== digits || data.phone !== canonicalPhone) {
      osPlan.push({ id: d.id, oldPhone: data.phone, newPhone: canonicalPhone, phoneDigits: digits });
    }
  });

  // ── 4. mensagens_portal / avaliacoes / agendamentos: backfill telefoneDigits ──
  function planTelefoneDigits(snap) {
    const plan = [];
    snap.docs.forEach(d => {
      const data = d.data();
      const digits = normalizePhoneDigits(data.telefone);
      if (digits.length < 10) return;
      if (data.telefoneDigits !== digits) plan.push({ id: d.id, telefoneDigits: digits });
    });
    return plan;
  }
  const mensagensPlan = planTelefoneDigits(mensagensSnap);
  const avaliacoesPlan = planTelefoneDigits(avaliacoesSnap);
  const agendamentosPlan = planTelefoneDigits(agendamentosSnap);

  // ── 5. RELATÓRIO ────────────────────────────────────────────
  console.log(`\n--- CLIENTES: ${clientPlan.length} grupo(s) de ${clientesSnap.size} precisam de correção/merge ---`);
  clientPlan.forEach(p => {
    console.log(p.isDuplicate
      ? `  [MERGE] digits=${p.digits} phone=${p.canonicalPhone} <- docs [${p.oldIds.join(', ')}]`
      : `  [RENOMEIA] ${p.oldIds[0]} -> ${p.keepId} (phone=${p.canonicalPhone})`);
  });
  if (invalid.length) {
    console.log(`\n--- ${invalid.length} cliente(s) com telefone inválido/incompleto — NÃO alterados, revisar manualmente ---`);
    invalid.forEach(i => console.log(`  doc ${i.id}: phone=${JSON.stringify(i.phone)}`));
  }
  console.log(`\n--- OS: ${osPlan.length} de ${osSnap.size} documento(s) com phone/phoneDigits para corrigir ---`);
  osPlan.forEach(o => console.log(`  ${o.id}: "${o.oldPhone}" -> "${o.newPhone}" (phoneDigits=${o.phoneDigits})`));
  console.log(`\n--- Backfill telefoneDigits: mensagens_portal=${mensagensPlan.length}/${mensagensSnap.size}  avaliacoes=${avaliacoesPlan.length}/${avaliacoesSnap.size}  agendamentos=${agendamentosPlan.length}/${agendamentosSnap.size} ---`);

  if (!APPLY) {
    console.log('\nDry-run concluído — nada foi gravado. Rode com --apply para aplicar as mudanças acima.');
    return;
  }

  // ── 6. APLICAR ──────────────────────────────────────────────
  console.log('\nAplicando mudanças...');

  for (const p of clientPlan) {
    await db.collection('clientes').doc(p.keepId).set(p.merged);
    for (const oldId of p.oldIds) {
      if (oldId !== p.keepId) await db.collection('clientes').doc(oldId).delete();
    }
  }
  console.log(`✔ ${clientPlan.length} cliente(s) corrigido(s)/mesclado(s).`);

  await commitInBatches(osPlan.map(o => (batch) =>
    batch.update(db.collection('os').doc(o.id), { phone: o.newPhone, phoneDigits: o.phoneDigits })
  ));
  console.log(`✔ ${osPlan.length} OS corrigida(s).`);

  await commitInBatches(mensagensPlan.map(m => (batch) =>
    batch.update(db.collection('mensagens_portal').doc(m.id), { telefoneDigits: m.telefoneDigits })
  ));
  await commitInBatches(avaliacoesPlan.map(a => (batch) =>
    batch.update(db.collection('avaliacoes').doc(a.id), { telefoneDigits: a.telefoneDigits })
  ));
  await commitInBatches(agendamentosPlan.map(a => (batch) =>
    batch.update(db.collection('agendamentos').doc(a.id), { telefoneDigits: a.telefoneDigits })
  ));
  console.log(`✔ telefoneDigits atualizado em mensagens_portal/avaliacoes/agendamentos.`);

  console.log('\nMigração concluída com sucesso.');
}

main().then(() => process.exit(0)).catch(e => { console.error('ERRO NA MIGRAÇÃO:', e); process.exit(1); });
