# RESULTADO TÉCNICO — FASE 2 | SPRINT 2 (CRM + AGENDA)

> **Natureza deste documento:** registro do resultado real da implementação (não um planejamento prévio — o planejamento foi feito em modo de planejamento na própria sessão de implementação, com aprovação do usuário antes de qualquer edição).
> Depende do [`fase2-sprint1-dashboard-rbac.md`](fase2-sprint1-dashboard-rbac.md) (Sprint 1, aprovado em 2026-07-02), que criou `CRM/shared/permissoes.js`.
> **Status: implementado, aguardando homologação manual e aprovação formal do usuário.**

---

## 1. Objetivo

Estender a integração do RBAC operacional (matriz de `perfis_operacionais`, Fase 1) aos módulos **CRM** (moduloId `crm`) e **Agenda** (moduloId `agenda`), cobrindo não só `visualizar` (como no Sprint 1) mas também `criar`, `editar` e `excluir` — os primeiros módulos da Fase 2 com ações de escrita.

## 2. Escopo

**Entrou:**
- `CRM/pages/crm-comercial/crm.js` — lista/detalhe de leads (moduloId `crm`).
- `CRM/pages/crm-comercial/entrada.js` — tela de criação de lead (moduloId `crm`).
- `CRM/pages/crm-comercial/chips.js` — lista/detalhe de chips cadastrados (moduloId `crm`).
- `CRM/pages/crm-comercial/chips-entrada.js` — tela de criação rápida de chip (moduloId `crm`).
- `CRM/pages/acaodasemana/acaodasemana.js` — Agenda (moduloId `agenda`).

**Não entrou (fora de escopo, registrado como pendência):**
- `RBAC_CARD_PARA_MODULO_ID` em `CRM/pages/dashboard/dashboard.js` não tem entrada para `acaodasemana`/`agenda` — o card da Agenda no Dashboard não é ocultado por `podeVisualizar('agenda')`. Não corrigido nesta sprint porque o Dashboard é módulo já aprovado/fechado do Sprint 1 e a regra do projeto veda tocar mais de um módulo por vez. Fica pendente para um micro-fix futuro autorizado separadamente.
- Refatoração de `acaodasemana.js` para separar de verdade criar/editar/excluir por nota (ver seção 5) — é refatoração arquitetural, fora da Fase 2.
- Qualquer alteração em Firestore Rules.
- `kernel.js`, `firebase.js` — não tocados; só consumidos via API pública já existente (`initModulo`).

## 3. Levantamento técnico (achados antes da implementação)

Investigação prévia (leitura completa dos 5 arquivos JS + 5 HTMLs) encontrou:
- **Nenhum RBAC ad-hoc ou abandonado** nesses arquivos — diferente do que ocorreu com `dashboard.js` antes do Sprint 1.
- **Só `entrada.js` chamava `initModulo()`** antes desta sprint. `crm.js`, `chips.js` e `acaodasemana.js` só tinham autenticação real de forma indireta, via `shared/dock.js` (que chama `initModulo()` por conta própria ao carregar). `chips-entrada.html` não carrega `dock.js` nem nenhum outro script que chame `initModulo()` — a única barreira antes desta sprint era o gate cosmético de `localStorage.getItem('cc_kernel_v1')` no `<head>` (o próprio `kernel.js` documenta que isso não é o mecanismo de segurança real). Por isso, cada um dos 5 arquivos precisou de `initModulo()` + `carregarPermissoes(ctx)` explícitos — pré-requisito técnico para o RBAC funcionar, não scope creep.
- `crm.js` não tinha nenhuma UI viva para criar lead (`abrirForm(null)` nunca era chamado) — criação é 100% delegada a `entrada.html`.
- `chips.js` tinha duas rotas de criação vivas: card inline (`abrirForm(null)`) e navegação para `chips-entrada.html`.
- `acaodasemana.js` não distingue criar/editar/excluir na UI — é uma única textarea por dia com autosave (`salvar()`) que reescreve o documento inteiro a cada mudança. Não dá para gatear os três verbos separadamente sem redesenhar o autosave (fora de escopo — ver seção 5).

## 4. Integração RBAC realizada

