# 📋 BACKLOG — Cell City Gestão Operacional

> Itens aprovados pelo usuário para sprint futura, ainda **sem autorização de implementação**.
> Cada item só sai daqui via processo formal (Planejamento → Aprovação → Implementação isolada → Backup → Homologação → TECHDOC → Encerramento).

---

## BL-001 — Indicador permanente de usuário + perfil na barra superior

**Origem:** solicitação do usuário em 2026-07-02, durante a homologação do RBAC Sprint 2 (CRM + Agenda).
**Prioridade sugerida:** alta para UX/homologação, não bloqueante para o Sprint 2.
**Sugestão de janela:** junto ou logo após um dos próximos sprints da Fase 2 (é transversal e ajuda a homologar os Sprints 3-5).

### O que o usuário pediu

Exibir permanentemente na barra superior (próximo à data/hora ou em outro local de destaque) o usuário autenticado e o perfil ativo, ex.:

- 👤 Itamar | Administrador
- 👤 Caixa 01 | Caixa
- 👤 Financeiro 01 | Financeiro
- 👤 Técnico 01 | Técnico

**Motivação declarada:** hoje o sistema não informa em nenhum lugar quem está logado nem com qual perfil — dificulta a homologação do RBAC, aumenta o risco de operar com o perfil errado e torna a auditoria menos clara.

**Complemento do usuário (2026-07-02):** exibir **os dois perfis quando existirem**, não só um:

- **Usuário:** Itamar
- **Perfil RBAC:** Administrador
- *(Opcional)* **Perfil legado:** Administrador

Motivo: durante a migração pode haver divergência entre o perfil legado (kernel) e o perfil do RBAC novo — exibir só um deles dificulta o diagnóstico de problemas de permissão. Isso resolve a "decisão de produto pendente" registrada abaixo: a resposta é **ambos** (o RBAC em destaque; o legado ao menos acessível, ex. em tooltip/hover ou linha secundária, a definir no planejamento visual).

### Levantamento preliminar (feito em 2026-07-02, só leitura)

- **Duas superfícies a cobrir:**
  1. **Dashboard** — tem topbar própria com data/hora (`clock-display`/`date-text` em `CRM/pages/dashboard/`); a brand bar compartilhada NÃO é injetada lá.
  2. **Demais páginas** — `CRM/shared/brand-header.js` injeta a barra superior (`#crm-brand-bar`, layout logo | título central | botões à direita) em todas as páginas exceto o Dashboard. É o ponto natural para o indicador nas páginas internas.
- **Dados já disponíveis sem nenhuma leitura extra:** `kernel.js` já exporta `getNome()` e `getPerfil()` (perfil legado do kernel: master_admin/admin/gerente/tecnico/atendente).
- **Dado que exige leitura extra:** o **perfil operacional** (RBAC novo — Administrador/Caixa/Financeiro/Técnico etc.) não está no `ctx` do kernel. Precisa de `usuarios/{uid}.perfil_operacional_id` → `perfis_operacionais/{id}.nome`. `shared/permissoes.js` já lê esses documentos ao carregar a matriz, mas hoje não guarda/expõe o **nome** do perfil — uma extensão pequena (ex.: `getPerfilOperacionalNome()`) resolveria sem leitura de rede adicional.
- **Decisão de produto — RESOLVIDA pelo usuário em 2026-07-02:** exibir **ambos os perfis** (RBAC em destaque + legado quando existir divergência ou sempre, a definir no planejamento visual). Fallback para usuário não migrado (sem `perfil_operacional_id`): exibir só o legado.
- **Componentes tocados (estimativa):** `CRM/shared/brand-header.js` (+ possivelmente `CRM/shared/permissoes.js` para expor o nome do perfil, e a topbar do Dashboard). Atenção: brand-header é compartilhado por quase todas as páginas — mudança de risco médio, exige homologação visual ampla.

### Regras para quando for implementado

