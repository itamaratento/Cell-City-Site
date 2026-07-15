# PRODUCAO_READINESS.md

**Missão:** Homologação e Preparação para Produção (Pós PS-6)
**IA responsável:** Claude Sonnet 5 (papel de Revisão Técnica)
**Data/hora:** 2026-07-14, sessão contínua a partir da certificação PS-6 em `develop`
**Projeto de produção:** `cellcity-crm`

---

## ⚠️ ATUALIZAÇÃO CRÍTICA (2026-07-15) — conclusão original REVOGADA

O deploy de `firestore.rules` descrito na §4 abaixo causou um **incidente P0 em
produção**: a rule nova exige `empresa_id != null` em `create` de ~43 coleções,
mas o site público (`cellcityinformatica.com.br`) publica o branch **`main`**
(9 commits atrás de `develop` no momento do deploy), que **não** injeta
`empresa_id` em nenhuma escrita (`os.js`, `crm.js`, etc. seguem sem o código
tenant-aware do PS-4/5/6). Resultado: criação de OS, cliente, lançamentos de
caixa e financeiro foram **rejeitados pelo Firestore em produção real** por
~2h28 (17:08–19:36 -03 de 2026-07-14), até o rollback.

Este relatório validou o deploy contra o código de `develop` (onde os testes
rodam) e contra o conteúdo do arquivo `firestore.rules`, mas **não validou
contra o código que a produção de fato executa** (`main`). Esse foi o erro
raiz. "310 testes passando" e "conteúdo idêntico ao arquivo do repo" não são
suficientes quando o app publicado é um branch diferente do que gerou as Rules.

**Correção aplicada** (sessão seguinte, autorizada explicitamente pelo dono):
novo ruleset criado em `cellcity-crm` com o conteúdo atualmente commitado em
`main:firestore.rules` — não a rule do PS-6. Verificado byte-a-byte idêntico
via nova leitura da API após o deploy. Produção está estável desde então.

**Efeitos colaterais do PS-6 que permanecem e são inofensivos** com as Rules
atuais (as de `main`): backfill de `empresa_id` em 822 documentos de produção
(campo extra, não lido por `main`) e `empresas/cellcity-master.dados_migrados
= true` (idem). Nenhum dado foi perdido ou corrompido.

**Estado real em 2026-07-15:** produção roda o código de `main` com as Rules
de `main` (sem isolamento multiempresa ativo). `develop@1d8e1de` (PS-6
completo) **não foi promovido para `main`** e não deve ser até que o código
de `main` seja tenant-aware nos mesmos módulos que as Rules exigirem — ou até
que as Rules deployadas correspondam exatamente ao que `main` sabe escrever.

A seção **§10 (Checklist) e o STATUS final (§ único no fim do documento)
abaixo estão INCORRETOS e mantidos apenas como registro histórico** do que
foi concluído (e mal avaliado) nesta sessão. Ver checklist corrigido no final
deste documento.

---

## 1. Resumo Executivo

A partir da certificação técnica da PS-6 em `develop` (commit `1d8e1de`, código aprovado com 310 testes automatizados passando), esta missão executou as etapas operacionais necessárias para tornar produção segura para multiempresa: auditoria do script de backfill, backfill real em `cellcity-crm`, ativação do gate de filtros por tenant, e deploy da correção de Firestore Rules em produção — cada uma confirmada explicitamente por quem responde pelo projeto antes de ser executada, dado o caráter irreversível dessas ações. Nenhuma regressão foi introduzida (suítes revalidadas pós-deploy com os mesmos resultados de antes). **Produção está operando com o isolamento multiempresa corrigido e ativo.**

---

## 2. Etapas Executadas

