# Auditoria — Firestore Rules "órfãs" (2026-07-07)

> **Status:** diagnóstico técnico, somente leitura. Nenhum arquivo de código, regra ou documentação existente foi alterado nesta auditoria.
> **Origem:** continuação da revisão de `COLECOES_FIRESTORE.md` (2026-07-07), que havia listado "26 regras do Firestore sem código ativo correspondente" na seção §21.2.
> **Resolução (mesma sessão, etapa seguinte):** ver `plans/RESOLUCAO_DUPLICIDADE_FIRESTORE_RULES_20260707.md` para o diagnóstico definitivo da causa raiz (arquivo `firestore.rules` duplicado). `COLECOES_FIRESTORE.md` §21.2/§18 já foram corrigidos com o achado final (só `clients`/`orders` órfãs reais; `gdrive_backup` é ativa).

---

## 0. Achado crítico que muda toda a análise

A lista de 26 "regras órfãs" da revisão anterior foi montada a partir do arquivo **`firestore.rules` da raiz do repositório**. Esse **não é o arquivo implantado no Firebase**.

| | `firestore.rules` (raiz) | `CRM/firestore.rules` |
|---|---|---|
| Linhas | 403 | 488 |
| Referenciado por `firebase.json` (`"rules": "CRM/firestore.rules"`) | ❌ Não | ✅ Sim |
| Referenciado por `CRM/firebase.json` (`"rules": "firestore.rules"`, caminho relativo a `CRM/`) | — | ✅ Sim (mesmo arquivo, caminho relativo) |
| Usado por `deploy.sh` / `DEPLOY_SAAS.sh` (ambos fazem `cd` para a raiz antes de rodar `firebase deploy`) | ❌ Não | ✅ Sim |
| Último commit | `e634291`, 2026-07-01 | `e6475fb`, 2026-07-06 (hardening) |
| Recebeu as correções de segurança de 2026-07-03 a 07-06 (BL-006, `temAcessoLiberado()`, Sprint 1a/1b, hardening) | ❌ Não | ✅ Sim, todas |

**Os dois arquivos nunca foram idênticos, nem no commit inicial (`f4d3d7d`, 2026-06-10)** — não é um caso de "cópia que divergiu depois", são dois arquivos paralelos desde o primeiro dia. Entre 06-10 e 07-01 os dois receberam edições em paralelo (provavelmente sem que ninguém percebesse que eram arquivos diferentes — o padrão de commit é sempre o mesmo auto-commit genérico `"Atualização DD/MM/AAAA-HH:MM"`). A partir de **2026-07-01**, só `CRM/firestore.rules` continuou recebendo commits; a raiz parou.

**Esse risco já tinha sido identificado e documentado** em `plans/FASE_3_LEVANTAMENTO.md` (2026-07-01, linha 82): *"Divergência entre `firestore.rules` (raiz) e `CRM/firestore.rules` (deployado) | Alta | ... precisa verificação dedicada, fora do escopo deste levantamento."* A recomendação #2 daquele documento ("Reconciliar `firestore.rules` (raiz) vs `CRM/firestore.rules`") **nunca foi executada** — é exatamente o que esta auditoria fecha agora, 6 dias depois.

### Consequência direta para a lista das 26

Comparando as 26 coleções contra `CRM/firestore.rules` (arquivo real):

- **23 não têm regra nenhuma no arquivo deployado.** Nunca chegaram a produção. Não são "regras órfãs em produção" — são linhas de um arquivo que não é publicado.
- **3 têm regra real e deployada** e por isso são as únicas candidatas de fato a "regra órfã": `clients`, `orders`, `gdrive_backup`.
- Dessas 3, uma (`gdrive_backup`) **na verdade não é órfã** — tem consumidor real de código, só não apareceu nas buscas anteriores por causa do padrão de acesso usado (ver §2.3).

**Recomendação sobre o arquivo da raiz:** ver §1. **Recomendação sobre as 3 candidatas:** ver §2.

---

## 1. Diagnóstico do `firestore.rules` da raiz

