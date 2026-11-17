/* ============================================================
   CÓDIGO DE ACESSO DO PORTAL DO CLIENTE

   Segundo fator além do telefone:
   - Se a OS tiver CPF → 4 últimos dígitos do CPF
   - Senão → portalAccessCode (4 dígitos gerados na criação da OS)

   Nunca expor CPF completo nem portalAccessCode na projeção pública
   de OS (ver functions/os.js::OS_CAMPOS_PUBLICOS).
   ============================================================ */

function normalizarCodigoAcesso(input) {
  return String(input == null ? '' : input).replace(/\D/g, '').slice(0, 4);
}

/** Código esperado para autenticar nesta OS (preferência: CPF). */
function codigoAcessoEsperado(os) {
  if (!os || typeof os !== 'object') return '';
  const cpfDigits = String(os.cpf || '').replace(/\D/g, '');
  if (cpfDigits.length >= 4) return cpfDigits.slice(-4);
  return normalizarCodigoAcesso(os.portalAccessCode);
}

function verificarCodigoAcessoOS(os, codigoInformado) {
  const informado = normalizarCodigoAcesso(codigoInformado);
  if (informado.length !== 4) return false;
  const esperado = codigoAcessoEsperado(os);
  return esperado.length === 4 && esperado === informado;
}

/**
 * Telefone autenticado se QUALQUER OS daquele telefone aceitar o código.
 * (Um cliente pode ter várias OS; o segundo fator prova a posse.)
 */
function algumaOSAceitaCodigo(listaOS, codigoInformado) {
  return (listaOS || []).some((os) => verificarCodigoAcessoOS(os, codigoInformado));
}

module.exports = {
  normalizarCodigoAcesso,
  codigoAcessoEsperado,
  verificarCodigoAcessoOS,
  algumaOSAceitaCodigo,
};
