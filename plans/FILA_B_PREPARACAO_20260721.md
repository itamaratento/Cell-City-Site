# FILA B — Relatório de preparação (espera controlada)

**Data:** 2026-07-21  
**HEAD:** `ce2e725` · Branch: `develop`  
**Natureza:** só leitura / inventário — **sem** alteração de código, Rules, CF, IAM, deploy  
**FILA A:** BL-007 / 009 / 010 — **não** autorizados (fora deste relatório)

---

## 1. Auditoria documental

| Item | Achado |
|------|--------|
| Fonte metodológica oficial | `GUIA_CONDUCAO_CICLOS.md` (adotado) |
| Anti-duplicação | `PADROES_DOCUMENTACAO.md` |
| Proposta autônoma genérica | `plans/PROPOSTA_FRAMEWORK_MESTRE_AUTONOMO_20260721.md` — **NÃO ADOTADA** (histórico OK) |
| Links em docs-chave (10 arquivos) | **0 quebrados** / 19 OK |
| `plans/TERMO_ENCERRAMENTO_GOVERNANCA_V320_20260721.md` | **Ausente** no tree atual (citado em conversa; não versionado ou removido) |
| HEAD Documental em `PROXIMA_ETAPA` | Ainda cita `c64dae7`; HEAD real = `ce2e725` (cadeia docs; atualizar só com auth de housekeeping) |

### Duplicações / sobreposição

- Vários “scripts autônomos” de governança na conversa → **rejeitar novos**; usar só `GUIA_CONDUCAO_CICLOS.md` + `ENGINEERING.md`.
- `MASTER_ROADMAP.md` desatualizado vs realidade 2026-07-21 (ainda fala Fase 2 “em andamento”; v3.2.0 / ADR-AUTH-001 / BL-007..011 não refletem o estado operacional). **Não é BUG** — é dívida documental de roadmap (atualização = FILA B futura ou backlog docs se autorizado).

---

## 2. Consistência ROADMAP × ADR × guias

| Documento | Papel | Consistência |
|-----------|-------|--------------|
| `PROXIMA_ETAPA.md` | Estado operacional | ✅ Espera controlada; BL abertos |
| `ADR_AUTH_001` | Autorização Alternativa A | ✅ Alinhado a PROXIMA / BACKLOG BL-011 |
| `GUIA_CONDUCAO_CICLOS.md` | Metodologia | ✅ Subordinado a ENGINEERING |
| `MASTER_ROADMAP.md` | Estratégia longa | ⚠️ Desatualizado (última narrativa ~2026-07-08; não cita ADR A / v3.2.0 homologação) |
| `ENGINEERING.md` / `CLAUDE.md` | Constituição | ✅ Autoridade máxima |

---

## 3. Inventários

### Módulos UI (`CRM/pages/`) — **36**

Inclui: dashboard, os, caixa, estoque, financeiro, crm-comercial, portal-cliente, portal-tecnico, usuarios-permissoes, saas-admin, saas-onboarding, central-*, etc.

### Shared (`CRM/shared/`) — **25** JS

Destaque RBAC/tenant: `permissoes.js`, `tenant-*.js`, `session.js`, `env-config.js`.

### Repositories — **18**

`base` + caixa, estoque, financeiro, os, portal, crm, clientes, …

### Cloud Functions — **5 arquivos** → exports em `index.js`

| Arquivo | Funções (amostra) |
|---------|-------------------|
| `admin.js` | `excluirUsuarioAdmin` |
| `os.js` | `consultarOSPublica`, `consultarOSPorTelefonePublica` |
| `portal.js` | 12× portal* |
| `saas.js` | `saasOnboardingCriarEmpresa` |
| `index.js` | reexport |

**Runtime:** `engines.node=20` · `firebase.json` `runtime: nodejs20` → **BL-007**.

### Coleções Firestore (match em `firestore.rules`) — **~70** paths

