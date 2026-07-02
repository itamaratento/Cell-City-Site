# RESULTADO TÉCNICO — FASE 2 | SPRINT 2 (CRM + AGENDA)

> **Natureza deste documento:** registro do resultado real da implementação (não um planejamento prévio — o planejamento foi feito em modo de planejamento na própria sessão de implementação, com aprovação do usuário antes de qualquer edição).
> Depende do [`fase2-sprint1-dashboard-rbac.md`](fase2-sprint1-dashboard-rbac.md) (Sprint 1, aprovado em 2026-07-02), que criou `CRM/shared/permissoes.js`.
> **Status: implementado e homologado por verificação automatizada (seção 9). Falta apenas a confirmação visual em navegador real (seção 10, roteiro na seção 12) e a aprovação formal do usuário.**

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

**Limitação do ambiente:** não há navegador nem ferramenta de automação de browser (Puppeteer/Playwright) disponível para mim neste ambiente — não é possível logar de verdade com as contas de homologação (`cellcity<perfil>@gmail.com`) nem observar o console real. Diante disso (decisão confirmada com o usuário), foi montado um harness de verificação automatizada em Node + jsdom que executa o **código real dos 5 arquivos** (cópia idêntica, não reimplementação) contra um DOM real (jsdom) e um Firestore mockado — cobre a lógica de gating, mas não substitui a confirmação visual num navegador de verdade (seção 10).

- **Sintaxe:** `node --check` (Node 22.23.1, via nvm) em todos os 5 arquivos — todos OK.
- **Resolução de caminhos:** smoke test com servidor HTTP estático local — todos os 5 arquivos alterados e suas dependências (`kernel.js`, `permissoes.js`) respondem HTTP 200, sem 404 de import.
- **Revisão de diff completo** (`git diff`) dos 5 arquivos, conferindo que cada gating bate exatamente com o levantamento da seção 3.
- **Auditoria estática do boot:** confirmado, nos 5 arquivos, que `initModulo()` é chamado, seguido de `if (!ctx) return;`, seguido de `await carregarPermissoes(ctx)`, **antes** de qualquer verificação de permissão ou renderização — mesma ordem em todos.
- **Verificação automatizada (jsdom, `devDependency` temporária, removida ao final):** os 5 arquivos reais foram executados com `initModulo()`/Firestore mockados, simulando os cenários abaixo. Todos os 20 casos bateram com o esperado, **zero erro de console/exceção em qualquer cenário**:

| Arquivo | Cenário | Esperado | Resultado |
|---|---|---|---|
| crm.js | Perfil restrito (visualizar✅ criar❌ editar❌ excluir❌) | card "Novo Cliente" oculto; botões Editar/Excluir/Converter-OS ausentes; pills de status sem onclick | ✅ bateu |
| crm.js | Perfil com matriz total (seed Administrador) | tudo visível/clicável | ✅ bateu |
| crm.js | Não migrado (sem `perfil_operacional_id`) | fail-open — tudo visível/clicável | ✅ bateu |
| crm.js | `visualizar: false` | redireciona para o Dashboard antes de renderizar qualquer coisa | ✅ bateu |
| crm.js | Perfil legado `admin` / `master_admin` | bypass total | ✅ bateu |
| entrada.js | `criar: false` | redireciona para `index.html` | ✅ bateu |
| entrada.js | `criar: true` / não migrado / admin legado | permanece na página | ✅ bateu (3 casos) |
| chips.js | Perfil restrito (visualizar✅ criar❌ editar❌ excluir❌) | card "Novo Chip" oculto; botão "Novo Chip" da topbar oculto; Editar/Excluir ausentes; pills sem onclick | ✅ bateu |
| chips.js | Matriz total / não migrado / admin legado | tudo visível/clicável (3 casos) | ✅ bateu |
| chips.js | `visualizar: false` | redireciona para o Dashboard | ✅ bateu |
| chips-entrada.js | `criar: false` / `true` / não migrado | redireciona / permanece / permanece (3 casos) | ✅ bateu |
| acaodasemana.js | `visualizar: false` | redireciona para o Dashboard | ✅ bateu |
| acaodasemana.js | `criar:false, editar:false` | textarea `readonly`, botões de recorrência `disabled` | ✅ bateu |
| acaodasemana.js | `criar:true, editar:false` (prova o AND, não OR) | continua `readonly`/`disabled` | ✅ bateu |
| acaodasemana.js | `criar:false, editar:true` (prova o AND, não OR) | continua `readonly`/`disabled` | ✅ bateu |
| acaodasemana.js | `criar:true, editar:true` | textarea liberada, botões habilitados | ✅ bateu |
| acaodasemana.js | Não migrado / admin legado | fail-open — liberado (2 casos) | ✅ bateu |

O harness (mocks + runner) e o jsdom usado só para esta verificação foram descartados ao final — `package.json` do projeto conferido de volta ao estado original (`git diff package.json` vazio).

