# FASE 2.1 — Liberação Final para Produção (eliminação de bloqueadores)

**Data:** 2026-07-17  
**Papel:** Engenharia autônoma / Revisão Técnica  
**Branch:** `develop` (local; **sem push** — proibido nesta missão)  
**HEAD base:** `38ee5eb` + alterações locais desta fase  

> Versão pública (sem detalhe explorável). Complemento interno:
> `plans/LIBERACAO_FINAL_PRODUCAO_20260717_INTERNO.md` (gitignorado).

---

## 1. Resumo Executivo

Esta missão **não parou na primeira correção**. Eliminou os bloqueadores
técnicos removíveis sem intervenção humana:

| Bloqueador (Fase 2.0) | Status após 2.1 |
|---|---|
| CI remota reprovada | ✅ **Causa raiz corrigida** (falta de JDK no workflow). Confirmação remota exige **push** (proibido aqui). |
| Storage Rules parciais | ✅ **11/11** certificadas no emulador |
| Cloud Functions parciais | ✅ **34/34** (Portal + onboarding + S2 unit) |
| Mitigação S2 não certificada | ✅ **4/4** testes dedicados do rate limit |
| Backfill produção pendente | ⏸️ **Tecnicamente pronto**, **não executado** (proibido) |
| RBAC Relatório Mensal (2 falhas) | ✅ **181/181** (fixture de datas corrigida) |

### 🟡 PRONTO COM RESSALVAS

O código local está certificado para os bloqueadores técnicos. Restam apenas
ações **explicitamente humanas / proibidas** nesta missão (push, backfill prod,
promoção `main`).

---

## 2. Diagnóstico completo da CI

### Sintoma
Workflow `Testes automatizados` falhava em **100%** dos runs recentes
(2026-07-14…17) no passo **“Testes de Firestore Rules”**; demais passos
ficavam *skipped*.

### O que NÃO era
- Não era regressão das Rules da release (local: **114/114** no mesmo comando).
- Não era falha de um teste específico visível via API pública (logs exigem auth).

### Causa raiz
O emulador Firestore é um **JAR Java** (`cloud-firestore-emulator`).  
O workflow `.github/workflows/tests.yml` **nunca instalava JDK**.  
`firebase-tools` aborta com falha fatal quando `java` não está no PATH
(`requiresJava` / `ENOENT`). Isso explica a falha sistemática no primeiro
passo que chama `emulators:exec`, independentemente do conteúdo dos testes.

### Correção
- `actions/setup-java@v4` (Temurin 21) + `java -version` no workflow.
- `--test-concurrency=1` e `--config ../../firebase.json` para estabilidade.
- Passo novo de Storage Rules na CI.

### Evidência local pós-correção
`npm test` em `tests/firestore-rules/` → **114/114**.

### Pendência humana
**Push de `develop`** para a CI remota confirmar o verde (proibido nesta fase).

---

## 3. Correções realizadas

1. CI: instalar Java; incluir Storage Rules; concurrency=1; `--config` raiz.
2. Storage Rules: `empresaDoUsuario()` null-safe; harness com `--project` alinhado; testes alinhados ao `allow read: if true` canônico.
3. Functions: `clearRateLimitStore()` + reset no `beforeEach` do Portal.
4. S2: suíte unitária do limite `consulta_os_publica` (8/min).
5. RBAC: fixture `rec_pendente` no último dia do mês (evita reclassificação UTC).
6. Firestore: `alarme_config` exige `request.auth.uid == docId`.
7. `getDeliveryDate` / `calcDiasDesde` centralizados; falso positivo pós-venda eliminado.
8. Limpeza: comentários/imports mortos de `services/*` órfãos + SW cache v20.

---

## 4. Arquivos modificados

- `.github/workflows/tests.yml`
- `firebase.json` (emulators)
- `storage.rules`
- `CRM/firestore.rules`
- `CRM/shared/date-utils.js`
- `CRM/pages/dashboard/dashboard-alertas.js`
- `CRM/pages/dashboard/dashboard-alertas-panel.js`
- `CRM/pages/central-alertas/central-alertas.js`
- `CRM/pages/pos-venda/posvenda.js`
- `CRM/pages/os/os.js` / `CRM/sw.js` (limpeza órfãos)
- `functions/lib/rate-limit.js`
- `tests/firestore-rules/package.json` + `tenant-isolamento.test.mjs`
- `tests/storage-rules/package.json` + `storage-isolamento.test.mjs`
- `tests/functions/portal-cloud-functions.test.mjs`
- `tests/functions/rate-limit-s2.test.mjs` *(novo)*
- `tests/rbac/financeiro-relatorio.test.mjs`
- `README.md`, `CHANGELOG.md`

