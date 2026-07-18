# FASE 4.1 — EXECUÇÃO DAS DECISÕES D01–D11 (2026-07-18)

Execução das decisões oficiais de `plans/DECISOES_FASE39_V310_20260718.md`. Commits `d71fc6b..b7d653f` na develop. Nenhum dado do Firestore foi alterado (restrição D01/D02 respeitada).

## Status por decisão

| Decisão | Status | Detalhe |
|---|---|---|
| D01 Padrão PT camelCase | ✅ registrado | doc oficial commitado; vigora p/ novos desenvolvimentos |
| D02 Legados preservados | ✅ cumprido | zero alterações de dados nesta fase |
| D03 WIF | 🟡 **80%** | criados: APIs (sts), pool `github`, provider `github-oidc` (restrito a `itamaratento/Cell-City-Site` @ `refs/heads/main`), SA `github-deploy@cellcity-crm.iam.gserviceaccount.com`; workflow migrado p/ WIF (`c48d83a`, sem secret). **PENDENTE: 5 bindings IAM** — o sandbox da sessão bloqueia concessão de papéis; executar `scripts/infra/wif-conceder-papeis.sh` (operador, ~30s) |
| D04 Correção Actions main | ✅ aplicada | `423ea5f`: tests.yml + estrutura.test.mjs materializam main E develop; validado em clone simulando push da main (1 pass/0 fail) |
| D05 Backup semanal | ✅ corrigido no script | causa-raiz: proteção de tags no Cell-City-Backup (desde ~07-12) recusa criação de tags pela deploy key — 8 falhas W28 em "push da tag de slot" com pushes de BRANCHES ok na mesma execução. Fix `3d28a27`+`b7d653f`: slots viram branches; espelhamento de tags tag-a-tag com recusa rebaixada a aviso no manifesto. Cron de domingo usa o script da develop (checkout ref: develop) — fix já vale sem promoção. **Recomendado ao operador:** bypass da deploy key no ruleset do Cell-City-Backup (restaura espelhamento de tags, ex.: v3.1.0) e, opcional, "Run workflow" manual p/ validar antes de domingo |
| D06 Índices | ✅ drift zero | `58b17b5`: firestore.indexes.json = 23/23 índices de prod (validado por export via API, 1:1) |
| D07 Catálogo | ✅ validado, **sem bug** | Catálogo é vitrine CURADA manualmente (acessórios; WhatsApp/template); não existe e nunca existiu sincronização com `produtos` (134 docs = base interna com PREÇOS DE CUSTO — não publicável). `catalogo_produtos` vazio = nenhum produto foi cadastrado na vitrine em produção. Não há "produtos ativos não publicados" (`produtos` nem possui campo `ativo`). Recomendação de backlog: importador estoque→vitrine copiando apenas campos públicos (nome, preço de venda, foto) |
| D08 Deploy via pipeline | ⏳ aguarda D03 completo | primeiro deploy CI ocorrerá na promoção (push na main dispara o workflow com WIF) ou via workflow_dispatch pós-promoção |
| D09 Homologação | ⏳ pós-deploy CI | smoke autenticado + módulos, na Fase 4.2 |
| D10 Promoção | ⏳ gates | ver abaixo |
| D11 Certificação 🟢 | ⏳ Fase 4.2 | |

## Gates da promoção (D10) — estado agora

| Gate | Estado |
|---|---|
| Pipeline verde | ⏳ CI da develop rodando em `b7d653f` (histórico: verde 2× hoje) |
| Deploy realizado pelo CI | 🔴 depende dos bindings IAM (D03) — **única pendência estrutural** |
| Backup funcional | 🟡 fix aplicado; validação real = dispatch manual ou domingo 07-19 |
| Índices sincronizados | ✅ drift zero |
| Smoke aprovado | ✅ 9/9 (Fase 3.5) + HTTP 16/16 (Fase 3.8) |

## Ações do operador (ordem)

1. **Executar** `bash scripts/infra/wif-conceder-papeis.sh` (conta owner no gcloud) — 5 bindings: 4 papéis de deploy na SA + `workloadIdentityUser` p/ o principalSet do repo. Sem isso o deploy CI falha na autenticação.
2. **(Recomendado)** Ruleset do `Cell-City-Backup`: adicionar a deploy key ao bypass da proteção de tags.
3. **(Opcional)** Actions → "Backup Semanal" → Run workflow — valida o fix antes do cron de domingo.
4. **Autorizar a promoção** develop→main (ff): o push na main dispara o Deploy Firebase via WIF (paths: indexes.json/functions/rules) e o tests.yml corrigido — se ambos verdes, Fase 4.2 fecha com smoke final e 🟢.

## Segurança

- Nenhuma chave/secret novo foi criado; WIF elimina a necessidade do `FIREBASE_SA_KEY` (D03).
- Provider OIDC com `attribute-condition` estrita (repo + ref main) — tokens de forks/outras branches são rejeitados na federação, antes de qualquer IAM.
- SA `github-deploy` ainda SEM papéis (inofensiva até o passo 1 do operador).
