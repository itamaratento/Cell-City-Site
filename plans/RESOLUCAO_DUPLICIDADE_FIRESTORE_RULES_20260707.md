# Resolução da duplicidade `firestore.rules` (raiz) vs `CRM/firestore.rules` — 2026-07-07

> **Status:** diagnóstico técnico definitivo, somente leitura (a remoção dos arquivos em si — §6 — não foi executada, ainda exige autorização separada).
> **Continuação de:** `plans/AUDITORIA_FIRESTORE_RULES_ORFAS_20260707.md` (mesma sessão, etapa anterior), que já tinha identificado o problema; esta etapa fecha o diagnóstico e define o plano de ação.
> **Atualização (mesma sessão, etapa seguinte):** o bloqueio do §6 (rebase em `develop`) foi resolvido — por outra sessão, em paralelo, não por esta. `COLECOES_FIRESTORE.md` §21.2/§18 já foram corrigidos com o achado final desta auditoria (só `clients`/`orders` órfãs reais no arquivo deployado; `gdrive_backup` é ativa). O plano de remoção do §6 segue **não executado**, aguardando autorização explícita.

---

## ⚠️ Achado que exige sua atenção antes de tudo (não fazia parte deste escopo)

Ao tentar entrar em `develop` para uma correção documental autorizada, encontrei um **rebase interativo em andamento, parado num conflito não resolvido em `CRM/TECHDOC.md`**, iniciado por outra sessão/processo (não por mim, nesta conversa). Detalhes:

- `git status` mostra: `interactive rebase in progress; onto bf89e53` — rebaseando `develop` sobre `bf89e53` (a ponta de `origin/develop`, com toda a Sprint 1b + hardening + promoção).
- Parou no 2º de 6 commits sendo reaplicados (`3750d07`, "TECHDOC: restaura documentação da Camada Repository (§19)"), com conflito em `CRM/TECHDOC.md` (esperado — os dois lados editaram esse arquivo de formas diferentes).
- **Nada foi perdido**: a ref `develop` continua intacta em `05b32a4` (meu commit de homologação de ontem + o commit de backup automático). O rebase está pausado exatamente onde a ferramenta o deixou; não toquei em nada.
- **Eu não mexi**: não rodei `rebase --abort`, `--continue`, nem editei o arquivo em conflito. Só constatei o estado via `git status`/`git reflog` e parei.

Isso parece ser exatamente a reconciliação entre a Camada Repository (órfã em `develop`) e a Sprint 1b/hardening (promovida via `origin/develop`) que ficou pendente desde a etapa de homologação desta sessão — provavelmente iniciada por você ou por outra sessão em paralelo. **Preciso que você (ou a outra sessão) resolva ou aborte esse rebase antes de qualquer nova tarefa que envolva `develop`** — não tentarei mexer nele sem instrução explícita seguindo justamente a diretriz de concorrência já registrada no projeto.

Por causa disso, a correção de `COLECOES_FIRESTORE.md` §21.2 (autorizada nesta etapa) **não pôde ser aplicada** — fica pendente para quando `develop` estiver destravada (ver §6).

Todo o resto desta auditoria foi feito só com leitura via `git show`/`git grep` contra a ref `main` e o histórico completo, que não são afetados pelo rebase em andamento em `develop`.

---

## 1. Confirmação oficial do arquivo de deploy

**`CRM/firestore.rules` é o único arquivo realmente usado em qualquer deploy.** Confirmado por 4 fontes independentes, todas apontando para o mesmo arquivo:

| Fonte | O que diz |
|---|---|
| `firebase.json` (raiz) | `"firestore": { "rules": "CRM/firestore.rules", ... }` |
| `CRM/firebase.json` | `"rules": "firestore.rules"` — caminho relativo a `CRM/`, resolve para o **mesmo arquivo** |
| `deploy.sh` / `DEPLOY_SAAS.sh` | Ambos fazem `cd` para a raiz do projeto antes de `firebase deploy --only firestore:rules` — usam o `firebase.json` da raiz |
| `_runtime_audit/verify-firestore-rules.mjs` | Ferramenta oficial do projeto para conferir o release ativo via API (`firebaserules.googleapis.com`) — argumento `--file` **default** é `resolve(__dirname, '../CRM/firestore.rules')` |

