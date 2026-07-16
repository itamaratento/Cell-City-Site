// ══════════════════════════════════════════════════════════════════════
// Testes do Kernel (Sprint 1 — Kernel SaaS, Fase 1.3: consolidação)
//
// Importa o CÓDIGO REAL de CRM/scripts/kernel.js (sem cópia, via
// tests/kernel/loader.mjs) e dirige manualmente o único listener de
// autenticação (`onAuthStateChanged`) através do mock em
// tests/kernel/mocks/firebase-auth-mock.js. Cobre:
//   - boot/inicialização (initModulo, _ready, timeout de sessão)
//   - autenticação (login/logout, sessão anônima)
//   - carregamento de sessão/tenant (contexto: uid/email/nome/empresaId/perfil)
//   - hierarquia de permissões (temPermissao)
//   - smoke test do fluxo completo ponta a ponta
// ══════════════════════════════════════════════════════════════════════
import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';

import { setupGlobals } from './helpers/env.mjs';
import * as authMock from './mocks/firebase-auth-mock.js';
import * as firestoreMock from './mocks/firestore-mock.js';
import * as firebaseScriptsMock from './mocks/firebase-scripts.js';

const KERNEL_URL = new URL('../../CRM/scripts/kernel.js', import.meta.url).href;

// kernel.js é um singleton por instância de módulo (estado top-level:
// _ctx, _readyResolved, _ready, e o próprio onAuthStateChanged registrado
// uma única vez na importação). Cada cenário precisa de uma execução nova
// — reimport com cache-busting, mesmo padrão de tests/rbac/helpers.
async function freshKernel() {
  authMock.__reset();
  firestoreMock.__reset();
  firebaseScriptsMock.__reset();
  const mod = await import(KERNEL_URL + '?t=' + Date.now() + '_' + Math.random().toString(36).slice(2));
  return mod;
}

const EMPRESA_ID_PADRAO = 'cellcity-master';

describe('Kernel — boot único e onAuthStateChanged', () => {
  test('registra exatamente um listener de autenticação por importação', async () => {
    setupGlobals();
    assert.equal(authMock.__hasListener(), false);
    await freshKernel();
    assert.equal(authMock.__hasListener(), true, 'kernel.js deve registrar onAuthStateChanged na importação');
  });

  test('initModulo() sem sessão redireciona para login.html (fora de /dev) e retorna null', async () => {
    const env = setupGlobals({ pathname: '/CRM/pages/dashboard/index.html' });
    const kernel = await freshKernel();

    await authMock.__trigger(null);
    const ctx = await kernel.initModulo();

    assert.equal(ctx, null);
    assert.equal(env.location.href, '/CRM/login.html');
    assert.equal(env.localStorage.getItem('cc_kernel_v1'), null);
  });

  test('initModulo() sem sessão dentro de /dev preserva o prefixo /dev no redirect', async () => {
    const env = setupGlobals({ pathname: '/dev/CRM/pages/dashboard/index.html' });
    const kernel = await freshKernel();

    await authMock.__trigger(null);
    const ctx = await kernel.initModulo();

    assert.equal(ctx, null);
    assert.equal(env.location.href, '/dev/CRM/login.html');
  });

  test('sessão anônima nunca constrói contexto (initModulo retorna null)', async () => {
    const env = setupGlobals();
    const kernel = await freshKernel();

    await authMock.__trigger({ uid: 'anon-1', isAnonymous: true });
    const ctx = await kernel.initModulo();

    assert.equal(ctx, null);
    assert.equal(env.location.href, '/CRM/login.html');
  });

  test('initModulo() redireciona após timeout quando auth nunca resolve', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      const env = setupGlobals();
      const kernel = await freshKernel();
      const p = kernel.initModulo();
      mock.timers.tick(10_000);
      const ctx = await p;

      assert.equal(ctx, null);
      assert.equal(env.location.href, '/CRM/login.html');
    } finally {
      mock.timers.reset();
    }
  });

  test('getCtxAsync() retorna null após timeout quando auth nunca resolve', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      setupGlobals();
      const kernel = await freshKernel();
      const p = kernel.getCtxAsync();
      mock.timers.tick(10_000);
      const ctx = await p;

      assert.equal(ctx, null);
    } finally {
      mock.timers.reset();
    }
  });
});

