/* ============================================================
   CLOUD FUNCTIONS — Cell City CRM

   Só existe aqui o que precisa mesmo de Admin SDK: ações que o client
   SDK não consegue fazer sem impersonar a conta-alvo (excluirUsuarioAdmin)
   ou leituras públicas que precisam devolver só um subconjunto seguro
   de campos, sem expor o documento inteiro via Firestore Rules
   (consultarOSPublica, consultarOSPorTelefonePublica — Sprint 1a,
   2026-07-05).

   Autorização 2026-07-04: até então este projeto não tinha nenhuma
   Cloud Function (decisão deliberada, por custo/simplicidade — ver
   TECHDOC.md §13). Autorizado a implementar para resolver a exclusão
   de usuário: o client SDK só apaga a conta em que ele mesmo está
   autenticado, então excluir a conta de OUTRO usuário exigia saber a
   senha atual dela. Aqui a checagem de quem pode excluir é feita no
   servidor (com Admin SDK, ignorando Firestore Rules), então nenhuma
   senha da conta-alvo é necessária.
   ============================================================ */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

const REGIAO = 'southamerica-east1'; // mesma região do Firestore (ver firebase.json)

exports.excluirUsuarioAdmin = onCall({ region: REGIAO }, async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'É preciso estar logado.');
  }

  const targetUid = request.data && request.data.uid;
  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'Informe o uid do usuário a excluir.');
  }
  if (targetUid === auth.uid) {
    throw new HttpsError('failed-precondition', 'Você não pode excluir a conta com a qual está logado.');
  }

  const db = admin.firestore();

  const callerSnap = await db.collection('usuarios').doc(auth.uid).get();
  const callerPerfil = callerSnap.exists ? callerSnap.data().perfil : null;
  if (callerPerfil !== 'admin' && callerPerfil !== 'master_admin') {
    throw new HttpsError('permission-denied', 'Só administradores podem excluir usuários.');
  }

  const targetSnap = await db.collection('usuarios').doc(targetUid).get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }
  const targetData = targetSnap.data();

  // Mesma guarda do último administrador já aplicada no client
  // (usuarios-permissoes.js::bloqueadoPorProtecaoAdmin) — replicada aqui
  // porque o client não pode mais ser a única linha de defesa: esta
  // function roda com Admin SDK e ignora as Firestore Rules.
  if (targetData.perfil === 'admin' || targetData.perfil === 'master_admin') {
    const admins = await db.collection('usuarios').where('perfil', 'in', ['admin', 'master_admin']).get();
    if (admins.size <= 1) {
      throw new HttpsError('failed-precondition', 'Não é possível excluir o último administrador do sistema.');
    }
  }

  try {
    await admin.auth().deleteUser(targetUid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e; // login já não existia — segue removendo o cadastro mesmo assim
  }
  await db.collection('usuarios').doc(targetUid).delete();

  await db.collection('auditoria_usuarios_permissoes').add({
    acao: 'usuario_excluido',
    admin_uid: auth.uid,
    admin_nome: (callerSnap.data() || {}).nome_exibicao || (callerSnap.data() || {}).nome || auth.token.email || auth.uid,
    alvo_uid: targetUid,
    alvo_nome: targetData.nome_exibicao || targetData.nome || targetData.email || targetUid,
    detalhes: { email: targetData.email || null, via: 'cloud-function' },
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

/* ============================================================
   PROJEÇÃO PÚBLICA DE OS — Sprint 1a (auditoria 2026-07-04)

   Antes: `os/{osId}` tinha `allow get: if true` no Firestore Rules —
   qualquer visitante, sem login, lia o documento INTEIRO por ID
   (sequencial/previsível, ex. OS-0001) — incluindo password/
   patternSequence/lockPhoto (senha/padrão/foto de desbloqueio do
   aparelho, em texto puro), endereço, IMEI e technicalObservation
   (notas internas da equipe). `garantia.html` e os dois
   `consultar-os.html` (público, sem login) são os únicos consumidores
   legítimos, e nenhum deles usa esses campos sensíveis — só o
   subconjunto abaixo. Estas duas functions passam a ser o único
   caminho público de leitura de `os` (Admin SDK, ignora Rules); a
   Rule de `get` foi fechada (`if false`) depois de todos os
   consumidores migrarem para elas.
   ============================================================ */

// Único ponto que decide quais campos de `os/{osId}` podem sair para
// o público sem login. NUNCA incluir aqui: password, patternSequence,
// lockPhoto, endereço, imei1/imei2, technicalObservation.
const OS_CAMPOS_PUBLICOS = [
  'id', 'clientName', 'phone', 'cpf', 'model', 'category', 'defect', 'status',
  'createdAt', 'updatedAt', 'deliveredAt', 'technician', 'garantiaId', 'prazoGarantia',
  'valor', 'valorCartao', 'observations', 'timeline',
  'orcamentoResposta', 'orcamentoDataResposta', 'orcamentoHoraResposta',
];

function projetarCamposPublicosOS(data) {
  const out = {};
  for (const campo of OS_CAMPOS_PUBLICOS) {
    if (data[campo] !== undefined) out[campo] = data[campo];
  }
  // relatorioTecnico só é público quando o técnico autorizou
  // explicitamente — mesma regra que garantia.html já aplica hoje.
  if (data.relatorioTecnico && data.relatorioTecnico.exibirPortal === true) {
    out.relatorioTecnico = data.relatorioTecnico;
  }
  return out;
}

// Duplicado deliberado de CRM/shared/phone-utils.js::normalizePhoneDigits
// — `functions/` só empacota o próprio diretório no deploy (ver
// firebase.json), não há como importar arquivos de fora dele em
// runtime sem um passo de build (que este projeto não usa). Se a
// regra de normalização mudar em phone-utils.js, replicar aqui também.
function normalizePhoneDigitsServer(input) {
  let d = String(input == null ? '' : input).replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 10 && /^[6-9]/.test(d.slice(2))) {
    d = d.slice(0, 2) + '9' + d.slice(2);
  }
  return d.slice(0, 11);
}

exports.consultarOSPublica = onCall({ region: REGIAO }, async (request) => {
  const osId = request.data && request.data.osId;
  if (!osId || typeof osId !== 'string' || osId.length > 30) {
    throw new HttpsError('invalid-argument', 'Informe o número da OS.');
  }

  const db = admin.firestore();
  const snap = await db.collection('os').doc(osId).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'OS não encontrada.');
  }

  return { os: projetarCamposPublicosOS(snap.data()) };
});