| Item | Achado |
|---|---|
| Existe desde | Commit inicial do repositório (`f4d3d7d`, 2026-06-10) |
| Já foi idêntico ao deployado? | Não, em nenhum momento da história |
| Abandonado desde | 2026-07-01 (commit `e634291`) — 6 dias antes desta auditoria |
| Referenciado por algum script/config de deploy | Não — `firebase.json` (raiz) e `CRM/firebase.json` apontam os dois para `CRM/firestore.rules` |
| Referenciado em `.gitignore` ou documentação como "cópia de referência" intencional | Não encontrado |
| Risco de estar ativo em outro ambiente (ex.: `cellcity-crm-dev`) | Não — o campo `"rules"` do `firebase.json` é o mesmo para todos os projetos-alvo (`firebase use <projeto>` troca o projeto, não o caminho do arquivo de regras) |
| Conteúdo | Mistura 55 coleções que **existem** em produção (ex.: `crm_leads`, `alertas_usuario`, `portal_eventos`) com 23 que nunca foram implementadas, sem nenhuma distinção visual entre as duas categorias |

**Conclusão:** o arquivo da raiz é um artefato morto — provavelmente nasceu de uma confusão de diretório (rodar `firebase init` ou editar rules a partir da raiz em vez de `CRM/`) nas primeiras semanas do projeto, foi mantido em paralelo por engano durante ~3 semanas, e parou de ser tocado quando (aparentemente) a divergência foi notada em 2026-07-01 — mas nunca foi removido nem consolidado.

**Risco de mantê-lo como está:** baixo tecnicamente (não afeta produção, já que nada o deploya), mas **alto risco de confusão futura** — qualquer pessoa (ou IA) que audite "as regras do Firestore" lendo o arquivo errado (como aconteceu na revisão anterior desta mesma sessão) vai produzir conclusões erradas outra vez. Já aconteceu duas vezes: uma vez na auditoria original (`FASE_3_LEVANTAMENTO.md`, que não seguiu adiante) e uma vez nesta sessão.

**Recomendação técnica (requer autorização separada — implica decidir entre excluir ou arquivar um arquivo):**
1. Confirmar com o dono se o arquivo da raiz tem algum propósito conhecido (cópia de rascunho, backup manual, etc.) antes de qualquer ação.
2. Se confirmado como lixo: excluir `firestore.rules` (raiz) do repositório, ou renomeá-lo para algo inequívoco como `firestore.rules.OBSOLETO_NAO_DEPLOYADO` até a exclusão formal.
3. Atualizar `COLECOES_FIRESTORE.md` §21.2 para remover a lista de "26 regras órfãs" (que na really não existem em produção) e substituir pela informação correta desta auditoria.
4. Considerar adicionar um teste/verificação simples (`diff` entre os dois arquivos, ou simplesmente excluir o duplicado) ao processo de deploy, para que essa divergência não se repita com nenhum outro arquivo de configuração.

---

## 2. As 3 candidatas reais (regras deployadas em `CRM/firestore.rules`)

### 2.1 `clients`

| Campo | Valor |
|---|---|
| Caminho da Rule | `match /clients/{docId} { allow read, write: if false; }` (linha ~484, bloco "BLOQUEADO: Coleções legadas") |
| Origem provável | Presente desde o commit inicial do projeto (`f4d3d7d`, 2026-06-10) |
| Módulo relacionado | Nenhum — nome genérico em inglês, nunca teve página própria identificada |
| Último uso encontrado em código | Nenhum, em nenhuma branch. Só existe menção em **comentário** de `CRM/scripts/firebase.js:85` ("coleções legadas (`orders`/`clients`) que nenhuma página usa"), presente em **todas as 10 branches locais e 3 remotas** verificadas |
| Código consumidor | Nenhum |
| Branch ou backup relacionado | Nenhum — busca em todas as branches locais/remotas e em `_BACKUPS/`/`BACKUP_*` não encontrou nenhum uso real, só o comentário explicativo |
| Classificação | **Órfã** (confiança: **95%**) |
| Risco de remoção | **Baixo** — já é `if false`; removê-la da regra não muda nenhum comportamento (Firestore nega por padrão qualquer caminho sem `match` correspondente, então o efeito de "se `false`" e "sem regra nenhuma" é idêntico) |
| Recomendação | Remover junto com `orders` (ver 2.2) numa limpeza única — baixíssimo risco, ação puramente cosmética |