describe('Kernel — carregamento de sessão e tenant (empresaId)', () => {
  test('primeiro acesso cria usuarios/{uid} com perfil "pendente" (nunca admin)', async () => {
    const env = setupGlobals();
    const kernel = await freshKernel();

    await authMock.__trigger({ uid: 'uid-novo', email: 'novo@cellcity.com', isAnonymous: false });
    const ctx = await kernel.initModulo();

    assert.ok(ctx, 'contexto deveria ter sido construído');
    assert.equal(ctx.uid, 'uid-novo');
    assert.equal(ctx.perfil, 'pendente');
    assert.equal(ctx.empresaId, EMPRESA_ID_PADRAO);
    assert.equal(ctx.nome, 'novo');

    const docCriado = firestoreMock.__raw('usuarios', 'uid-novo');
    assert.ok(docCriado, 'documento usuarios/{uid} deveria ter sido criado no primeiro acesso');
    assert.equal(docCriado.perfil, 'pendente');
    assert.equal(docCriado.empresa_id, EMPRESA_ID_PADRAO);

    assert.equal(env.localStorage.getItem('cc_kernel_v1'), '1');
    const eventos = env.getDispatchedEvents();
    assert.equal(eventos.length, 1);
    assert.equal(eventos[0].type, 'kernel-ready');
    assert.equal(eventos[0].detail.uid, 'uid-novo');
  });

  test('usuário existente carrega empresaId/perfil/nome exatamente como gravados no Firestore', async () => {
    setupGlobals();
    const kernel = await freshKernel();
    // Seed DEPOIS de freshKernel(): freshKernel() reseta os mocks (inclusive
    // o Firestore em memória) antes de reimportar o kernel.
    firestoreMock.__seed('usuarios', 'uid-existente', {
      email: 'tecnico@cellcity.com',
      nome: 'Técnico Um',
      empresa_id: 'empresa-cliente-x',
      perfil: 'tecnico',
    });

    await authMock.__trigger({ uid: 'uid-existente', email: 'tecnico@cellcity.com', isAnonymous: false });
    const ctx = await kernel.initModulo();

    assert.equal(ctx.empresaId, 'empresa-cliente-x');
    assert.equal(ctx.perfil, 'tecnico');
    assert.equal(ctx.nome, 'Técnico Um');

    // Não deve ter sobrescrito o documento existente
    const doc = firestoreMock.__raw('usuarios', 'uid-existente');
    assert.equal(doc.empresa_id, 'empresa-cliente-x');
  });

  test('falha de leitura do Firestore usa valores padrão sem lançar exceção (fail-safe)', async () => {
    setupGlobals();
    const kernel = await freshKernel();
    firestoreMock.__setForceGetDocError(new Error('Firestore indisponível'));

    await authMock.__trigger({ uid: 'uid-erro', email: 'erro@cellcity.com', isAnonymous: false });
    const ctx = await kernel.initModulo();

    assert.ok(ctx, 'contexto deve resolver mesmo com Firestore indisponível');
    assert.equal(ctx.perfil, 'pendente');
    assert.equal(ctx.empresaId, EMPRESA_ID_PADRAO);
    assert.equal(firestoreMock.__raw('usuarios', 'uid-erro'), undefined, 'não deve tentar criar doc após erro de leitura');
  });

  test('falha de setDoc no primeiro acesso usa defaults sem lançar exceção (fail-safe)', async () => {
    setupGlobals();
    const kernel = await freshKernel();
    firestoreMock.__setForceSetDocError(new Error('Firestore write denied'));

    await authMock.__trigger({ uid: 'uid-setdoc-erro', email: 'w@cellcity.com', isAnonymous: false });
    const ctx = await kernel.initModulo();

    assert.ok(ctx, 'contexto deve resolver mesmo quando setDoc falha no primeiro acesso');
    assert.equal(ctx.perfil, 'pendente');
    assert.equal(ctx.empresaId, EMPRESA_ID_PADRAO);
    assert.equal(firestoreMock.__raw('usuarios', 'uid-setdoc-erro'), undefined, 'doc não deve ter sido criado após falha de setDoc');
  });

  test('getEmpresaId() lança erro se chamado antes de initModulo() resolver', async () => {
    setupGlobals();
    const kernel = await freshKernel();
    assert.throws(() => kernel.getEmpresaId());
  });

  test('getCtxAsync() resolve o mesmo contexto de initModulo() sem redirecionar', async () => {
    const env = setupGlobals();
    const kernel = await freshKernel();

    await authMock.__trigger({ uid: 'uid-x', email: 'x@cellcity.com', isAnonymous: false });
    const ctx = await kernel.getCtxAsync();

    assert.ok(ctx);
    assert.equal(ctx.uid, 'uid-x');
    assert.equal(env.location.href, `http://localhost${env.location.pathname}`, 'getCtxAsync não deve redirecionar');
  });
});

describe('Kernel — hierarquia de permissões (temPermissao)', () => {
  const CASOS = [
    ['master_admin', 'master_admin', true],
    ['master_admin', 'admin', true],
    ['admin', 'admin', true],
    ['admin', 'master_admin', false],
    ['gerente', 'tecnico', true],
    ['tecnico', 'gerente', false],
    ['atendente', 'atendente', true],
    ['atendente', 'admin', false],
    ['pendente', 'atendente', false],
  ];

  for (const [perfilAtual, perfilMinimo, esperado] of CASOS) {
    test(`perfil="${perfilAtual}" temPermissao("${perfilMinimo}") === ${esperado}`, async () => {
      setupGlobals();
      const kernel = await freshKernel();
      firestoreMock.__seed('usuarios', 'uid-perm', {
        email: 'p@cellcity.com',
        perfil: perfilAtual,
        empresa_id: EMPRESA_ID_PADRAO,
      });
      await authMock.__trigger({ uid: 'uid-perm', email: 'p@cellcity.com', isAnonymous: false });
      await kernel.initModulo();

      assert.equal(kernel.temPermissao(perfilMinimo), esperado);
    });
  }
});

