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