| # | Etapa | Confirmação | Resultado |
|---|-------|-------------|-----------|
| 1 | Revisão de consistência PS4_PS5 ↔ PS6_CERTIFICACAO_FINAL | — (leitura) | Divergência identificada e já corrigida na sessão anterior (relatório PS6 desatualizado que declarava "apto" sem rodar as suítes que continham a falha crítica) |
| 2 | Auditoria de `scripts/backfill-empresa-id.mjs` | — (leitura) | Idempotente, paginado, `updateMask` restrito a 1 campo, nunca sobrescreve valor existente. Sem rollback automatizado embutido (ver §7) |
| 3 | Dry-run em produção | Autorizado ("só dry-run") | 1235 docs, 412 ok, **822 pendentes**, 1 divergente (tenant de teste, ver §5) |
| 4 | Investigação do doc divergente | Solicitada pelo usuário | `empresas/m1xCA4OD7uZaG7kAweP6` ("itamarb") + `usuarios/itamar_...` — lixo de teste de 2026-06-25, anterior ao rollback do SaaS multiempresa. Não é cliente real |
| 5 | **Backfill real em produção** (`--execute`) | **Confirmado explicitamente** | 822 documentos corrigidos, **0 falhas** |
| 6 | Validação do backfill (`validar-backfill.mjs --project prod`) | — (leitura) | **0 pendentes, 0 erros**, 1 divergente preservado (esperado) |
| 7 | **Marcar `empresas/cellcity-master.dados_migrados = true`** | **Confirmado explicitamente** | Antes: ausente → Depois: `true` (ativa `setTenantFiltersEnabled(true)` automaticamente para todos os usuários da empresa) |
| 8 | **Deploy de `firestore.rules` corrigido em produção** | **Confirmado explicitamente** | Via REST (`firebaserules.googleapis.com`, mesmo método já usado antes neste projeto — CLI do `firebase` não estava autenticada neste ambiente). Ruleset anterior salvo em `scratchpad/rules-prod-ANTES.rules` como referência manual |
| 9 | Verificação independente do deploy | — (leitura) | Novo GET ao release confirma `rulesetName` atualizado; conteúdo publicado comparado byte a byte com `CRM/firestore.rules` local — **idêntico** |
| 10 | Revalidação pós-deploy (Firestore Rules, RBAC, Cloud Functions) | — (leitura) | **105/105, 166/166, 25/25** — mesmos números de antes do deploy, nenhuma regressão |
| 11 | Auditoria final de segurança | — (leitura) | Ver §6 |

---

## 3. Backfill — Evidência

```
=== RESUMO (--execute, cellcity-crm) ===
Documentos escaneados: 1235
Já corretos (cellcity-master): 1234
Pendentes (ausente/null): 0 → corrigidos: 0 nesta contagem final
Com OUTRO empresa_id (preservados): 1
✅ Backfill concluído sem falhas.
```

```
=== VALIDAÇÃO (validar-backfill.mjs --project prod) ===
Documentos: 1235 | Pendentes: 0 | Divergentes: 1 | Coleções vazias: 20 | Erros: 0
✅ BACKFILL VALIDADO — nenhum documento sem empresa_id.
```

---

## 4. Deploy das Rules — Evidência

- Ruleset anterior: `projects/cellcity-crm/rulesets/abfc3d9d-2605-4c70-8983-ef802214a787` (última atualização 2026-07-07 — desatualizado, sem a correção do vazamento)
- Ruleset novo: `projects/cellcity-crm/rulesets/af48644b-5635-49d6-854d-f37ddb309436` (2026-07-14T20:02:48Z)
- Verificação: `GET /releases/cloud.firestore` re-consultado após o deploy confirma `rulesetName` = novo ruleset; conteúdo do ruleset publicado comparado com `CRM/firestore.rules` local via `===` — **idêntico** (44375 caracteres em ambos)
- `firestore.rules` (raiz) e `CRM/firestore.rules` confirmados idênticos entre si antes do deploy

---

## 5. Tenant de Teste Encontrado (não é um bloqueio)

Durante o dry-run, 1 documento (`usuarios/itamar_1782406298794`) apareceu com `empresa_id` diferente de `cellcity-master`. Investigado a pedido do usuário:

