// Testes de unidade das Cloud Functions do Portal do Cliente — Sprint 1b
// (2026-07-06). Chama os handlers diretamente via `.run({ data })` (v2
// onCall expõe isso — ver firebase-functions/lib/v2/providers/https.js),
// contra o emulador de Firestore (Admin SDK ignora Rules, então isto testa
// só a lógica das Functions, não a segurança do Firestore — essa parte
// é coberta por tests/firestore-rules/).
//
// Rodar: cd tests/functions && node ../../node_modules/.bin/firebase
// emulators:exec --only firestore --project cellcity-rules-test
// "node --test" (a partir da raiz do repo).

import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as fns from '../../functions/index.js';

// `require` daqui resolve a partir de functions/index.js (não da raiz do
// repo, que tem sua própria cópia de firebase-admin em node_modules) —
// garante a MESMA instância do SDK que index.js usou em `admin.initializeApp()`.
// Duas cópias resolvidas por caminhos diferentes seriam dois SDKs
// independentes, e o app nunca apareceria inicializado neste arquivo.
const require = createRequire(new URL('../../functions/index.js', import.meta.url));
const admin = require('firebase-admin');

const db = admin.firestore();

after(async () => {
  await admin.app().delete();
});

async function limparColecao(nome) {
  const snap = await db.collection(nome).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

beforeEach(async () => {
  await Promise.all([
    limparColecao('mensagens_portal'),
    limparColecao('avaliacoes'),
    limparColecao('agendamentos'),
    limparColecao('solicitacoes_diagnostico'),
    limparColecao('portal_eventos'),
    limparColecao('os'),
    limparColecao('clientes'),
  ]);
});

const PHONE = '61999998888';
const PHONE_OUTRO = '61988887777';

// HttpsError expõe `.code` (ex.: 'invalid-argument') separado da `.message`
// — a mensagem de erro sozinha não contém o code, então os testes de
// rejeição comparam `.code` diretamente em vez de casar regex na mensagem.
function comCode(codeEsperado) {
  return (err) => err.code === codeEsperado;
}

// ===== Nome do cliente (login) =====
// Fix definitivo do HOTFIX P0 (2026-07-06): substitui o getDoc direto de
// clientes/{phoneDigits} no client (bloqueado por temAcessoLiberado() nas
// Rules) por esta function — só devolve `name`, nunca CPF/e-mail/endereço.

test('portalObterNomeCliente: devolve só o nome, nunca outros campos do cliente', async () => {
  await db.collection('clientes').doc(PHONE).set({
    name: 'Fulano de Tal',
    cpf: '123.456.789-00',
    email: 'fulano@example.com',
    endereco: 'Rua Teste, 123',
  });
  const resp = await fns.portalObterNomeCliente.run({ data: { phoneDigits: PHONE } });
  assert.deepEqual(resp, { name: 'Fulano de Tal' });
});

test('portalObterNomeCliente: telefone sem doc em clientes devolve nome vazio (sem erro)', async () => {
  const resp = await fns.portalObterNomeCliente.run({ data: { phoneDigits: PHONE } });
  assert.deepEqual(resp, { name: '' });
});

test('portalObterNomeCliente: rejeita telefone inválido', async () => {
  await assert.rejects(
    () => fns.portalObterNomeCliente.run({ data: { phoneDigits: '123' } }),
    comCode('invalid-argument')
  );
});

// ===== Mensagens =====

test('portalEnviarMensagem + portalListarMensagens: fluxo feliz', async () => {
  await fns.portalEnviarMensagem.run({ data: { phoneDigits: PHONE, nome: 'Fulano', texto: 'Olá, tudo bem?', clientName: 'Fulano' } });
  const { lista } = await fns.portalListarMensagens.run({ data: { phoneDigits: PHONE } });
  assert.equal(lista.length, 1);
  assert.equal(lista[0].texto, 'Olá, tudo bem?');
  assert.equal(lista[0].telefoneDigits, PHONE);
  assert.equal(lista[0].lida, false);
  // createdAt precisa sair como ISO string, não como Timestamp — o encoder
  // do onCall achata um Timestamp em {_seconds,_nanoseconds} sem `.toDate()`
  // e o client (_fmtDateTime) renderizava "Invalid Date" (achado da
  // homologação do Lote 2).
  assert.equal(typeof lista[0].createdAt, 'string');
  assert.ok(!Number.isNaN(Date.parse(lista[0].createdAt)), 'createdAt deve ser uma data ISO válida');
});

test('portalListarMensagens: não vaza mensagem de outro telefone', async () => {
  await fns.portalEnviarMensagem.run({ data: { phoneDigits: PHONE, nome: 'A', texto: 'mensagem A' } });
  await fns.portalEnviarMensagem.run({ data: { phoneDigits: PHONE_OUTRO, nome: 'B', texto: 'mensagem B' } });
  const { lista } = await fns.portalListarMensagens.run({ data: { phoneDigits: PHONE } });
  assert.equal(lista.length, 1);
  assert.equal(lista[0].texto, 'mensagem A');
});

test('portalEnviarMensagem: rejeita texto curto demais', async () => {
  await assert.rejects(
    () => fns.portalEnviarMensagem.run({ data: { phoneDigits: PHONE, nome: 'Fulano', texto: 'oi' } }),
    comCode('invalid-argument')
  );
});

test('portalEnviarMensagem: rejeita telefone inválido', async () => {
  await assert.rejects(
    () => fns.portalEnviarMensagem.run({ data: { phoneDigits: '123', nome: 'Fulano', texto: 'mensagem válida' } }),
    comCode('invalid-argument')
  );
});

test('portalMarcarMensagemLida: marca a própria mensagem', async () => {
  await fns.portalEnviarMensagem.run({ data: { phoneDigits: PHONE, nome: 'A', texto: 'mensagem A' } });
  const snap = await db.collection('mensagens_portal').where('telefoneDigits', '==', PHONE).get();
  const msgId = snap.docs[0].id;
  await fns.portalMarcarMensagemLida.run({ data: { phoneDigits: PHONE, msgId } });
  const depois = await db.collection('mensagens_portal').doc(msgId).get();
  assert.equal(depois.data().lida, true);
});

test('portalMarcarMensagemLida: rejeita marcar mensagem de outro telefone', async () => {
  await fns.portalEnviarMensagem.run({ data: { phoneDigits: PHONE_OUTRO, nome: 'B', texto: 'mensagem B' } });
  const snap = await db.collection('mensagens_portal').where('telefoneDigits', '==', PHONE_OUTRO).get();
  const msgId = snap.docs[0].id;
  await assert.rejects(
    () => fns.portalMarcarMensagemLida.run({ data: { phoneDigits: PHONE, msgId } }),
    comCode('permission-denied')
  );
});

// ===== Avaliações =====

test('portalCriarAvaliacao + portalListarAvaliacoes: fluxo feliz', async () => {
  await fns.portalCriarAvaliacao.run({ data: { phoneDigits: PHONE, clientName: 'Fulano', nota: 5, texto: 'Ótimo!' } });
  const { lista } = await fns.portalListarAvaliacoes.run({ data: { phoneDigits: PHONE } });
  assert.equal(lista.length, 1);
  assert.equal(lista[0].nota, 5);
  assert.equal(typeof lista[0].createdAt, 'string');
  assert.ok(!Number.isNaN(Date.parse(lista[0].createdAt)), 'createdAt deve ser uma data ISO válida');
});

test('portalCriarAvaliacao: rejeita nota fora do intervalo', async () => {
  await assert.rejects(
    () => fns.portalCriarAvaliacao.run({ data: { phoneDigits: PHONE, nota: 7, texto: '' } }),
    comCode('invalid-argument')
  );
});

// ===== Agendamentos =====

const AGENDAMENTO_BASE = {
  phoneDigits: PHONE,
  nome: 'Fulano',
  telefoneInformado: '(61) 99999-8888',
  data: '2026-08-10',
  horario: '09:00',
  tipoEquipamento: 'celular',
  motivo: 'avaliacao',
  observacoes: '',
};

test('portalCriarAgendamento + portalListarAgendamentos: fluxo feliz', async () => {
  await fns.portalCriarAgendamento.run({ data: AGENDAMENTO_BASE });
  const { lista } = await fns.portalListarAgendamentos.run({ data: { phoneDigits: PHONE } });
  assert.equal(lista.length, 1);
  assert.equal(lista[0].status, 'aguardando');
  assert.equal(lista[0].data, '2026-08-10');
  assert.equal(typeof lista[0].createdAt, 'string');
  assert.ok(!Number.isNaN(Date.parse(lista[0].createdAt)), 'createdAt deve ser uma data ISO válida');
});

test('portalCriarAgendamento: rejeita data mal formatada', async () => {
  await assert.rejects(
    () => fns.portalCriarAgendamento.run({ data: { ...AGENDAMENTO_BASE, data: '10/08/2026' } }),
    comCode('invalid-argument')
  );
});

test('portalListarHorariosOcupados: reflete agendamentos aguardando/confirmado, ignora cancelado', async () => {
  await fns.portalCriarAgendamento.run({ data: AGENDAMENTO_BASE }); // aguardando, 09:00
  await db.collection('agendamentos').add({ data: '2026-08-10', horario: '10:00', status: 'confirmado' });
  await db.collection('agendamentos').add({ data: '2026-08-10', horario: '11:00', status: 'cancelado' });
  const { ocupados } = await fns.portalListarHorariosOcupados.run({ data: { data: '2026-08-10' } });
  assert.deepEqual(ocupados.sort(), ['09:00', '10:00']);
});

test('portalListarHorariosOcupados: não devolve dado de cliente, só o horário', async () => {
  await fns.portalCriarAgendamento.run({ data: AGENDAMENTO_BASE });
  const resp = await fns.portalListarHorariosOcupados.run({ data: { data: '2026-08-10' } });
  assert.deepEqual(Object.keys(resp), ['ocupados']);
  assert.equal(typeof resp.ocupados[0], 'string');
});

// ===== Solicitação de diagnóstico =====

test('portalCriarSolicitacaoDiagnostico: fluxo feliz', async () => {
  await fns.portalCriarSolicitacaoDiagnostico.run({
    data: { phoneDigits: PHONE, clientName: 'Fulano', tipoEquipamento: 'celular', marca: 'Samsung', modelo: 'S23', descricao: 'Tela trincada, não liga mais.' },
  });
  const snap = await db.collection('solicitacoes_diagnostico').get();
  assert.equal(snap.size, 1);
  assert.equal(snap.docs[0].data().status, 'pendente');
});

test('portalCriarSolicitacaoDiagnostico: rejeita descrição curta', async () => {
  await assert.rejects(
    () => fns.portalCriarSolicitacaoDiagnostico.run({ data: { phoneDigits: PHONE, tipoEquipamento: 'celular', descricao: 'curto' } }),
    comCode('invalid-argument')
  );
});

// ===== Eventos =====

test('portalRegistrarEvento: aceita tipo válido e filtra campos extras', async () => {
  await fns.portalRegistrarEvento.run({
    data: { phoneDigits: PHONE, clientName: 'Fulano', tipo: 'clique_whatsapp', dados: { pagina: 'contato', campoNaoPermitido: 'x' } },
  });
  const snap = await db.collection('portal_eventos').get();
  assert.equal(snap.size, 1);
  const d = snap.docs[0].data();
  assert.equal(d.pagina, 'contato');
  assert.equal(d.campoNaoPermitido, undefined);
});

test('portalRegistrarEvento: rejeita tipo fora da whitelist', async () => {
  await assert.rejects(
    () => fns.portalRegistrarEvento.run({ data: { phoneDigits: PHONE, tipo: 'evento_inventado' } }),
    comCode('invalid-argument')
  );
});

// ===== Orçamento =====

async function seedOS(overrides = {}) {
  await db.collection('os').doc('OS-0001').set({
    id: 'OS-0001',
    phoneDigits: PHONE,
    status: 'orcamento_enviado',
    valor: 150,
    ...overrides,
  });
}

test('portalResponderOrcamento: aprova quando phoneDigits bate', async () => {
  await seedOS();
  await fns.portalResponderOrcamento.run({ data: { osId: 'OS-0001', phoneDigits: PHONE, resposta: 'aprovado' } });
  const depois = await db.collection('os').doc('OS-0001').get();
  assert.equal(depois.data().status, 'orcamento_aprovado');
  assert.equal(depois.data().orcamentoResposta, 'aprovado');
});

test('portalResponderOrcamento: recusa exige motivo (obs)', async () => {
  await seedOS();
  await assert.rejects(
    () => fns.portalResponderOrcamento.run({ data: { osId: 'OS-0001', phoneDigits: PHONE, resposta: 'recusado' } }),
    comCode('invalid-argument')
  );
});

test('portalResponderOrcamento: recusa com motivo funciona', async () => {
  await seedOS();
  await fns.portalResponderOrcamento.run({ data: { osId: 'OS-0001', phoneDigits: PHONE, resposta: 'recusado', obs: 'Muito caro' } });
  const depois = await db.collection('os').doc('OS-0001').get();
  assert.equal(depois.data().status, 'orcamento_recusado');
});

test('portalResponderOrcamento: NEGA quando phoneDigits não bate com a OS (fix central desta sprint)', async () => {
  await seedOS();
  await assert.rejects(
    () => fns.portalResponderOrcamento.run({ data: { osId: 'OS-0001', phoneDigits: PHONE_OUTRO, resposta: 'aprovado' } }),
    comCode('permission-denied')
  );
  const depois = await db.collection('os').doc('OS-0001').get();
  assert.equal(depois.data().status, 'orcamento_enviado', 'a OS não deve ter sido alterada');
});

test('portalResponderOrcamento: rejeita OS já respondida (guarda anti-duplo)', async () => {
  await seedOS({ status: 'orcamento_aprovado' });
  await assert.rejects(
    () => fns.portalResponderOrcamento.run({ data: { osId: 'OS-0001', phoneDigits: PHONE, resposta: 'aprovado' } }),
    comCode('failed-precondition')
  );
});

test('portalResponderOrcamento: rejeita OS inexistente', async () => {
  await assert.rejects(
    () => fns.portalResponderOrcamento.run({ data: { osId: 'OS-9999', phoneDigits: PHONE, resposta: 'aprovado' } }),
    comCode('not-found')
  );
});
