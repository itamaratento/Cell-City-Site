# FASE 2.5 — Acompanhamento da Liberação (Pós-Push)

**Data:** 2026-07-17  
**Branch:** `develop` @ `a6c7a56` (sincronizada com `origin/develop`)  
**Modo:** monitoramento CI + correção automática  

> Complemento operacional: `plans/ACOMPANHAMENTO_LIBERACAO_20260717_INTERNO.md` (gitignorado).

---

## Recomendação Final

### 🟢 CI APROVADA — PRONTO PARA BACKFILL

---

## 1. Resumo Executivo

Push da release para `origin/develop` concluído. A CI remota falhou três vezes
por causas ambientais do runner (não regressão de produto). Cada falha foi
reproduzida, corrigida e revalidada. Commits posteriores (docs 2.5, fix portal
agendamento, suíte segurança Fase 2.2 na CI) também passaram.

| Run | SHA | Testes | Pages | Firebase |
|---|---|---|---|---|
| — | `cc88695` | ❌ Control Center | ✅ | ⏭️ skipped |
| — | `4afa002` | ❌ Control Center | ✅ | — |
| — | `03d9337` | ❌ Control Center | ✅ | — |
| — | `fb57b47` | ✅ success | ✅ | ⏭️ |
| **atual** | **`a6c7a56`** | **✅ success** | **✅** | ⏭️ skipped |

---

## 2. Status da CI Remota (HEAD atual)

| Workflow | Run | Conclusão |
|---|---|---|
| **Testes automatizados** | [29598467563](https://github.com/itamaratento/Cell-City-Site/actions/runs/29598467563) | **success** |
| **Deploy Pages** | [29598467319](https://github.com/itamaratento/Cell-City-Site/actions/runs/29598467319) | **success** |
| Deploy Firebase | [29598469425](https://github.com/itamaratento/Cell-City-Site/actions/runs/29598469425) | skipped (gate `main` — correto) |

Passos críticos do job `test` (todos success): Firestore Rules, Storage Rules,
Cloud Functions, RBAC, performance, integridade, onboarding, E2E, Control Center
estrutura, Control Center diagnóstico/ferramentas/manutenção.

---

## 3. Problemas Encontrados

### P1 — `_BACKUPS/` ausente no checkout limpo

| Campo | Detalhe |
|---|---|
| Sintoma | `ENOENT: scandir .../_BACKUPS` |
| Tipo | Ambiente CI (pasta gitignored) |
| Onde | `estrutura.test.mjs` — Backup das Configurações |
| Fix | `mkdirSync` antes de `readdirSync` (`4afa002`) |

### P2 — Histórico git raso (`fetch-depth: 1`)

| Campo | Detalhe |
|---|---|
| Sintoma | Central de IAs Histórico não encontra “Fase 5” no `git log` |
| Tipo | Configuração do checkout |
| Fix | `fetch-depth: 0` em `tests.yml` (`03d9337`) |

### P3 — Branch local `main` ausente no runner

| Campo | Detalhe |
|---|---|
| Sintoma | `Branch 'main' não encontrada` em Comparar Branches |
| Tipo | Ambiente CI (`checkout` só materializa a branch do evento) |
| Fix | Materializar `main` a partir de `origin/main` no workflow + teste (`fb57b47`) |

### P4 — Aviso Node 20 deprecated

Não bloqueante. Runner força Node 24 nas actions; testes Node 20 do projeto OK.

---

## 4. Correções Aplicadas

| Commit | Correção |
|---|---|
| `4afa002` | Tolerar `_BACKUPS` ausente |
| `03d9337` | Checkout com histórico completo |
| `fb57b47` | Materializar `refs/heads/main` para Comparar Branches |
| `773178a` | Portal: conflito de horário em `portalCriarAgendamento` |
| `a6c7a56` | CI: suíte `seguranca-fase22` no workflow |

Nenhuma alteração em Rules deployadas, Firebase prod ou dados de produção.

---

## 5. Evidências

- API / UI Actions: runs #72–#75 em `develop`
- Reprodução local: shallow clone (Histórico), clone sem `main` (Comparar),
  ausência de `_BACKUPS` (backup configs)
- Pós-fix: 94/94 Control Center em clone CI-like; CI remota success

---

## 6. Testes Executados

| Suíte | Onde | Resultado |
|---|---|---|
| Control Center estrutura | Local + CI | ✅ 94/94 / CI success |
| Firestore Rules | CI | ✅ |
| Storage Rules | CI | ✅ |
| Cloud Functions | CI | ✅ |
| RBAC | CI | ✅ |
| Demais passos `tests.yml` | CI | ✅ |

---

## 7. Atualizações de Documentação

- Este relatório + `_INTERNO`
- `CHANGELOG.md` / `PROXIMA_ETAPA.md` (Fase 2.5)

---

## 8. Preparação do Backfill

**Não executado.** Pronto para autorização humana:

```bash
gcloud auth print-access-token >/dev/null
node scripts/backfill-empresa-id.mjs --project prod           # dry-run
node scripts/backfill-empresa-id.mjs --project prod --execute
node scripts/validar-backfill.mjs --project prod              # exit 0
# empresas/cellcity-master → dados_migrados: true
```

**Ordem rígida (P0 2026-07-14):** validar exit 0 → flag → só então Rules via `main`.

---

## 9. Preparação da Promoção

```bash
git fetch origin
git checkout main && git merge --ff-only origin/develop
git push origin main
git tag -a v2026.07.17-saas -m "Release SaaS RC 2026-07-17"
git push origin v2026.07.17-saas
```

Somente após backfill validado.

---

## 10. Preparação do Deploy

| Artefato | Gatilho |
|---|---|
| Pages `/dev` | já atualizado no push `develop` |
| Pages produção | push `main` |
| Rules / Functions / Storage | `deploy-firebase.yml` só em `main` |

---

## 11. Riscos Residuais

| Risco | Severidade |
|---|---|
| Promover Rules sem backfill | **P0** |
| S2 sem prova de posse | Médio (decisão dono) |
| Warning Node 20 Actions | Baixo |

---

## 12. Pendências Humanas

1. **Autorizar backfill** produção (dry-run → execute → validar → `dados_migrados`)
2. Fast-forward `develop` → `main` + tag
3. Deploy Firebase
4. Smoke pós-deploy
5. (Opcional) Decisão S2 raiz

---

## 13. Parecer Técnico

A liberação pós-push está tecnicamente concluída. A CI remota passou após
correções ambientais reproducíveis; HEAD atual `a6c7a56` também verde.
Não resta falha corrigível sem autorização humana. A próxima etapa é
**backfill de produção**.

### 🟢 CI APROVADA — PRONTO PARA BACKFILL

---

*Missão FASE 2.5 encerrada. Sem backfill, merge `main`, tag ou deploy Firebase
além do Pages automático em `/dev`.*
