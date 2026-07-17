# FASE 2.7 — Certificação Final Pré-Main

**Data:** 2026-07-17
**Executor:** Claude (VS Code), papel Revisão Técnica
**Natureza:** validação exclusiva — nenhum merge, tag, deploy ou alteração em produção executado.

---

## Etapa 1 — Revisão da Fase 2.3

`functions/portal.js` — `portalCriarAgendamento` (linhas 238-289) confirmado:
- Validação server-side de horário ocupado presente (linhas 268-271), antes do `.add()`.
- Usa a função compartilhada `horariosOcupadosDaEmpresa()` (linhas 226-236) — a mesma
  função é chamada por `portalListarHorariosOcupados` (linha 305). Sem duplicação de regra.
- Diff `a6c7a56..HEAD` em `functions/portal.js` confirmado como código-movimento puro
  (extração de função), sem alteração de comportamento.

**Ressalva a registrar com precisão (não omitir):** a validação impede que um novo
agendamento seja criado para um horário já ocupado por outro registro **já
persistido**. Não elimina uma janela teórica estreita de corrida entre duas
requisições **simultâneas** para o mesmo horário exato (sem reserva atômica via
`doc().create()`), decisão consciente já registrada no commit `773178a` e no
relatório da Fase 2.3. Portanto: "impossível criar dois agendamentos para o
mesmo horário" é verdade para o caso predominante (submissão não concorrente,
que era o gap real e grave), não uma garantia absoluta contra concorrência exata.

Arquivos modificados (commits `773178a`, `8cd46e5`): `functions/portal.js`,
`tests/functions/portal-cloud-functions.test.mjs`.

## Etapa 2 — Testes

- `functions/portal.js`: sintaxe válida (`node --check`).
- Suíte completa do Portal (28/28, incluindo os 3 testes novos de
  `portalCriarAgendamento`): não reexecutada localmente nesta fase — máquina
  compartilhada com RAM/swap praticamente esgotados (mesma condição da Fase
  2.3, sem melhora). Em vez de arriscar nova tentativa de emulador (na
  Fase 2.3 isso já causou processos Java órfãos por falha silenciosa do
  wrapper), a evidência usada foi a execução real em CI (run `29598467563`,
  ver Etapa 5) contra o commit `a6c7a56` — confirmado que
  `tests/functions/portal-cloud-functions.test.mjs` é **byte-idêntico** entre
  `a6c7a56` e o HEAD atual (`git diff` vazio) e que `functions/portal.js` só
  mudou por um refactor puro já verificado (Etapa 1). A suíte 28/28 daquele
  run continua sendo evidência válida para o código atual.
- Suítes locais reexecutadas nesta fase (sem necessidade de emulador):
  RBAC **181/181**, integridade **14/14**, segurança Fase 2.2 **12/12**.
- Nenhuma falha encontrada — não houve motivo para interromper.

## Etapa 3 — Auditoria multiempresa

| Componente | Arquivo | Estado |
|---|---|---|
| tenant-context | `CRM/shared/tenant-context.js` | Íntegro, sem mudança desde revisão anterior |
| tenant-resolver | `CRM/shared/tenant-resolver.js` | Íntegro |
| tenant-provider | `CRM/shared/tenant-provider.js` | Íntegro |
| repositories (tenant) | `CRM/repositories/base.repository.tenant.js` | Íntegro — injeção de `empresa_id`, filtro gateado por `dadosMigrados`, sem mudança |
| Firestore Rules | `CRM/firestore.rules` | Inalterado desde `4080ec2` (confirmado via `git log`) — mesma versão já certificada 117/117 na Fase 2.3 e confirmada verde em CI real |
| RBAC | `tests/rbac/` | 181/181 nesta fase |

Nenhuma regressão. O modelo de segurança permanece: filtros client-side
(tenant-context/repositories) são UX/defesa em profundidade — o limite real é
avaliado pelo Firestore server-side via `mesmaEmpresaRead/Create` +
`empresaDoUsuario()`, que lê `usuarios/{uid}.empresa_id` no servidor,
independente do que o cliente tenta declarar (ex.: "Modo Suporte" via
`sessionStorage` não sobrescreve a Rule).

## Etapa 4 — Coleção `config`

Confirmado sem mudança nesta fase (Rule em `CRM/firestore.rules:131-134`
idêntica; achado documentado em `COLECOES_FIRESTORE.md` §19 desde o commit
`4ce40ef`, intacto). Permanece compartilhada entre todas as empresas
(`impressao`, `horarios`, `retorno_mensagens`, `crm_pre_os_counter`,
`dock_ordem`). Impacto atual: **zero** (só `cellcity-master` em produção).
Risco documentado para quando uma 2ª empresa real for aprovada — não
corrigido nesta fase (fora de escopo: exige migração de esquema de doc ID +
backfill, não um patch de Rule). Migração **não** implementada aqui, conforme
instrução da missão.