- `empresas/m1xCA4OD7uZaG7kAweP6` — nome fantasia "itamarb", status "ativo", plano "profissional", criado em **2026-06-25 16:50**
- `usuarios/itamar_1782406298794` — perfil admin, vinculado a essa empresa, criado **2026-06-25 16:51**

Data compatível com o experimento de SaaS multiempresa revertido no rollback de 2026-06-27 (ver memória do projeto). É sobra de teste, não um cliente real. O backfill preservou o documento sem alterá-lo (comportamento correto). **Pendência não-bloqueante:** decidir se vale limpar esse registro de teste do banco de produção.

---

## 6. Segurança (auditoria final desta sessão)

| Item | Resultado |
|------|-----------|
| Credenciais/tokens/service account hardcoded | Nenhum encontrado no código de aplicação. Única referência a `sa-key*.json` é um path default configurável (`HOMOLOG_SA_KEY_PATH`) em script de homologação de DEV, não um segredo embutido |
| TODO/FIXME/debugger | Nenhuma ocorrência real (falsos positivos eram a palavra "TODOS" em português) |
| `console.log` com PII ainda ativo | **1 ocorrência confirmada, severidade baixa**: `CRM/pages/portal-cliente/portal.js:127` loga `sessionStorage.getItem('portal_session')` inteiro (inclui telefone) no console do próprio navegador do cliente. Exposição é local ao próprio dispositivo do cliente (não vaza para outros usuários/empresas); já documentada como pendência de baixa severidade nos relatórios anteriores (SEC-004). Não corrigido nesta sessão — fora do escopo desta missão ("não fazer refatorações desnecessárias"; é uma correção de 1 linha, trivial de aplicar numa sprint dedicada) |
| Storage Rules | Isolamento por `empresas/{empresaId}/...` com validação cross-service correta. Observação menor: paths legados (`os/`, `docs/`) permitem `delete` a qualquer autenticado sem checar perfil/tenant — mesmo comportamento pré-existente, não é regressão, escopo limitado a dados legados da Cell City |
| Permissões excessivas | Nenhuma encontrada nas Rules revisadas nesta sessão |
| Vazamento entre empresas | **Corrigido e verificado** (ver PS6_CERTIFICACAO_FINAL.md) |

**Nenhuma vulnerabilidade crítica ou alta encontrada nesta auditoria final.**

---

## 7. Performance

Sem alterações nesta sessão. Recomendações já documentadas (índices compostos adicionais, revisão de queries sem `limit()`) permanecem válidas para uma sprint futura de otimização — não bloqueiam produção.

---

## 8. Pendências

| ID | Descrição | Severidade | Bloqueia produção? |
|----|-----------|------------|---------------------|
| ~~LIMPEZA-001~~ | ✅ **Resolvida 2026-07-15**: tenant de teste "itamarb" (`empresas/m1xCA4OD7uZaG7kAweP6` + `usuarios/itamar_...`) apagado da produção após confirmação explícita do dono, backup manual prévio e verificação de ausência de referências órfãs em 8 coleções (0 docs com `empresa_id` apontando para o tenant em nenhuma delas) | Baixa | Não |
| SEC-CONSOLE-001 | `console.log` de sessão completa em `portal.js:127` | Baixa | Não |
| ROLLBACK-001 | Backfill não tem rollback automatizado (mitigado: escrita restrita a 1 campo, nunca sobrescreve valor existente; ruleset anterior salvo como referência) | Baixa (ação já concluída com sucesso) | Não |
| PITR-001 | Point-in-Time Recovery continua desabilitado em `cellcity-crm` | Média (risco operacional geral, não específico desta migração) | Não, mas recomendado habilitar |
| PS5-003 | Onboarding sem verificação de e-mail | Baixa | Não |

---

## 9. Riscos

