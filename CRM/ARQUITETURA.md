# Cell City CRM — Arquitetura Oficial do Client

> Consolidada na **Sprint 1 · Fase 1.1** (2026-07-16). Verificação
> automatizada: `npm run auditar-arquitetura` (5 invariantes).
> Complementa `ENGINEERING.md` (governança) e `CRM/TECHDOC.md` (histórico).

## 1. Visão em camadas

```
┌─ pages/<módulo>/  (29 módulos — apresentação; DOM, eventos, render)
│    └── só importa das camadas abaixo; NUNCA de outro pages/<módulo>
├─ services/        (regra de negócio pura; sem DOM, sem Firebase)
├─ repositories/    (acesso a dados; única camada que monta queries)
├─ shared/          (utilitários e contexto: tenant-*, permissoes,
│                    sanitize, date-utils, phone-utils, dock, …)
├─ scripts/kernel.js  (bootstrap: auth + sessão + empresa)
└─ scripts/firebase.js + firebase/client.js  (SDK hub; app único)
```

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
4. `initializeApp` só nos 3 pontos autorizados (§6).
5. SDK Firebase via CDN só na allowlist auditada; código novo importa de
   `scripts/firebase.js` (ou `firebase/client.js` nos repositórios).
6. Caminhos sempre RELATIVOS (H-008: absolutos `/CRM/...` resolviam para
   produção dentro de `/dev`). Sem bundler não existem aliases — a
   profundidade do módulo dita os `../`.

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
| `scripts/firebase.js` | hub oficial do SDK |
| `scripts/kernel.js` | primitivas auth/firestore da MESMA URL do SDK (o browser deduplica o módulo — zero custo) |
| `pages/catalogo/public/catalogo-publico.js` | página pública sem kernel; `initializeApp` próprio com env-config |
| `pages/usuarios-permissoes/firebase-secondary.js` | app secundário deliberado — criar usuário sem derrubar a sessão do admin |
| `pages/usuarios-permissoes/usuarios-permissoes.js` | `firebase-functions` (callable `excluirUsuarioAdmin`) |
| `shared/session.js` | **LEGADO** (modelo conta-única pré-kernel; só config/Ferramentas usa) — migração recomendada, arquivo de autenticação = protegido |
| `pages/central-informacoes/informacoes.js` | storage direto da CDN — dívida: usar `getFirebaseStorage()` |

## 7. O que é proibido em código novo

- Novo `onAuthStateChanged` (o kernel é o dono do fluxo de auth).
- Novo `initializeApp` / import de SDK via CDN fora da allowlist.
- Import entre módulos de página.
- Query Firestore fora de repositório em módulo já migrado.
- Constante global/chave `cc_*`/timeout fora de `shared/app-config.js`
  (Fase 1.2).
