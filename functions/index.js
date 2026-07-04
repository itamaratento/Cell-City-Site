/* ============================================================
   CLOUD FUNCTIONS — Cell City CRM

   Só existe aqui o que precisa mesmo de Admin SDK (o client SDK não
   consegue fazer sem impersonar a conta-alvo). Hoje: excluirUsuarioAdmin.

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
