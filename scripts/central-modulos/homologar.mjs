#!/usr/bin/env node
/* ============================================================
   HOMOLOGAÇÃO — Central de Módulos V2 (Sprint MOD-V2-001)

   Sobe um servidor estático local, abre a página real no Chrome
   headless (puppeteer-core, mesmo binário da suíte
   homologar-performance) e valida o comportamento fim a fim:
   render do catálogo, métricas, busca global, filtros, health
   check, favoritos e logs.

   Únicos stubs: /CRM/scripts/firebase.js e /CRM/scripts/kernel.js
   (interceptados por URL — nenhum arquivo do repo é alterado),
   para a página não depender de rede/credenciais do Firebase.
   Todo o resto (central-modulos.js, página, JSON gerado, dock,
   brand-header) roda com o código real.

   Uso: node scripts/central-modulos/homologar.mjs
   ============================================================ */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORTA = 8791;
const BASE = `http://127.0.0.1:${PORTA}`;
const CHROME = process.env.HOMOLOG_CHROME_PATH || '/usr/bin/google-chrome';
const PAGINA = `${BASE}/CRM/pages/central-modulos/index.html`;

const STUB_FIREBASE = `
export const db = {};
export const auth = {};
export const authReady = Promise.resolve(null);
export const getAuthUser = () => null;
export const getFirebaseStorage = () => ({});
export const setPersistence = async () => {};
export const browserLocalPersistence = {};
export const collection = (...a) => ({ _c: a.slice(1).join('/') });
export const addDoc = async () => ({ id: 'mock' });
export const getDocs = async () => ({ docs: [], forEach() {}, empty: true, size: 0 });
export const getDoc = async () => ({ exists: () => false, data: () => null });
export const doc = (...a) => ({ _d: a.slice(1).join('/') });
export const setDoc = async (ref) => { (window.__setDocCalls = window.__setDocCalls || []).push(ref && ref._d); };
export const updateDoc = async () => {};
export const deleteDoc = async () => {};
export const query = (...a) => a;
export const orderBy = () => ({});
export const where = () => ({});
export const onSnapshot = (ref, cb) => { setTimeout(() => cb({ exists: () => false, data: () => null }), 0); return () => {}; };
export const runTransaction = async () => {};
export const serverTimestamp = () => new Date();
export const limit = () => ({});
`;

const STUB_KERNEL = `
const ctx = { uid: 'homolog-uid', nome: 'Homologação', email: 'homolog@test', perfil: 'admin', empresaId: 'homolog' };
export async function initModulo() { return ctx; }
export async function login() { return ctx; }
export async function logout() {}
export const getCtx = () => ctx;
export async function getCtxAsync() { return ctx; }
export const getUser = () => ctx;
export const getUid = () => ctx.uid;
export const getEmail = () => ctx.email;
export const getNome = () => ctx.nome;
export const getPerfil = () => ctx.perfil;
export function getEmpresaId() { return ctx.empresaId; }
export function temPermissao() { return true; }
export const AUTH_FLAG = 'cc_kernel_v1';
`;

