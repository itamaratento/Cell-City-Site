/* ============================================================
   PORTAL DO CLIENTE — Sprint 1b (2026-07-06)

   As 5 coleções do Portal (avaliacoes, mensagens_portal, portal_eventos,
   agendamentos, solicitacoes_diagnostico) e a resposta de orçamento em
   `os` dependiam de acesso direto do cliente (sessão anônima) ao
   Firestore, protegido só por `request.auth != null` — sem checar
   perfil, porque o hotfix de 2026-07-05 (commit 60173b7) removeu
   `temAcessoLiberado()` dessas coleções (bloqueava cliente anônimo
   legítimo, que nunca tem doc usuarios/{uid}). Essas functions fecham
   a brecha original (conta 'pendente' conseguia ler/escrever ali): o
   cliente deixa de falar direto com o Firestore, então a Rule volta a
   poder exigir temAcessoLiberado() sem quebrar o Portal.

   Mesmo modelo de confiança da Sprint 1a (consultarOSPorTelefonePublica):
   `phoneDigits` do payload é a única prova de identidade — não é prova
   de posse do telefone (SMS OTP etc. é decisão de produto separada,
   fora de escopo). Abuso automatizado (criar avaliação/mensagem falsa
   em nome de outro telefone) já era possível hoje via Firestore direto;
   não é uma regressão desta migração.
   ============================================================ */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { REGIAO } = require('./lib/config');
const { aplicarRateLimit } = require('./lib/rate-limit');
const { empresaIdDe, docDaEmpresa } = require('./lib/empresa');
const { maskPhoneServer, validarPhoneDigitsServer } = require('./lib/phone');

// Achado da homologação do Lote 2: o encoder de resposta do onCall
// (`encode()` em firebase-functions/lib/common/providers/https.js) achata
// um Timestamp do Admin SDK em `{_seconds,_nanoseconds}` simples (perde
// `.toDate()`) — o formatador do client (_fmtDate/_fmtDateTime em
// portal.js) não reconhece esse formato e renderizava "Invalid Date" nas
// telas de Mensagens/Avaliações/Agendamentos. Serializa para ISO string
// antes de devolver — mesmo formato já usado em outras coleções do
// projeto (ex. `os.createdAt`) — e centraliza a ordenação (antes
// duplicada em 3 lugares) numa função só.
function serializarCreatedAt(doc) {
  if (doc.createdAt && typeof doc.createdAt.toDate === 'function') {
    return { ...doc, createdAt: doc.createdAt.toDate().toISOString() };
  }
  return doc;
}

