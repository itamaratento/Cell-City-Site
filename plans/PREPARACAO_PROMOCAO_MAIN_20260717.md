# FASE 2.9 — Preparação para Promoção à Main

**Data:** 2026-07-17  
**Branch:** `develop`  
**HEAD local:** `0547fcb`  
**origin/develop:** `a6c7a56` (local **à frente 7**)  
**Modo:** preparação / gate — **sem** merge, tag, deploy, smoke

---

## Classificação

### 🟡 PRONTO COM RESSALVAS

Código, banco (backfill + flag), e CI do SHA remoto estão aprovados.  
A promoção **não** deve partir do HEAD local sem antes publicar os 7 commits
e obter CI verde nesse SHA.

---

## ETAPA 1 — Estado do repositório

| Item | Evidência |
|---|---|
| Branch | `develop` ✅ |
| Working tree | **Limpa** ✅ |
| HEAD local | `0547fcb` — `docs(backfill): Fase 2.8 — relatório final…` |
| Remoto sincronizado | ❌ Local **ahead 7** de `origin/develop` (`a6c7a56`) |
| `main` | `84977dc` (atrás de develop — ff possível após sync) |

Últimos commits locais (incl. não publicados):

```
0547fcb docs(backfill): Fase 2.8 — relatório final com ajuste de auditoria
23a8d4b docs(backfill): registros do gate e da execução do backfill de produção
0fcde14 docs(certificacao): Fase 2.7 — certificação final pré-main
eb63dd1 docs(certificacao): relatório final da Fase 2.3 — validação pré-main
4ce40ef docs(fase2.3): registra achados e regressão da validação final pré-main
8cd46e5 refactor(portal): extrai horariosOcupadosDaEmpresa
a1ea1b6 docs(release): atualiza Fase 2.5 com HEAD a6c7a56 e CI verde
a6c7a56 ci: liga a suíte de regressão de segurança da Fase 2.2 ao workflow
```

---

## ETAPA 2 — Flag `dados_migrados`

**Procedimento oficial:** após `validar-backfill` exit 0 →  
`empresas/cellcity-master.dados_migrados = true` (ativa filtros tenant).

| Campo | Fato comprovado |
|---|---|
| Leitura | GET Firestore REST `empresas/cellcity-master` — HTTP **200** |
| Valor anterior | **`true`** |
| `updateTime` documento | `2026-07-14T20:01:18.771424Z` |
| Escrita nesta fase | **Não necessária** — já `true` |
| Valor final | **`true`** (inalterado) |

Nenhum contorno de permissão. Nenhuma invenção de valor.

---

## ETAPA 3 — Revisão da release

| Documento | Estado pré-gate | Ação |
|---|---|---|
| Backfill execução | ✅ `plans/BACKFILL_PRODUCAO_EXECUCAO_20260717.md` | OK |
| CHANGELOG | Parcial (2.3/2.5; falta 2.8/2.9 + backfill) | Atualizado nesta fase |
| PROXIMA_ETAPA.md | Desatualizado (ainda “PRONTO PARA BACKFILL”) | Atualizado nesta fase |
| Checklist produção | Sequência backfill→flag→main→deploy | Flag e backfill ✅; main pendente |

---

## ETAPA 4 — CI

| SHA | Workflows | Conclusão |
|---|---|---|
| `a6c7a56` (`origin/develop`) | Testes · Pages · Firebase | **success** · **success** · **skipped** ✅ |
| `0547fcb` (HEAD local) | — | **0 runs** ❌ (não publicado) |

Não há falhas pendentes no SHA remoto certificado.  
HEAD local **não** tem evidência de CI.

---

## ETAPA 5 — Gate final (parecer)

| Área | Parecer |
|---|---|
| **Código** | ✅ Aprovado (release em develop; commits pós-CI são docs + refactor portal já coberto por testes locais em 2.3) |
| **Banco de dados** | ✅ Aprovado (PITR ativo; backfill validado) |
| **Backfill** | ✅ Aprovado (4 docs · validar exit 0 · 0 pendentes) |
| **CI** | 🟡 Aprovada no remoto `a6c7a56`; **pendente** no HEAD local |
| **Documentação** | 🟡 Atualizada nesta fase; precisa push para refletir no remoto |
| **Produção** | 🟡 Pronta **após** sync `develop` + CI no HEAD |

---

## Relatório final (obrigatório)

| Item | Valor |
|---|---|
| Commit atual (local) | `0547fcb` |
| Branch | `develop` |
| Estado repo | Limpo; **ahead 7** de origin |
| Backfill | 🟢 4 corrigidos, 0 falhas |
| Validação | 🟢 exit 0, 0 pendentes |
| `dados_migrados` | **`true`** (já estava; sem escrita) |
| Documentação | Atualizada localmente nesta fase |
| CI | Verde em `a6c7a56`; ausente em HEAD |
| Pendências | 1) `git push origin develop` 2) CI verde no novo HEAD 3) autorização promote→main + tag 4) deploy Firebase/Rules 5) smoke |
| Próxima ação | Publicar develop → confirmar CI → autorizar promoção |

### 🟡 PRONTO COM RESSALVAS

**Ressalva principal:** remoto não sincronizado / CI não cobre HEAD local.  
Após `git push origin develop` e CI verde, reclassificar para  
🟢 PRONTO PARA PROMOÇÃO À MAIN.

---

*Sem merge, tag, deploy Firebase/Rules ou smoke nesta fase.*