Núcleo: `os`, `clientes`, `usuarios`, `empresas`, `perfis_operacionais`, financeiro_*, caixa_*, estoque_*, portal/*, saas_*, …

### Scripts (amostra `scripts/`)

Homologação, release, backup, central-modulos, engines (health/diagnostic/execution), WIF, backfill `empresa_id`, etc.

### Testes

`tests/` ≈ **2601** arquivos `.mjs`/`.js` (inclui fixtures/gerados — contagem bruta).

### Métricas rápidas

| Métrica | Valor |
|---------|-------|
| Tag release | `v3.2.0` |
| Baseline funcional | `b663a13` |
| HEAD | `ce2e725` |
| Páginas CRM | 36 |
| Shared JS | 25 |
| Repositories | 18 |
| Functions source files | 5 |
| CF runtime | nodejs20 |
| Coleções rules (approx) | ~70 |

---

## 4. Mapa de dependências (alto nível)

```
UI pages → shared (permissoes, tenant, session, env)
         → repositories → Firestore
Portal/OS pública → Cloud Functions (portal/os)
SaaS onboarding → functions/saas.js
Auth/RBAC UI → permissoes.js + perfis_operacionais
Barreira dados → firestore.rules (auth + tenant + gates)
Deploy → CI WIF · firebase.json (nodejs20) · storage.rules (bucket pode não existir → BL-009)
```

---

## 5. Lista de riscos (preparação)

| ID | Risco | Prob. | Impacto | Mitigação |
|----|-------|-------|---------|-----------|
| R1 | Deploy CF bloqueado após 2026-10-30 (Node 20) | Alta se adiar | Alto | Autorizar **BL-007** com folga |
| R2 | Upload fotos OS sem bucket Storage | Certa hoje | Médio (feature incompleta) | Decisão Blaze **BL-009** |
| R3 | Tags backup não espelhadas | Média | Baixo | **BL-010** UI GitHub |
| R4 | Bypass matriz via SDK (Alternativa A) | Contínua | Médio (staff) | Contas controladas; ADR; opcional 6.2-B |
| R5 | MASTER_ROADMAP desatualizado | Certa | Baixo (confusão planejamento) | Atualizar roadmap quando autorizado |
| R6 | Legados sem `perfil_operacional_id` fail-open UI | Média | Médio | Migração opcional |

---

## 6. Backlog refinado + estimativas técnicas (FILA A)

| ID | Objetivo | Escopo técnico | Estimativa* | Deps | Aceite resumido |
|----|----------|----------------|-------------|------|-----------------|
| **BL-007** | nodejs22 | `functions/package.json` engines; `firebase.json` runtime; CI Node; suíte CF | **M** (0,5–1,5 d) | Auth CF; CI | Runtime 22 DEV+CI verde; rollback = reverter+redeploy |
| **BL-009** | Bucket Storage | Decisão Blaze + criar bucket; pipeline já aplica rules | **S** técnico / **decisão $** | Dono (custo) | Bucket existe; upload OS OK DEV |
| **BL-010** | Bypass deploy key | Só GitHub UI backup repo | **XS** (minutos) | Admin GitHub | Próximo backup espelha tag |
| Legados | Backfill perfil_op | Dados Auth/Firestore; sem Rules | **M–L** | Política matriz | Staff ativo com perfil_op |
| 6.2-B | Rules×matriz | Reescrever rules + emulador | **XL** | Auth Rules + ADR | Suíte Rules + RBAC runtime |

\*S/M/L/XL relativos; não são compromisso de prazo.

**Prioridade sugerida (só preparação):** BL-007 (prazo) → BL-009 (negócio) → BL-010 (baixo) → legados → 6.2-B.

---

## 7. Conclusão FILA B

| Fila | Status |
|------|--------|
| A (007/009/010) | Aguardando autorização |
| B (este relatório) | **Concluída nesta rodada** (inventário + riscos + refinamento) |

Próximo trabalho útil sem auth: opcionalmente aprofundar inventário de testes por suíte, ou checklist pré-BL-007 (versões `firebase-functions`/`admin` vs Node 22) — ainda FILA B.

```
⏸ ESPERA CONTROLADA
FILA B: preparação documentada
FILA A: bloqueada
```

---

## 8. Continuação FILA B — pré-checagem BL-007 (2026-07-21, HEAD `ce2e725`)

**Escopo:** só inventário técnico. **Não** altera `package.json` / `firebase.json` / CI.

### Situação atual

| Artefato | Valor |
|----------|--------|
| `functions/package.json` engines | `"node": "20"` |
| `firebase.json` runtime | `nodejs20` |
| `firebase-functions` (lock) | 6.6.0 |
| `firebase-admin` (lock) | 12.7.0 |
| CI `.github/workflows/tests.yml` | `node-version: "20"` |
| API das functions | **100% Gen2** (`firebase-functions/v2/https` `onCall`) |

### Compatibilidade Node 22

- Firebase documenta **Node.js 22** como runtime suportado.
- Gen1 tem histórico de rejeitar `nodejs22`; **este projeto usa Gen2** → risco Gen1 **não aplicável**.
- Deps atuais (`firebase-functions` ^6 / `admin` ^12) são adequadas como base; na execução autorizada, considerar `npm outdated` / bump leve se o CLI exigir.

### Checklist de execução (quando BL-007 for autorizado)

1. `functions/package.json` → `"engines": {"node": "22"}`  
2. `firebase.json` → `"runtime": "nodejs22"`  
3. CI `tests.yml` (e qualquer deploy workflow) → Node 22 no runner  
4. `npm ci` em `functions/` + suíte local/emulador  
5. Deploy DEV primeiro → smoke portal/OS/saas onCall  
6. Só então promoção via processo normal  
7. Rollback: reverter engines/runtime + redeploy  

### Estimativa refinada

**M** (meio dia a 1,5 dia) — mudança pequena, risco concentrado em redeploy das ~16 functions e CI.

### Bloqueio restante

Continua exigindo **autorização explícita** (Cloud Functions = módulo crítico).

---

## 9. Inventário complementar (continuação)

### Cloud Functions exportadas (16)

`excluirUsuarioAdmin` · `consultarOSPublica` · `consultarOSPorTelefonePublica` · 12× `portal*` · `saasOnboardingCriarEmpresa`

### Workflows CI

| Workflow | Papel |
|----------|--------|
| `tests.yml` | Node **20** no runner |
| `deploy-firebase.yml` | Deploy Firebase |
| `deploy-pages.yml` | GitHub Pages |
| `backup-weekly.yml` | Backup |

### Suítes em `tests/`

`control-center` · `e2e` · `firestore-rules` · `functions` · `infra` · `integrity` · `onboarding` · `os` · `performance` · `rbac` · `saas-admin` · `storage-rules`

### Scripts npm relevantes

`homologar-performance` · `auditar-arquitetura` · `homologar-central-modulos` · `testar-central-modulos`

---

## 10. Estado ao fim desta continuação

| Fila | Status |
|------|--------|
| A | Bloqueada |
| B | Pré-checagem BL-007 + inventários ✅ |

Sem implementação. Próximo ganho útil na FILA B (se ainda desejado): rascunho de diff esperado para BL-007 (texto only) ou auditoria de desatualização linha a linha do `MASTER_ROADMAP.md` — ainda sem editar o roadmap até autorização documental.

---

## 11. Rascunho de diff esperado — BL-007 (texto only; NÃO aplicar)

Arquivos previstos quando autorizado:

### `functions/package.json`
```diff
-  "engines": { "node": "20" }
+  "engines": { "node": "22" }
```

### `firebase.json`
```diff
-      "runtime": "nodejs20"
+      "runtime": "nodejs22"
```

### `.github/workflows/tests.yml`
```diff
-          node-version: "20"
+          node-version: "22"
```

### `deploy-firebase.yml`
Não fixa Node do runner hoje (só `npm ci` em `functions/` + Firebase CLI). Runtime efetivo vem de `firebase.json` / `engines`. Opcional: pin explícito Node 22 no job para alinhar ao CI de testes.

### Fora do diff mínimo
- Bump `firebase-functions` / `firebase-admin` — só se testes/CLI exigirem.
- Docs: BACKLOG BL-007 → ✅ + TECHDOC § breve + PROXIMA.

### Ordem segura pós-autorização
DEV (emulador + deploy DEV se processo permitir) → CI verde → `main`/prod via workflow existente.

---

## 12. Auditoria `MASTER_ROADMAP.md` × realidade 2026-07-21 (sem editar)

**Arquivo:** 428 linhas · banner “Atualizado em **2026-07-08**” · última seção situacional vista: **2026-07-13**.

| Afirmação no roadmap | Realidade operacional (PROXIMA / ADR / v3.2.0) | Gap |
|----------------------|-----------------------------------------------|-----|
| Objetivo: “Fase 2 em andamento” | RBAC UI integrado; release **v3.2.0** homologada; ADR Alternativa A | Desatualizado |
| Fase 2 status “🔵 Em andamento” | Sprints RBAC já concluídos na prática; enforcement Rules≠matriz = **dívida consciente (BL-011)** | Status errado |
| Diagrama “Fase 2 🔵 Em andamento” (~L324) | Idem | Desatualizado |
| Não menciona v3.2.0 / Fase 4 CI WIF / BL-007..011 | Existe em PROXIMA/BACKLOG/TECHDOC | Lacuna |
| Não menciona ADR-AUTH-001 | Modelo oficial de autorização | Lacuna |
| Fonte de verdade imediata | Deve continuar sendo `PROXIMA_ETAPA.md` (já declarado no próprio roadmap) | OK — mitiga parcialmente |

**Recomendação FILA B:** quando houver autorização **documental** (não é FILA A), acrescentar seção “Situação em 2026-07-21” + corrigir status Fase 2 / ponteiro a ADR e BL-007 — **um** patch no roadmap, sem duplicar PROXIMA.

**Não feito agora:** edição do `MASTER_ROADMAP.md` (evita mudança normativa sem pedido explícito).

---

## 13. Estado ao fim desta continuação

| Item | Status |
|------|--------|
| FILA A | Bloqueada |
| Diff BL-007 (rascunho) | ✅ §11 |
| Gaps MASTER_ROADMAP | ✅ §12 (lista; arquivo intocado) |
| Código / Rules / CF | Intocados |

```
⏸ ESPERA CONTROLADA
FILA B: preparação aprofundada
Aguardando auth FILA A ou auth documental do roadmap
```

---

## 14. Pré-checagem BL-009 — Storage / Blaze (texto only)

### Situação

| Item | Achado |
|------|--------|
| Bucket Firebase Storage | **Ausente** (guard no `deploy-firebase.yml` pula storage se count=0) |
| `storage.rules` no repo | ✅ Existe (raiz) — endurecidas (auth + empresa; fotos OS) |
| Pipeline | Já aplica rules **quando** bucket existir |
| Dependência de custo | Plano **Blaze** para criar bucket novo |

### Consumidores no código (quebrados/inúteis sem bucket)

| Arquivo | Uso |
|---------|-----|
| `CRM/pages/os/os-photo-storage.js` | `uploadBytes` fotos OS |
| `CRM/pages/central-informacoes/informacoes.js` | upload/getBytes/delete Storage |
| `CRM/scripts/firebase.js` | expõe `getStorage` / `uploadBytes` |

### Checklist quando autorizado (decisão Blaze + criar bucket)

1. Decisão administrativa de custo (prod e/ou DEV).  
2. Console Firebase → Storage → Get Started (criar bucket default).  
3. Próximo deploy `main` aplica `storage.rules` automaticamente (guard deixa de pular).  
4. Validar DEV (se bucket DEV separado) e PROD: upload foto OS + leitura com usuário autenticado mesma empresa.  
5. CORS: revisar `cors.json` (BACKLOG já nota domínio sem `www`).  
6. Homologação: 1 upload + 1 download + deny anônimo.

### Estimativa

- Decisão de negócio: **bloqueante** (dono).  
- Técnico pós-decisão: **S** (criar bucket + smoke).

---

## 15. Pré-checagem BL-010 — Bypass deploy key (texto only)

### Situação

| Item | Achado |
|------|--------|
| Repo | `Cell-City-Backup` |
| Problema | Ruleset de tags impede deploy key de criar tags; slots viraram **branches** (workaround funcional) |
| API | Plano free → rulesets **não** inspecionáveis/alteráveis via API |
| Severidade | Baixa / não-fatal (backups semanais OK) |

### Checklist (só UI GitHub — dono admin)

1. Abrir `Cell-City-Backup` → Settings → Rules → ruleset de **tags**.  
2. Adicionar a **deploy key** à lista de bypass.  
3. Rodar workflow de backup manual (ou aguardar domingo).  
4. Critério de aceite: manifesto/backup espelha **tag** (ex. `v3.2.0`), não só branch de slot.

### Estimativa

**XS** (minutos de UI) — zero código neste monorepo.

---

## 16. Rascunho textual — seção roadmap (NÃO aplicar em `MASTER_ROADMAP.md`)

Texto sugerido para autorização documental futura:

```markdown
## Situação em 2026-07-21 — Release v3.2.0; espera controlada

- Release **v3.2.0** em produção; homologação funcional 🟡 com ressalvas
  (ETAPA 6.4). Baseline Funcional Certificada: `b663a13`.
- Modelo de autorização oficial: **ADR-AUTH-001 Alternativa A**
  (Rules = auth+tenant; RBAC matriz = aplicação). BL-011 = dívida consciente.
- Estado operacional: **espera controlada** — ver `PROXIMA_ETAPA.md`.
- Backlog imediato (não autorizado automaticamente): BL-007 (nodejs22),
  BL-009 (Storage/Blaze), BL-010 (bypass tags backup).
- Fase 2 (RBAC UI nos módulos): tratar como **concluída na prática**;
  enforcement server-side da matriz permanece fora do critério oficial (ADR A).

Fonte de verdade imediata continua sendo `PROXIMA_ETAPA.md`.
```

Também corrigir no mesmo patch (quando autorizado): status Fase 2 “Em andamento” → concluída (UI) + ponteiro ADR.

---

## 17. Estado ao fim desta continuação

| Item | Status |
|------|--------|
| HEAD observado | `a7340e3` (working tree com FILA_B modificado localmente) |
| BL-009 prep | ✅ §14 |
| BL-010 prep | ✅ §15 |
| Draft roadmap | ✅ §16 (não aplicado) |
| FILA A | Bloqueada |
| Código | Intocado |

```
⏸ ESPERA CONTROLADA
FILA B: 007/009/010 preparados em texto
Próximo: autorização FILA A ou patch documental do roadmap
```

---

## 18. Rascunhos — Script Mestre por backlog (ativar só com auth)

Não são documentos normativos separados até o dono autorizar o BL; ficam aqui para não duplicar arquivos.

### Script Mestre BL-007 (nodejs22)

1. **Objetivo:** runtime CF/CI em Node 22 antes de 2026-10-30.  
2. **Escopo:** `functions/package.json` · `firebase.json` · `tests.yml` (+ opcional pin no deploy).  
3. **Fora:** Rules, Storage, produto UI.  
4. **Riscos:** redeploy 16 functions; regressão onCall portal/OS/saas.  
5. **Testes:** `tests/functions/*` · homolog portal smoke · CI `tests.yml`.  
6. **Aceite:** engines/runtime 22; CI verde; onCall smoke DEV; rollback documentado.  
7. **Rollback:** reverter 20 + redeploy.  
8. **Diff:** ver §11.

### Script Mestre BL-009 (Storage/Blaze)

1. **Objetivo:** bucket real + rules aplicadas; uploads OS/informações funcionais.  
2. **Escopo:** decisão Blaze · criar bucket · (opcional) CORS · smoke upload.  
3. **Fora:** mudança de `storage.rules` salvo correção factual.  
4. **Riscos:** custo Blaze; CORS; path multiempresa.  
5. **Testes:** `tests/storage-rules/` · upload OS autenticado · deny anônimo.  
6. **Aceite:** bucket>0 na API; deploy storage não pulado; 1 foto OS OK.  
7. **CORS gap conhecido:** `cors.json` tem `www.cellcityinformatica.com.br` e firebaseapp/web.app/localhost — **não** tem `https://cellcityinformatica.com.br` (sem www). Incluir no checklist se o domínio bare for usado.  
8. **Consumidores:** §14.

### Script Mestre BL-010 (bypass tags backup)

1. **Objetivo:** espelhar tags no `Cell-City-Backup`.  
2. **Escopo:** só GitHub UI (ruleset tags → bypass deploy key).  
3. **Fora:** este monorepo.  
4. **Aceite:** backup espelha tag (ex. v3.2.0).  
5. **Passos:** §15.

---

## 19. Métricas de testes (contagem bruta de arquivos)

| Suíte | Arquivos (aprox.) |
|-------|-------------------|
| `tests/rbac/` | 936 |
| `tests/firestore-rules/` | 826 |
| `tests/storage-rules/` | 825 (incl. node_modules locais da pasta) |
| `tests/functions/` | 3 |
| demais | ≤4 cada |

Útil para BL-007 (focar `tests/functions` + smoke) e BL-009 (`storage-rules` + smoke real).

### Módulos com import de `permissoes`

~30 arquivos em `CRM/pages/**` importam permissões (RBAC UI difundido) — consistente com ADR Alternativa A.

---

## 20. Esgotamento da FILA B (neste ciclo de espera)

| Preparação | Status |
|------------|--------|
| Inventários gerais | ✅ |
| Riscos + backlog refinado | ✅ |
| BL-007 pré-checagem + diff | ✅ |
| BL-009 / BL-010 prep | ✅ |
| Gaps MASTER_ROADMAP + draft seção | ✅ |
| Scripts Mestre rascunho A | ✅ §18 |
| Implementação FILA A | ❌ sem auth |
| Editar MASTER_ROADMAP / código | ❌ sem auth |

**Próximo trabalho útil real:** autorização de BL-007 (prazo), BL-009 (custo) ou BL-010 (UI), **ou** autorização documental para atualizar o roadmap.

Continuar gerando só auditoria genérica a partir daqui teria retorno baixo e risco de duplicação documental.