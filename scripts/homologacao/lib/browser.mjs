// Fase 3 — Homologação em navegador real (Chrome headless via puppeteer-core).
// Só lê dados do projeto Firebase DEV (nunca produção — env-config.js resolve
// localhost/file:// para cellcity-crm-dev) e só autentica com a conta padrão de
// homologação (nunca a senha de uma pessoa). Não altera nenhum arquivo do app.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync as readFileSyncFs } from 'node:fs';
import { join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function waitForServer(url, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return true;
    } catch { /* ainda subindo */ }
    await wait(300);
  }
  throw new Error(`Servidor local não respondeu em ${timeoutMs}ms: ${url}`);
}

function startStaticServer(cwd, port) {
  const bin = join(cwd, 'node_modules/.bin/http-server');
  const child = spawn(bin, ['-p', String(port), '-c-1', '.'], { cwd, stdio: 'ignore' });
  return child;
}

export async function runBrowserHomologation({
  cwd = process.cwd(),
  evidenceDir,
  baseUrl = `http://localhost:${process.env.HOMOLOG_SERVE_PORT || 8899}`,
  port = Number(process.env.HOMOLOG_SERVE_PORT || 8899),
  saKeyPath = process.env.HOMOLOG_SA_KEY_PATH || join(cwd, 'sa-key-dev.json'),
  firebaseProject = process.env.HOMOLOG_FIREBASE_PROJECT || 'cellcity-crm-dev',
  testEmail = process.env.HOMOLOG_TEST_EMAIL || 'cellcityadmin@gmail.com',
  chromePath = process.env.HOMOLOG_CHROME_PATH || '/usr/bin/google-chrome',
  skip = process.env.HOMOLOG_SKIP_BROWSER === '1',
} = {}) {
  const screenshotsDir = join(evidenceDir, 'screenshots');
  const consoleDir = join(evidenceDir, 'console');
  const networkDir = join(evidenceDir, 'network');
  mkdirSync(screenshotsDir, { recursive: true });
  mkdirSync(consoleDir, { recursive: true });
  mkdirSync(networkDir, { recursive: true });

  if (skip) {
    return { skipped: true, reason: 'HOMOLOG_SKIP_BROWSER=1 — fase de navegador pulada explicitamente' };
  }

  const result = {
    skipped: false,
    baseUrl,
    firebaseProject,
    testEmail,
    login: null,
    dashboard: null,
    centralAlertas: null,
    cache: null,
    multiTab: null,
    screenshots: [],
    errors: [],
  };

  // ---- login: resolve UID pelo e-mail e confirma doc real antes de gerar token ----
  let uid, token;
  try {
    const sa = JSON.parse(readFileSyncFs(saKeyPath, 'utf8'));
    initializeApp({ credential: cert(sa), projectId: firebaseProject });
    const authUser = await getAuth().getUserByEmail(testEmail);
    uid = authUser.uid;
    const doc = await getFirestore().collection('usuarios').doc(uid).get();
    if (!doc.exists) throw new Error(`usuarios/${uid} não existe em ${firebaseProject} — não usar este UID (ver feedback-uid-dev-prod-nao-reusar)`);
    token = await getAuth().createCustomToken(uid);
    result.login = { ok: true, uid, email: testEmail, perfil: doc.data().perfil };
  } catch (e) {
    result.login = { ok: false, error: e.message };
    result.errors.push(`login: ${e.message}`);
    return result; // sem login não dá pra continuar
  }

  // ---- servidor estático local ----
  const server = startStaticServer(cwd, port);
  try {
    await waitForServer(`${baseUrl}/CRM/login.html`);
  } catch (e) {
    result.errors.push(`servidor local: ${e.message}`);
    server.kill();
    return result;
  }

  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  function attach(page, label) {
    const consoleLines = [];
    const networkLines = [];
    page.on('console', m => consoleLines.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', e => consoleLines.push(`[PAGEERROR] ${e.message}`));
    page.on('requestfailed', r => networkLines.push(`[FAILED] ${r.url()} — ${r.failure()?.errorText}`));
    page.on('request', r => { if (/firestore\.googleapis\.com/.test(r.url())) networkLines.push(`[firestore] ${r.method()} ${r.url().slice(0, 120)}`); });
    return {
      flush() {
        writeFileSync(join(consoleDir, `${label}.log`), consoleLines.join('\n'));
        writeFileSync(join(networkDir, `${label}.log`), networkLines.join('\n'));
        // só conta exceção real não tratada ([PAGEERROR]) ou console.error
        // explícito ([error]) — não conta warnings/logs que só mencionam a
        // palavra "erro" (ex.: "Nenhum alarme", "NotAllowedError" de Periodic
        // Sync em headless, ambos benignos e pré-existentes).
        return { consoleErrors: consoleLines.filter(l => /^\[PAGEERROR\]|^\[error\]/.test(l)).length, firestoreRequests: networkLines.filter(l => l.startsWith('[firestore]')).length };
      },
    };
  }

  async function screenshot(page, name) {
    const file = join(screenshotsDir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    result.screenshots.push(file);
  }

  try {
    // ---- login real via custom token ----
    const page = await browser.newPage();
    const tap = attach(page, '01-login');
    await page.goto(`${baseUrl}/CRM/login.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await screenshot(page, '01-login');
    const loginEval = await page.evaluate(async (tok) => {
      try {
        const [{ auth }, { signInWithCustomToken }] = await Promise.all([
          import('/CRM/scripts/firebase.js'),
          import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js'),
        ]);
        const cred = await signInWithCustomToken(auth, tok);
        return { ok: true, uid: cred.user.uid };
      } catch (e) { return { ok: false, error: e.message }; }
    }, token);
    tap.flush();
    if (!loginEval.ok) { result.errors.push(`signInWithCustomToken: ${loginEval.error}`); throw new Error('login falhou no navegador'); }

    // ---- Dashboard ----
    const t0 = Date.now();
    await page.goto(`${baseUrl}/CRM/pages/dashboard/index.html`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    const loadMs = Date.now() - t0;
    await wait(1500);
    await screenshot(page, '02-dashboard');
    const dashTap = attach(page, '02-dashboard');
    await wait(4000);
    const dashStats = dashTap.flush();
    result.dashboard = { ok: true, loadMs, url: page.url(), ...dashStats };

    // ---- Central de Alertas ----
    const page2 = await browser.newPage();
    const alertasTap = attach(page2, '03-central-alertas');
    await page2.goto(`${baseUrl}/CRM/pages/central-alertas/index.html`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await wait(1500);
    await screenshot(page2, '03-central-alertas');
    const hiddenTest = await page2.evaluate(async () => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(r => setTimeout(r, 200));
      const whenHidden = document.hidden;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(r => setTimeout(r, 200));
      const whenVisible = document.hidden;
      return { whenHidden, whenVisible };
    });
    const alertasStats = alertasTap.flush();
    result.centralAlertas = {
      ok: hiddenTest.whenHidden === true && hiddenTest.whenVisible === false,
      url: page2.url(),
      hiddenTest,
      ...alertasStats,
      nota: 'document.hidden/visibilitychange testados via override real do DOM. Supressão do polling durante os 300s/600s NÃO é medida aqui (janela longa demais para rodar em toda execução) — ver teste isolado de padrão em tests/performance/polling-gating.test.mjs.',
    };

    // ---- Cache / offline (leitura de um documento real: o próprio usuário logado) ----
    await wait(1000);
    const onlineRead = await page2.evaluate(async (u) => {
      const { db, doc, getDoc } = await import('/CRM/scripts/firebase.js');
      const snap = await getDoc(doc(db, 'usuarios', u));
      return { exists: snap.exists(), source: snap.metadata.fromCache ? 'cache' : 'servidor' };
    }, uid);

    // Offline precisa valer para TODAS as abas abertas (page e page2) — o
    // persistentMultipleTabManager pode rotear a conexão real do Firestore
    // pela aba "primária"; deixar só uma aba offline via CDP não simula uma
    // desconexão de rede de verdade (achado desta própria automação: com só
    // page2 offline, a leitura ainda ia a servidor através de page).
    const allTargets = [page, page2];
    const clients = await Promise.all(allTargets.map(p => p.target().createCDPSession()));
    for (const c of clients) {
      await c.send('Network.enable');
      await c.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    }
    await wait(3000); // dá tempo do SDK detectar a desconexão
    const offlineRead = await page2.evaluate(async (u) => {
      const { db, doc, getDoc } = await import('/CRM/scripts/firebase.js');
      try {
        const snap = await getDoc(doc(db, 'usuarios', u));
        return { ok: true, exists: snap.exists(), source: snap.metadata.fromCache ? 'cache' : 'servidor' };
      } catch (e) { return { ok: false, error: e.code || e.message }; }
    }, uid);
    for (const c of clients) {
      await c.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    }
    await wait(1000);
    const reconnectRead = await page2.evaluate(async (u) => {
      const { db, doc, getDoc } = await import('/CRM/scripts/firebase.js');
      const snap = await getDoc(doc(db, 'usuarios', u));
      return { exists: snap.exists(), source: snap.metadata.fromCache ? 'cache' : 'servidor' };
    }, uid);
    await screenshot(page2, '04-cache-offline-reconnect');
    result.cache = {
      // exige source==='cache' de propósito: sem essa checagem, uma leitura
      // que "deu certo" mas na verdade escapou pela rede (ex.: offline mal
      // aplicado) passaria como aprovada sem provar persistência nenhuma.
      ok: onlineRead.exists && offlineRead.ok === true && offlineRead.exists && offlineRead.source === 'cache' && reconnectRead.exists,
      onlineRead, offlineRead, reconnectRead,
    };

    // ---- Multiaba ----
    const page3 = await browser.newPage();
    const tab2Tap = attach(page3, '05-dashboard-aba2');
    await page3.goto(`${baseUrl}/CRM/pages/dashboard/index.html`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await wait(2000);
    await screenshot(page3, '05-dashboard-aba2');
    const tab2Stats = tab2Tap.flush();
    const readLog = (name) => { try { return readFileSyncFs(join(consoleDir, name), 'utf8'); } catch { return ''; } };
    const failedPrecondition = /failed-precondition/i.test(readLog('02-dashboard.log') + readLog('05-dashboard-aba2.log'));
    result.multiTab = { ok: !failedPrecondition, failedPrecondition, ...tab2Stats };

  } catch (e) {
    result.errors.push(e.stack || e.message);
  } finally {
    await browser.close();
    server.kill();
  }

  return result;
}