- Processo formal completo (planejamento → aprovação → backup → homologação → TECHDOC).
- Não alterar `kernel.js`/`firebase.js` — consumir só API pública existente.
- Fail-open visual: falha ao obter o perfil nunca pode quebrar a barra — exibir só o nome, ou nada.

---

---

## BL-002 — PWA instalado a partir de `/dev` abre em produção

**Origem:** auditoria de dependências da Fase 1 do plano de separação de ambientes (`plans/SEPARACAO_AMBIENTES_DEV_PROD.md`), 2026-07-03.
**Prioridade sugerida:** média — só afeta quem instala o CRM como PWA a partir do `/dev`; não bloqueia a Fase 1 nem a Fase 5 desse plano.

### O que foi encontrado

`CRM/manifest.json` tem `start_url: "/CRM/"` e `scope: "/"` absolutos. Se alguém instalar o app como PWA a partir de `cellcityinformatica.com.br/dev/...`, o atalho instalado abre em `/CRM/` (produção), não em `/dev/CRM/`. É uma instância concreta do achado já registrado no plano ("74 arquivos com paths absolutos `/CRM/`"), específica do fluxo de instalação de PWA — os casos de teste atuais da homologação (F-15, CX-03) cobrem navegação/redirect, não instalação de PWA.

### Regras para quando for implementado

- Processo formal completo (planejamento → aprovação → homologação).
- Provável solução: `manifest.json` servido dinamicamente (ou dois manifests) para que `start_url`/`scope` respeitem o ambiente atual — decisão de desenho a fazer no planejamento, não nesta entrada.
- Adicionar caso de teste PWA-01 na homologação da separação de ambientes antes de considerar resolvido.

---

## BL-003 — `cors.json` não lista o domínio sem `www`

**Origem:** mesma auditoria da Fase 1 (2026-07-03).
**Prioridade sugerida:** baixa — gap pré-existente em produção, não introduzido pela separação de ambientes.

### O que foi encontrado

`cors.json` (raiz, usado tanto em produção quanto será reaproveitado para o bucket DEV na Fase 1) libera como origem `https://www.cellcityinformatica.com.br`, mas não `https://cellcityinformatica.com.br` (sem `www`). `CRM/shared/env-config.js` trata os dois como produção igualmente — se algum cliente acessa o domínio sem `www` e tenta um upload/download de Storage, pode esbarrar em erro de CORS.

### Regras para quando for implementado

- Processo formal completo (planejamento → aprovação → backup → homologação).
- Mudança é em arquivo compartilhado por produção e DEV — testar os dois ambientes antes de publicar.

---

---

## BL-004 — Módulo de Controle de Cotas Firebase (CRÍTICO)

**Origem:** solicitação do usuário em 2026-07-03, decorrente do esgotamento real de cota Firestore em produção (2026-07-02, ~13:30 BRT, plano Spark) e da criação do ambiente DEV na separação de ambientes ([[project-fase1-separacao-ambientes-status]] nas memórias — ver `plans/SEPARACAO_AMBIENTES_DEV_PROD.md` e `plans/RELATORIO_COTA_FIRESTORE_20260702.md`).
**Prioridade sugerida:** alta — proteção ativa contra estouro de cota/faturamento inesperado, especialmente relevante agora que o `cellcity-crm-dev` está no plano Blaze (pay-as-you-go, sem teto automático de gasto). **Sequenciamento (confirmado pelo usuário em 2026-07-03):** (1) concluir a separação DEV/PROD, (2) validar que os dois ambientes funcionam de forma independente (homologação completa, ver `plans/HOMOLOGACAO_SEPARACAO_AMBIENTES.md`), (3) só então implementar este item. Não adicionar módulo novo enquanto a infraestrutura da separação ainda está sendo consolidada.

### Objetivo

Módulo permanente do CRM para monitorar em tempo real o consumo das cotas do Firebase (produção e DEV), evitando estouro de franquia gratuita ou cobranças inesperadas.