### 2.2 `orders`

| Campo | Valor |
|---|---|
| Caminho da Rule | `match /orders/{docId} { allow read, write: if false; }` (bloco "BLOQUEADO: Coleções legadas") |
| Origem provável | Presente desde o commit inicial do projeto (`f4d3d7d`, 2026-06-10) |
| Módulo relacionado | Nenhum — nome genérico em inglês, sugere um protótipo muito inicial antes de `os` virar o nome definitivo |
| Último uso encontrado em código | Nenhum. Há um comentário em `CRM/pages/pos-venda/posvenda.js:82` ("CORREÇÃO: OS são salvas na coleção 'os', não 'orders'") — presente em todas as branches — que confirma que em algum momento inicial havia confusão sobre o nome certo, corrigida no código há muito tempo |
| Código consumidor | Nenhum |
| Branch ou backup relacionado | Nenhum uso real encontrado em nenhuma branch ou pasta de backup |
| Classificação | **Órfã** (confiança: **95%**) |
| Risco de remoção | **Baixo** — mesmo raciocínio de `clients` |
| Recomendação | Remover junto com `clients` |

### 2.3 `gdrive_backup` — ⚠️ NÃO é órfã

| Campo | Valor |
|---|---|
| Caminho da Rule | `match /gdrive_backup/{docId} { allow read, write: if request.auth != null && temAcessoLiberado(); }` |
| Origem provável | Presente desde o commit inicial (`f4d3d7d`, 2026-06-10) — e **atualizada em 2026-07-04** junto com ~45 outras coleções reais, quando a função `temAcessoLiberado()` foi aplicada mecanicamente a todas as coleções de negócio (ver `CRM/TECHDOC.md`, P0 de segurança parte 2) |
| Módulo relacionado | **Diário** — backup de registros no Google Drive |
| Último uso encontrado em código | **Ativo, hoje**: `CRM/shared/gdrive-backup.js` (linhas 21, 47, 53, 92, 99, 113, 119) lê/escreve `doc(db, 'gdrive_backup', '_credenciais')` e `doc(db, 'gdrive_backup', moduleKey)` — só que via `doc(db, ...CREDS_DOC)` (spread de um array `['gdrive_backup', '_credenciais']`), padrão que não aparece numa busca direta por `collection(db,'gdrive_backup')`/`doc(db,'gdrive_backup',...)` como as demais 25 coleções desta lista |
| Código consumidor | `CRM/shared/gdrive-backup.js` → importado por `CRM/pages/diario/diario-gdrive.js` → importado por `CRM/pages/diario/diario.js` (módulo Diário real, ativo em produção) |
| Branch ou backup relacionado | Presente e idêntico em `main` e `develop` (não é exclusivo de uma branch experimental) |
| Classificação | **Ativa** (confiança: **90%** — o encadeamento de imports até `diario.js` é real e verificado, mas não confirmei em runtime que a função que dispara essa leitura/escrita é de fato chamada pela UI hoje; ficou como diagnóstico estático) |
| Risco de remoção | **Alto** — remover a rule quebraria o backup no Google Drive do módulo Diário em produção |
| Recomendação | **Não remover.** Ação corretiva real: atualizar `COLECOES_FIRESTORE.md` (fora do escopo desta auditoria, precisa autorização separada) para mover `gdrive_backup` de "não documentada" para a seção §18 (Sincronização e Backup), junto de `cc_lixeira`/`cc_gdrive_logs`. Também vale registrar o padrão `doc(db, ...array)` como um novo ponto-cego de busca (além de constantes locais e Camada Repository), para auditorias futuras não repetirem o erro. |

---

## 3. As 23 entradas que **não existem** no arquivo deployado

Não são "regras órfãs de produção" — são linhas de um arquivo (`firestore.rules` da raiz) que nunca é publicado. A classificação `Ativa/Legado/Órfã/Indeterminada` não se aplica no sentido de risco de segurança (não há regra real para avaliar); o que resta é entender a origem de cada uma, só por completude histórica.

