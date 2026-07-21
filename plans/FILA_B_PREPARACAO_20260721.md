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