## Etapa 5 — CI

Run validado: **`29598467563`** ("Testes automatizados"), commit `a6c7a56`,
branch `develop`, `conclusion: success`, confirmado via API pública do GitHub
(não apenas por relato). Todos os 24 steps do job `test` individualmente
`success`, incluindo Firestore Rules, Storage Rules, Cloud Functions do
Portal, RBAC, E2E e Control Center. `Deploy Pages` (run `29598467319`) também
`success`. `Deploy Firebase` (run `29598469425`) `skipped` — corretamente
gateado (`if: github.ref == 'refs/heads/main'`), como esperado em push de
`develop`. Nenhum push novo para `origin/develop` desde então (confirmado via
`git fetch` + comparação de SHA nesta fase) — não há CI mais recente a validar.

## Etapa 6 — Produção

Verificação independente via API (leitura, sem escrita):

- **Firestore Rules ativas em produção** (`firebaserules.googleapis.com`,
  projeto `cellcity-crm`): `updateTime = 2026-07-14T22:36:19Z` — **anterior**
  a toda esta sessão (2026-07-17). Confirma que nenhuma Rule foi publicada
  hoje.
- **`origin/main`**: `84977dc` (== tag `v3.0.0`), inalterado.
- **Tags**: nenhuma tag nova criada (`v3.0.0` continua a mais recente).
- **`deploy-firebase.yml`**: todo run em `develop` termina `skipped` (gate de
  branch) ou, historicamente, falhava antes mesmo do gate por falta de
  `FIREBASE_SA_KEY` (nunca configurado) — confirmado que nenhum deploy real
  de Firestore Rules/Indexes/Storage/Functions ocorreu, hoje ou em qualquer
  execução anterior a partir de `develop`.
- **Backfill**: não executado por mim nesta sessão (nenhum comando de
  backfill rodado). `plans/GATE_FINAL_BACKFILL_20260717.md` (produzido pela
  sessão concorrente, revisado nesta fase) documenta o mesmo estado —
  🟡 aprovado com ressalva, bloqueado até aprovação humana explícita.
  Tentativa de leitura direta de `empresas/cellcity-master.dados_migrados`
  via API foi bloqueada pelo classificador de permissões da ferramenta
  (acesso de leitura a dado de produção com credencial real) — respeitado,
  não contornado; a evidência acima (Rules inalteradas + nenhum backfill
  executado por esta sessão + gate de CI intacto) já é suficiente para a
  confirmação pedida nesta etapa.

**Confirmado explicitamente:** nenhum backfill executado; nenhuma Rule
publicada; nenhum deploy Firebase ocorreu; nenhuma tag criada; nenhuma
promoção para `main` ocorreu.

## Etapa 7 — Parecer técnico

| Área | Veredito |
|---|---|
| Segurança | ✅ Aprovado |
| Arquitetura | ✅ Aprovado |
| Multiempresa | ✅ Aprovado (com pendência não-bloqueante documentada: `config` compartilhado) |
| CI | ✅ Aprovado |
| Testes | ✅ Aprovado |
| Produção | ✅ Apto (nenhuma ação de produção necessária ou executada nesta fase) |

---

## Relatório Final

- **Commit analisado:** `4ce40ef` (HEAD local no início desta fase); nenhum
  commit novo criado durante a Fase 2.7 (fase 100% de leitura/validação).
- **Branch:** `develop`.
- **Estado do repositório:** working tree limpa; local 4 commits à frente de
  `origin/develop` (`a1ea1b6`, `8cd46e5`, `4ce40ef`, `eb63dd1`); 87 commits à
  frente de `origin/main`.
- **Resultado dos testes:** RBAC 181/181, integridade 14/14, segurança Fase
  2.2 12/12 (reexecutados nesta fase); Portal 28/28 com validação por CI real
  + verificação de diff byte-a-byte contra o código atual.
- **Resultado da CI:** run `29598467563` — 100% success, todos os steps
  confirmados individualmente.
- **Pendências:** migração de `config/*` para esquema por tenant (não
  bloqueia esta promoção); decisão opcional já registrada sobre reforçar
  `consultarOSPublica` (S2) além do rate-limit.
- **Riscos conhecidos:** janela teórica estreita de corrida em
  `portalCriarAgendamento` para requisições verdadeiramente simultâneas
  (aceito, documentado); corrida teórica equivalente em `excluirUsuarioAdmin`
  para dupla exclusão simultânea do último admin (aceito, documentado);
  `config` compartilhado entre empresas (só relevante quando uma 2ª empresa
  real for aprovada).
- **Próximas etapas recomendadas:** seguir a sequência já documentada em
  `PROXIMA_ETAPA.md` — backfill de produção → fast-forward `develop→main` +
  tag → deploy Firebase → smoke pós-deploy. Nenhuma delas executada nesta
  fase.

### 🟢 PRONTO PARA PROMOÇÃO À MAIN