| Coleção | Origem (commit, data) | Contexto | Confiança da origem |
|---|---|---|---|
| `assinaturas` | `0b145b1`, 2026-06-24 | SaaS Multiempresa (revertido 2026-06-27) — rastreada a `_BACKUPS/.../saas/saas.js` | 85% |
| `financeiro_cat_despesas` | `0b145b1`, 2026-06-24 | Rastreada a `_BACKUPS/.../homologacao/homologacao.js` (página interna de auto-teste, hoje inexistente) | 80% |
| `fornecedores` | `0b145b1`, 2026-06-24 | Provável versão genérica anterior a `fornecedor_compras`/`fornecedor_tendencias`; citada como risco em `plans/FASE_3_LEVANTAMENTO.md` | 70% |
| `categorias_wpp` | `478f7c1`, 2026-06-17 | Provável categorização de campanhas WhatsApp, nunca implementada (o módulo Campanhas usa só `ClientesRepository`) | 55% |
| `robo_atividade` | `478f7c1`, 2026-06-17 | Rastreada a `_BACKUPS/.../central-organizacao/central.js` (versão antiga, pré-refatoração) — nome sugere integração com bot (possivelmente relacionado ao projeto irmão `Robo-Instagram`, fora deste repositório) | 60% |
| `auditoria_logs` | `dfb11fa`, 2026-06-28 | Rastreada a `_BACKUPS/.../homologacao/homologacao.js`; provável nome anterior a `auditoria_usuarios_permissoes`/`auditoria_saas` | 75% |
| `automacao_execucoes` | `dfb11fa`, 2026-06-28 | Citada em `plans/AUDITORIA_GERAL_20260704.md`; nenhum módulo de "automação" chegou a existir no código | 50% |
| `automacao_logs` | `dfb11fa`, 2026-06-28 | Mesma origem/contexto de `automacao_execucoes` | 50% |
| `backup_historico` | `dfb11fa`, 2026-06-28 | Citada em `plans/FASE_3_VALIDACAO.md`; provável nome anterior a `backup_logs` | 65% |
| `chat_historico` | `dfb11fa`, 2026-06-28 | Comentário "PRIVADO: Chat interno" no próprio arquivo — funcionalidade de chat interno nunca construída | 55% |
| `configuracoes` | `dfb11fa`, 2026-06-28 | Rastreada a `_BACKUPS/.../shared/home-prefs.js` — nome antigo, hoje é `config` (singular) | 80% |
| `diario_metas` | `dfb11fa`, 2026-06-28 | Comentário "PRIVADO: Diário técnico" ao lado de `diario_registros`/`diario_eventos` (reais) — funcionalidade de metas do Diário planejada, não construída | 55% |
| `encomendas` | `dfb11fa`, 2026-06-28 | Sem origem rastreada — nome sugere um módulo de encomendas/pedidos nunca construído | 40% |
| `estoque_config` | `dfb11fa`, 2026-06-28 | Sem origem rastreada — provável config granular do Estoque, hoje inexistente (Estoque não tem tela de configuração própria) | 45% |
| `estoque_movimentacoes` | `dfb11fa`, 2026-06-28 | Citada em `plans/FASE_3_LEVANTAMENTO.md`/`FASE_3_VALIDACAO.md` — provável log de entradas/saídas de estoque mais granular que o atual (`estoque_produtos` só guarda saldo) | 60% |
| `historico_alertas` | `dfb11fa`, 2026-06-28 | Comentário "PRIVADO: Produtividade pessoal" ao lado de `alertas_usuario` (real) — histórico de alertas nunca implementado | 50% |
| `lancamentos_caixa` | `dfb11fa`, 2026-06-28 | Citada em `plans/FASE_3_LEVANTAMENTO.md`/`FASE_3_VALIDACAO.md` — nome invertido de `caixa_lancamentos` (real), provável erro de nomenclatura nunca corrigido no arquivo da raiz | 70% |
| `lixeira` | `dfb11fa`, 2026-06-28 | Rastreada a `_BACKUPS/.../homologacao/homologacao.js`; nome genérico anterior a `cc_lixeira` (real, escopo Diário/Drive) | 65% |
| `monitoramento` | `dfb11fa`, 2026-06-28 | Sem origem rastreada — nome genérico, comentário próprio "PRIVADO: Monitoramento e configurações gerais" | 40% |
| `pendencias` | `dfb11fa`, 2026-06-28 | Citada em `plans/FASE_3_VALIDACAO.md` — nome genérico, possivelmente pensado para o módulo Financeiro | 50% |
| `preferencias_sistema` | `dfb11fa`, 2026-06-28 | Sem origem rastreada — hoje as preferências reais ficam em `usuarios/{uid}/preferencias/*` (subcoleção), não numa coleção de 1º nível | 45% |
| `tarefas_robo` | `dfb11fa`, 2026-06-28 | Comentário "PRIVADO: Robô WhatsApp" ao lado de `robo_atividade` — mesma família de bot nunca integrado a este repositório | 55% |
| `teste_caixa` | `dfb11fa`, 2026-06-28 | Comentário "PRIVADO: Temporários / debug" — claramente um nome de teste, nunca teve consumidor | 70% |

