# ✅ CHECKLIST — Sprint 1 (Kernel SaaS), Fase 1.3: Consolidação do Kernel

> Escopo travado: exclusivamente o Kernel. Sem regra de negócio, sem
> Firestore Rules, sem Cloud Functions, sem telas/fluxos funcionais.
> Relatório técnico completo: `plans/RELATORIO_TECNICO_KERNEL_FASE_1_3.md`.
> Documentação de arquitetura: `CRM/scripts/KERNEL.md`.

## Análise

- [x] Revisão completa de `CRM/scripts/kernel.js` (bootstrap, lifecycle, providers de sessão/tenant).
- [x] Mapeamento de todos os módulos que consomem `kernel.js` (32/47 arquivos `pages/**/*.js` importam diretamente; os demais são sub-módulos de páginas que já importam via o arquivo principal).
- [x] Busca completa por consumidores de cada export público de `kernel.js` (confirmação de código morto antes de remover).
- [x] Identificação de todos os pontos de autenticação fora do Kernel (`shared/session.js`, `firebase-secondary.js`, Portal do Cliente) e classificação de cada um (decisão deliberada vs. dívida técnica).
- [x] Validação do fluxo de boot: `onAuthStateChanged` único → `_ready` único → `initModulo()` → contexto (uid/email/nome/empresaId/perfil).
- [x] Validação de que nenhuma leitura de Firestore no boot pode lançar exceção não tratada (fail-safe confirmado).
- [x] Validação de que não existe inicialização/registro duplicado *dentro* do próprio Kernel.

## Padronização

- [x] Confirmado: boot único (`onAuthStateChanged` registrado exatamente uma vez por página).
- [x] Confirmado: `_ready` único (uma só resolução, trava por `_readyResolved`).
- [x] Confirmado: `initModulo()` como único ponto de entrada padrão documentado e usado pelos 32 módulos operacionais.
- [x] Removidas as duas exportações de código morto (`getEmail`, `AUTH_FLAG`) — zero consumidores confirmados.
- [x] Nenhuma dependência desnecessária introduzida (nenhum novo import em `kernel.js`).
- [x] Documentação oficial do Kernel criada (`CRM/scripts/KERNEL.md`), cobrindo ciclo de vida, contrato de API e exceções deliberadas.
- [ ] ~~Unificar `shared/session.js` a `kernel.js`~~ — **fora do escopo desta Fase** (tocaria tela/fluxo funcional de um módulo específico fora do Kernel; requer autorização e Sprint própria).
- [ ] ~~Centralizar a chave `'cc_kernel_v1'` usada nos gates HTML~~ — **fora do escopo desta Fase** (exigiria editar ~34 telas simultaneamente).

## Validação (testes)

- [x] Testes de inicialização/bootstrap — `tests/kernel/kernel.test.mjs` (boot único, registro do listener).
- [x] Testes de autenticação — login/logout, persistência (lembrar), sessão anônima.
- [x] Testes de tenant — carregamento de `empresaId` (documento existente / primeiro acesso / falha de leitura).
- [x] Testes de carregamento/sessão — contexto completo (uid/email/nome/perfil), `getCtx()`/`getCtxAsync()`.
- [x] Testes de permissão — hierarquia completa de `temPermissao()` (9 cenários).
- [x] Smoke test ponta a ponta (boot → sessão → tenant → permissão → logout).
- [x] Suíte nova executada: **24/24 aprovados**.
- [x] Suíte de RBAC (consumidores reais do Kernel) reexecutada: **164/166** — 2 falhas pré-existentes confirmadas em `main`, não relacionadas ao Kernel.
- [x] Suíte de integridade reexecutada: **13/14** — 1 falha por ausência de `rsync` no ambiente de execução (infraestrutura, não código).
- [x] Suíte do Control Center reexecutada: **91/94** — 3 falhas pré-existentes por estado de branch/git do ambiente, não relacionadas ao Kernel.
- [x] Confirmado, reproduzindo em `main` antes da alteração: todas as falhas remanescentes já existiam e são idênticas — nenhuma regressão introduzida por esta Fase.
- [ ] Firestore Rules / Cloud Functions — não reexecutadas nesta sessão (ambiente sem emulador configurado); sem relação com o Kernel e fora do escopo desta Fase.

## Documentação

- [x] `CRM/scripts/KERNEL.md` criado.
- [x] `CRM/TECHDOC.md` §2 atualizado com referência ao novo documento.
- [x] `CRM/TECHDOC.md` §36 criado com o registro completo desta Fase.
- [x] `plans/RELATORIO_TECNICO_KERNEL_FASE_1_3.md` criado.
- [x] Este checklist.
- [x] `.github/workflows/tests.yml` atualizado com o novo passo de CI.

## Entrega

- [x] Kernel consolidado (já era único ponto de boot; agora documentado e sem código morto).
- [x] Bootstrap padronizado (ciclo de vida documentado formalmente).
- [x] Inicialização única (confirmada, não havia duplicação a corrigir dentro do próprio Kernel).
- [x] Lifecycle organizado (diagrama e contrato de API em `KERNEL.md`).
- [x] Relatório técnico.
- [x] Checklist (este arquivo).
- [x] Documentação atualizada.
- [x] Commits organizados (um por alteração lógica — ver relatório técnico, seção "Commits").