### Localização proposta

Dentro do **módulo de Auditoria** do CRM, junto com saúde do sistema, logs, alertas e monitoramento — um único lugar para consultar antes de operações de alto consumo.

### O que monitorar

- **Firestore:** leituras, escritas, exclusões.
- **Storage:** espaço utilizado, uploads, downloads.
- **Authentication:** operações relevantes, se houver métrica disponível.

### Dashboard

Painel com barra de progresso por métrica (leituras/escritas/exclusões Firestore, Storage — armazenamento/uploads/downloads —, Auth, demais serviços usados). Para cada recurso, exibir: cota oficial do Google, consumo atual, percentual utilizado, **saldo restante**, horário do próximo reset (quando aplicável), e status geral (🟢 Normal / 🟡 Atenção / 🔴 Crítico).

### Histórico

Consumo por hora, por dia, por semana; gráfico de evolução; maior pico do dia; tendência de consumo.

### Política automática de limiares

- **80%** → alerta amarelo (atenção).
- **90%** → alerta vermelho (crítico).
- **95%** → **bloqueio automático** de operações que aumentem o consumo (scripts, varreduras, cargas em lote, uploads em massa etc.).

### Integração com a IA (Claude)

Antes de executar operações de alto consumo (leituras/escritas em lote, backups, migrações), consultar este painel. Acima de 95%, interromper automaticamente a operação e informar o motivo ao usuário.

### Fonte dos dados

Priorizar métricas oficiais do Google Cloud/Firebase (Cloud Monitoring, Billing, APIs de métricas); complementar com contadores internos do CRM onde não houver métrica oficial exposta.

### Regras para quando for implementado

- Processo formal completo (planejamento → aprovação → backup → homologação → TECHDOC).
- Módulo novo e isolado — não altera módulos existentes do CRM além da integração com Auditoria.
- Definir explicitamente as fontes de métrica oficiais disponíveis por API antes do planejamento (nem toda métrica do Firebase tem endpoint de leitura simples — validar viabilidade técnica de cada item do dashboard antes de aprovar o desenho final).
- Considerar que o bloqueio automático em 95% não pode travar operações críticas de produção (ex.: login, OS, Caixa) — só operações de alto consumo not-essenciais (scripts/cargas em lote).

---

---

## BL-005 — Política Inteligente de Consumo de Cotas Firebase

**Origem:** solicitação do usuário em 2026-07-03, como camada de política complementar ao BL-004 (módulo/dashboard de cotas) — BL-004 mede e exibe o consumo, BL-005 define o comportamento (do programador humano e da IA) em função do que o painel mostra.
**Prioridade sugerida:** alta, mesmo motivo do BL-004. **Depende do BL-004** (o painel de cotas é o que fornece o percentual usado nas regras abaixo) — não faz sentido implementar isoladamente. Mesmo sequenciamento do BL-004: só depois de (1) concluída e (2) homologada a separação de ambientes DEV/PROD.

### Objetivo

Garantir que o ambiente DEV nunca ultrapasse as cotas gratuitas do Firebase e que tarefas de alto consumo só rodem quando houver margem suficiente.

### Faixas de consumo e comportamento

| Faixa | Status | Comportamento |
|---|---|---|
| 0–50% | 🟢 Normal | Execução normal |
| 50–80% | 🟡 Atenção | IA avalia o impacto antes de iniciar tarefas grandes |
| 80–90% | 🟠 Cautela | Evitar novas tarefas pesadas; priorizar só desenvolvimento de baixo consumo |
| 90–95% | 🔴 Crítico | Somente operações essenciais |
| ≥95% | ⛔ Bloqueio | Bloqueio automático de tarefas que aumentem o consumo |

### Comportamento esperado da IA (Claude)