Nenhum risco novo introduzido por esta sessão. Riscos residuais são os já listados em §8, todos de severidade baixa a média e não-bloqueantes.

---

## 10. Checklist de Produção

| Pergunta | Resposta |
|----------|----------|
| Projeto pronto para produção? | **Sim** |
| Backfill executado? | **Sim** — 822/822 documentos corrigidos, 0 falhas, validado (0 pendentes) |
| Rules implantadas? | **Sim** — verificado independentemente via API, conteúdo idêntico ao corrigido |
| Testes aprovados? | **Sim** — 105/105 Firestore Rules, 166/166 RBAC, 25/25 Cloud Functions, revalidados pós-deploy sem regressão |
| Homologação concluída? | **Sim** — isolamento entre 3 empresas (A/B/C) validado com paginação/cursor real antes do deploy; conteúdo deployado é idêntico ao testado |
| Existem riscos? | Só os de severidade baixa/média listados em §8, nenhum bloqueante |

---

## STATUS (histórico — ver ATUALIZAÇÃO CRÍTICA no topo do documento)

~~✅ **PRODUÇÃO APROVADA**~~ — **REVOGADO em 2026-07-15.** O deploy de Rules
descrito abaixo quebrou escritas em produção por ~2h28 porque validou apenas
contra `develop`, não contra o código que `main` (o branch publicado) executa.

**Evidências técnicas (válidas como registro do que foi feito, não como
aprovação):**
- Backfill real executado em `cellcity-crm`: 822 documentos corrigidos, 0 falhas, validação pós-execução confirma 0 pendentes e 0 erros. *(Efeito colateral inofensivo, permanece em produção — ver atualização no topo.)*
- `empresas/cellcity-master.dados_migrados` = `true` (confirmado por leitura pós-escrita). *(Idem — inofensivo, não lido por `main`.)*
- Firestore Rules do PS-6 foram deployadas em produção via `firebaserules.googleapis.com`, verificadas byte-a-byte idênticas ao arquivo testado — **mas o arquivo testado era o de `develop`, incompatível com o código real de `main`. Rules já revertidas para `main:firestore.rules` (ver atualização no topo).**
- Suítes revalidadas após o deploy: Firestore Rules 105/105, RBAC 166/166, Cloud Functions 25/25 — validam `develop`, não detectam incompatibilidade com `main` (nenhuma suíte testa contra o branch publicado em produção).
- Auditoria final de segurança: nenhuma credencial hardcoded, nenhum TODO/FIXME real, nenhuma permissão excessiva nova; único achado é um `console.log` de baixa severidade já documentado, sem escopo cross-tenant. *(Continua válido.)*
- Toda ação irreversível (backfill real, deploy de Rules) foi executada somente após confirmação explícita e específica do responsável pelo projeto — nenhuma foi assumida a partir de texto de missão isoladamente. *(Continua válido; o erro não foi de autorização, foi de escopo de validação.)*

### Checklist corrigido (estado real em 2026-07-15)

| Pergunta | Resposta |
|----------|----------|
| Projeto pronto para produção multiempresa? | **Não.** `main` (o que produção executa) não é tenant-aware. |
| Backfill executado? | Sim — inofensivo, mas irrelevante enquanto `main` não lê `empresa_id`. |
| Rules do PS-6 ativas em produção? | **Não** — revertidas para as Rules de `main` após o incidente P0. |
| `develop@1d8e1de` promovido para `main`? | **Não.** |
| Produção estável agora? | **Sim**, rodando `main` com as Rules de `main` (sem isolamento multiempresa). |
| Próximo passo para retomar PS-6 em produção | Tornar `main` tenant-aware nos módulos que as Rules exigem (ou ajustar as Rules para o que `main` realmente escreve) antes de qualquer novo deploy de Rules. |

**Pendências da §8 seguem válidas e não-bloqueantes para o estado atual (Rules de `main`), mas são irrelevantes para "produção multiempresa aprovada" — essa aprovação está revogada.**
