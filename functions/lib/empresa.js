const { HttpsError } = require('firebase-functions/v2/https');

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

module.exports = { EMPRESA_PADRAO, empresaIdDe, docDaEmpresa };
