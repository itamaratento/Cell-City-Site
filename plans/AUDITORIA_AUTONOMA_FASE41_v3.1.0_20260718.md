# FASE 4.1 — Auditoria Autônoma Completa — Release v3.1.0

**Data:** 2026-07-18  
**Modo:** AUTÔNOMO · READ-ONLY (nenhuma alteração em produção, sem migrações, sem deploys)  
**Projeto Firebase:** `cellcity-crm`  
**Tag:** `v3.1.0` → commit `b7e260d` (= `origin/main` peeled)  
**develop:** `2fe6973` (5 commits à frente de `main`)

### Legenda de certeza

| Símbolo | Significado |
|---|---|
| **FATO** | Confirmado por arquivo, comando ou API nesta sessão |
| **INFERÊNCIA** | Interpretação técnica a partir de fatos |
| **NÃO VERIFICÁVEL** | Exige credencial, console ou sessão autenticada ausente neste ambiente |

---

## Parecer executivo

A release **v3.1.0** está **operacional no eixo de infraestrutura** (Rules FS/Storage publicadas, 16 Functions ACTIVE, 23 índices compostos READY em produção, Pages servindo CRM). A auditoria autônoma do código e da configuração **não encontrou P0 de vazamento cross-tenant óbvio nas Rules de negócio**, mas identificou **riscos P1 persistentes** (superfícies públicas, RBAC só em UI, PII em endpoint público, drift de índices git↔prod) e **gates de homologação não fechados** (smoke autenticado, Actions deploy).

**Veredito de governança (alinhado às Fases 3.8/4.0):**

🟡 **CERTIFICADA COM RESSALVAS** — a auditoria reforça, não remove, as ressalvas humanas.

---

# FASE A — Inventário geral

### Estrutura top-level (FATO)

| Dir | Papel |
|---|---|
| `CRM/` | App CRM (Firebase Hosting `public: "CRM"`) |
| `functions/` | Cloud Functions Node 20 |
| `scripts/` | Automação / Control Center / homologação |
| `tests/` | Suítes automatizadas |
| `plans/` | Planos e relatórios (~121 `.md`) |
| `.github/workflows/` | 4 workflows |
| `sql/`, `assets/`, `css/`, `js/`, landings | Site institucional / schema docs |
| `_BACKUPS/`, `_reports/`, `_runtime_audit/` | Artefatos locais |

### Contagens (FATO · excl. node_modules onde aplicável)

| Escopo | Quantidade |
|---|---|
| Módulos `CRM/pages/*` | **36** pastas |
| `CRM/**/*.html` | **50** |
| `CRM/**/*.js` | **111** |
| Functions fonte (sem node_modules) | **10** `.js` |
| Exports Callable | **16** |
| Workflows | **4** |
| Test files `*.test.*` | **~53** |
| Plans `.md` | **121** |

### Páginas / módulos CRM (FATO)

`acaodasemana`, `analise`, `auditoria`, `autoatendimento`, `caixa`, `campanhas`, `catalogo`, `central-alertas`, `central-comandos`, `central-informacoes`, `central-modulos`, `central-organizacao`, `chat`, `clientes`, `compras`, `config`, `contas`, `crm-comercial`, `dashboard`, `diario`, `em-breve`, `estoque`, `estrategia`, `financeiro`, `fornecedor`, `importar`, `kernel-test`, `minha-semana`, `os`, `portal-cliente`, `portal-tecnico`, `pos-venda`, `relatorios`, `saas-admin`, `saas-onboarding`, `usuarios-permissoes`.

### Artefatos de plataforma (FATO)

| Artefato | Path |
|---|---|
| Firestore Rules | `CRM/firestore.rules` |
| Firestore Indexes (repo) | `CRM/firestore.indexes.json` |
| Storage Rules | `storage.rules` (raiz) |
| Firebase config | `firebase.json`, `.firebaserc` (`cellcity-crm` / `cellcity-crm-dev`) |
| Docs | `README.md`, `ENGINEERING.md`, `CLAUDE.md`, `CHANGELOG.md`, `PROXIMA_ETAPA.md`, `COLECOES_FIRESTORE.md`, `CRM/TECHDOC.md`, `CRM/ARQUITETURA.md` |

### Serviços externos (FATO / INFERÊNCIA)