Não existe nenhum script, workflow (`.github/workflows/*.yml` não menciona Firestore Rules em nenhum ponto) ou configuração que aponte para o `firestore.rules` da raiz.

**Confirmação independente já existente no projeto** (não descoberta por mim, só reconfirmada): `plans/FASE_3_VALIDACAO.md` (2026-07-01) já tinha feito essa mesma verificação, indo além — comparou o *release realmente ativo em produção* via `firebaserules.googleapis.com` byte a byte contra `CRM/firestore.rules` e confirmou identidade total.

---

## 2. Origem histórica dos dois arquivos

| | `firestore.rules` (raiz) | `CRM/firestore.rules` |
|---|---|---|
| Primeiro commit | `f4d3d7d`, 2026-06-10 ("Primeiro commit") | `f4d3d7d`, 2026-06-10 (mesmo commit) |
| Eram idênticos no início? | **Não** — divergem já no primeiro commit do repositório | — |
| Último commit | `e634291`, 2026-07-01 | `e6475fb`, 2026-07-06 (hardening de segurança) |
| Padrão de commit | Genérico (`"Atualização DD/MM/AAAA-HH:MM"`) em toda a vida do arquivo | Mistura de commits genéricos (até 07-01) e commits descritivos (a partir de 07-03: BL-006, P0s, Sprint 1a/1b, hardening) |
| Nº de commits que o tocaram | 11 | 20+ |

**Interpretação:** os dois arquivos nunca foram "uma cópia que divergiu" — nasceram como dois arquivos paralelos desde o dia 1 (provavelmente uma confusão de diretório nas primeiras semanas: alguém rodou `firebase init`, editou regras, ou colou conteúdo a partir da raiz do projeto em vez de `CRM/`, sem perceber que já existia um `CRM/firestore.rules`). Os dois foram editados em paralelo, por engano, até **2026-07-01**, quando o arquivo da raiz parou de receber commits — data que coincide exatamente com o levantamento da Fase 3 (`plans/FASE_3_LEVANTAMENTO.md`), que foi a primeira vez que alguém percebeu a duplicidade.

**Este achado (data de abandono, ausência de identidade inicial) foi obtido por mim via `git log --follow -- <arquivo>`, mas a duplicidade em si e sua causa já estavam documentadas.**

---

## 3. Todas as referências encontradas

### 3.1 Referências corretas — já tratam `CRM/firestore.rules` como fonte oficial e o arquivo da raiz como stale

Estes documentos **já estão corretos**, não precisam de correção:

- `CRM/TECHDOC.md` (linha 16 e ao longo de todo o documento — sempre qualifica como `CRM/firestore.rules`)
- `GUIA_OPERACAO_AMBIENTES.md` (linha 89): *"A fonte oficial é `CRM/firestore.rules`... Os arquivos `firestore.rules`/`firestore.indexes.json` da raiz estão desatualizados — não usar."*
- `GUIA_MANUTENCAO.md` (linha 67): regista a dívida técnica explicitamente, com data de confirmação (2026-07-06)
- `GUIA_ROLLBACK.md`
- `plans/SEPARACAO_AMBIENTES_DEV_PROD.md` (linha 192)
- `plans/FASE_3_LEVANTAMENTO.md` / `plans/FASE_3_VALIDACAO.md` (a auditoria original que descobriu isso, 2026-07-01)
- `plans/AUDITORIA_GERAL_20260704.md` / `plans/AUDITORIA_EXECUTIVA_GERAL_20260704.md`
- `plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md` (já contém uma **recomendação formal de remoção**, item 9, prioridade P2 — ver §5)
- `plans/HOMOLOGACAO_SEPARACAO_AMBIENTES.md` / `plans/FASE2_PRONTIDAO_SEPARACAO_AMBIENTES.md`
- `plans/VALIDACAO_FUNCIONAL_RISCOS.md`
- `plans/fase2-sprint1-dashboard-rbac.md` (linha 168)

