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
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { REGIAO } = require('./lib/config');
const { aplicarRateLimit } = require('./lib/rate-limit');

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
