/**
 * Meta Semanal do Dashboard — dataISO (inclui Beepstart sem campo `data`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  META_ANO_MIN,
  weekNumISO,
  isoWeekDataISORange,
  dataRefLancamento,
  somarLucroMetaSemanal,
} from '../../CRM/pages/caixa/caixa-data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, '../../CRM/pages/dashboard/dashboard-caixa.js'), 'utf8');
const INDEXES = readFileSync(join(__dirname, '../../CRM/firestore.indexes.json'), 'utf8');

test('META_ANO_MIN é 2019 (histórico do relatório)', () => {
  assert.equal(META_ANO_MIN, 2019);
});

test('isoWeekDataISORange: segunda 00:00-03 até domingo fim → ISO UTC', () => {
  // 2024-W24: segunda 2024-06-10 … domingo 2024-06-16
  const r = isoWeekDataISORange(2024, 24);
  assert.equal(r.monday, '2024-06-10');
  assert.equal(r.sunday, '2024-06-16');
  assert.equal(r.startISO, new Date('2024-06-10T00:00:00-03:00').toISOString());
  assert.equal(r.endISO, new Date('2024-06-16T23:59:59.999-03:00').toISOString());
  assert.ok(r.startISO < r.endISO);
});

test('dataRefLancamento: Beepstart (dia+dataISO, sem data) → dia', () => {
  const beep = {
    dia: '2024-06-12',
    dataISO: '2024-06-12T18:30:00.000Z',
    lucro: 80,
  };
  assert.equal(dataRefLancamento(beep), '2024-06-12');
  assert.equal(beep.data, undefined);
});

test('somarLucroMetaSemanal: lançamento só dataISO+dia (Beepstart) entra na soma', () => {
  const ano = 2024;
  const numSem = 24; // 2024-06-10 … 2024-06-16
  const beep = {
    // Formato importar.js beep_venda_*: tem dia + dataISO, NÃO tem `data`
    dia: '2024-06-12',
    dataISO: '2024-06-12T15:00:00.000Z',
    lucro: 150,
    importadoDe: 'beepstart',
  };
  const caixaNovo = {
    data: '2024-06-11',
    dia: '2024-06-11',
    dataISO: '2024-06-11T15:00:00.000Z',
    lucro: 50,
  };
  const foraDaSemana = {
    dia: '2024-06-20',
    dataISO: '2024-06-20T15:00:00.000Z',
    lucro: 999,
  };
  const { lucroAtual, lucroPorAno } = somarLucroMetaSemanal(
    [beep, caixaNovo, foraDaSemana],
    ano,
    numSem
  );
  assert.equal(lucroAtual, 200, 'Beepstart + caixa novo na semana atual');
  assert.equal(Object.keys(lucroPorAno).length, 0);
  assert.equal(weekNumISO(new Date('2024-06-12T12:00:00')), numSem);
});

test('somarLucroMetaSemanal: histórico de outro ano na mesma semana ISO', () => {
  const hist = {
    dia: '2023-06-14',
    dataISO: '2023-06-14T15:00:00.000Z',
    lucro: 300,
  };
  const ref = dataRefLancamento(hist);
  const semHist = weekNumISO(new Date(ref + 'T12:00:00'));
  const { lucroAtual, lucroPorAno } = somarLucroMetaSemanal([hist], 2024, semHist);
  assert.equal(lucroAtual, 0);
  assert.equal(lucroPorAno[2023], 300);
});

test('dashboard-caixa.js filtra por dataISO (não por data) + fallback + anos desde 2019', () => {
  assert.match(SRC, /where\(\s*'dataISO'\s*,\s*'>='/);
  assert.match(SRC, /where\(\s*'dataISO'\s*,\s*'<='/);
  assert.equal(/where\(\s*'data'\s*,/.test(SRC), false, 'não deve filtrar Meta por campo data');
  assert.match(SRC, /fallback leitura completa/);
  assert.match(SRC, /META_ANO_MIN/);
  assert.match(SRC, /isoWeekDataISORange/);
  assert.match(SRC, /somarLucroMetaSemanal/);
});

test('firestore.indexes.json: composto empresa_id + dataISO ASC', () => {
  const idx = JSON.parse(INDEXES);
  const hit = (idx.indexes || []).find((i) =>
    i.collectionGroup === 'caixa_lancamentos'
    && (i.fields || []).some((f) => f.fieldPath === 'dataISO' && f.order === 'ASCENDING')
    && (i.fields || []).some((f) => f.fieldPath === 'empresa_id' && f.order === 'ASCENDING')
  );
  assert.ok(hit, 'índice caixa_lancamentos (empresa_id ASC, dataISO ASC) obrigatório');
});
