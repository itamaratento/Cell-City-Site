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
   phoneDigits como prova de identidade). O rate limiter em lib/rate-limit.js
   reduz o risco de abuso automatizado — sem depender de SMS OTP ou outro
   fator externo. App Check completo exigiria SDK no frontend e está
   documentado como melhoria futura (P1).

   P2.1 (2026-07-16): módulo único de 807 linhas quebrado por domínio —
   admin.js, os.js, portal.js, saas.js, com helpers compartilhados em
   lib/. Este arquivo passa a ser só o ponto de entrada: inicializa o
   Admin SDK uma única vez e reexporta cada function pelo nome (reexport
   explícito, não spread, para que `import * as fns from './index.js'`
   em tests/functions/ continue enxergando cada export estaticamente).
   ============================================================ */
const admin = require('firebase-admin');

admin.initializeApp();

const adminFns = require('./admin');
const osFns = require('./os');
const portalFns = require('./portal');
const saasFns = require('./saas');

exports.excluirUsuarioAdmin = adminFns.excluirUsuarioAdmin;

exports.consultarOSPublica = osFns.consultarOSPublica;
exports.consultarOSPorTelefonePublica = osFns.consultarOSPorTelefonePublica;

exports.portalObterNomeCliente = portalFns.portalObterNomeCliente;
exports.portalListarMensagens = portalFns.portalListarMensagens;
exports.portalEnviarMensagem = portalFns.portalEnviarMensagem;
exports.portalMarcarMensagemLida = portalFns.portalMarcarMensagemLida;
exports.portalListarAvaliacoes = portalFns.portalListarAvaliacoes;
exports.portalCriarAvaliacao = portalFns.portalCriarAvaliacao;
exports.portalListarAgendamentos = portalFns.portalListarAgendamentos;
exports.portalCriarAgendamento = portalFns.portalCriarAgendamento;
exports.portalListarHorariosOcupados = portalFns.portalListarHorariosOcupados;
exports.portalCriarSolicitacaoDiagnostico = portalFns.portalCriarSolicitacaoDiagnostico;
exports.portalRegistrarEvento = portalFns.portalRegistrarEvento;
exports.portalResponderOrcamento = portalFns.portalResponderOrcamento;

exports.saasOnboardingCriarEmpresa = saasFns.saasOnboardingCriarEmpresa;
