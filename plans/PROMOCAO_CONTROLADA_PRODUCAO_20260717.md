# FASE 2.0 — Promoção Controlada para Produção

**Data:** 2026-07-17  
**Horário (início push):** 11:08:55 -03 / 14:08:55 UTC  
**Papel:** Revisão Técnica (promoção controlada — sem merge para `main`)  
**Branch publicada:** `develop`  
**Hash publicado:** `38ee5eb673ce7cc14a61c4b4e271d0c3afaf10f1`  
**Remoto:** `https://github.com/itamaratento/Cell-City-Site.git`  
**Projeto de produção:** `cellcity-crm`

> ⚠️ Repositório público: este relatório evita detalhe explorável de vulnerabilidades.
> Detalhes internos, quando existirem, ficam em `plans/*_INTERNO.md` (gitignorado).

---

## 1. Resumo Executivo

A Fase 2.0 **publicou `develop` no remoto** com sucesso e acompanhou a CI remota.
A publicação de `develop` **não** dispara deploy de Rules/Functions em produção
(`deploy-firebase.yml` exige `main` — run ficou `skipped`, como esperado).

**Bloqueadores que impedem promover para `main` nesta fase:**

1. **CI remota `Testes automatizados` FALHOU** no commit publicado
   ([run 29586785475](https://github.com/itamaratento/Cell-City-Site/actions/runs/29586785475))
   — falha no passo *Testes de Firestore Rules*; demais passos da suíte foram
   *skipped*. Logs completos da CI exigem autenticação `gh` (não disponível nesta
   sessão). **Localmente**, a mesma suíte passou **114/114**.
2. **Storage Rules não certificadas por completo** — suíte nova: **6/10**
   (A2 *deny* ok; caminhos positivos e 1 expectativa de teste inconsistente com
   `allow read: if true` no path canônico de fotos de OS).
3. **Backfill de produção NÃO executado** — pré-requisito obrigatório antes do
   deploy das Rules multiempresa (precedente P0 de 2026-07-14 documentado em
   `PRODUCAO_READINESS.md`).
4. **Resíduo S2** (consulta pública de OS sem prova de posse) permanece apenas
   mitigado por rate limit — aceite formal ainda pendente.

### 🔴 DECISÃO: PROMOÇÃO BLOQUEADA

`develop` está no remoto e rastreável. **`main` permanece bloqueada.**

---

## 2. Commits Publicados

### Etapa 1 — Validação pré-push

| Item | Resultado |
|---|---|
| Branch | `develop` |
| Working tree | limpo (após commit documental) |
| Remoto / tracking | `origin/develop` |
| Segredos | nenhum rastreado / nenhum em status |
| Temporários | nenhum |
| Conflitos | nenhum (fast-forward) |

**Commit adicional antes do push** (necessário para status limpo):

- `38ee5eb` — `docs(certificacao): registra homologação, correção cross-tenant e certificação final Fase 1.8`
  - `plans/CERTIFICACAO_FINAL_RELEASE_20260717.md`
  - `plans/CORRECAO_CROSS_TENANT_PRE_OS_20260717.md`
  - `plans/HOMOLOGACAO_FINAL_SAAS_20260717.md`

### Etapa 2 — Push

| Campo | Valor |
|---|---|
| Comando | `git push origin develop` |
| Intervalo | `d9eec7d..38ee5eb` |
| Hash enviado | `38ee5eb673ce7cc14a61c4b4e271d0c3afaf10f1` |
| Início | 2026-07-17 11:08:55 -03 |
| Duração | ~2 s |
| Resultado | ✅ sucesso |
| Pós-push | `origin/develop == local` (0 ahead / 0 behind) |

**Não executado:** merge, rebase, checkout `main`, tag de release, deploy de produção.

Commits relevantes já incluídos no intervalo publicado (amostra):

- `b6242f2` — correções de segurança (auditoria + cross-tenant `pre_os`)
- `f3936be` — suíte Storage Rules (A2) + fix de harness Firestore
- `38ee5eb` — docs de certificação Fase 1.5–1.8

---

## 3. Resultado da CI

Runs disparados pelo push de `38ee5eb`:

| Workflow | Run | Status | Conclusão |
|---|---|---|---|
| Deploy Firebase (rules + indexes + functions) | [29586785554](https://github.com/itamaratento/Cell-City-Site/actions/runs/29586785554) | completed | **skipped** (gate `main` only — correto) |
| Deploy Pages (main + develop) | [29586785499](https://github.com/itamaratento/Cell-City-Site/actions/runs/29586785499) | completed | **success** |
| Testes automatizados | [29586785475](https://github.com/itamaratento/Cell-City-Site/actions/runs/29586785475) | completed | **failure** |

### Detalhe do job `test` (falha)

| Step | Resultado |
|---|---|
| Checkout / Node 20 / npm ci (raiz, functions, firestore-rules) | ✅ |
| **Testes de Firestore Rules** | ❌ **failure** |
| Cloud Functions Portal / RBAC / Performance / Integridade / Control Center | ⏭️ skipped (cascade) |

Anotação pública: *Process completed with exit code 1* (+ warning de deprecação Node 20→24 nos actions).

**Corroboração local (mesmo comando CI: `npm test` em `tests/firestore-rules/`):**

```
# tests 114
# pass 114
# fail 0
```

**Interpretação:** a CI remota está vermelha no critério formal desta fase; a
reprodução local da suíte de Rules está verde. Histórico recente de `develop`
também mostra falhas recorrentes em `Testes automatizados` — investigar logs
completos (requer `gh auth login` / `GH_TOKEN`) antes de tratar como regressão
funcional desta release.

**Cobertura / Lint / Build de app:** não configurados na raiz (projeto estático +
ESM). Não há artefato de coverage nesta pipeline.

---

## 4. Firestore Rules

| Evidência | Resultado |
|---|---|
| Emulador real (`firebase emulators:exec --only firestore`) | **114/114** ✅ |
| Isolamento multiempresa (`tenant-isolamento` + `os-publico`) | incluso no 114/114 ✅ |
| Cross-tenant `pre_os` | coberto e aprovado ✅ |

Critério de Rules **localmente atendido**. Critério de CI remota **não atendido**
(passo correspondente falhou sem log detalhado acessível sem autenticação).

---

## 5. Storage Rules

Suíte: `tests/storage-rules/storage-isolamento.test.mjs` (nova, commit `f3936be`).

| Resultado | Valor |
|---|---|
| Execução | **6 pass / 4 fail / 10 total** |
| A2 — delete por OUTRA empresa em `os/` e `docs/` | ✅ NEGADO (correção confirmada) |
| A2 — delete pela empresa dona (`cellcity-master`) | ❌ `storage/unauthorized` + `Null value error` em `firestore.get` (lookup de `empresa_id`) |
| Canônico — empresa A CRUD próprio | ❌ write/delete unauthorized (mesmo padrão de lookup null) |
| Canônico — isolamento de leitura OS | ❌ teste espera deny; regra canônica de fotos tem `allow read: if true` (Portal/garantia) — **expectativa do teste inconsistente com o desenho documentado** |

**Parecer Storage:** a correção A2 (*deny* cross-empresa no legado) está
**evidenciada**. A certificação positiva completa **não** está fechada — harness
de lookup cross-service no emulador + 1 teste com expectativa desalinhada.
**Não certificado para promoção.**

---

## 6. Cloud Functions

| Suíte / item | Resultado | Nota |
|---|---|---|
| `tests/functions/saas-onboarding.test.mjs` | **5/5** ✅ | emulador Firestore |
| `tests/functions/portal-cloud-functions.test.mjs` | **11/25** ⚠️ | falhas em cascata por **rate limit** (`resource-exhausted` / “Aguarde 60s”) — contaminação do bucket IP do harness, não prova de regressão de autorização |
| Rate limit S2 (`consulta_os_publica` 8/min) | presente em código ✅ | `functions/lib/rate-limit.js` + `functions/os.js` |
| Deploy em produção nesta fase | **não** | workflow skipped em `develop` |

**Parecer Functions:** onboarding SaaS ok; Portal precisa de reexecução limpa
(reset de rate-limit / IPs distintos no harness) para certificação formal.
Não bloqueia por evidência de bug de autorização nova, mas **não fecha** o
critério “Cloud Functions certificadas” desta fase.

---

## 7. Homologação Multiempresa

| Camada | Evidência | Resultado |
|---|---|---|
| Firestore Rules (A/B/master) | 114/114 | ✅ isolamento completo no emulador |
| RBAC | 179/181 | ⚠️ 2 falhas pré-existentes (Relatório Mensal; idênticas em `main`) |
| UI multiempresa com empresas reais logadas | não executada nesta fase | ⏸️ lacuna conhecida (navegador / credenciais) |
| Storage isolamento positivo | 6/10 | ⏸️ incompleto (§5) |

**Confirmação pedida (A↛B, B↛C, C↛A):** comprovada no **nível de Rules** para as
coleções cobertas pelos testes de tenant. **Não** reexecutada ponta-a-ponta em
UI com três empresas reais nesta sessão.

---

## 8. Backfill

| Item | Status |
|---|---|
| Previsto no plano de migração | **SIM** — obrigatório antes das Rules fail-closed em produção |
| Executado em produção nesta fase | **NÃO** |
| Script | `scripts/backfill-empresa-id.mjs` (`--project prod`, dry-run por padrão; `--execute` para escrever) |
| Coleções | inclui `pre_os` e demais coleções de negócio |
| Sequência exigida | backfill → `validar-backfill` → `dados_migrados:true` → **só então** deploy Rules (`main`) |

**Decisão desta fase:** não executar backfill de produção sem autorização
explícita + backup confirmado na janela de operação. Mantido como
**bloqueador de promoção**.

---

## 9. Backup e Rollback

| Item | Status |
|---|---|
| `GUIA_ROLLBACK.md` | presente (código / Rules / dados) |
| `PRODUCAO_READINESS.md` | presente (inclui incidente P0 2026-07-14) |
| `backup-weekly.yml` | presente |
| Tags recentes para rollback de código | `v3.0.0`, `v2026.07.11-1009`, … |
| Tag da release candidata criada nesta fase | **não** (promoção retida) |
| Restore validado em produção nesta sessão | **não** (somente documentação/procedimentos) |

Rollback imediato, se `main` fosse promovida por engano: `git revert` /
republicar Rules anteriores conforme `GUIA_ROLLBACK.md` §5. **Não aplicável
agora** — `main` não foi tocada.

---

## 10. Riscos Residuais

| Risco | Severidade | Estado |
|---|---|---|
| CI remota vermelha sem log detalhado autenticado | 🔴 | Bloqueia promoção formal |
| Backfill de produção pendente | 🔴 | Promover Rules sem backfill = risco de outage (precedente P0) |
| Storage Rules — certificação positiva incompleta | 🟠 | A2 deny ok; harness/lookup e 1 teste desalinhado |
| Portal Functions — rate-limit no harness | 🟡 | Reexecução limpa necessária |
| S2 — consulta pública sem prova de posse | 🟡 | Mitigado; raiz aberta |
| RBAC Relatório Mensal (2 testes) | 🟡 | Pré-existente em `main` |
| UI multiempresa real não refeita nesta fase | 🟡 | Lacuna de cobertura E2E |

---

## 11. Checklist Final

| Critério da missão | Situação |
|---|---|
| ✔ develop publicado | ✅ `38ee5eb` em `origin/develop` |
| ✔ CI remota aprovada | ❌ **failure** (Firestore Rules step) |
| ✔ Storage Rules certificadas | ❌ 6/10 — incompleto |
| ✔ Cloud Functions certificadas | ⚠️ parcial (onboarding 5/5; portal rate-limited) |
| ✔ Homologação multiempresa concluída | ⚠️ Rules ✅; UI real ⏸️ |
| ✔ Backfill (quando aplicável) concluído | ❌ **não executado** |
| ✔ Backup e rollback confirmados | ⚠️ procedimentos ok; restore prod não revalidado agora |
| ✔ Nenhum bloqueador crítico restante | ❌ **há bloqueadores** |

---

## 12. Parecer Técnico

A etapa de **publicação controlada de `develop`** cumpriu o objetivo de
rastreabilidade: o remoto contém a release candidata, o deploy de produção
permanece isolado do push de `develop`, e as Pages de develop publicaram com
sucesso.

A etapa de **liberação para `main`** **não** pode ser autorizada com as
evidências desta fase. O critério explícito “CI remota aprovada” falhou; o
backfill de produção — pré-condição operacional das Rules multiempresa —
não ocorreu; Storage Rules e Portal Functions não fecharam certificação
completa.

Nenhuma promoção, tag de release ou deploy de produção foi executada.
Correções de código **não** foram abertas nesta fase além do commit
documental pré-push (necessário ao status limpo).

### Próximos passos recomendados (sob autorização)

1. `gh auth login` (ou `GH_TOKEN`) → baixar logs do run `29586785475` e
   eliminar a falha de Firestore Rules na CI (ou confirmar flakiness).
2. Corrigir harness Storage (`firestore.get` no emulador) + alinhar teste de
   leitura canônica ao `allow read: if true`.
3. Reexecutar Portal Functions com rate-limit resetado / IPs distintos.
4. Janela operacional: backup → backfill prod (dry-run → execute) → validar →
   `dados_migrados`.
5. Só então: nova Fase de promoção `develop`→`main` + tag.

---

## 13. Decisão sobre a promoção para main

# 🔴 PROMOÇÃO BLOQUEADA

**Fundamentação:** critérios obrigatórios desta fase **não** foram todos
atendidos (CI remota, Storage Rules, backfill de produção, certificação
completa de Functions). A branch `main` **não** foi alterada.

**O que está liberado:** uso de `develop` remoto como linha candidata para
CI/Pages/revisão contínua.  
**O que permanece suspenso:** merge/ff para `main`, tag de release de produção,
deploy Firebase de Rules/Functions/Storage em `cellcity-crm`.

---

*Fase 2.0 — 2026-07-17. Push exclusivo de `develop`. Sem merge, sem tag de
produção, sem deploy de produção.*