| Serviço | Evidência |
|---|---|
| Firestore | Rules + indexes + código |
| Auth | Login CRM / `request.auth` nas Rules |
| Storage | `storage.rules` + paths `empresas/{id}/…` |
| Cloud Functions | 16 ACTIVE em `southamerica-east1` |
| GitHub Pages | headers Server: GitHub.com no domínio público |
| Google Drive backup | coleção `gdrive_backup` documentada |

---

# FASE B — Arquitetura

```
[Browser CRM / Portal]
        │
        ├─ Firebase Auth
        ├─ Firestore (Rules: mesmaEmpresa* + temAcessoLiberado)
        ├─ Storage (path empresas/{empresaId}/…)
        └─ Callable Functions (Admin SDK bypass Rules)
                ├─ excluirUsuarioAdmin (auth staff)
                ├─ OS públicas + Portal (phoneDigits / osId)
                └─ saasOnboardingCriarEmpresa (público + rate limit)

Tenant: usuarios.empresa_id → injectTenantFilter / TenantRepo / Rules
RBAC módulo: permissoes.js (UI, fail-open) — NÃO enforce nas Rules
Master: isMasterAdmin() cross-tenant
```

**Arquivos centrais (FATO):** `CRM/shared/kernel.js`, `permissoes.js`, `tenant-query.js` / `tenant-resolver.js`, `repositories/base.repository*.js`, `CRM/firestore.rules`, `functions/{index,admin,os,portal,saas}.js`, `lib/empresa.js`, `lib/rate-limit.js`.

**Acoplamentos (INFERÊNCIA):** Dashboard concentra muitos listeners; Portal cliente + Functions espelham whitelist de campos; Catálogo público depende de `empresa_id==cellcity-master`.

---

# FASE C — Revisão de código

| Achado | Evidência | Classificação |
|---|---|---|
| Marcadores TODO/FIXME/HACK | ~50 matches; maioria falso-positivo PT (`TODOS`, `XXXXXX`) | Baixo ruído |
| `DEBUG TEMPORÁRIO` | `CRM/pages/dashboard/dashboard-alertas.js:118` | **MÉDIO** — limpar |
| Placeholders “temporário” | `modulos.catalogo.json` / `modulos.meta.json` | Baixo |
| `console.log` com senha/token | **0** em CRM/functions | OK |
| Código morto / legado | coleções `orders`/`clients` deny; chat desativado (TECHDOC); fallback `produtos` | Documentado |
| Duplicação Portal CF | templates listar/criar similares em `portal.js` | Dívida técnica |

**NÃO VERIFICÁVEL nesta passagem:** imports não usados e dependências npm órfãs (exigiria ESLint/depcheck completo — não executado end-to-end).

---

# FASE D — Modelo de dados

### Fontes

- **FATO:** `COLECOES_FIRESTORE.md` — 23 seções numeradas de catálogo  
- **FATO:** ~48 nomes únicos via `collection(db,'…')` em `CRM/**/*.js` (amostra heurística; constantes nomeadas podem escapar)

### Inconsistências de nomenclatura (FATO)

| Par | Onde | Impacto |
|---|---|---|
| `phone` / `phoneDigits` (OS) vs `telefone` / `telefoneDigits` (Portal) | `functions/os.js`, `functions/portal.js`, índices | Dois vocabulários; índices `telefone+createdAt` vs queries `telefoneDigits` |
| `createdAt` vs `criadoEm` | Portal/avaliações vs chat/crm_leads | Índices distintos necessários |
| `clientName` (OS pública) vs `nome` (clientes/estoque) | Projeção CF vs CRM | OK por domínio, mas aumenta curva |
| `nome` vs `nome_exibicao` | clientes/estoque vs usuarios | Índices separados |

### Achados documentados já no catálogo (FATO)

- `config` **sem** `empresa_id` — compartilhada entre tenants (COLECOES §19)  
- `known-issues.json`: coleções sem rule citada — `auditoria_saas`, `notificacoes_saas`  
- Legado `estoque` / `produtos` / `clients` / `orders`

---

# FASE E — Consistência de índices

| Fonte | Contagem | Evidência |
|---|---|---|
| Produção (`gcloud` composite) | **23 READY** | API 2026-07-18 |
| `origin/develop` JSON | **19** | `git show` |
| `origin/main` / tag v3.1.0 JSON | **14** | `git show` |
| Collection group queries no código | **0** | `rg collectionGroup(` |

### Drift (FATO · crítico de governança)

```
prod 23  >  develop JSON 19  >  main JSON 14
```