### 3.2 Referência que precisa de correção

- **`COLECOES_FIRESTORE.md` §21.2** (escrita por mim, mais cedo nesta mesma sessão) — analisou o arquivo da raiz como se fosse "26 regras órfãs de produção". Está **desatualizada/incorreta** à luz deste achado. Correção **bloqueada** pelo rebase em andamento (ver §0 e §6).

### 3.3 Menções antigas/neutras — não precisam de ação

Documentos que mencionam `firestore.rules` sem qualificar `CRM/`, mas que são registros históricos (não afirmam nada sobre "hoje"):

- `6_INSTRUCOES_INTEGRACAO_CRM.md` (guia de integração antigo, sem indicação de que ainda é mantido ativamente)
- `HISTORICO_PROJETO.md` (linhas 30, 66 — descrevem a árvore de arquivos do projeto num ponto específico do passado; registro histórico, correto para a época)
- `CRM/pages/pos-venda/RELATORIO_TESTES.md`, `BACKUP_POSVENDA_SAAS_FIX_2026-06-26/RELATORIO_TESTES.md`, `CRM/pages/portal-cliente/RELATORIO_HOMOLOGACAO_ETAPA3.md` — relatórios de homologação já concluídos, registro de resultado da época

### 3.4 Arquivos soltos adicionais (mesma causa raiz, ainda presentes hoje)

Confirmei que **todos ainda existem no repositório hoje** (não foram removidos apesar de recomendações desde 2026-07-04):

| Arquivo | Situação |
|---|---|
| `firestore.rules` (raiz) | Stale, 403 linhas, não deployado |
| `firestore.rules.backup` (raiz) | Cópia de backup solta |
| `firestore.rules.backup_saas_2026-06-24` (raiz) | Cópia de backup da era SaaS |
| `firebase.json.bak_catalogo_2026-06-12` (raiz) | Backup solto de config |
| `firestore.indexes.json` (raiz) | **Vazio** (`{"indexes": [], "fieldOverrides": []}`) — irmão do rules órfão |
| `CRM/firestore.rules.BACKUP_2026-07-01` | Cópia de backup solta dentro de `CRM/` |
| `CRM/firestore.rules.secure` | Rascunho antigo (2026-06-10), nunca referenciado |

---

## 4. Avaliação de risco de manter os dois arquivos

| Tipo de risco | Nível | Justificativa |
|---|---|---|
| Segurança/produção | **Nenhum** | Confirmado repetidamente (por esta auditoria e por `FASE_3_VALIDACAO.md` via API) que o arquivo da raiz nunca é deployado |
| Confusão operacional | **Alto — já materializado 2 vezes** | (1) O levantamento inicial da Fase 3 (antes da própria validação) chegou a apontar `crm_leads`/`portal_eventos` como "sem proteção" por causa do arquivo errado — corrigido na validação. (2) Eu mesmo, nesta sessão, produzi `COLECOES_FIRESTORE.md` §21.2 com a mesma análise incorreta, apesar do achado já estar documentado desde 01/07 |
| Higiene de repositório | **Médio** | 7 arquivos soltos (regras, índices, backups, rascunho) acumulados desde 2026-06-10, nunca limpos apesar de 3 recomendações formais anteriores (04/07, 04/07, 01/07) |
| Custo de não agir | **Crescente** | Cada nova auditoria "das Firestore Rules" que não souber desta armadilha corre o mesmo risco — o problema se autoperpetua até o arquivo ser removido |

---

## 5. Recomendação técnica definitiva

