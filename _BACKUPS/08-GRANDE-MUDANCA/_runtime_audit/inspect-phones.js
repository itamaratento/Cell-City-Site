const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const cfg = {
  apiKey: "AIzaSyD5wQRvcVdweOhVqwd8e08JuzRXOESEbqE",
  authDomain: "cellcity-crm.firebaseapp.com",
  projectId: "cellcity-crm",
  storageBucket: "cellcity-crm.firebasestorage.app",
  messagingSenderId: "645609867368",
  appId: "1:645609867368:web:b3ee19ccfe3d17c61c53dd"
};

const app = initializeApp(cfg);
const db = getFirestore(app);

// Classifica o formato do telefone
function fmt(v) {
  if (v == null) return 'NULO/ausente';
  const s = String(v);
  if (/^\(\d{2}\)\s\d{5}-\d{4}$/.test(s)) return 'mascarado-11 "(NN) NNNNN-NNNN"';
  if (/^\(\d{2}\)\s\d{4}-\d{4}$/.test(s)) return 'mascarado-10 "(NN) NNNN-NNNN"';
  if (/^\d{11}$/.test(s)) return 'raw-11 (so digitos)';
  if (/^\d{10}$/.test(s)) return 'raw-10 (so digitos)';
  if (/\s/.test(s) && /[()\-]/.test(s)) return 'outro-com-mascara';
  return 'outro: ' + JSON.stringify(s.slice(0, 16));
}
const digits = v => String(v == null ? '' : v).replace(/\D/g, '');

(async () => {
  const out = {};
  const osSnap = await getDocs(collection(db, 'os'));
  const clSnap = await getDocs(collection(db, 'clientes'));

  const osFmt = {}, clFmt = {};
  const osByMasked = {};   // telefone exato (string) -> count nas OS
  const osByDigits = {};   // só dígitos -> count nas OS
  const osPhonesRaw = [];

  osSnap.forEach(d => {
    const p = d.data().phone;
    osFmt[fmt(p)] = (osFmt[fmt(p)] || 0) + 1;
    osByMasked[String(p)] = (osByMasked[String(p)] || 0) + 1;
    const dg = digits(p);
    if (dg) osByDigits[dg] = (osByDigits[dg] || 0) + 1;
    if (osPhonesRaw.length < 6) osPhonesRaw.push(p);
  });

  const clientes = [];
  clSnap.forEach(d => {
    const c = d.data();
    clFmt[fmt(c.phone)] = (clFmt[fmt(c.phone)] || 0) + 1;
    clientes.push({ phone: c.phone, name: c.name, history: Array.isArray(c.history) ? c.history.length : 0 });
  });

  // Para cada cliente, verifica casamento por máscara exata vs por dígitos
  let casaExato = 0, casaSoDigitos = 0, naoCasa = 0;
  const exemplosDivergencia = [];
  const exemplosOK = [];
  clientes.forEach(c => {
    const exato = osByMasked[String(c.phone)] || 0;
    const porDig = osByDigits[digits(c.phone)] || 0;
    if (exato > 0) { casaExato++; if (exemplosOK.length < 3) exemplosOK.push({ name: c.name, phone: c.phone, osExato: exato }); }
    else if (porDig > 0) {
      casaSoDigitos++;
      if (exemplosDivergencia.length < 5) {
        // descobre o formato como está gravado na OS
        let formaNaOS = null;
        for (const k in osByMasked) { if (digits(k) === digits(c.phone)) { formaNaOS = k; break; } }
        exemplosDivergencia.push({ name: c.name, clientePhone: c.phone, formaNaOS, osPorDigitos: porDig });
      }
    } else { naoCasa++; }
  });

  out.totais = { os: osSnap.size, clientes: clSnap.size };
  out.formatos_OS = osFmt;
  out.formatos_clientes = clFmt;
  out.casamento_cliente_x_os = {
    casaPorMascaraExata: casaExato,
    casaApenasPorDigitos_DIVERGENCIA: casaSoDigitos,
    semNenhumaOS: naoCasa
  };
  out.exemplos_divergencia = exemplosDivergencia;
  out.exemplos_ok = exemplosOK;
  out.amostra_phones_OS = osPhonesRaw;

  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
})().catch(e => { console.error('ERRO:', e.message || e); process.exit(1); });
