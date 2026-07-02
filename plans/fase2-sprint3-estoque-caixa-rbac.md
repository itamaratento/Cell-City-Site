# RESULTADO TÉCNICO — FASE 2 | SPRINT 3 (ESTOQUE + CAIXA)

> **Natureza deste documento:** registro do resultado real da implementação. Planejamento feito em modo de planejamento na mesma sessão, com aprovação do usuário antes de qualquer edição (escopo, mapa ação→permissão, riscos, ordem de execução, critérios e rollback aprovados previamente).
> Depende de [`fase2-sprint2-crm-agenda-rbac.md`](fase2-sprint2-crm-agenda-rbac.md) (aprovado em 2026-07-02, tag `sprint2-rbac-crm-agenda-aprovado`).
> **Status: implementado e verificado automaticamente (12/12 cenários). Aguardando homologação manual em navegador e aprovação formal do usuário.**

---

## 1. Objetivo

Integrar o RBAC operacional aos módulos **Estoque** (moduloId `estoque`) e **Caixa** (moduloId `caixa`), com atenção especial (exigida pelo roadmap) à integração entre os dois — a movimentação de estoque disparada pelo Caixa ao vender.

## 2. Arquivos alterados

- `CRM/pages/estoque/estoque.js` — backup: `estoque.BACKUP_2026-07-02.js`
- `CRM/pages/caixa/caixa.js` — backup: `caixa.BACKUP_2026-07-02.js`

Nenhum HTML, `kernel.js`, `firebase.js`, Firestore Rules, `dashboard.js` ou `shared/*` alterado.

## 3. Decisões de produto (confirmadas com o usuário no planejamento)

1. **`aprovar` do Caixa: sem efeito nesta sprint.** A matriz tem `temAprovar:true` para `caixa`, mas o código vivo não tem nenhum fluxo de aprovação — o fechamento automático (semântica original) foi removido na reescrita de 30/06 e só existe em backup. Decisão: não inventar semântica; **pendência registrada** — quando o fechamento for reintroduzido (Fase 4), deverá ser gateado por `podeAprovar('caixa')`.
2. **Botão "Novo Produto" do Caixa** (cadastra em `estoque_produtos` durante a venda): controlado por **`podeCriar('caixa')`** — o fluxo pertence ao Caixa; o módulo depende só da própria permissão. (Na prática o modal só é alcançável via `salvarLancamento`, cujo formulário inteiro já é ocultado sem `criar`.)
3. **Movimentação entrada/saída no Estoque** (botões +/− que alteram quantidade): mapeada para **`podeEditar('estoque')`**.
4. **Baixa/entrada automática de estoque ao salvar lançamento: NUNCA gateada** — é efeito colateral da venda (ação do Caixa), executada por funções locais do próprio `caixa.js` (`descontarEstoqueLocal`/`incrementarEstoqueLocal`). **Regra fixa cumprida: zero checagem de permissão de `estoque` dentro de `caixa.js`.**

## 4. Integração realizada

### Estoque (`estoque.js`)
| Ação | Permissão | Efeito quando negado |
|---|---|---|
| Ver módulo | `podeVisualizar('estoque')` | Redirect para o Dashboard |
| Criar produto (`#est-btn-novo`) | `podeCriar('estoque')` | Botão oculto (inclusive após `fecharForm`, que antes re-exibia incondicionalmente) |
| Editar produto (`.est-card-edit`) | `podeEditar('estoque')` | Botão não renderizado |
| Movimentar +/− (`data-entrada`/`data-saida`) | `podeEditar('estoque')` | Botões não renderizados (quantidade continua visível) |
| Excluir produto (`.est-card-del`) | `podeExcluir('estoque')` | Botão não renderizado |

Boot reestruturado: `estoque.js` não chamava `initModulo()` (gate real vinha só indireto via `dock.js`). Agora tem `_boot()` explícito no padrão dos Sprints 1-2; os listeners de eventos (antes top-level) e o `carregar()` só rodam após o gate.

### Caixa (`caixa.js`)
| Ação | Permissão | Efeito quando negado |
|---|---|---|
| Ver módulo | `podeVisualizar('caixa')` | **Janela principal:** redirect para o Dashboard. **Dentro de iframe:** apenas não boota (sem redirect) — ver §5 |
| Criar lançamento (form `#bloco-padrao-2`, inclui "+ Nova categoria") | `podeCriar('caixa')` | Formulário inteiro oculto |
| Novo lembrete (`.btn-novo-lembrete`) | `podeCriar('caixa')` | Botão oculto |
| Pagar lembrete (`pagarLembrete` — gera lançamento) | `podeCriar('caixa')` | Botão não renderizado |
| Editar lançamento (✏️) | `podeEditar('caixa')` | Botão não renderizado |
| Excluir lançamento (✕) | `podeExcluir('caixa')` | Botão não renderizado |
| Excluir lembrete (✕) | `podeExcluir('caixa')` | Botão não renderizado |
| Baixa/entrada automática de estoque | **sem gate** | — |
| Aprovar | **sem efeito** (pendência §3.1) | — |

Nota de escopo: os gates de "Novo lembrete" e "Excluir lembrete" não estavam listados nominalmente na tabela do planejamento, mas são escritas de UI do próprio Caixa nos mesmos verbos (criar/excluir) — foram incluídos para cumprir o objetivo da sprint ("todas as permissões de criação/edição/exclusão via RBAC"), registrado aqui como complemento consistente.