**Remover o arquivo da raiz e seus artefatos irmãos, mantendo `CRM/firestore.rules`/`CRM/firestore.indexes.json` como fonte única.** Esta recomendação **já existe formalmente** em `plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md` (item 9, prioridade P2, aguardando desde 2026-07-04) — esta auditoria a **reconfirma e a formaliza como pronta para execução**, não propõe algo novo.

Não recomendo "manter como referência histórica": o conteúdo do arquivo da raiz não representa nenhum estado real de produção (nunca foi idêntico ao deployado, nem no primeiro commit) — não tem valor de referência, só risco de confusão. Se algum valor histórico for desejado, o próprio `git log -- firestore.rules` já preserva o conteúdo para sempre, sem precisar do arquivo continuar solto no working tree.

---

## 6. Plano de remoção (preparado, **não executado**)

Requer autorização explícita separada (toca uma área adjacente a Firestore Rules, mesmo não sendo o arquivo ativo — regra do `CLAUDE.md` §1) e depende de `develop` estar destravada do rebase em andamento (§0).

1. **Pré-requisito:** resolver/abortar o rebase em `develop` (fora do meu escopo — aguardando você ou a outra sessão).
2. Confirmar mais uma vez, no momento da execução, que o release ativo em produção (`cellcity-crm`) e em DEV (`cellcity-crm-dev`) bate com `CRM/firestore.rules` via `node _runtime_audit/verify-firestore-rules.mjs --project <projeto>` (checagem rápida, já é prática padrão do projeto).
3. Remover em um único commit isolado (não misturar com outra mudança):
   - `firestore.rules` (raiz)
   - `firestore.rules.backup` (raiz)
   - `firestore.rules.backup_saas_2026-06-24` (raiz)
   - `firebase.json.bak_catalogo_2026-06-12` (raiz)
   - `firestore.indexes.json` (raiz, vazio)
   - `CRM/firestore.rules.BACKUP_2026-07-01`
   - `CRM/firestore.rules.secure`
4. Rodar de novo o `verify-firestore-rules.mjs` pós-remoção (deve dar exatamente o mesmo resultado do passo 2 — a remoção não deploya nada, só limpa arquivos do working tree).
5. Corrigir `COLECOES_FIRESTORE.md` §21.2 (substituir a lista de "26 regras órfãs" pelo achado correto: só `clients`/`orders` são órfãs reais, `gdrive_backup` é ativa — ver `plans/AUDITORIA_FIRESTORE_RULES_ORFAS_20260707.md`).
6. Marcar o item 9 de `plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md` como concluído.
7. Atualizar este relatório (ou o anterior) com a confirmação de execução.

**Nenhum desses passos foi executado.**

---

## 7. Documentos que precisarão ser atualizados no futuro

| Documento | O que precisa mudar | Quando |
|---|---|---|
| `COLECOES_FIRESTORE.md` §21.2 | Substituir "26 regras órfãs" pela conclusão correta (2 órfãs reais + 1 falso positivo) | Assim que `develop` destravar (bloqueado agora) |
| `plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md` | Marcar item 9 como concluído, após a remoção ser executada | Após execução do plano do §6 |
| `plans/AUDITORIA_FIRESTORE_RULES_ORFAS_20260707.md` | Adicionar nota de resolução apontando para este documento | Pode ser feito já, quando `develop` destravar (o arquivo está em `plans/`, que não depende de `develop`, mas prefiro tratar as duas correções juntas para não fragmentar o histórico) |

---

## Confirmação

Nenhuma alteração foi realizada no repositório nesta auditoria: nenhum código, nenhuma Firestore Rule, nenhum `firebase.json`, nenhuma Cloud Function e nenhum documento existente foi modificado. A correção planejada em `COLECOES_FIRESTORE.md` ficou pendente por um bloqueio externo (rebase em andamento em `develop`, não iniciado por mim) — não por decisão própria de escopo. Este relatório é novo e permanece **não commitado**.