| Arquivo | moduloId | Verificações aplicadas | Efeito quando negado |
|---|---|---|---|
| `crm.js` | `crm` | `visualizar` no boot | Redireciona para `/CRM/pages/dashboard/index.html` |
| `crm.js` | `crm` | `criar` no card "Novo Cliente" (home grid) | Card não é renderizado |
| `crm.js` | `crm` | `editar` nas pills de status, botão "Editar Lead", botão "Converter em O.S." | Elementos não são renderizados no painel de detalhe |
| `crm.js` | `crm` | `excluir` no botão "Excluir" | Botão não é renderizado |
| `entrada.js` | `crm` | `criar` no boot | Redireciona para `/CRM/pages/crm-comercial/index.html` (página é 100% de criação) |
| `chips.js` | `crm` | `visualizar` no boot | Redireciona para `/CRM/pages/dashboard/index.html` |
| `chips.js` | `crm` | `criar` no card "Novo Chip" (home grid) e no botão "Novo Chip" da topbar (navegação para `chips-entrada.html`) | Card não é renderizado; botão fica oculto |
| `chips.js` | `crm` | `editar` nas pills de status e botão "Editar" | Elementos não são renderizados |
| `chips.js` | `crm` | `excluir` no botão "Excluir" | Botão não é renderizado |
| `chips-entrada.js` | `crm` | `criar` no boot | Redireciona para `chips.html` (página é 100% de criação) |
| `acaodasemana.js` | `agenda` | `visualizar` no boot | Redireciona para `/CRM/pages/dashboard/index.html` |
| `acaodasemana.js` | `agenda` | `criar` **E** `editar` combinados no boot (ver seção 5) | Textarea de notas fica `readonly`; botões de parar recorrência ficam `disabled` |

`podeAprovar` não foi usado — a matriz confirma `temAprovar: false` para `crm` e `agenda` (só `caixa` e `financeiro` têm aprovação).

**Firestore Rules:** nenhuma alteração. As únicas leituras novas introduzidas por `carregarPermissoes()` (`usuarios/{uid}` e `perfis_operacionais/{id}`) já foram validadas como liberadas pelas Rules atuais durante o Sprint 1.

## 5. Decisão de produto registrada — Agenda

A UI de `acaodasemana.js` não tem como distinguir "criar uma nota" de "editar uma nota existente": `salvar()` relê o texto inteiro da textarea a cada autosave e reescreve o documento do dia, então uma única chamada pode adicionar, alterar e remover linhas ao mesmo tempo. Separar de verdade os três verbos (`criar`/`editar`/`excluir`) exigiria redesenhar esse mecanismo — fora do escopo da Fase 2 (é refatoração arquitetural).

Decisão confirmada com o usuário: a textarea só fica editável quando **`podeCriar('agenda') E podeEditar('agenda')`** forem ambos `true` (regra mais restritiva). Um perfil com só uma das duas permissões marcadas na matriz fica com a Agenda em modo leitura. Isso é uma limitação de design deliberada, não um bug — deve ser considerada se a Fase 3/4 revisitar a arquitetura do autosave.

## 6. Arquivos alterados

- `CRM/pages/crm-comercial/crm.js`
- `CRM/pages/crm-comercial/entrada.js`
- `CRM/pages/crm-comercial/chips.js`
- `CRM/pages/crm-comercial/chips-entrada.js`
- `CRM/pages/acaodasemana/acaodasemana.js`

Nenhum HTML foi alterado — toda a ocultação/desabilitação é feita via JS manipulando o DOM já existente (`display:none`, `readonly`, `disabled`), conforme regra do CLAUDE.md de não alterar estrutura HTML.

## 7. Backups (ponto de rollback)

Criados antes de qualquer edição, mesmo padrão de nomenclatura já usado no projeto:
- `CRM/pages/crm-comercial/crm.BACKUP_2026-07-02.js`
- `CRM/pages/crm-comercial/entrada.BACKUP_2026-07-02-sprint2.js`
- `CRM/pages/crm-comercial/chips.BACKUP_2026-07-02.js`
- `CRM/pages/crm-comercial/chips-entrada.BACKUP_2026-07-02.js`
- `CRM/pages/acaodasemana/acaodasemana.BACKUP_2026-07-02.js`

