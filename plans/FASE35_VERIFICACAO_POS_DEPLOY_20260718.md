# FASE 3.5 — Verificação Pós-Deploy da v3.1.0 (2026-07-18)

Continuação da Fase 3.4 (`plans/FASE34_RESTABELECIMENTO_DEPLOY_20260717.md`). Sessão retomada com a instrução "continue". Toda evidência abaixo foi colhida por API nesta sessão (GitHub API pública + `gcloud`/REST autenticado como `itamaratento@gmail.com`, quota project `cellcity-crm`).

---

## 1. Deploy por fora do CI detectado — Rules e Functions da v3.1.0 ESTÃO em produção

O secret `FIREBASE_SA_KEY` continua sem uso: **nenhum run novo** do workflow "Deploy Firebase" após a falha 29623002802 (último run na `main` permanece o de 2026-07-18T00:24Z). Porém:

- **Firestore Rules**: release `cloud.firestore` aponta para o ruleset `965a56e8-a1a0-4064-bcb6-424ba5debfc9`, criado `00:31:48Z` e publicado `00:37:10Z` (2026-07-18). Conteúdo baixado via firebaserules API e comparado: **byte-idêntico** ao `CRM/firestore.rules` da `main` @ `b7e260d` (v3.1.0). ✅
- **Cloud Functions**: as **16 functions** exportadas por `functions/index.js` da v3.1.0 estão `ACTIVE`, todas com `updateTime` ≈ `00:39Z` — incluindo `saasOnboardingCriarEmpresa`, que era a CF SaaS ausente. ✅
- Conclusão: alguém com credenciais (fora deste CI) executou o equivalente a `firebase deploy --only firestore:rules,functions` ~15 min após o run falho. Esta sessão não identificou o autor (a API não registra ator); presume-se o operador.

**A parte Rules/Functions da janela de inconsistência Pages×Firebase está FECHADA.**

## 2. 🔴 ÍNDICES NÃO FORAM DEPLOYADOS — incidente ativo em produção

`gcloud firestore indexes composite list` (projeto `cellcity-crm`): apenas **7 índices**, todos `READY`, todos pré-v3.1.0. **Nenhum em `CREATING`.** Dos 14 definidos no `CRM/firestore.indexes.json` da `main`, **11 estão ausentes** (todos os multi-tenant com `empresa_id`).

### Evidência ao vivo (runQuery REST, limit 1)

As consultas que o código v3.1.0 emite falharam em produção com `FAILED_PRECONDITION — The query requires an index`:

- `os` where `empresa_id==` orderBy `createdAt desc` → ❌
- `clientes` where `empresa_id==` orderBy `nome asc` → ❌
- `estoque_produtos` where `empresa_id==` orderBy `nome asc` → ❌

### O filtro tenant ESTÁ ativo em produção

`empresas/cellcity-master.dados_migrados = true` (lido via REST) ⇒ `areTenantFiltersEnabled()` liga o filtro global do `base.repository.tenant.js` ⇒ toda `list()`/`onChange()` de repositório tenant injeta `where('empresa_id'==...)`.

### Telas afetadas AGORA (repositório tenant + orderBy, varredura completa em `origin/main`)

| Tela / chamada | Coleção | Índice necessário | No indexes.json? |
|---|---|---|---|
| Pós-venda (`posvenda.js:91`) | `os` | empresa_id ASC, createdAt DESC | ✅ (falta deployar) |
| Central de Alertas (`central-alertas.js:157`)* | `avaliacoes` | empresa_id ASC, createdAt DESC | ✅ (falta deployar) |
| Autoatendimento (`autoatendimento.js:44,61`) | `pre_os` | empresa_id ASC, criadoEm DESC | ❌ → adicionado em `bb4905d` |
| Catálogo admin (`catalogo.js:49`) | `catalogo_produtos` | empresa_id ASC, ordem ASC | ❌ → adicionado em `bb4905d` |
| Central Comandos (`comandos.js:200`) | `comandos` | empresa_id ASC, criadoEm DESC | ❌ → adicionado em `bb4905d` |
| Central Informações (`informacoes.js:198`) | `informacoes` | empresa_id ASC, criadoEm DESC | ❌ → adicionado em `bb4905d` |
| Chips listener (`chips.js:95`)* | `chips_cadastros` | empresa_id ASC, criadoEm DESC | ❌ → adicionado em `bb4905d` |

\* degradam com `console.warn` (não crasham a tela inteira), mas ficam sem dados.

**Não afetados** (verificado): OS e Clientes listam sem orderBy (ordenação client-side — igualdade pura não exige índice composto); Caixa usa `(empresa_id, data)` que já existe `READY` desde 2026-06-28; catálogo público filtra só por igualdade e ordena no cliente; saas-admin ordena sem where; portal usa CFs cujos índices `(telefone, createdAt)` existem.

### Correção aplicada na develop

`CRM/firestore.indexes.json`: **+5 índices** (pre_os, catalogo_produtos, comandos, informacoes, chips_cadastros) — commit `bb4905d`. Sem isso, mesmo o deploy dos índices deixaria 5 telas quebradas. Defeito tecnicamente comprovado (evidência acima) — dentro do escopo de correção do papel de Revisão.

## 3. Fix de CI da main (item 1b da Fase 3.4)

Sem mudança: continua diagnosticado, validado e **aguardando autorização** para reaplicar na develop (a reversão anterior foi sinalizada como intencional).

---

## AÇÕES DO OPERADOR (atualizadas — os índices são o único bloqueio restante da release)

1. **Deployar os índices** (URGENTE — telas quebradas em produção): na raiz do repo, branch com `bb4905d` (develop) ou após promover o fix:
   `firebase deploy --only firestore:indexes --project cellcity-crm`
   *(ou autorizar esta sessão a criar os 16 índices via `gcloud firestore indexes composite create` — 11 do arquivo + 5 novos; criação leva alguns minutos por índice).*
2. Decidir sobre o secret `FIREBASE_SA_KEY`: mesmo com o deploy manual de ontem, o CI continua incapaz de deployar — a dívida permanece.
3. Autorizar (ou não) a reaplicação do fix de CI (Fase 3.4 §1b).
4. Após índices `READY`: esta sessão reexecuta o smoke (runQuery das 7 combinações) e emite a certificação final da v3.1.0.

## Parecer

### 🟡 v3.1.0 PARCIALMENTE EM PRODUÇÃO
Código (Pages) ✅ · Rules ✅ (byte-idêntico) · Functions ✅ (16/16) · **Índices ❌ (11+5 ausentes — telas de Pós-venda, Autoatendimento, Catálogo, Comandos, Informações, Alertas e Chips degradadas/quebradas)**.
