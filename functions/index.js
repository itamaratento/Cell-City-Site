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

   Rate limiting (P0 2026-07-15): 15/16 funções são públicas (apenas
   phoneDigits como prova de identidade). O rate limiter abaixo reduz
   o risco de abuso automatizado — sem depender de SMS OTP ou outro
   fator externo. App Check completo exigiria SDK no frontend e está
   documentado como melhoria futura (P1).
   ============================================================ */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

const REGIAO = 'southamerica-east1'; // mesma região do Firestore (ver firebase.json)

// ============================================================
// RATE LIMITER — in-memory sliding window
// ============================================================
// Em runtime serverless (Cloud Functions), cada instância tem sua
// própria memória. Isto não é um rate limiter distribuído — na
// prática, requisições simultâneas podem ser distribuídas entre
// instâncias diferentes. Ainda assim, eleva o custo do abusador
// (cada nova instância precisa aquecer o cache) e bloqueia surtos
// dentro de uma mesma instância.
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minuto

function rateLimitKey(tipo, valor) {
  return `${tipo}:${valor}`;
}

function rateLimitCheck(tipo, valor, maxRequests) {
  if (!valor) return; // sem chave = sem rate limit (não deve ocorrer)
  const key = rateLimitKey(tipo, valor);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = [];
    rateLimitStore.set(key, entry);
  }

  // Remove timestamps fora da janela
  while (entry.length > 0 && entry[0] < windowStart) {
    entry.shift();
  }

  if (entry.length >= maxRequests) {
    const retryAfter = Math.ceil((entry[0] + RATE_LIMIT_WINDOW_MS - now) / 1000);
    throw new HttpsError('resource-exhausted',
      `Muitas requisições. Aguarde ${retryAfter}s antes de tentar novamente.`);
  }

  entry.push(now);

  // Limpeza periódica: a cada 100 chaves, varre o Map inteiro
  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore) {
      while (v.length > 0 && v[0] < windowStart) v.shift();
      if (v.length === 0) rateLimitStore.delete(k);
    }
  }
}

// Limites por operação
const LIMITES = {
  leitura:   { ip: 60, telefone: 30 },   // consultas
  escrita:  { ip: 20, telefone: 10 },   // criar/responder
  evento:   { ip: 30, telefone: 15 },   // tracking só aceita 3 tipos
};

function aplicarRateLimit(request, tipoOperacao) {
  // IP do caller (pode ser IPv4 ou IPv6)
  const ip = request.rawRequest?.ip
    || request.rawRequest?.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || 'unknown';

  const limites = LIMITES[tipoOperacao] || LIMITES.leitura;

  rateLimitCheck('ip', ip, limites.ip);

  // Se a requisição tem phoneDigits, aplica limite também por telefone
  const phoneDigits = request.data && request.data.phoneDigits;
  if (phoneDigits && typeof phoneDigits === 'string' && phoneDigits.length >= 10) {
    rateLimitCheck('tel', phoneDigits, limites.telefone);
  }
}

// PS-6 (multiempresa): toda CF pública recebe um empresaId opcional no
// payload (injetado centralmente pelo Portal — ver index.html do Portal).
// Default 'cellcity-master' preserva 100% dos consumidores atuais
// (garantia.html, consultar-os.html, Portal sem ?empresa=).
const EMPRESA_PADRAO = 'cellcity-master';
function empresaIdDe(data) {
  const e = String((data && data.empresaId) || EMPRESA_PADRAO);
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(e)) {
    throw new HttpsError('invalid-argument', 'Empresa inválida.');
  }
  return e;
}
// Durante a transição (dados de produção ainda sem backfill), um doc
// legado sem empresa_id é tratado como da empresa padrão.
function docDaEmpresa(docData, empresaId) {
  return (docData.empresa_id || EMPRESA_PADRAO) === empresaId;
}

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

  // PS-6 (multiempresa): admin só exclui usuários da PRÓPRIA empresa;
  // apenas master_admin (operador da plataforma) atravessa empresas.
  const callerEmpresa = (callerSnap.data() || {}).empresa_id || EMPRESA_PADRAO;
  const targetEmpresa = targetData.empresa_id || EMPRESA_PADRAO;
  if (callerPerfil !== 'master_admin' && callerEmpresa !== targetEmpresa) {
    throw new HttpsError('permission-denied', 'Este usuário pertence a outra empresa.');
  }

  // Mesma guarda do último administrador já aplicada no client
  // (usuarios-permissoes.js::bloqueadoPorProtecaoAdmin) — replicada aqui
  // porque o client não pode mais ser a única linha de defesa: esta
  // function roda com Admin SDK e ignora as Firestore Rules.
  if (targetData.perfil === 'admin' || targetData.perfil === 'master_admin') {
    // PS-6: a guarda do último admin passa a ser POR EMPRESA.
    const admins = await db.collection('usuarios')
      .where('empresa_id', '==', targetEmpresa)
      .where('perfil', 'in', ['admin', 'master_admin']).get();
    if (admins.size <= 1) {
      throw new HttpsError('failed-precondition', 'Não é possível excluir o último administrador da empresa.');
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
    empresa_id: targetEmpresa,
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
  'id', 'clientName', 'phone', 'phoneDigits', 'cpf', 'model', 'category', 'defect', 'status',
  'createdAt', 'updatedAt', 'deliveredAt', 'technician', 'garantiaId', 'prazoGarantia',
  'valor', 'valorCartao', 'observations', 'timeline',
  'orcamentoResposta', 'orcamentoDataResposta', 'orcamentoHoraResposta',
];
// `phoneDigits` já é derivável de `phone` (ambos públicos, mesmo dado em dois
// formatos) — expor o campo canônico direto evita que consumidores públicos
// (consultar-os.html) precisem reconstruir os dígitos via regex a partir do
// `phone` formatado, o que quebra silenciosamente para qualquer OS onde os
// dois campos não fiquem 100% consistentes (achado da homologação do Lote 2).

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
  aplicarRateLimit(request, 'leitura');
  const osId = request.data && request.data.osId;
  if (!osId || typeof osId !== 'string' || osId.length > 30) {
    throw new HttpsError('invalid-argument', 'Informe o número da OS.');
  }

  const empresaId = empresaIdDe(request.data);
  const db = admin.firestore();
  const snap = await db.collection('os').doc(osId).get();
  // Empresa errada responde igual a inexistente — não vaza a existência
  // de OS de outra empresa.
  if (!snap.exists || !docDaEmpresa(snap.data(), empresaId)) {
    throw new HttpsError('not-found', 'OS não encontrada.');
  }

  return { os: projetarCamposPublicosOS(snap.data()) };
});

