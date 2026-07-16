# Cell City CRM — Arquitetura Oficial do Client

> Consolidada na **Sprint 1 · Fase 1.1** (2026-07-16) e aprofundada na
> **Fase 1.3 — Kernel** (2026-07-16). Verificação automatizada:
> `npm run auditar-arquitetura` (6 invariantes — a Fase 1.3 estendeu o
> parser para também auditar `<script type="module">` inline de .html,
> além de .js, e adicionou o invariante de caminho relativo). Complementa
> `ENGINEERING.md` (governança) e `CRM/TECHDOC.md` (histórico).

## 1. Visão em camadas

```
┌─ pages/<módulo>/  (33 módulos com entrypoint rastreável — apresentação;
│                    DOM, eventos, render — ver nota¹)
│    └── só importa das camadas abaixo; NUNCA de outro pages/<módulo>
├─ services/        (regra de negócio pura; sem DOM, sem Firebase)
├─ repositories/    (acesso a dados; única camada que monta queries)
├─ shared/          (utilitários e contexto: tenant-*, permissoes,
│                    sanitize, date-utils, phone-utils, dock, …)
├─ scripts/kernel.js  (bootstrap: auth + sessão + empresa)
└─ scripts/firebase.js + firebase/client.js  (SDK hub; app único)
```

¹ 33 = módulos com pelo menos um arquivo `.js` OU bloco `<script
type="module">` inline auditável (grafo de imports). 4 módulos
(`kernel-test`, `saas-admin`, `saas-onboarding`, `portal-tecnico`) não têm
NENHUM `.js` próprio — toda a lógica vive inline no `.html` — e por isso
ficavam **totalmente invisíveis** ao auditor da Fase 1.1 (que só lia
`.js`). Corrigido na Fase 1.3. `CRM/pages/` tem 36 pastas ao todo; a
diferença são utilitários/páginas sem JS rastreável (estáticas ou
`<script>` clássico sem import).

## 2. Cadeia de bootstrap (ordem real de execução)

1. **Gate inline no HTML** — snippet síncrono no `<head>` redireciona para
   login sem flash (flag UX `cc_kernel_v1`; segurança real é o Firebase Auth).
2. **`shared/env-config.js`** — seleciona projeto DEV/PROD pela URL e define
   `window.CC_FIREBASE_CONFIG` (import de efeito colateral do firebase.js).
3. **`scripts/firebase.js`** — ÚNICO `initializeApp` do app principal;
   Firestore com cache persistente (IndexedDB multi-aba, fallback memória);
   Storage lazy via `getFirebaseStorage()`.
4. **`scripts/kernel.js`** — ÚNICO `onAuthStateChanged` do fluxo principal;
   monta `ctx` (uid, email, nome, empresaId, perfil — padrão `pendente`),
   chama `initTenant(ctx, empresaId)` e expõe `initModulo()/getCtx()/…`.
5. **`shared/tenant-provider.js`** — orquestra: restaura tenant da sessão ou
   resolve via `tenant-resolver` → popula `tenant-context` → liga filtros
   multiempresa SOMENTE se `empresas/{id}.dados_migrados === true` (PS-6) →
   dispara `tenant-ready`.
6. **Módulo da página** — `const ctx = await initModulo(); if (!ctx) return;`

Injeção de dependência é **por contexto**: o kernel entrega `ctx` ao módulo;
repositórios leem o tenant via `tenant-context` (estado central), nunca de
variável própria.

### 2.1 Segunda cadeia, deliberada: páginas públicas (sem kernel)

Existe exatamente **uma outra** cadeia de bootstrap legítima no client,
para páginas acessadas por quem NÃO é equipe (sem `usuarios/{uid}.perfil`,
sem RBAC): cada uma cria sua própria app Firebase (`initializeApp` próprio,
`env-config.js` para DEV/PROD) e delega qualquer escrita privilegiada a uma
Cloud Function (Admin SDK, ignora Rules do client) — nunca lê/escreve
coleções sensíveis direto. Fase 1.3 auditou e fechou esta lista (nenhuma
outra existe no client):

| Página | Auth | Por quê é separada do kernel |
|---|---|---|
| `pages/catalogo/public/catalogo-publico.js` | nenhuma | catálogo público, zero dado sensível |
| `garantia.html` | nenhuma | consulta pública de OS via `consultarOSPublica` (Cloud Function) |
| `pages/saas-onboarding/index.html` | nenhuma | cadastro de empresa via `saasOnboardingCriarEmpresa` (Cloud Function) |
| `pages/portal-cliente/index.html` + `portal.js` | **anônima própria** (`signInAnonymously` + 2º `onAuthStateChanged`, ver §6) | cliente final identificado por telefone, não por conta de equipe; todas as 13 operações passam por `PortalFunctions.*` (Cloud Functions) |

O gate inline (`cc_kernel_v1`) e o kernel real (`initModulo()`) são
exclusivos do fluxo de equipe — nunca usar em página pública, e nunca
introduzir uma TERCEIRA cadeia sem atualizar esta tabela e o auditor.

## 3. Padrão Repository (composição, não herança)

- `base.repository.js` — factory de acesso puro (CRUD + query builder).
- `base.repository.padrao.js` — decorator: API padronizada em português
  (`listar/criar/editar/remover/…`, envelope `{ok, dados, erro}`, cache
  opt-in, logging).