- Antes de qualquer tarefa que possa consumir muitas leituras/escritas/uploads/consultas, consultar o painel de cotas (BL-004).
- Acima de 50%: avaliar se a tarefa pode esperar; se não for urgente, sugerir adiar para depois do reset diário, com uma mensagem no estilo: "Esta operação consumirá muitas cotas. O ambiente já utilizou mais de 50% da cota diária. Recomendo executá-la após o reset diário."
- Acima de 95%: **não iniciar** a tarefa (ou **cancelar automaticamente** se já estiver em andamento e cruzar o limiar durante a execução — não só bloquear no início). Sem pedir confirmação: registrar no log, informar o motivo, aguardar o próximo ciclo de reset. Mensagem padrão (texto final definido pelo usuário em 2026-07-03): "Operação bloqueada automaticamente para preservar as cotas diárias do Firebase. Aguarde o próximo ciclo de renovação ou reduza o consumo antes de executar esta tarefa."

### Painel — campo adicional

Além do que o BL-004 já lista: **consumo previsto** (estimativa de quando a cota vai esgotar, com base na tendência de consumo do dia) — ajuda a decidir se vale iniciar uma tarefa grande sem esperar chegar em 95% para descobrir.

### Painel — informações de reset

Exibir (no mesmo painel do BL-004): percentual consumido, horário previsto do próximo reset diário, tempo restante até o reset.

### Regras para quando for implementado

- Processo formal completo (planejamento → aprovação → backup → homologação → TECHDOC), junto com o BL-004.
- Definir explicitamente o que conta como "tarefa que pode esperar" vs. "operação essencial" antes do planejamento — sem essa definição a regra de 50%/90% fica subjetiva demais para implementar de forma consistente.
- A regra de bloqueio acima de 95% precisa da mesma ressalva do BL-004: nunca travar operações essenciais de produção (login, OS, Caixa), só tarefas de alto consumo não-essenciais.

---

## BL-006 — 🔴 CRÍTICO DE SEGURANÇA: escalada de privilégio via auto-escrita em `usuarios/{uid}` — ✅ CORRIGIDO E ACEITO (2026-07-03)

**Origem:** descoberto durante a validação de rules da Fase 4 (separação de ambientes), 2026-07-03, ao reproduzir o caso RBAC-06 da homologação.
**Severidade:** 🔴 Crítica. **Pré-existente em PRODUÇÃO** — não foi introduzido pela separação de ambientes (as rules do DEV são cópia idênticas das de produção, deployadas na Fase 2 e verificadas via API).

**STATUS FINAL:** corrigido, testado (6 cenários reais no DEV, todos passaram) e **aceito formalmente pelo dono em 2026-07-03**. Gate removido da homologação da separação de ambientes. Rule já publicada e verificada no DEV (`develop`, commit `eb6fa72`); produção segue com a rule original vulnerável até a promoção `develop` → `main` ser autorizada. Ver seção "Correção aplicada" abaixo.

### A falha

A rule de `usuarios/{uid}` (`CRM/firestore.rules`, ~linha 208) permite que o dono do doc escreva **qualquer campo** do próprio documento:

```
match /usuarios/{uid} {
  allow read, write: if request.auth != null && (
    request.auth.uid == uid ||
    get(.../usuarios/$(request.auth.uid)).data.perfil in ['admin', 'master_admin']
  );
}
```

Como o campo `perfil` está **dentro** desse mesmo doc, e é exatamente o campo que todas as outras rules consultam para autorizar admin (`get(...).data.perfil in ['admin','master_admin']`), qualquer usuário autenticado comum pode:

1. Fazer `PATCH usuarios/{seu-uid}` com `perfil: "master_admin"` — **permitido** pela cláusula `request.auth.uid == uid`.
2. A partir daí, passar em toda checagem de admin do sistema (escrever em `perfis_operacionais`, ler `auditoria_usuarios_permissoes`, gerenciar outros usuários etc.).

**Comprovado no DEV** (teste isolado com o usuário `cellcityestoque`, perfil `atendente`): o `PATCH` do próprio `perfil` para `master_admin` retornou HTTP 200 e o valor foi persistido. Revertido em seguida.