exports.consultarOSPorTelefonePublica = onCall({ region: REGIAO }, async (request) => {
  const digits = normalizePhoneDigitsServer(request.data && request.data.phoneDigits);
  if (digits.length < 10) {
    throw new HttpsError('invalid-argument', 'Informe um telefone válido.');
  }

  const db = admin.firestore();
  const snap = await db.collection('os').where('phoneDigits', '==', digits).limit(50).get();

  return { lista: snap.docs.map((d) => projetarCamposPublicosOS(d.data())) };
});

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

// Duplicado deliberado de CRM/shared/phone-utils.js::maskPhone — mesmo
// motivo de normalizePhoneDigitsServer acima (functions/ não importa
// arquivos de fora do próprio diretório).
function maskPhoneServer(digits) {
  const d = String(digits == null ? '' : digits).replace(/\D/g, '').slice(0, 11);
  if (d.length > 10) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length > 0) return `(${d}`;
  return d;
}

function validarPhoneDigitsServer(input) {
  const digits = normalizePhoneDigitsServer(input);
  if (digits.length < 10) {
    throw new HttpsError('invalid-argument', 'Informe um telefone válido.');
  }
  return digits;
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
  const digits = validarPhoneDigitsServer(request.data && request.data.phoneDigits);
  const db = admin.firestore();
  const snap = await db.collection('clientes').doc(digits).get();
  return { name: snap.exists ? (snap.data().name || '') : '' };
});