- `base.repository.tenant.js` — decorator multiempresa: injeta `empresa_id`
  nas escritas, remove do payload em `update` (proteção), adiciona `where`
  nas consultas/listeners quando os filtros estão ativos.
- `<coleção>.repository.js` — arquivos-ponte nomeados (3–7 linhas):
  `export const OSRepository = createTenantRepository('os')`.
- Coleções globais (ex.: `empresas`) usam `createRepository` (sem tenant).

**Não há barrel `repositories/index.js` de propósito**: ESM de browser sem
bundler — um barrel forçaria download de TODOS os repositórios em toda
página. Import direto do arquivo da coleção é a regra.

## 4. Regras de import (invariantes do auditor)

1. Import quebrado = build quebrado (auditor falha).
2. Grafo de dependências é acíclico.
3. `pages/<a>` nunca importa de `pages/<b>` — compartilhou, sobe para
   `shared/`, `services/` ou `repositories/`.
4. `initializeApp` só nos pontos autorizados (§6).
5. SDK Firebase via CDN só na allowlist auditada; código novo importa de
   `scripts/firebase.js` (ou `firebase/client.js` nos repositórios).
6. Caminhos sempre RELATIVOS (H-008: absolutos `/CRM/...` resolviam para
   produção dentro de `/dev`). Sem bundler não existem aliases — a
   profundidade do módulo dita os `../`. **Verificado automaticamente
   desde a Fase 1.3** (invariante 6 do auditor — antes só documentado);
   achou e corrigiu 1 ocorrência real (`pages/kernel-test/index.html`).

Desde a Fase 1.3 os invariantes 1, 3, 4 e 5 também auditam `<script
type="module">` INLINE de `.html` — a Fase 1.1 auditava só `.js` e não
via 3 `initializeApp` reais nem o 2º `onAuthStateChanged` legítimo
(§2.1, §6).

## 5. Multiempresa (estado PS-1..PS-6, congelado pós-incidente 07-14)

- Resolução: `usuarios/{uid}.empresa_id` → fallback `cellcity-master`
  (single-tenant atual). Cache de tenant por sessão (`sessionStorage`).
- Escritas já injetam `empresa_id`; filtros de leitura são gateados pelo
  backfill (`dados_migrados`) — ligar antes esconderia docs legados.
- Rules e promoção de filtros são mudanças CRÍTICAS (gatilhos do Modo
  Acelerado) — nunca autônomas.

## 6. Exceções documentadas (allowlist do auditor)

| Arquivo | Motivo |
|---|---|
| `scripts/firebase.js` | hub oficial do SDK; **único** `initializeApp` do fluxo de equipe |
| `scripts/kernel.js` | primitivas auth/firestore da MESMA URL do SDK (o browser deduplica o módulo — zero custo); **único** `onAuthStateChanged` do fluxo de equipe |
| `pages/catalogo/public/catalogo-publico.js` | página pública sem kernel; `initializeApp` próprio com env-config (§2.1) |
| `pages/usuarios-permissoes/firebase-secondary.js` | app secundário deliberado — criar usuário sem derrubar a sessão do admin |
| `pages/usuarios-permissoes/usuarios-permissoes.js` | `firebase-functions` (callable `excluirUsuarioAdmin`) |
| `shared/session.js` | **LEGADO** (modelo conta-única pré-kernel; só config/Ferramentas usa) — migração recomendada, arquivo de autenticação = protegido |
| `pages/central-informacoes/informacoes.js` | storage direto da CDN — dívida: usar `getFirebaseStorage()` |
| `garantia.html` *(Fase 1.3)* | `initializeApp` próprio, página pública sem auth (§2.1) |
| `pages/saas-onboarding/index.html` *(Fase 1.3)* | `initializeApp` próprio, cadastro público sem auth (§2.1) |
| `pages/portal-cliente/index.html` *(Fase 1.3)* | `initializeApp` próprio + **2º `onAuthStateChanged`** legítimo do app (auth anônima do cliente, bounded context isolado — §2.1); `portal.js` (clássico, sem import) consome via `window.*` |
| `pages/kernel-test/index.html` *(Fase 1.3)* | diagnóstico do kernel: `import()` dinâmico de `signOut` direto da CDN para encerrar sessão sem o redirect de `logout()` — não é um novo listener nem uma nova app |

Adoção do kernel/Repository por módulo (métrica do auditor) é calculada
por **alcançabilidade transitiva no grafo**, não só import direto do
próprio arquivo — um módulo que só chega ao kernel via um helper de
`shared/` (ex.: `central-modulos.js`, `portal-sync.js`) ou via um bloco
inline de `.html` (ex.: `portal-cliente/admin.html`) conta como usando
kernel, porque a garantia é real independente de qual arquivo a fornece.

## 7. O que é proibido em código novo

- Novo `onAuthStateChanged` (o kernel é o dono do fluxo de auth).
- Novo `initializeApp` / import de SDK via CDN fora da allowlist.
- Import entre módulos de página.
- Query Firestore fora de repositório em módulo já migrado.
- Constante global/chave `cc_*`/timeout fora de `shared/app-config.js`
  (Fase 1.2).