- 5 índices foram adicionados em `develop` (`bb4905d`: pre_os, catalogo_produtos, comandos, informacoes, chips_cadastros) **não promovidos** ao `main` tagueado.  
- **~4 índices** existem em produção **fora** do JSON de `develop` (criados via API/console na publicação híbrida) — **risco de drift** em próximo `firebase deploy --only firestore:indexes` a partir do repo.

### Índices possivelmente residuais (INFERÊNCIA)

- `mensagens_portal(telefone, createdAt)` enquanto CF usa `telefoneDigits` sem orderBy.  
- Índices `tipo+createdAt` / `ativo+ordem` em prod sem `collectionGroup` nomeado no dump gcloud desta sessão (campo veio `None` no format) — **parcialmente NÃO VERIFICÁVEL** o binding coleção↔campos via CLI format.

### Consultas sem composite no JSON (INFERÊNCIA / P3 ops)

- Dashboard alertas: `os` + `status`  
- CF agendamentos: `data` + `status in`  
Admin SDK / índices auto podem cobrir; não comprovado nesta auditoria.

---

# FASE F — Firestore Rules

**Path:** `CRM/firestore.rules` (FATO)

### Pontos fortes (FATO)

- Padrão `mesmaEmpresaRead/Create` + `empresaImutavel`  
- `isMasterAdmin` como única exceção cross-tenant explícita  
- Usuário não eleva próprio `perfil` / `empresa_id` (BL-006)  
- `os` get público fechado (`get: if false`)  
- Deny legado `orders`/`clients`

### Riscos (FATO)

| Item | Severidade |
|---|---|
| `config/{docId}` `get: if true` | **ALTO** |
| `pre_os` `create: if true` | **ALTO** |
| `metadata` sem `mesmaEmpresa*` | **ALTO** |
| `catalogo_config` get público | **MÉDIO** |
| RBAC operacional **não** nas Rules (só empresa + não pendente) | **ALTO** (autorização real = tenant, não perfil) |
| favoritos/preferências sem `temAcessoLiberado` | **BAIXO** |

---

# FASE G — Storage Rules

**Path:** `storage.rules` (raiz) (FATO)

| Path | Read | Write |
|---|---|---|
| `empresas/{empresaId}/os/…` | **público** | auth + mesma empresa + image &lt;5MB |
| `empresas/{empresaId}/{**}` | auth + empresa | auth + empresa &lt;20MB |
| legado `os/{osId}/…` | público | write false |
| legado `docs/{**}` | qualquer auth | write false |

**Risco ALTO:** fotos de OS legíveis sem autenticação (intencional Portal/garantia; enumeração se path previsível).

---

# FASE H — Cloud Functions

**FATO:** 16 `onCall` (v2), região `southamerica-east1`, **todas ACTIVE** em produção.  
**FATO:** nenhum `onRequest` / `onSchedule` / `onDocument` no inventário atual.

| Grupo | Funções | Auth |
|---|---|---|
| Admin | `excluirUsuarioAdmin` | Sim |
| OS pública | `consultarOSPublica`, `consultarOSPorTelefonePublica` | Não + rate limit |
| Portal (11) | listar/criar mensagens, avaliações, agendamentos, diagnóstico, eventos, orçamento, nome | Não + `phoneDigits` |
| SaaS | `saasOnboardingCriarEmpresa` | Não + rate limit |

**Riscos:** prova de posse fraca (`phoneDigits`/`osId`); **CPF** em `OS_CAMPOS_PUBLICOS` (`functions/os.js`); rate limit in-memory (**MÉDIO**); filtro empresa pós-query Admin (**BAIXO** custo).

---

# FASE I — Workflows

| Workflow | Secrets | Observação |
|---|---|---|
| `deploy-firebase.yml` | `FIREBASE_SA_KEY` | Gate **main-only**; último run main = **failure** (auth) |
| `tests.yml` | — | develop **success**; main **failure** (Control Center) |
| `deploy-pages.yml` | — | success recente |
| `backup-weekly.yml` | `BACKUP_DEPLOY_KEY` | schedule + dispatch |

**NÃO VERIFICÁVEL:** valor/presença real dos secrets no GitHub (sem `gh`/token).

Não há workflow `release.yml` dedicado (FATO).

---

# FASE J — Segurança