### Impacto

Qualquer conta autenticada (inclusive as anônimas? — a verificar) pode se auto-promover a administrador via chamada REST direta ao Firestore, sem passar pela UI. O RBAC de interface não protege contra isso (nunca protegeu — a segurança real são as rules). Afeta produção hoje.

### Correção aplicada (2026-07-03)

Rule `usuarios/{uid}` reescrita separando `read`/`create`/`update`/`delete`: `create` continua livre (auto-provisionamento do `kernel.js`/`_buildContext()` preservado), `update` do próprio dono agora exige que `perfil`/`perfil_operacional_id`/`empresa_id`/`status` fiquem inalterados (só admin/master_admin mexem nesses campos), `delete` preserva o comportamento original.

**6 testes reais no DEV, todos passaram:** exploit original bloqueado (403), campo não-sensível ainda editável pelo dono (200), leitura preservada (200), admin edita outro usuário (200), admin muda perfil de outro usuário (200), criação no primeiro login preservada (200, testado com usuário novo real).

Deploy de rules feito via Firebase CLI, verificado via API antes e depois. Merge em `develop` (commit `eb6fa72`). **Produção confirmada com a rule vulnerável original, intocada** (esperado — nada promovido ainda).

### Aceite formal (2026-07-03)

> "Registro o aceite formal do BL-006. Considero a correção validada tecnicamente com base nos testes apresentados e removo esse gate da homologação. A partir deste momento, o único bloqueio restante para a promoção à produção é a homologação funcional completa do ambiente DEV. Após a homologação, caso não sejam encontrados problemas, autorizarei a promoção da branch `develop` para `main` seguindo o procedimento padrão e com backup prévio."

RBAC-06 do checklist de homologação passa a ter resultado esperado atualizado (ver `plans/HOMOLOGACAO_SEPARACAO_AMBIENTES.md`) — não é mais bloqueante para a decisão de negócio, só falta a execução do teste em navegador junto com o resto do checklist.

### Regras (histórico)

- Processo formal seguido (planejamento → aprovação → backup de `CRM/firestore.rules` → deploy DEV → verificação API → aceite formal do dono).
- **`CRM/firestore.rules` é arquivo sensível** — alteração de rules afeta os dois ambientes; testado no DEV primeiro, produção não tocada.

---

*Novos itens de backlog devem ser adicionados abaixo, com numeração sequencial BL-XXX.*

---

## BL-007 — Upgrade do runtime das Cloud Functions: nodejs20 → nodejs22 — ✅ CONFIG APLICADA (2026-07-23)

**Status:** engines/`firebase.json`/CI → **nodejs22**. Runtime em **produção** aplica no próximo deploy de Functions.
**Relatório:** [`plans/PACOTE_COTA_BL007_20260723.md`](PACOTE_COTA_BL007_20260723.md)

**Origem:** aviso do Firebase CLI no deploy CI de 2026-07-19 (Fase 4.3): Node.js 20 depreciado em 2026-04-30, **descomissionamento em 2026-10-30** — após essa data novos deploys seriam bloqueados.

### Plano de migração (planejamento — Fase 4, item de encerramento)

1. **Pré-checagem:** confirmar suporte a nodejs22 nas dependências de `functions/package.json` (firebase-functions, firebase-admin — atualizar se preciso).
2. **Mudanças:** `functions/package.json` → `"engines": {"node": "22"}`; conferir se `firebase.json` (`functions[].runtime: nodejs20`) precisa ir a `nodejs22`; alinhar Node dos workflows (`tests.yml` usa Node 20 no runner).
3. **Testes:** suíte completa local + CI (emulador roda no Node do runner); atenção a diferenças de ICU/timezone.
4. **Deploy:** promoção normal via CI (pipeline da Fase 4.3); primeiro deploy recria as 16 functions no novo runtime (sem "Skipped").
5. **Rollback:** reverter commit e redeployar (runtime volta junto); functions v2 mantêm revisões no Cloud Run.