**Nota sobre confiança:** os percentuais acima refletem confiança na *origem/motivo histórico* de cada entrada, não confiança em "pode remover com segurança" — como nenhuma delas tem regra no arquivo deployado, a segurança de removê-las do arquivo da raiz é **100% (nenhum efeito em produção)**, independente da origem.

---

## 4. Tabela de prioridade de limpeza (sequência sugerida)

| Prioridade | Ação | Onde | Risco | Requer autorização de |
|---|---|---|---|---|
| 1 | Corrigir `COLECOES_FIRESTORE.md` §21.2 — remover a lista de "26 órfãs" baseada no arquivo errado, documentar `gdrive_backup` como ativa em §18 | `COLECOES_FIRESTORE.md` | Nenhum (só documentação) | Autorização de edição de doc (já concedida em geral, mas não nesta etapa específica) |
| 2 | Decidir o destino do `firestore.rules` da raiz (excluir, arquivar ou formalizar como intencional) | `firestore.rules` (raiz) | Baixo (arquivo não deployado) | Decisão do dono — envolve excluir um arquivo do repositório |
| 3 | Remover as entradas `clients` e `orders` de `CRM/firestore.rules` (arquivo real) | `CRM/firestore.rules` | Baixo (já são `if false`) | Alteração de Firestore Rules — autorização explícita separada |
| 4 | Revisitar as 23 entradas do arquivo da raiz *só* se a decisão do item 2 for "reconciliar conteúdo" em vez de excluir — nesse caso, decidir uma a uma se algum dia farão parte do arquivo real | — | N/A | Decisão de produto/arquitetura |

---

## 5. Dependências encontradas

- `gdrive_backup` depende de `CRM/shared/gdrive-backup.js` → `CRM/pages/diario/diario-gdrive.js` → `CRM/pages/diario/diario.js` (produção real).
- Nenhuma outra dependência de código, Cloud Function ou branch foi encontrada para as demais 25 coleções desta auditoria.

## 6. Riscos

- **Nenhum risco de produção** identificado nesta auditoria (nenhuma alteração foi feita; o achado sobre `gdrive_backup` é preventivo — evita que uma limpeza futura a remova por engano).
- **Risco documental residual:** a seção §21.2 de `COLECOES_FIRESTORE.md` (entregue na etapa anterior desta sessão) está desatualizada à luz deste achado e deveria ser corrigida antes de ser tratada como referência.
- **Risco de repetição:** sem alguma reconciliação do arquivo da raiz, a próxima pessoa (humana ou IA) que auditar "as regras do Firestore" sem saber deste achado pode cometer o mesmo erro pela terceira vez.

## 7. Recomendações (resumo)

1. Não remover `gdrive_backup` — está ativa.
2. `clients`/`orders`: seguros para remover de `CRM/firestore.rules` quando autorizado (baixíssimo risco, puramente cosmético).
3. Decidir o destino do `firestore.rules` da raiz — esse é o achado de maior valor desta auditoria, maior que a limpeza das regras em si.
4. Corrigir `COLECOES_FIRESTORE.md` §21.2 numa próxima etapa autorizada.

---

## Confirmação

Nenhuma alteração foi realizada no repositório nesta auditoria: nenhum código, nenhuma Firestore Rule, nenhuma Cloud Function e nenhum documento existente foi modificado. Este arquivo é novo e permanece **não commitado**, conforme o escopo autorizado.
