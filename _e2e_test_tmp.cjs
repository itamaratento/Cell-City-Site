// Teste ponta-a-ponta (via firebase-admin) simulando exatamente os mesmos
// caminhos de código de os.js (saveOS/saveFullClient) e portal.js (doLogin/_listenOS),
// usando os.js e portal.js's shared/phone-utils.js. Cria docs de teste, valida, e apaga.
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const sa = require('./sa-key.json');
initializeApp({ credential: cert(sa), projectId: 'cellcity-crm' });
const db = getFirestore();

const TEST_OS_ID_10 = 'OS-TEST-10DIG';
const TEST_OS_ID_11 = 'OS-TEST-11DIG';

async function main() {
  const { normalizePhoneDigits, maskPhone, canonicalizePhone } = await import('file://' + __dirname + '/CRM/shared/phone-utils.js');

  let ok = true;
  const check = (label, cond) => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + label); if (!cond) ok = false; };

  // ===== CENÁRIO 1: telefone fixo de 10 dígitos (não deve ganhar 9º dígito) =====
  const fixo10 = '1633451122'; // DDD 16, local começa em "3" -> fixo, não mexe
  const { phone: phoneFixo, phoneDigits: digitsFixo } = canonicalizePhone(fixo10);
  check('10 dígitos fixo: mantém 10 dígitos', digitsFixo === '1633451122');
  check('10 dígitos fixo: máscara 4-4', phoneFixo === '(16) 3345-1122');

  await db.collection('os').doc(TEST_OS_ID_10).set({
    id: TEST_OS_ID_10, clientName: 'Teste Fixo 10 Dígitos', phone: phoneFixo, phoneDigits: digitsFixo,
    status: 'recebido', createdAt: new Date().toISOString(), empresa_id: 'cellcity-master'
  });
  // Simula a query do Portal (_listenOS / doLogin) para esse telefone
  const snap10 = await db.collection('os').where('phoneDigits', '==', digitsFixo).get();
  check('Portal encontra OS de telefone fixo (10 dígitos)', snap10.size === 1 && snap10.docs[0].id === TEST_OS_ID_10);

  // ===== CENÁRIO 2: celular de 10 dígitos SEM o 9º dígito (o bug original da OS-0095) =====
  const celularSemNove = '61971112222'.length; // (não usado, só pra clareza)
  const celular10 = '6171112222'; // 10 dígitos, local começa em "7" -> celular, deveria virar 11
  const { phone: phoneCel, phoneDigits: digitsCel } = canonicalizePhone(celular10);
  check('celular 10 dígitos: auto-insere o 9', digitsCel === '61971112222');
  check('celular 10 dígitos: máscara 5-4 após correção', phoneCel === '(61) 97111-2222');

  await db.collection('os').doc(TEST_OS_ID_11).set({
    id: TEST_OS_ID_11, clientName: 'Teste Celular Sem 9', phone: phoneCel, phoneDigits: digitsCel,
    status: 'recebido', createdAt: new Date().toISOString(), empresa_id: 'cellcity-master'
  });

  // Simula LOGIN no portal: cliente digita só os 10 dígitos que tinha (sem o 9)
  const digitsDigitadoLogin = normalizePhoneDigits(celular10); // mesma correção
  check('Login com 10 dígitos calcula o mesmo canônico', digitsDigitadoLogin === digitsCel);
  const snapLogin = await db.collection('os').where('phoneDigits', '==', digitsDigitadoLogin).get();
  check('Portal encontra a OS mesmo se o cliente digitar sem o 9º dígito', snapLogin.size === 1 && snapLogin.docs[0].id === TEST_OS_ID_11);

  // Simula LOGIN digitando com os 11 dígitos corretos também
  const digitsDigitado11 = normalizePhoneDigits('61971112222');
  const snapLogin11 = await db.collection('os').where('phoneDigits', '==', digitsDigitado11).get();
  check('Portal encontra a mesma OS digitando os 11 dígitos corretos', snapLogin11.size === 1 && snapLogin11.docs[0].id === TEST_OS_ID_11);

  // ===== CENÁRIO 3: mudança de status não mexe no telefone =====
  await db.collection('os').doc(TEST_OS_ID_11).update({ status: 'em_analise', updatedAt: new Date().toISOString() });
  const posStatus = await db.collection('os').doc(TEST_OS_ID_11).get();
  check('Mudança de status preserva phone/phoneDigits', posStatus.data().phone === phoneCel && posStatus.data().phoneDigits === digitsCel && posStatus.data().status === 'em_analise');

  // ===== LIMPEZA =====
  await db.collection('os').doc(TEST_OS_ID_10).delete();
  await db.collection('os').doc(TEST_OS_ID_11).delete();
  console.log('\nDocs de teste removidos.');

  console.log(ok ? '\nTODOS OS CENÁRIOS PASSARAM' : '\nALGUM CENÁRIO FALHOU');
  process.exit(ok ? 0 : 1);
}
main().catch(e => { console.error('ERRO NO TESTE:', e); process.exit(1); });