describe('Kernel — login() / logout()', () => {
  test('login() com lembrar=true usa persistência local; lembrar=false usa persistência de sessão', async () => {
    setupGlobals();
    const kernel = await freshKernel();
    await authMock.__trigger(null);

    await kernel.login('a@cellcity.com', 'senha123', true);
    assert.equal(authMock.__getLastPersistence(), authMock.browserLocalPersistence);

    await kernel.login('a@cellcity.com', 'senha123', false);
    assert.equal(authMock.__getLastPersistence(), authMock.browserSessionPersistence);
  });

  test('login() encerra sessão anônima ativa antes de autenticar de verdade', async () => {
    setupGlobals();
    const kernel = await freshKernel();
    await authMock.__trigger(null);

    firebaseScriptsMock.auth.currentUser = { uid: 'anon', isAnonymous: true };
    await kernel.login('a@cellcity.com', 'senha123');

    assert.equal(authMock.__getSignOutCalls(), 1, 'deveria ter chamado signOut para a sessão anônima');
    assert.equal(firebaseScriptsMock.auth.currentUser.isAnonymous, false);
  });

  test('login() bem-sucedido registra ultimo_acesso sem bloquear em caso de falha silenciosa', async () => {
    setupGlobals();
    const kernel = await freshKernel();
    firestoreMock.__seed('usuarios', 'uid-login', { email: 'login@cellcity.com', perfil: 'admin' });
    await authMock.__trigger(null);

    authMock.__setNextSignInUser({ uid: 'uid-login', email: 'login@cellcity.com', isAnonymous: false });
    const user = await kernel.login('login@cellcity.com', 'senha123');

    assert.equal(user.uid, 'uid-login');
    const doc = firestoreMock.__raw('usuarios', 'uid-login');
    assert.equal(doc.ultimo_acesso, '__SERVER_TIMESTAMP__');
  });

  test('logout() encerra sessão, apaga a flag de gate e redireciona para login.html', async () => {
    const env = setupGlobals();
    const kernel = await freshKernel();

    await authMock.__trigger({ uid: 'uid-out', email: 'out@cellcity.com', isAnonymous: false });
    await kernel.initModulo();
    assert.equal(env.localStorage.getItem('cc_kernel_v1'), '1');

    await kernel.logout();

    assert.equal(authMock.__getSignOutCalls(), 1);
    assert.equal(env.localStorage.getItem('cc_kernel_v1'), null);
    assert.equal(env.location.href, '/CRM/login.html');
    assert.equal(kernel.getCtx(), null);
  });
});

describe('Kernel — API pública consolidada (sem código morto)', () => {
  test('exporta somente as funções realmente consumidas pelos módulos', async () => {
    setupGlobals();
    const kernel = await freshKernel();

    const apiEsperada = [
      'initModulo', 'login', 'logout',
      'getCtx', 'getCtxAsync', 'getUser', 'getUid', 'getNome', 'getPerfil',
      'getEmpresaId', 'temPermissao',
    ];
    for (const nome of apiEsperada) {
      assert.equal(typeof kernel[nome], 'function', `kernel.${nome} deveria continuar exportado`);
    }

    // Fase 1.3 — código morto removido: nenhum consumidor no repositório
    // (verificado por busca completa antes da remoção; ver relatório técnico).
    assert.equal('getEmail' in kernel, false, 'getEmail era código morto (zero consumidores) — removido na Fase 1.3');
    assert.equal('AUTH_FLAG' in kernel, false, 'AUTH_FLAG era código morto (zero consumidores) — removido na Fase 1.3');
  });
});

describe('Kernel — smoke test (fluxo completo ponta a ponta)', () => {
  test('boot → sessão → tenant → permissão → logout, sem lançar exceções', async () => {
    const env = setupGlobals({ pathname: '/CRM/pages/os/index.html' });
    const kernel = await freshKernel();

    // 1) Boot: nenhuma sessão ainda resolvida quando o módulo é importado.
    assert.equal(authMock.__hasListener(), true);

    // 2) Autenticação real chega (equivalente ao Firebase disparando o
    //    primeiro onAuthStateChanged da aba).
    await authMock.__trigger({ uid: 'uid-smoke', email: 'smoke@cellcity.com', isAnonymous: false });

    // 3) initModulo() é o único ponto de entrada usado pelos módulos.
    const ctx = await kernel.initModulo();
    assert.ok(ctx);
    assert.equal(ctx.empresaId, EMPRESA_ID_PADRAO);

    // 4) Getters síncronos pós-boot.
    assert.equal(kernel.getUid(), 'uid-smoke');
    assert.equal(kernel.getEmpresaId(), EMPRESA_ID_PADRAO);

    // 5) Gate de permissão.
    assert.equal(kernel.temPermissao('atendente'), false, 'perfil pendente não deve ter nenhum nível de acesso');

    // 6) Encerramento de sessão sem exceções.
    await kernel.logout();
    assert.equal(env.location.href, '/CRM/login.html');
  });
});