## 5. Risco R1 — loop de iframes (mitigado e testado)

O Dashboard carrega `/CRM/pages/caixa/index.html` num **iframe invisível** a cada abertura (`_verificarFechamentoCaixa`, `dashboard.js:135-158`) para disparar um orquestrador de fechamento que **não existe mais** no Caixa atual (removido em 30/06; o cache `caixa_ultimo_fechamento` nunca é gravado pelo código vivo). Se o gate de `visualizar` redirecionasse dentro do iframe, um usuário sem permissão de caixa entraria em loop: dashboard → iframe caixa → redirect dashboard (no iframe) → novo iframe → …

**Mitigação implementada (100% dentro de `caixa.js`):** o redirect só acontece quando `window.self === window.top`. Dentro de iframe, o `init()` simplesmente retorna sem bootar — nada é renderizado, nenhum listener é assinado, nenhum loop. Verificado no cenário automatizado nº 12 (abaixo).

**Pendência pré-existente registrada (fora do escopo):** o iframe do Dashboard é hoje um disparo inútil a cada carga (o orquestrador que ele acionaria não existe). Correção pertence ao módulo Dashboard ou à reintrodução do fechamento — exige autorização própria.

## 6. Verificação automatizada executada (12/12 corretos)

Mesmo método do Sprint 2 (Node + jsdom executando o **código real** com `kernel.js`/`firebase.js` mockados em cópias isoladas no scratchpad; jsdom instalado como devDependency temporária e **removido ao final** — `package.json` conferido de volta ao original). Única adaptação nas cópias de teste: os imports do `caixa.js` via URL gstatic e caminho absoluto `/CRM/...` foram remapeados para os mocks locais (Node não resolve https/URLs absolutas de site).

| # | Módulo | Cenário | Resultado |
|---|---|---|---|
| 1 | Estoque | Restrito (vis✔ criar✘ editar✘ excluir✘): botão Novo oculto; cards sem editar/excluir/±  | ✅ |
| 2 | Estoque | Matriz total: tudo visível | ✅ |
| 3 | Estoque | Não migrado: fail-open total | ✅ |
| 4 | Estoque | `visualizar:false`: redirect antes de renderizar | ✅ |
| 5 | Estoque | Admin legado: bypass | ✅ |
| 6 | Caixa | Restrito: form oculto, novo-lembrete oculto, cards sem ✏️/✕, lembretes sem Pagar/✕ | ✅ |
| 7 | Caixa | Matriz total: tudo visível | ✅ |
| 8 | Caixa | Não migrado: fail-open total | ✅ |
| 9 | Caixa | `visualizar:false` em janela principal: redirect | ✅ |
| 10 | Caixa | Admin legado: bypass | ✅ |
| 11 | Caixa | **Fluxo de venda com `estoque.*` 100% negado**: lançamento criado E baixa de estoque executada (5→4 unidades) | ✅ |
| 12 | Caixa | **`visualizar:false` DENTRO de iframe simulado**: sem redirect, boot abortado, nada renderizado (loop impossível) | ✅ |

Zero exceção/erro de runtime em todos os cenários. `node --check` limpo nos dois arquivos.

## 7. Rollback

Copiar `estoque.BACKUP_2026-07-02.js` / `caixa.BACKUP_2026-07-02.js` por cima dos arquivos alterados. Ponto de restauração global: tag `sprint2-rbac-crm-agenda-aprovado`. Rollback local por arquivo, sem efeito colateral (nada compartilhado foi tocado).

## 8. Roteiro de homologação manual (usuário, navegador real)

**A. Admin (`cellcityadmin@gmail.com`)**
1. Estoque: botão "＋ Novo Produto", ✏️, ✕ e botões ± visíveis; criar → editar → movimentar → excluir um produto de teste funciona.
2. Caixa: formulário de lançamento visível; criar → editar → excluir lançamento funciona; lembretes com "Pagar" e "✕".
3. Console (F12) sem erros novos nas duas páginas.

**B. Perfil restrito (configurar na matriz: `estoque` e `caixa` com visualizar✔ e demais ✘)**
1. Estoque: sem botão "Novo Produto"; cards sem ✏️/✕/±; lista e resumo visíveis normalmente.
2. Caixa: formulário de lançamento e "Novo Lembrete" ausentes; cards sem ✏️/✕; lembretes sem "Pagar"/"✕"; totais e lista visíveis.
3. Com `caixa.visualizar` ✘: acessar a URL do Caixa → redirect ao Dashboard; **abrir o Dashboard → sem travamento/loop** (verificação do R1); com `estoque.visualizar` ✘: URL do Estoque → redirect.
4. Voltar `caixa.criar` ✔ e vender um produto vinculado ao estoque → conferir no módulo Estoque (admin) que a quantidade baixou.

**C. Usuário sem `perfil_operacional_id`**
1. Estoque e Caixa idênticos ao admin (fail-open), sem nada oculto.

**D. Regressão obrigatória (CLAUDE.md):** Login, Dashboard, CRM, OS, Caixa, Estoque, Financeiro, Portal do Cliente.

## 9. Critérios de aprovação (pendentes)

Roteiro §8 confirmado sem regressão; console limpo; R1 verificado na prática; aprovação formal registrada antes de iniciar o Sprint 4 (Financeiro).