function ordenarPorCreatedAtDesc(lista) {
  return lista.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

// Whitelist de campos por coleção do Portal — mesmo princípio de
// OS_CAMPOS_PUBLICOS/projetarCamposPublicosOS (Sprint 1a): nunca devolver o
// doc inteiro (`{id, ...data()}`) para o client. Risco de vazamento é baixo
// hoje nestas 3 coleções (nenhum campo interno identificado por leitura do
// código que as escreve — telefone/telefoneDigits/origem não são exibidos e
// ficam de fora de propósito, já que o caller já sabe o próprio telefone),
// mas a whitelist evita que um campo interno futuro (ex. nota do staff,
// IP de origem) vaze automaticamente sem ninguém perceber.
const CAMPOS_POR_COLECAO_PORTAL = {
  mensagens_portal: ['id', 'clientName', 'nome', 'texto', 'mensagem', 'lida', 'resposta', 'respostaAt', 'respostaEm', 'createdAt'],
  avaliacoes: ['id', 'nota', 'texto', 'createdAt'],
  agendamentos: ['id', 'clientName', 'nome', 'data', 'horario', 'tipoEquipamento', 'motivo', 'observacoes', 'observacaoAdmin', 'status', 'createdAt', 'updatedAt'],
};

function projetarCamposPortal(colecao, doc) {
  const campos = CAMPOS_POR_COLECAO_PORTAL[colecao];
  const out = {};
  for (const campo of campos) {
    if (doc[campo] !== undefined) out[campo] = doc[campo];
  }
  return out;
}

// ---- Nome do cliente (login) ----
//
// Fix definitivo do HOTFIX P0 (2026-07-06, ver CRM/TECHDOC.md): doLogin()
// lia clientes/{phoneDigits} direto do Firestore para exibir o nome na
// saudação — coleção protegida por temAcessoLiberado() (tem CPF/e-mail/
// endereço, não pode reabrir para sessão anônima como as outras 6). O
// hotfix isolou o getDoc em try/catch para não derrubar o login, aceitando
// perder o nome real (fallback "Cliente"). Esta function fecha a lacuna
// sem reabrir a Rule: mesmo padrão Admin SDK das demais, retornando só
// `name` — nunca CPF/e-mail/endereço.
exports.portalObterNomeCliente = onCall({ region: REGIAO }, async (request) => {
  aplicarRateLimit(request, 'leitura');
  const digits = validarPhoneDigitsServer(request.data && request.data.phoneDigits);
  const empresaId = empresaIdDe(request.data);
  const db = admin.firestore();
  const snap = await db.collection('clientes').doc(digits).get();
  if (!snap.exists || !docDaEmpresa(snap.data(), empresaId)) return { name: '' };
  return { name: snap.data().name || '' };
});

// ---- Mensagens ----

exports.portalListarMensagens = onCall({ region: REGIAO }, async (request) => {
  aplicarRateLimit(request, 'leitura');
  const digits = validarPhoneDigitsServer(request.data && request.data.phoneDigits);
  const empresaId = empresaIdDe(request.data);
  const db = admin.firestore();
  // Sem orderBy na query (achado da homologação em DEV: o único índice
  // composto que existe de fato em mensagens_portal é telefone+createdAt,
  // não telefoneDigits+createdAt — where+orderBy em campos diferentes
  // sem o índice certo falha. Ordena no servidor, mesmo padrão usado em
  // portalListarAvaliacoes/portalListarAgendamentos abaixo, para não
  // depender de criar/esperar build de um índice novo).
  const snap = await db.collection('mensagens_portal')
    .where('telefoneDigits', '==', digits)
    .limit(200)
    .get();
  const lista = ordenarPorCreatedAtDesc(
    snap.docs
      .filter((d) => docDaEmpresa(d.data(), empresaId))
      .map((d) => projetarCamposPortal('mensagens_portal', serializarCreatedAt({ id: d.id, ...d.data() })))
  );
  return { lista };
});

exports.portalEnviarMensagem = onCall({ region: REGIAO }, async (request) => {
  aplicarRateLimit(request, 'escrita');
  const data = request.data || {};
  const digits = validarPhoneDigitsServer(data.phoneDigits);
  const nome = String(data.nome || '').trim();
  const texto = String(data.texto || '').trim();
  const clientName = String(data.clientName || '') || nome;

  if (!nome) throw new HttpsError('invalid-argument', 'Informe seu nome.');
  if (texto.length < 3) throw new HttpsError('invalid-argument', 'A mensagem deve ter pelo menos 3 caracteres.');
  if (texto.length > 2000) throw new HttpsError('invalid-argument', 'Mensagem muito longa.');

  const db = admin.firestore();
  await db.collection('mensagens_portal').add({
    empresa_id: empresaIdDe(data),
    telefone: maskPhoneServer(digits),
    telefoneDigits: digits,
    clientName,
    nome,
    texto,
    lida: false,
    origem: 'portal',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

exports.portalMarcarMensagemLida = onCall({ region: REGIAO }, async (request) => {
  aplicarRateLimit(request, 'escrita');
  const digits = validarPhoneDigitsServer(request.data && request.data.phoneDigits);
  const msgId = request.data && request.data.msgId;
  if (!msgId || typeof msgId !== 'string' || msgId.length > 200) {
    throw new HttpsError('invalid-argument', 'Informe o id da mensagem.');
  }

  const db = admin.firestore();
  const ref = db.collection('mensagens_portal').doc(msgId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Mensagem não encontrada.');
  if (snap.data().telefoneDigits !== digits || !docDaEmpresa(snap.data(), empresaIdDe(request.data))) {
    throw new HttpsError('permission-denied', 'Esta mensagem não pertence a este telefone.');
  }
  await ref.update({ lida: true });
  return { ok: true };
});

// ---- Avaliações ----

exports.portalListarAvaliacoes = onCall({ region: REGIAO }, async (request) => {
  aplicarRateLimit(request, 'leitura');
  const digits = validarPhoneDigitsServer(request.data && request.data.phoneDigits);
  const empresaId = empresaIdDe(request.data);
  const db = admin.firestore();
  const snap = await db.collection('avaliacoes').where('telefoneDigits', '==', digits).limit(200).get();
  // Ordena no servidor (sem orderBy na query) para não depender de um
  // índice composto extra — coleção pequena por telefone, custo desprezível.
  const lista = ordenarPorCreatedAtDesc(
    snap.docs
      .filter((d) => docDaEmpresa(d.data(), empresaId))
      .map((d) => projetarCamposPortal('avaliacoes', serializarCreatedAt({ id: d.id, ...d.data() })))
  );
  return { lista };
});

exports.portalCriarAvaliacao = onCall({ region: REGIAO }, async (request) => {
  aplicarRateLimit(request, 'escrita');
  const data = request.data || {};
  const digits = validarPhoneDigitsServer(data.phoneDigits);
  const nota = Number(data.nota);
  const texto = String(data.texto || '').trim();
  const clientName = String(data.clientName || '');

  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    throw new HttpsError('invalid-argument', 'Nota inválida.');
  }

  const db = admin.firestore();
  await db.collection('avaliacoes').add({
    empresa_id: empresaIdDe(data),
    telefone: maskPhoneServer(digits),
    telefoneDigits: digits,
    clientName,
    nota,
    texto,
    origem: 'portal',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

// ---- Agendamentos ----

exports.portalListarAgendamentos = onCall({ region: REGIAO }, async (request) => {
  aplicarRateLimit(request, 'leitura');
  const digits = validarPhoneDigitsServer(request.data && request.data.phoneDigits);
  const empresaId = empresaIdDe(request.data);
  const db = admin.firestore();
  const snap = await db.collection('agendamentos').where('telefoneDigits', '==', digits).limit(200).get();
  const lista = ordenarPorCreatedAtDesc(
    snap.docs
      .filter((d) => docDaEmpresa(d.data(), empresaId))
      .map((d) => projetarCamposPortal('agendamentos', serializarCreatedAt({ id: d.id, ...d.data() })))
  );
  return { lista };
});

exports.portalCriarAgendamento = onCall({ region: REGIAO }, async (request) => {
  aplicarRateLimit(request, 'escrita');
  const data = request.data || {};
  const digits = validarPhoneDigitsServer(data.phoneDigits);
  const nome = String(data.nome || '').trim();
  const telefoneInformado = String(data.telefoneInformado || '').trim();
  const dataAgendamento = String(data.data || '');
  const horario = String(data.horario || '');
  const tipoEquipamento = String(data.tipoEquipamento || '');
  const motivo = String(data.motivo || '');
  const observacoes = String(data.observacoes || '').trim();
  const clientName = String(data.clientName || '') || nome;

  if (!nome) throw new HttpsError('invalid-argument', 'Informe seu nome.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAgendamento)) throw new HttpsError('invalid-argument', 'Data inválida.');
  if (!/^\d{2}:\d{2}$/.test(horario)) throw new HttpsError('invalid-argument', 'Horário inválido.');
  if (!tipoEquipamento) throw new HttpsError('invalid-argument', 'Selecione o tipo de equipamento.');
  if (!motivo) throw new HttpsError('invalid-argument', 'Selecione o motivo do atendimento.');

  const db = admin.firestore();
  const empresaId = empresaIdDe(data);

  // Achado (Fase 2.3): a function não validava o horário contra
  // agendamentos já existentes — portalListarHorariosOcupados só informa
  // o cliente, nada impedia o próprio submit de escolher um horário já
  // ocupado. Mesmo filtro usado lá (data + status ativo), aplicado aqui
  // como barreira real. Ainda existe uma janela estreita de corrida entre
  // duas requisições simultâneas para o mesmo horário (sem reserva
  // atômica) — aceitável: o risco predominante corrigido é a ausência
  // total de validação, não a concorrência exata no mesmo instante.
  const ocupadosSnap = await db.collection('agendamentos')
    .where('data', '==', dataAgendamento)
    .where('status', 'in', ['confirmado', 'aguardando'])
    .get();
  const jaOcupado = ocupadosSnap.docs.some((d) => {
    const doc = d.data();
    return docDaEmpresa(doc, empresaId) && String(doc.horario || '').slice(0, 5) === horario.slice(0, 5);
  });
  if (jaOcupado) {
    throw new HttpsError('already-exists', 'Este horário já está ocupado. Escolha outro.');
  }

  await db.collection('agendamentos').add({
    empresa_id: empresaId,
    telefone: maskPhoneServer(digits),
    telefoneDigits: digits,
    telefoneInformado,
    clientName,
    nome,
    data: dataAgendamento,
    horario,
    tipoEquipamento,
    motivo,
    observacoes,
    status: 'aguardando',
    origem: 'portal',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

// Achado da Sprint 1b (não estava nos 7 itens originais do plano):
// _buscarHorariosOcupados() no Portal consulta `agendamentos` por data,
// sem filtrar por telefone — é checagem de disponibilidade de horário,
// não dado de um cliente específico. Devolve só os horários ocupados,
// nenhum dado de cliente.
exports.portalListarHorariosOcupados = onCall({ region: REGIAO }, async (request) => {
  aplicarRateLimit(request, 'leitura');
  const dataAgendamento = String((request.data && request.data.data) || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAgendamento)) {
    throw new HttpsError('invalid-argument', 'Data inválida.');
  }
  const empresaId = empresaIdDe(request.data);
  const db = admin.firestore();
  const snap = await db.collection('agendamentos')
    .where('data', '==', dataAgendamento)
    .where('status', 'in', ['confirmado', 'aguardando'])
    .get();
  const ocupados = snap.docs
    .filter((d) => docDaEmpresa(d.data(), empresaId))
    .map((d) => d.data().horario)
    .filter(Boolean)
    .map((h) => String(h).slice(0, 5));
  return { ocupados };
});

// ---- Solicitação de diagnóstico ----

exports.portalCriarSolicitacaoDiagnostico = onCall({ region: REGIAO }, async (request) => {
  aplicarRateLimit(request, 'escrita');
  const data = request.data || {};
  const digits = validarPhoneDigitsServer(data.phoneDigits);
  const clientName = String(data.clientName || '');
  const tipoEquipamento = String(data.tipoEquipamento || '').trim();
  const marca = String(data.marca || '').trim();
  const modelo = String(data.modelo || '').trim();
  const descricao = String(data.descricao || '').trim();

  if (!tipoEquipamento) throw new HttpsError('invalid-argument', 'Selecione o tipo de equipamento.');
  if (descricao.length < 10) throw new HttpsError('invalid-argument', 'Descreva o problema (mínimo 10 caracteres).');

  const db = admin.firestore();
  // Schema idêntico ao que o client escrevia direto (sem telefoneDigits —
  // este payload original nunca teve esse campo; mantido para não gerar
  // deriva de schema sem necessidade real).
  await db.collection('solicitacoes_diagnostico').add({
    empresa_id: empresaIdDe(data),
    telefone: maskPhoneServer(digits),
    clientName,
    tipoEquipamento,
    marca,
    modelo,
    descricao,
    status: 'pendente',
    respondido: false,
    origem: 'portal',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

// ---- Eventos (tracking) ----

const PORTAL_EVENTO_TIPOS = ['acesso', 'clique_whatsapp', 'clique_maps'];
const PORTAL_EVENTO_CAMPOS_EXTRA = ['pagina', 'origem'];

exports.portalRegistrarEvento = onCall({ region: REGIAO }, async (request) => {
  aplicarRateLimit(request, 'evento');
  const data = request.data || {};
  const digits = validarPhoneDigitsServer(data.phoneDigits);
  const tipo = String(data.tipo || '').trim();
  if (!PORTAL_EVENTO_TIPOS.includes(tipo)) {
    throw new HttpsError('invalid-argument', 'Tipo de evento inválido.');
  }
  const clientName = String(data.clientName || '');
  const dadosOrigem = data.dados || {};
  const dadosPermitidos = {};
  for (const campo of PORTAL_EVENTO_CAMPOS_EXTRA) {
    if (typeof dadosOrigem[campo] === 'string' && dadosOrigem[campo].length <= 40) {
      dadosPermitidos[campo] = dadosOrigem[campo];
    }
  }

  const db = admin.firestore();
  await db.collection('portal_eventos').add({
    empresa_id: empresaIdDe(data),
    tipo,
    telefone: maskPhoneServer(digits),
    clientName,
    ...dadosPermitidos,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

// ---- Orçamento (aprovar/recusar) ----

// Substitui 4 implementações (portal.js::_executarAprovacao/_executarRecusa,
// consultar-os.html raiz::responderOrcamentoConsulta x2) por uma só.
// Proteção que NÃO existia antes desta sprint: com Firestore Rules,
// qualquer sessão anônima conseguia aprovar/recusar QUALQUER OS (a regra
// só checava request.auth != null, nunca comparava telefone). Aqui a
// Function é o único caminho e exige que o phoneDigits do payload bata
// com o phoneDigits gravado na própria OS antes de aceitar.
exports.portalResponderOrcamento = onCall({ region: REGIAO }, async (request) => {
  aplicarRateLimit(request, 'escrita');
  const data = request.data || {};
  const osId = data.osId;
  if (!osId || typeof osId !== 'string' || osId.length > 30) {
    throw new HttpsError('invalid-argument', 'Informe o número da OS.');
  }
  const digits = validarPhoneDigitsServer(data.phoneDigits);
  const resposta = data.resposta;
  if (resposta !== 'aprovado' && resposta !== 'recusado') {
    throw new HttpsError('invalid-argument', 'Resposta inválida.');
  }
  const escolha = (data.escolha === '1' || data.escolha === '2') ? data.escolha : null;
  const obs = String(data.obs || '').trim().slice(0, 500) || null;
  const origem = data.origem === 'consulta-os' ? 'Consulta OS' : 'Portal do Cliente';

  if (resposta === 'recusado' && (!obs || obs.length < 3)) {
    throw new HttpsError('invalid-argument', 'Informe o motivo da recusa.');
  }

  const db = admin.firestore();
  const ref = db.collection('os').doc(osId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'OS não encontrada.');
  const osData = snap.data();

  if (osData.phoneDigits !== digits || !docDaEmpresa(osData, empresaIdDe(data))) {
    throw new HttpsError('permission-denied', 'Este telefone não corresponde a esta OS.');
  }
  if (osData.status !== 'orcamento_enviado' && osData.status !== 'orcamento') {
    throw new HttpsError('failed-precondition', 'Este orçamento já foi respondido.');
  }

  // Copiado do client original (que rodava no navegador do cliente, em
  // horário de Brasília implícito) — achado da homologação: rodando numa
  // Cloud Function (runtime em UTC por padrão), toLocaleDateString/
  // toLocaleTimeString sem `timeZone` explícito gravavam data/hora 3h
  // adiantadas (e possivelmente o dia errado perto da meia-noite).
  const now = new Date();
  const TZ = 'America/Sao_Paulo';
  const dataResp = now.toLocaleDateString('pt-BR', { timeZone: TZ });
  const horaResp = now.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const escNome = escolha === '1' ? 'Orçamento 1' : (escolha === '2' ? 'Orçamento 2' : 'o orçamento');
  const textoTimeline = resposta === 'aprovado'
    ? `Cliente aprovou ${escNome} em ${dataResp} às ${horaResp}.${obs ? `\n\nObservação:\n"${obs}"` : ''}`
    : `Cliente recusou o orçamento em ${dataResp} às ${horaResp}.\n\nMotivo:\n"${obs}"`;

  const campos = {
    status: resposta === 'aprovado' ? 'orcamento_aprovado' : 'orcamento_recusado',
    orcamentoResposta: resposta,
    orcamentoOrigem: origem,
    orcamentoDataResposta: dataResp,
    orcamentoHoraResposta: horaResp,
    orcamentoTimestamp: now.toISOString(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    timeline: admin.firestore.FieldValue.arrayUnion({ date: now.toISOString(), text: textoTimeline }),
  };
  if (escolha) campos.orcamentoEscolhido = escolha;
  if (obs) campos.orcamentoObs = obs;

  await ref.update(campos);
  return { ok: true };
});