| Item | Status | Evidência |
|---|---|---|
| `sa-key.json` no disco | Presente, mode restrito | `ls`; **gitignored** |
| `.env` | Ausente | find |
| ApiKey Firebase no client | Presente (esperado público) | `env-config.js` |
| Private keys em código | Não encontradas | rg `BEGIN` |
| `FIREBASE_SA_KEY` Actions | Referenciado; deploy falha | workflow + histórico runs |
| RBAC fail-open UI | Confirmado | `permissoes.js` L77–79 |
| CPF endpoint público | Confirmado | `functions/os.js` |

**.gitignore:** cobre `.env`, `sa-key.json`; **não** lista explicitamente `*serviceAccount*` / `*.pem` (lacuna menor).

---

# FASE K — Performance

| Smell | Evidência | Severidade |
|---|---|---|
| Multi-`onSnapshot` dashboard sem unsub guardado | `dashboard-alertas-panel.js` (~5 listeners) | **ALTO** (custo + leak) |
| `getDocs` full-collection busca dashboard | `dashboard-busca.js` os/clientes/estoque | **ALTO** |
| N+1 financeiro categorias | `financeiro.js` loop `getDocs` itens | **MÉDIO** |
| Polling dashboard/alertas/alarme | vários `setInterval` | **MÉDIO** |
| CF lê até 200 docs e filtra empresa | portal/os | **BAIXO** |

---

# FASE L — Qualidade (indicadores qualitativos)

| Dimensão | Avaliação | Base |
|---|---|---|
| Organização modular | Boa | 36 pages + shared + repositories |
| Padronização tenant | Boa nas Rules; parcial no naming | `empresa_id` vs campos PT/EN |
| Coesão Functions | Média | Portal monolítico `portal.js` |
| Duplicação | Média | listagens portal; docs em plans/ |
| Legibilidade Rules | Alta | helpers nomeados + comentários |
| Testes | Boa cobertura declarada | ~53 test files; RBAC dominante |
| Dívida docs | Alta volume | 121 plans; CHANGELOG `[Unreleased]` |

**NÃO VERIFICÁVEL:** métricas ciclomáticas automatizadas (não rodadas).

---

# FASE M — Documentação

| Divergência | Evidência |
|---|---|
| Tag `v3.1.0` existe; CHANGELOG sem seção `## [3.1.0]` | CHANGELOG top = `[Unreleased]` |
| PROXIMA em Fase 4.0 COM RESSALVAS vs commits develop “incidente encerrado” | Narrativas coexistentes por fase |
| Índices: docs falam 23 READY; `main` JSON tem 14 | Drift git |
| TECHDOC em `CRM/`, não raiz | Inventário |

---

# FASE N — Git

| Ref | SHA | Nota |
|---|---|---|
| `origin/main` | `b7e260d` | = `v3.1.0^{}` |
| `origin/develop` | `2fe6973` | +5 |
| Tags | `v3.0.0`, `v3.1.0` | |

**Commits não promovidos:** `ae5b02c`, `95c7c3d`, `bb4905d` (indexes), `990086d`, `2fe6973` (docs).

Working tree local pode conter docs de Fases 3.8/4.0/4.1 ainda não commitados (**FATO** de sessões anteriores).

---

# FASE O — Matriz de riscos

| ID | Sev | Descrição | Causa | Impacto | Prob. | Mitigação |
|---|---|---|---|---|---|---|
| R1 | **ALTO** | RBAC só UI (fail-open) | Design `permissoes.js` | Atendente chama API Firestore em coleções da empresa | Alta | Enforce perfil nas Rules ou Custom Claims |
| R2 | **ALTO** | Portal/OS: `phoneDigits`/`osId` | Sem OTP/PoP | Impersonação / enumeração | Média | OTP / assinatura / CAPTCHA |
| R3 | **ALTO** | CPF em OS pública | Whitelist | Vazamento PII | Média | Remover CPF da projeção |
| R4 | **ALTO** | Storage OS read público | Decisão Portal | Enumeração de fotos | Média | Tokens assinados / paths opacos |
| R5 | **ALTO** | `config`/`pre_os`/`metadata` abertos | Rules legadas | Spam / config cross-tenant | Média | Fechar get/create; migrar config por tenant |
| R6 | **ALTO** | Drift índices prod 23 ≠ repo 14/19 | Deploy híbrido | Deploy futuro apaga/desalinha | Alta | Exportar índices prod → JSON; ff develop→main |
| R7 | **MÉDIO** | Actions Deploy Firebase falha | Secret ausente | Sem CI/CD prod | Alta | `FIREBASE_SA_KEY`/WIF |
| R8 | **MÉDIO** | CI Testes main vermelho | Control Center | Falso sinal na branch protegida | Alta | Corrigir teste na main |
| R9 | **MÉDIO** | Listeners/queries full dashboard | Falta limit/unsub | Custo Firestore / leaks | Média | limit + unsubscribe + paginação |
| R10 | **MÉDIO** | Rate limit in-memory | Design CF | Bypass cold start | Média | Redis/Firestore counters |
| R11 | **BAIXO** | `sa-key.json` local | Ops | Risco se cópia/leak máquina | Baixa | Manter gitignore; rotacionar se exposto |
| R12 | **BAIXO** | S2 PoP Portal (já rate-limited) | Débito conhecido | Abuso | Baixa | Roadmap segurança |

