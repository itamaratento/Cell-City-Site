import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { accessSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const DIR = path.resolve(fileURLToPath(import.meta.url), '../../..');
let server, browser;

const PAGES = [
  { path: '/CRM/index.html',            name: 'Boot loader' },
  { path: '/CRM/login.html',            name: 'Login' },
  { path: '/CRM/pages/dashboard/index.html',   name: 'Dashboard' },
  { path: '/CRM/pages/os/index.html',           name: 'OS' },
  { path: '/CRM/pages/caixa/index.html',        name: 'Caixa' },
  { path: '/CRM/pages/portal-cliente/index.html', name: 'Portal Cliente' },
  { path: '/CRM/garantia.html',                  name: 'Garantia' },
];

before(async () => {
  server = spawn('node', [
    path.resolve(DIR, 'node_modules/http-server/bin/http-server'),
    DIR, '-p', '8099', '--silent'
  ], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 2000));

  // Sprint 0 FASE 1 (2026-07-16): `require` não existe em módulo ES — o
  // ReferenceError era engolido pelo catch e TODO caminho reportava falso
  // "Chrome not found" desde a criação deste teste (P1.6). accessSync via
  // import resolve; a suíte roda de verdade pela primeira vez.
  const chromePaths = ['/snap/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'];
  const chromePath = chromePaths.find(p => { try { accessSync(p); return true; } catch { return false; } });
  if (!chromePath) throw new Error('Chrome not found');

  browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--no-sandbox', '--headless=new', '--disable-gpu'],
  });
});

after(() => {
  if (browser) browser.close();
  if (server) server.kill();
});

for (const page of PAGES) {
  test(`E2E: ${page.name} carrega sem erros fatais`, async () => {
    const ctx = await browser.createBrowserContext();
    const tab = await ctx.newPage();
    const errors = [];
    tab.on('pageerror', e => errors.push(e.message));

    const resp = await tab.goto(`http://localhost:8099${page.path}`, {
      waitUntil: 'networkidle0', timeout: 15000
    });

    assert.ok(resp.ok(), `${page.path} deve responder 200 (recebeu ${resp.status()})`);
    assert.equal(errors.length, 0,
      `${page.path} não deve ter erros JS: ${errors.join('; ')}`);
    await ctx.close();
  });
}

test('E2E: Dashboard contém módulos do grid', async () => {
  const ctx = await browser.createBrowserContext();
  const tab = await ctx.newPage();
  await tab.goto('http://localhost:8099/CRM/pages/dashboard/index.html', {
    waitUntil: 'networkidle0', timeout: 15000
  });
  const moduleCards = await tab.$$('.module-card');
  assert.ok(moduleCards.length >= 5,
    `Dashboard deve ter >= 5 module-cards (encontrados: ${moduleCards.length})`);
  await ctx.close();
});

test('E2E: login.html tem formulário', async () => {
  const ctx = await browser.createBrowserContext();
  const tab = await ctx.newPage();
  await tab.goto('http://localhost:8099/CRM/login.html', {
    waitUntil: 'networkidle0', timeout: 15000
  });
  const emailInput = await tab.$('input[type="email"]');
  const submitBtn = await tab.$('button[type="submit"]');
  assert.ok(emailInput, 'login.html deve ter input de email');
  assert.ok(submitBtn, 'login.html deve ter botão de submit');
  await ctx.close();
});