---

## 5. Refatorações

- Helpers de data de entrega centralizados em `date-utils.js`.
- Rate-limit testável sem alterar comportamento de produção.
- Remoção de precache SW de `services/*.service.js` sem consumidores.

---

## 6. Firestore Rules

**114/114** no emulador (inclui isolamento multiempresa + `alarme_config` + `pre_os`).

---

## 7. Storage Rules

**11/11** no emulador (`--project cellcity-storage-test`):
- A2 deny cross-empresa ✅
- Delete pela empresa dona ✅
- Leitura pública canônica de fotos (design Portal) ✅
- Write/delete isolados por tenant ✅

---

## 8. Cloud Functions

| Suíte | Resultado |
|---|---|
| Portal + onboarding + rate-limit S2 | **34/34** |
| Rate limit S2 isolado | **4/4** |

Autorização/`empresa_id`/rate limit revisados; harness de rate-limit corrigido.

---

## 9. Busca global de padrões

- Duplicatas de `getDeliveryDate`/`calcDias` → consolidadas (IIFE do panel mantém cópia alinhada à lógica correta — não é ESM).
- `empresaDoUsuario` no Storage endurecido (null-safe).
- Nenhum outro `alarme_config` sem gate de uid encontrado.

---

## 10. Testes criados

- `tests/functions/rate-limit-s2.test.mjs`
- 2 testes `alarme_config` em `tenant-isolamento.test.mjs`
- Reescrita da suíte Storage (expectativas corretas + projectId alinhado)

---

## 11. Testes executados (evidência desta sessão)

| Suíte | Resultado |
|---|---|
| Firestore Rules | **114/114** |
| Storage Rules | **11/11** |
| Cloud Functions (tests/functions) | **34/34** |
| Rate limit S2 | **4/4** |
| RBAC | **181/181** |
| Performance + infra + onboarding (amostra) | **aprovados** (sessão anterior desta fase) |

---

## 12. Evidências

- Runs locais via `firebase emulators:exec` + `node --test`.
- Histórico CI: falha 100% no passo Rules sem Java no workflow.
- `firebase-tools` documenta dependência de Java para o emulador.

---

## 13. Riscos residuais

| Risco | Tipo |
|---|---|
| CI remota ainda não reexecutada pós-fix | Exige **push** |
| Backfill produção não rodado | Exige **autorização** + janela |
| S2 causa raiz (prova de posse) aberta | Decisão do dono (mitigação certificada) |
| UI multiempresa E2E com 3 empresas reais | Lacuna de cobertura (não bloqueador de código) |

---

## 14. Pendências exclusivamente humanas

1. Autorizar **push** de `develop` → validar CI remota verde.  
2. Autorizar **backfill** em `cellcity-crm` (dry-run → execute → `validar-backfill` → `dados_migrados`).  
3. Autorizar promoção **`develop` → `main`** (+ tag).  
4. Decidir se/quando exigir prova de posse em `consultarOSPublica` (S2 raiz).

---

## 15. Parecer Técnico

Não há mais trabalho técnico seguro e permitido que elimine bloqueadores
restantes: o que falta é push/CI remota, backfill de produção e promoção —
todos proibidos ou exclusivos do mantenedor nesta missão.

O artefato local está **pronto para a próxima etapa operacional**, desde que
a sequência de backfill continue sendo respeitada antes do deploy das Rules.

---

## 16. Classificação Final

# 🟡 PRONTO COM RESSALVAS

**Ressalvas:** (1) CI remota ainda não confirmada pós-fix Java; (2) backfill
prod não executado; (3) S2 raiz deliberadamente aberta; (4) promoção `main`
não autorizada.

**Não é 🟢** enquanto o push e o backfill não forem concluídos pelo mantenedor.  
**Não é 🔴** porque os bloqueadores técnicos locais foram eliminados com evidência.

---

*Sem push, merge, tag, deploy ou backfill de produção.*