exports.consultarOSPorTelefonePublica = onCall({ region: REGIAO }, async (request) => {
  aplicarRateLimit(request, 'leitura');
  const digits = normalizePhoneDigitsServer(request.data && request.data.phoneDigits);
  if (digits.length < 10) {
    throw new HttpsError('invalid-argument', 'Informe um telefone válido.');
  }

  const empresaId = empresaIdDe(request.data);
  const db = admin.firestore();
  // Filtro de empresa aplicado pós-query (não na query) de propósito:
  // em produção o backfill de empresa_id ainda não rodou e um
  // where('empresa_id'==) esconderia todas as OS legadas.
  const snap = await db.collection('os').where('phoneDigits', '==', digits).limit(50).get();

  return {
    lista: snap.docs
      .filter((d) => docDaEmpresa(d.data(), empresaId))
      .map((d) => projetarCamposPublicosOS(d.data())),
  };
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
  await db.collection('agendamentos').add({
    empresa_id: empresaIdDe(data),
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

/* ============================================================
   SAAS — ONBOARDING SELF-SERVICE (PS-6)

   A página CRM/pages/saas-onboarding/ escrevia direto em `empresas`
   e `saas_eventos` via client SDK sem nenhuma autenticação — as Rules
   (write master_admin / create com tenant) bloqueiam isso por design.
   Esta function é o único caminho público de cadastro de empresa.

   Decisões:
   - A empresa nasce com status 'pendente_aprovacao' — nada é liberado
     automaticamente; o operador (master_admin) aprova no saas-admin.
   - dados_migrados: true — empresa nova não tem dado legado, então os
     filtros tenant do client ficam ativos desde o primeiro login.
   - Nenhuma conta de usuário é criada aqui: o vínculo usuário↔empresa
     é feito pelo operador na aprovação (evita signup público virar
     vetor de spam de contas Auth).
   ============================================================ */
exports.saasOnboardingCriarEmpresa = onCall({ region: REGIAO }, async (request) => {
  aplicarRateLimit(request, 'escrita');
  const data = request.data || {};
  const nome = String(data.nome || '').trim();
  const responsavel = String(data.seuNome || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const whatsapp = String(data.whatsapp || '').trim().slice(0, 20);
  const PLANOS_VALIDOS = ['trial', 'basico', 'profissional', 'enterprise'];
  const plano = PLANOS_VALIDOS.includes(data.plano) ? data.plano : 'trial';

  if (nome.length < 2 || nome.length > 80) {
    throw new HttpsError('invalid-argument', 'Informe o nome da empresa (2 a 80 caracteres).');
  }
  if (!responsavel || responsavel.length > 80) {
    throw new HttpsError('invalid-argument', 'Informe o nome do responsável.');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) {
    throw new HttpsError('invalid-argument', 'Informe um e-mail válido.');
  }

  const db = admin.firestore();

  // Dedup pelo e-mail de contato — barreira simples contra re-submissão.
  const dup = await db.collection('empresas').where('contato_email', '==', email).limit(1).get();
  if (!dup.empty) {
    throw new HttpsError('already-exists', 'Já existe um cadastro com este e-mail. Fale com o suporte.');
  }

  const empresaId = 'emp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const agora = admin.firestore.FieldValue.serverTimestamp();

  await db.collection('empresas').doc(empresaId).set({
    nome_fantasia: nome,
    razao_social: nome,
    plano,
    status: 'pendente_aprovacao',
    dados_migrados: true,
    data_criacao: agora,
    data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    contato_nome: responsavel,
    contato_email: email,
    contato_whatsapp: whatsapp,
    modulos_ativos: null,
  });

  await db.collection('saas_eventos').doc(`onboard_${empresaId}`).set({
    tipo: 'onboarding',
    empresa_id: empresaId,
    detalhes: { nome, responsavel, email, whatsapp, plano },
    criadoEm: agora,
  });

  return { ok: true, empresaId };
});