let passou = 0, falhou = 0;
async function teste(nome, fn) {
  try { await fn(); console.log(`  ✅ ${nome}`); passou++; }
  catch (e) { console.error(`  ❌ ${nome}\n     ${e.message}`); falhou++; }
}
const esperar = (cond, msg) => { if (!cond) throw new Error(msg); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ── servidor estático ─────────────────────────────────────────
const servidor = spawn(process.execPath,
  [path.join(ROOT, 'node_modules', 'http-server', 'bin', 'http-server'), ROOT, '-p', String(PORTA), '-c-1', '--silent'],
  { stdio: 'ignore' });
for (let i = 0; i < 40; i++) {
  try { await fetch(BASE + '/CRM/shared/modulos.catalogo.json'); break; }
  catch { await dormir(250); }
}

let browser;
try {
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();

  const errosPagina = [];
  page.on('pageerror', (e) => errosPagina.push(String(e && e.message || e)));
  page.on('console', (msg) => { if (msg.type() === 'error') errosPagina.push(msg.text()); });

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url().split('?')[0];
    if (u.endsWith('/CRM/scripts/firebase.js')) return req.respond({ contentType: 'application/javascript', body: STUB_FIREBASE });
    if (u.endsWith('/CRM/scripts/kernel.js')) return req.respond({ contentType: 'application/javascript', body: STUB_KERNEL });
    req.continue();
  });

  await page.goto(PAGINA, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('#cm-grid .cm-card', { timeout: 10000 });

  const contarCards = () => page.$$eval('#cm-grid .cm-card', (els) => els.length);

  await teste('render inicial: 28 módulos visíveis no grid (chat oculto — TECHDOC §31)', async () =>
    esperar(await contarCards() === 28, `esperava 28 cards, achei ${await contarCards()}`));

  await teste('métricas renderizadas (total, status, score)', async () => {
    const txt = await page.$eval('#cm-metricas', (el) => el.textContent);
    esperar(txt.includes('28') && txt.includes('score médio'), `métricas incompletas: ${txt}`);
  });

  await teste('busca global por coleção Firestore (caixa_lancamentos)', async () => {
    await page.type('#cm-busca', 'caixa_lancamentos');
    await dormir(100);
    const n = await contarCards();
    const ids = await page.$$eval('#cm-grid .cm-card', (els) => els.map((e) => e.dataset.mid));
    esperar(n > 0 && ids.includes('analise'), `busca por coleção não achou 'analise' (achou: ${ids.join(',')})`);
  });

  await teste('busca global por dependência (phone-utils)', async () => {
    await page.$eval('#cm-busca', (el) => { el.value = ''; });
    await page.type('#cm-busca', 'phone-utils');
    await dormir(100);
    const ids = await page.$$eval('#cm-grid .cm-card', (els) => els.map((e) => e.dataset.mid));
    esperar(ids.includes('os') && ids.includes('crm-comercial'), `busca por dependência falhou (achou: ${ids.join(',')})`);
    await page.$eval('#cm-busca', (el) => { el.value = ''; el.dispatchEvent(new Event('input')); });
  });

  await teste('filtro por grupo Financeiro → 3 módulos', async () => {
    await page.select('#cm-f-grupo', 'Financeiro');
    await dormir(100);
    esperar(await contarCards() === 3, `esperava 3, achei ${await contarCards()}`);
    await page.select('#cm-f-grupo', '');
  });

  await teste('filtro por status 🟡 Atenção → 7 módulos', async () => {
    await page.select('#cm-f-status', 'atencao');
    await dormir(100);
    esperar(await contarCards() === 7, `esperava 7, achei ${await contarCards()}`);
    await page.select('#cm-f-status', '');
    await dormir(100);
  });

  await teste('ⓘ abre detalhes com health check e diagnósticos', async () => {
    await page.click('.cm-card[data-mid="os"] .cm-info');
    await dormir(150);
    const aberto = await page.$eval('#cm-det', (d) => d.open);
    const txt = await page.$eval('#cm-det-corpo', (el) => el.textContent);
    esperar(aberto && txt.includes('Health check') && txt.includes('Coleções'), 'modal de detalhes incompleto');
    await page.click('#cm-det-fechar');
  });

  await teste('favoritar grava localStorage e chama setDoc no caminho certo', async () => {
    await page.click('.cm-card[data-mid="os"] .cm-star');
    await dormir(200);
    const favs = await page.evaluate(() => JSON.parse(localStorage.getItem('cc_modulos_favs') || '[]'));
    const chamadas = await page.evaluate(() => window.__setDocCalls || []);
    esperar(favs.includes('os'), 'favorito não gravado no localStorage');
    esperar(chamadas.some((c) => c === 'usuarios/homolog-uid/preferencias/modulos'), `setDoc não chamado no caminho esperado (${chamadas.join(' | ')})`);
    const estrela = await page.$eval('.cm-card[data-mid="os"] .cm-star', (el) => el.classList.contains('on'));
    esperar(estrela, 'estrela não acendeu após favoritar');
  });

  await teste('chip ⭐ Favoritos filtra para o módulo favoritado', async () => {
    await page.click('#cm-f-fav');
    await dormir(100);
    const ids = await page.$$eval('#cm-grid .cm-card', (els) => els.map((e) => e.dataset.mid));
    esperar(ids.length === 1 && ids[0] === 'os', `filtro favoritos: ${ids.join(',')}`);
    await page.click('#cm-f-fav');
  });

  await teste('painel de logs registra eventos (catálogo, favorito)', async () => {
    await page.click('#cm-logs-btn');
    await dormir(150);
    const txt = await page.$eval('#cm-det-corpo', (el) => el.textContent);
    esperar(txt.includes('catalogo-carregado') && txt.includes('favorito'), 'log local sem os eventos esperados');
    await page.click('#cm-det-fechar');
  });

  await teste('sem erros de página/console durante toda a sessão', async () =>
    esperar(errosPagina.length === 0, `erros capturados:\n     ${errosPagina.join('\n     ')}`));

  const shot = process.env.HOMOLOG_SCREENSHOT;
  if (shot) { await page.screenshot({ path: shot, fullPage: true }); console.log(`  📸 evidência: ${shot}`); }
} finally {
  if (browser) await browser.close();
  servidor.kill();
}

console.log(`\n${falhou === 0 ? '✅ HOMOLOGADO' : '❌ REPROVADO'} — ${passou} passou / ${falhou} falhou`);
process.exit(falhou === 0 ? 0 : 1);