## BL-008 — Harness `homologar-performance` reprova indevidamente (parser TAP vs spec) — ✅ CORRIGIDO (2026-07-21)

**Origem:** Fase 4.3 (2026-07-19) — harness marcou 4 suítes como ❌ "NaN pass/NaN fail" com exit 0, e emitiu REPROVADO com todos os testes passando (RBAC 181/181 confirmado manualmente).
**Prioridade sugerida:** média (afeta confiabilidade do veredito automático, não o produto).

### Causa e correção sugerida

`scripts/homologacao/lib/tests-runner.mjs` (`parseNodeTestSummary`) só entende o reporter *spec* (`ℹ pass N`), mas `node --test` sob `spawnSync` (não-TTY) emite TAP (`# pass N`). Corrigir: aceitar os dois formatos (ou forçar `--test-reporter=spec` no spawn) e tratar `exitCode === 0` como aprovação quando o parse falhar, registrando aviso.

### Correção aplicada (2026-07-21)

`parseNodeTestSummary()` passou a reconhecer os dois formatos (spec e TAP), inclusive para a lista de testes que falharam; `runSuite()` só cai no fallback por `exitCode` quando nenhum dos dois formatos bate, registrando `warning` explícito (nunca aprova em silêncio). Bônus encontrado durante a validação: `audit.mjs` tinha um bug relacionado (`.trim()` da saída inteira do `git status --porcelain` comia o 1º caractere do 1º arquivo listado) — corrigido junto. Validado rodando a suíte real de ponta a ponta antes/depois (RBAC 181/181 e Polling gating 4/4 voltam a aparecer como ✅ com contagem real). Detalhe técnico completo em `CRM/TECHDOC.md` §48. Nenhum arquivo protegido tocado; sem autorização adicional exigida (fora dos 10 gatilhos do Modo Acelerado Autônomo).

## BL-009 — Decisão: criar bucket Firebase Storage (exige Blaze)

**Origem:** Fase 4.3 (2026-07-19) — constatado que o projeto **nunca teve** bucket Firebase Storage; releases de storage.rules apontavam para bucket inexistente. Upload de fotos de OS depende disso para existir de verdade.
**Prioridade sugerida:** decisão administrativa do dono (custo: exige plano Blaze desde out/2024 para buckets novos).
**Nota técnica:** o workflow de deploy já está preparado — quando o bucket existir, o passo de Storage aplica `storage.rules` (já endurecidas, A2) automaticamente.

## BL-010 — Cell-City-Backup: bypass da deploy key no ruleset de proteção de tags

**Origem:** D05 (Fase 4.1, 2026-07-18) — proteção de tags no repo Cell-City-Backup impede a deploy key de espelhar tags (ex.: v3.1.0+); slots de backup viraram branches (funcional). Item de UI do GitHub (plano free não expõe via API).
**Prioridade sugerida:** baixa (não-fatal; backups semanais estão verdes).
**Ação:** no GitHub UI do Cell-City-Backup: Settings → Rules → ruleset de tags → adicionar a deploy key ao bypass list; depois validar espelhamento de tags no próximo backup.

## BL-011 — 🟡 Firestore Rules ≠ matriz `perfis_operacionais` (dívida consciente — ADR-AUTH-001)

**Status (2026-07-21, ETAPA 6.2-C):** **decisão arquitetural Alternativa A** registrada em [`plans/ADR_AUTH_001_MODELO_AUTORIZACAO_20260721.md`](ADR_AUTH_001_MODELO_AUTORIZACAO_20260721.md) e `CRM/TECHDOC.md` §50. **Não é bug bloqueador.** Rules = auth + tenant; RBAC operacional = aplicação. Evolução B/híbrido só com autorização explícita de Rules (processo BL-006).