## 10. Testes que continuam pendentes (precisam de navegador real)

Por decisão do usuário, ficam pendentes por agora — não bloqueiam este relatório, mas bloqueiam a **aprovação formal** da Sprint 2:

- [ ] Login real com pelo menos 1 conta por perfil (`cellcityadmin@gmail.com`, `cellcitycaixa@gmail.com` etc. — ver roteiro na seção 12) e confirmação visual de que a interface se comporta como os testes automatizados previram.
- [ ] Console do navegador limpo (sem erros/warnings novos) durante a navegação real pelos 5 fluxos.
- [ ] Fluxo completo ponta a ponta para perfil sem restrição: criar lead → editar → excluir; criar chip → editar → excluir; escrever na Agenda.
- [ ] Verificação do release ativo de Firestore Rules via API (`firebaserules.googleapis.com`) — regra permanente desde o incidente da Fase 1, mesmo sem mudança esperada nas Rules.
- [ ] Testes obrigatórios do projeto (Login, Dashboard, CRM, OS, Caixa, Estoque, Financeiro, Portal do Cliente — conforme CLAUDE.md).

## 11. Achado de processo — auto-commit externo publicou as mudanças no branch `develop`

Durante a limpeza do ambiente de teste foi constatado que um processo externo ao Claude Code (não identificado nesta sessão, mesmo comportamento já registrado em 2026-06-30) **commitou e enviou automaticamente** os 5 arquivos alterados + os backups + este documento para `origin/develop` (commit `3a80819`, "Atualização 02/07/2026-10:19"), sem ação minha. Verificado que `origin/main` (o que o GitHub Pages efetivamente publica, confirmado por `origin/HEAD -> origin/main`) **não recebeu essas mudanças** — continua em `4ce7db1`, anterior ao Sprint 2. Ou seja, produção não foi afetada, mas o branch `develop` compartilhado já reflete um código que ainda não passou por aprovação formal. Registrado aqui para visibilidade — nenhuma ação corretiva foi tomada por mim (não é módulo desta sprint).

## 12. Roteiro de teste manual (para o usuário executar)

Login sugerido por cenário (ver `project-padrao-usuarios-homologacao` — ajustar perfil operacional de cada conta em "Usuários e Permissões" antes de testar, se ainda não estiver configurado):

**A. `cellcityadmin@gmail.com` (Administrador — tudo liberado)**
1. Abrir `/CRM/pages/crm-comercial/index.html` — card "Novo Cliente" visível; abrir um lead → botões Editar/Excluir/Converter em O.S. visíveis; pills de status clicáveis.
2. Abrir `/CRM/pages/crm-comercial/chips.html` — card "Novo Chip" e botão "📱 Novo Chip" da topbar visíveis; abrir um chip → Editar/Excluir visíveis.
3. Abrir `/CRM/pages/acaodasemana/index.html` — textarea de notas editável, sem `readonly`.
4. Console do navegador (F12) sem erros em nenhuma das 3 páginas.

**B. `cellcityatendimento@gmail.com` (ou outro perfil com `crm`/`agenda` restritos na matriz — configurar em Usuários e Permissões antes)**
1. Com `crm.criar=false`: `/CRM/pages/crm-comercial/index.html` não deve mostrar o card "Novo Cliente"; tentar abrir `entrada.html` direto pela URL deve redirecionar de volta para `index.html`.
2. Com `crm.editar=false`/`excluir=false`: abrir um lead existente — botões Editar/Excluir/Converter em O.S. ausentes; clicar numa pill de status não deve fazer nada.
3. Repetir 1-2 em `/CRM/pages/crm-comercial/chips.html` e `chips-entrada.html`.
4. Com `agenda.criar` e/ou `agenda.editar` = `false`: `/CRM/pages/acaodasemana/index.html` — textarea não deve aceitar digitação (readonly).
5. Com `agenda.visualizar=false`: acessar a URL da Agenda deve redirecionar para o Dashboard.

**C. Usuário sem `perfil_operacional_id` definido (criar um usuário de teste sem perfil migrado, ou usar um antigo)**
1. Todas as páginas acima devem se comportar como o perfil Administrador (fail-open) — nada deve ficar oculto/bloqueado.

Em qualquer um dos passos acima, qualquer erro no console do navegador (F12 → Console) deve ser reportado antes da aprovação.

## 13. Critérios de aprovação (pendentes)

Todos os itens da seção 10 confirmados no navegador real (roteiro da seção 12); nenhuma regressão encontrada nos fluxos normais dos perfis sem restrição; decisão de produto da seção 5 validada com o usuário na prática (não só na teoria); aprovação formal registrada antes de iniciar o Sprint 3 (Estoque + Caixa).

---

*Este documento registra o que foi implementado e verificado automaticamente. A aprovação formal da Sprint 2 depende da confirmação manual em navegador descrita nas seções 10 e 12.*