**P0 crítico de outage/cross-tenant massivo:** **não evidenciado** nas Rules atuais de negócio.

---

# FASE P — Plano de ação priorizado

### Correção imediata (ops/gov)

1. Exportar índices compostos de produção → alinhar `CRM/firestore.indexes.json`  
2. Fast-forward `develop`→`main` (após autorização) para incorporar `bb4905d` + docs  
3. Configurar `FIREBASE_SA_KEY`/WIF e validar um deploy Actions verde  
4. Remover `cpf` de `OS_CAMPOS_PUBLICOS` (ou mascarar)

### Curto prazo

5. Fechar Rules: `config` get, `pre_os` create, `metadata` tenant  
6. Corrigir CI Control Center na `main`  
7. Dashboard: unsub + `limit` nas queries quentes  
8. Remover `DEBUG TEMPORÁRIO`

### Médio prazo

9. Enforce RBAC em Rules ou Claims  
10. PoP/OTP Portal e OS pública  
11. Storage OS: URLs assinadas  
12. Migrar `config` para esquema por `empresa_id`

### Longo prazo

13. Unificar vocabulário `telefone`/`phone`, `createdAt`/`criadoEm`  
14. Rate limit distribuído  
15. Reduzir volume de plans órfãos / versionar CHANGELOG `3.1.0`  
16. Depcheck + ESLint imports mortos

---

# FASE Q — Pendências externas

| Dependência | O que falta | O que já foi possível |
|---|---|---|
| Credencial admin | Smoke autenticado + RBAC runtime | Shells HTML 200; redirect login |
| GitHub Secrets / `gh` | Validar secret; `workflow_dispatch` verde | Workflows lidos; runs públicos failure/success |
| Firebase/GCP Console | Auditoria IAM SA detalhada; App Check | Rules/indexes/functions via CLI owner |
| Aprovação humana | ff develop→main; deploy; tag nova | Diff 5 commits analisado |
| Sessão multi-perfil | Matriz RBAC UI | Código fail-open documentado |

---

# FASE R — Parecer final

### Resumo

Auditoria autônoma cobriu inventário, arquitetura, Rules, Storage, Functions, índices (repo+prod), workflows, smells de código/performance, git e docs — **sem modificar produção**.

### Por eixo

| Eixo | Nota |
|---|---|
| Arquitetura | Multiempresa maduro nas Rules; RBAC módulo frágil |
| Segurança | Sem P0 cross-tenant óbvio; vários P1 públicos/PII |
| Performance | Riscos claros no Dashboard (listeners/full scans) |
| Qualidade | Organização boa; dívida naming + docs |
| Governança | Drift índices e CI/CD Actions incompleto |

### Conclusão

```
🟡 RELEASE v3.1.0 — CERTIFICADA COM RESSALVAS
(auditoria de código/config NÃO eleva para SEM RESSALVAS)
```

A elevação para 🟢 continua condicionada aos gates externos (smoke autenticado + pipeline Actions), agora **acrescidos** da recomendação de **fechar o drift de índices** e tratar os P1 de superfície pública/PII no plano imediato.

---

## Apêndice — Evidências de comando (amostra)

```
prod composite indexes: 23 READY
functions ACTIVE: 16
origin/main indexes JSON: 14
origin/develop indexes JSON: 19
git main...develop: 0  5
v3.1.0^{} == origin/main: YES
```

---

*FASE 4.1 — Auditoria autônoma. READ-ONLY. Sem deploy, sem migração, sem alteração de produção.*
