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
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { REGIAO } = require('./lib/config');
const { aplicarRateLimit } = require('./lib/rate-limit');
const { empresaIdDe, docDaEmpresa } = require('./lib/empresa');
const { normalizePhoneDigitsServer } = require('./lib/phone');

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