**Origem:** Homologação funcional pós-BL-008 (2026-07-21) — Etapa 6 (RBAC Runtime). Relatório: `plans/CERTIFICACAO_ETAPA63_HOMOLOGACAO_FUNCIONAL_20260721.md`; evidências `evidencias/etapa6-rbac-runtime-20260721-084209/` e `evidencias/etapa61-remediacao-20260721/`.
**Severidade:** 🟡 média (dívida consciente / residual de cliente adulterado com token de staff).
**Prioridade sugerida:** baixa — só reabrir se o dono autorizar Alternativa B ou híbrido (ETAPA 6.2-B).
**Autorização:** qualquer mudança em `CRM/firestore.rules` continua exigindo autorização explícita.

### A falha

`CRM/firestore.rules` (ex.: `os`, linhas 112-126; padrão idêntico em `financeiro_*`/`caixa_lancamentos`/`estoque_*`) exige, para `create`/`update`/`delete`, apenas:

```
request.auth != null && temAcessoLiberado() && mesmaEmpresa*()
```

`temAcessoLiberado()` (linhas 18-21) só verifica que o documento `usuarios/{uid}` existe e `perfil != 'pendente'` — **nunca consulta `perfis_operacionais` nem `perfil_operacional_id`**. A matriz de criar/editar/excluir/aprovar por perfil existe e funciona na camada de UI (`CRM/shared/permissoes.js`), mas não tem equivalente nas Rules.

**Impacto:** qualquer usuário autenticado ativo da mesma empresa pode criar/editar/excluir registros dessas coleções via chamada direta ao Firestore (client SDK/REST), independentemente do que a matriz do seu perfil operacional permita na UI — mesma classe de risco do BL-006 (restrição só client-side, sem Rule equivalente), mas sem o vetor de auto-escalada de privilégio daquele caso (aqui não há elevação de perfil, só bypass de ação dentro do próprio nível de acesso).

**Comprovado na Etapa 6** (evidência real, navegador + Firestore DEV): perfis Técnico/Atendente/Financeiro conseguiram `create`+`delete` de um documento de teste em `os` via client SDK, mesmo com a matriz de UI restringindo essas ações para alguns desses perfis.

**Achados relacionados na mesma apuração (Etapa 6.1):**
- Não existe usuário/perfil "sem permissão" (matriz vazia) no DEV para testar o cenário fail-closed — criação está fora do escopo autorizado até decisão do dono.
- Usuário `cellcitygerente@gmail.com` (perfil legado `gerente`, UID `w6s8K7bxTKShF2apJCK5zOZZ4Bi2`, criado 2026-07-03) não tem `perfil_operacional_id` associado → fail-open de matriz por compatibilidade legada, não corrupção.

### Regras para quando for decidido/implementado

- **Não é regressão desta release** — não bloquear v3.2.0 nem tratar como incidente de produção; é uma característica do modelo presente desde a Fase 2 (RBAC aplicado nos módulos), agora medida pela primeira vez.
- Três alternativas avaliadas (detalhe completo na certificação linkada): **(A)** manter Rules = tenant+auth e aceitar formalmente que a matriz é só UI; **(B)** Rules replicam a matriz completa (`get()` de `perfis_operacionais` em toda coleção de negócio — mais seguro, mais caro em leituras, mais complexo); **(C)** modelo híbrido, só nas operações de maior risco (ex.: delete de OS, escrita financeira/caixa/estoque). Recomendação técnica: **C**, faseado por módulo (alinhado ao princípio "um módulo por vez" do projeto).
- Se a opção B/C for autorizada: processo formal completo (planejamento → aprovação → backup de `CRM/firestore.rules` → testes no emulador `tests/firestore-rules/` → deploy DEV → verificação via API → aceite formal do dono → só então promoção a produção), mesmo padrão usado no BL-006.
- Provisionamento de dados de teste (usuário restrito, vínculo do Gerente) é de baixo risco e pode ser autorizado independentemente da decisão de arquitetura — desbloqueia a cobertura de teste sem mexer em Rules.