**Rollback:** restaurar o arquivo correspondente a partir do backup acima e remover o commit/staging da mudança. Como nenhum dos 5 arquivos teve estrutura HTML ou Firestore Rules alterada, o rollback é local a cada arquivo `.js`, sem efeito colateral em outros módulos.

## 8. Riscos

| Alteração | Risco | Motivo |
|---|---|---|
| Adicionar `initModulo()` a `crm.js`/`chips.js`/`chips-entrada.js`/`acaodasemana.js` | **Médio** | Esses 4 arquivos nunca tinham chamado `initModulo()` diretamente — é a primeira vez que o boot deles depende explicitamente da resolução dessa Promise. Mitigado: mesmo padrão já usado em `entrada.js` e `dashboard.js`, testado sintaticamente (`node --check`) e verificado via smoke test HTTP local (todos os arquivos e suas dependências resolvem com 200 OK). |
| Gating de botões via template string (`crm.js`/`chips.js`) | **Baixo** | Muda só a condição de renderização de HTML já existente; não altera lógica de negócio nem os handlers em si. |
| Textarea `readonly` na Agenda | **Baixo/Médio** | Primeira vez que a Agenda fica bloqueada para qualquer perfil — decisão de produto documentada na seção 5, precisa ser validada na homologação com um perfil real restrito. |
| Redirecionamentos (`window.location.href`) em `podeVisualizar`/`podeCriar` negados | **Baixo** | Mesmo padrão que `kernel.js` já usa para sessão inválida; sem risco de loop (verificado: os destinos de redirecionamento nunca reexecutam o mesmo gate que disparou o redirecionamento). |

## 9. Testes executados nesta sessão

- **Sintaxe:** `node --check` (Node 22.23.1, via nvm) em todos os 5 arquivos — todos OK.
- **Resolução de caminhos:** smoke test com servidor HTTP estático local — todos os 5 arquivos alterados e suas dependências (`kernel.js`, `permissoes.js`) respondem HTTP 200, sem 404 de import.
- **Revisão de diff completo** (`git diff`) dos 5 arquivos, conferindo que cada gating bate exatamente com o levantamento da seção 3.

## 10. Testes NÃO executados (pendentes de homologação manual)

Sem framework de teste automatizado ou browser headless disponível neste ambiente (mesma limitação já registrada no Sprint 1) — os testes abaixo dependem de login real com Firebase Auth e precisam ser feitos manualmente pelo usuário (ou por mim, orientado pelo usuário, em uma sessão com acesso ao navegador):

- [ ] Perfil restrito (ex. Atendimento sem `criar`/`editar`/`excluir` em `crm`): confirmar que os botões somem em `crm.js`/`chips.js`, que `entrada.html`/`chips-entrada.html` redirecionam corretamente, e que a Agenda fica somente-leitura.
- [ ] Usuário não migrado (sem `perfil_operacional_id`): tudo deve continuar visível/editável (fail-open).
- [ ] Perfil Administrador/`master_admin`: bypass total, nada oculto.
- [ ] Fluxo completo para perfil sem restrição: criar lead → editar → excluir; criar chip → editar → excluir; escrever na Agenda — sem erro de console.
- [ ] Verificação do release ativo de Firestore Rules via API (`firebaserules.googleapis.com`) — regra permanente desde o incidente da Fase 1, mesmo sem mudança esperada nas Rules.
- [ ] Testes obrigatórios do projeto (Login, Dashboard, CRM, OS, Caixa, Estoque, Financeiro, Portal do Cliente — conforme CLAUDE.md).

## 11. Critérios de aprovação (pendentes)

Todos os itens da seção 10 marcados; nenhuma regressão encontrada nos fluxos normais dos perfis sem restrição; decisão de produto da seção 5 validada com o usuário na prática (não só na teoria); aprovação formal registrada antes de iniciar o Sprint 3 (Estoque + Caixa).

---

*Este documento registra o que foi implementado. A aprovação formal da Sprint 2 depende da homologação manual descrita na seção 10.*
