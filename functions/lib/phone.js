const { HttpsError } = require('firebase-functions/v2/https');

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

module.exports = { normalizePhoneDigitsServer, maskPhoneServer, validarPhoneDigitsServer };