// ---- Mensagens ----

exports.portalListarMensagens = onCall({ region: REGIAO }, async (request) => {
  const digits = validarPhoneDigitsServer(request.data && request.data.phoneDigits);
  const db = admin.firestore();
  // Sem orderBy na query (achado da homologação em DEV: o único índice
  // composto que existe de fato em mensagens_portal é telefone+createdAt,
  // não telefoneDigits+createdAt — where+orderBy em campos diferentes
  // sem o índice certo falha. Ordena no servidor, mesmo padrão usado em
  // portalListarAvaliacoes/portalListarAgendamentos abaixo, para não
  // depender de criar/esperar build de um índice novo).
  const snap = await db.collection('mensagens_portal')
    .where('telefoneDigits', '==', digits)
    .get();
  const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  lista.sort((a, b) => {
    const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });
  return { lista };
});

exports.portalEnviarMensagem = onCall({ region: REGIAO }, async (request) => {
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
  const digits = validarPhoneDigitsServer(request.data && request.data.phoneDigits);
  const msgId = request.data && request.data.msgId;
  if (!msgId || typeof msgId !== 'string' || msgId.length > 200) {
    throw new HttpsError('invalid-argument', 'Informe o id da mensagem.');
  }

  const db = admin.firestore();
  const ref = db.collection('mensagens_portal').doc(msgId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Mensagem não encontrada.');
  if (snap.data().telefoneDigits !== digits) {
    throw new HttpsError('permission-denied', 'Esta mensagem não pertence a este telefone.');
  }
  await ref.update({ lida: true });
  return { ok: true };
});

// ---- Avaliações ----

exports.portalListarAvaliacoes = onCall({ region: REGIAO }, async (request) => {
  const digits = validarPhoneDigitsServer(request.data && request.data.phoneDigits);
  const db = admin.firestore();
  const snap = await db.collection('avaliacoes').where('telefoneDigits', '==', digits).get();
  const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Ordena no servidor (sem orderBy na query) para não depender de um
  // índice composto extra — coleção pequena por telefone, custo desprezível.
  lista.sort((a, b) => {
    const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });
  return { lista };
});

exports.portalCriarAvaliacao = onCall({ region: REGIAO }, async (request) => {
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
  const digits = validarPhoneDigitsServer(request.data && request.data.phoneDigits);
  const db = admin.firestore();
  const snap = await db.collection('agendamentos').where('telefoneDigits', '==', digits).get();
  const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  lista.sort((a, b) => {
    const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
    const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
    return tb - ta;
  });
  return { lista };
});

exports.portalCriarAgendamento = onCall({ region: REGIAO }, async (request) => {
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
  await db.collection('agendamentos').add({
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
  const dataAgendamento = String((request.data && request.data.data) || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAgendamento)) {
    throw new HttpsError('invalid-argument', 'Data inválida.');
  }
  const db = admin.firestore();
  const snap = await db.collection('agendamentos')
    .where('data', '==', dataAgendamento)
    .where('status', 'in', ['confirmado', 'aguardando'])
    .get();
  const ocupados = snap.docs
    .map((d) => d.data().horario)
    .filter(Boolean)
    .map((h) => String(h).slice(0, 5));
  return { ocupados };
});

// ---- Solicitação de diagnóstico ----

exports.portalCriarSolicitacaoDiagnostico = onCall({ region: REGIAO }, async (request) => {
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

  if (osData.phoneDigits !== digits) {
    throw new HttpsError('permission-denied', 'Este telefone não corresponde a esta OS.');
  }
  if (osData.status !== 'orcamento_enviado' && osData.status !== 'orcamento') {
    throw new HttpsError('failed-precondition', 'Este orçamento já foi respondido.');
  }

  const now = new Date();
  const dataResp = now.toLocaleDateString('pt-BR');
  const horaResp = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
