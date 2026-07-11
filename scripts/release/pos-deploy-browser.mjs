// Pós-Deploy (Release Center v2.0, opção 7 / parte da Certificação de Produção).
// Chrome headless via puppeteer-core, só páginas PÚBLICAS de produção — nunca
// tenta login (sem credencial nenhuma aqui, de propósito: CLAUDE.md §1 proíbe
// mexer em Login/Autenticação sem autorização, e nem seria seguro automatizar
// login real contra produção). Confirma que a página carrega e captura erros
// de console/pageerror.
//
// Saída: JSON em stdout. Exit 0 = sem erros críticos, 1 = achou erro(s),
// 2 = pulado (sem Chrome disponível).
import { existsSync } from 'node:fs';

const CHROME_PATH = process.env.HOMOLOG_CHROME_PATH || '/usr/bin/google-chrome';
const BASE = process.env.POS_DEPLOY_BASE_URL || 'https://cellcityinformatica.com.br';

const PAGINAS = [
  { label: 'home', url: `${BASE}/` },
  { label: 'login', url: `${BASE}/CRM/login.html` },
  { label: 'dashboard', url: `${BASE}/CRM/pages/dashboard/index.html` },
  { label: 'portal-cliente', url: `${BASE}/CRM/pages/portal-cliente/index.html` },
];

if (!existsSync(CHROME_PATH)) {
  console.log(JSON.stringify({ skipped: true, motivo: `Chrome não encontrado em ${CHROME_PATH}` }));
  process.exit(2);
}

const puppeteer = (await import('puppeteer-core')).default;
const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const resultado = [];
let temErroCritico = false;

try {
  for (const { label, url } of PAGINAS) {
    const page = await browser.newPage();
    const erros = [];
    page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
    page.on('pageerror', e => erros.push(e.message));
    let httpStatus = null;
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      httpStatus = resp ? resp.status() : null;
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      erros.push(`[NAVEGAÇÃO] ${e.message}`);
    }
    await page.close();
    if (erros.length > 0) temErroCritico = true;
    resultado.push({ label, url, httpStatus, erros });
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ skipped: false, paginas: resultado }, null, 2));
process.exit(temErroCritico ? 1 : 0);
