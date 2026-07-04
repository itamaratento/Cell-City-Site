# Refatoração do Dashboard — Etapa 1: Levantamento

Branch: `refactor-dashboard-modular` (a partir de `develop`).
Arquivo analisado: `CRM/pages/dashboard/dashboard.js` — **2991 linhas**, 117 KB.
Arquivos irmãos na mesma pasta (fora de escopo): `dashboard.css` (72 KB), `index.html` (62 KB), `sw-alarme.js` (Service Worker do alarme de OS).

## 1. Estrutura geral

- Um único IIFE/bootstrap no final (`_bootDashboard()`), sem `export` nenhum no arquivo inteiro.
- **Confirmado por grep em todo o repo:** nenhum outro arquivo importa símbolos de `dashboard.js` — é uma folha (leaf), só referenciada por `<script type="module" src="dashboard.js">` em `index.html:567`. Isso significa que a Etapa 2 (criar módulos) **não precisa alterar `index.html`** — os novos arquivos serão importados de dentro do próprio `dashboard.js`, nunca direto do HTML.
- Uma única classe `Dashboard` (linhas 26–2978, **quase o arquivo inteiro**) com ~48 métodos.
- 2 variáveis de módulo fora da classe: `_uid` (linha 23) e a constante `RBAC_CARD_PARA_MODULO_ID` (linhas 14–21).

## 2. Imports (linhas 6–8)

```js
import { initModulo } from '../../scripts/kernel.js';
import { db, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, onSnapshot, query, where, orderBy, limit } from "../../scripts/firebase.js";
import { carregarPermissoes, podeVisualizar } from '../../shared/permissoes.js';
```

Nenhum outro import. `firebase.js` é arquivo protegido (CLAUDE.md) — só leitura, não será tocado.

## 3. `this.state` (constructor, linhas 28–68)

```
state.meta        = { current, goal }               — Meta Semanal
state.calendar    = { open, viewDate, selectedDate } — Mini calendário
state.searchData  = { os, clientes, produtos, modulos } — dados MOCK/estáticos usados só como fallback/lista de módulos da Busca Global
```

## 4. Inventário completo de métodos (ordem no arquivo)

| Linhas | Método | Responsabilidade |
|---|---|---|
| 27–70 | `constructor` | monta `this.state`, chama `init()` |
| 72–92 | `init` | orquestra a chamada de todos os `setupX` (ordem de inicialização) |
| 97–132 | `setupClock` | relógio + data por extenso (DOM, `setInterval` 1s) |
| 135–158 | `_verificarFechamentoCaixa` | dispara fechamento automático do Caixa via iframe oculto (1x/dia, cache em `localStorage`) |
| 161–218 | `setupNotas` | bloco de notas do dock (Firestore `notas_usuarios/{uid}`, realtime + debounce save) |
| 221–224 | `setupMetaSemanal` | dispara `updateMeta` + `_carregarMetaFirestore` |
| 226–295 | `_carregarMetaFirestore` | calcula meta semanal a partir de `caixa_lancamentos` (mesma semana ISO do ano anterior) |
| 297–315 | `updateMeta` | atualiza DOM da barra de progresso da meta |
| 318–320 | `setupAutoatendimento` | dispara contador |
| 322–343 | `_carregarContadorAutoatendimento` | badge com `onSnapshot` de `pre_os` (status AGUARDANDO_CONVERSAO) |
| 347–372 | `setupDiarioBadge` | badge com `onSnapshot` de `diario_registros` (revisões vencidas) |
| 377–492 | `_lerAgenda` | lê coleção `agenda` (sticky notes), extrai eventos com horário, recorrência |
| 495–508 | `_vencidos` | filtra eventos vencidos |
| 511–519 | `_contarAcoesVencidas` | conta vencidos |
| 522–529 | `_proximoCompromisso` | próximo evento futuro |
| 539–556 | `atualizarCardAcaoSemana` | destaca card "Ação da Semana" se houver vencidas (`setInterval` 30s) |
| 559–952 | `gerarAlertas` | **motor da Central de Alertas** — agrega Ação da Semana, Pós-venda (`os`+`posvenda_contatos`), OS orçamento/pronta (`os`), Meta (state), Portal do Cliente (`mensagens_portal`), Avaliações (`avaliacoes`), Aparelhos não retirados (`os`), Orçamentos sem resposta (`os`) |
| 955–1183 | `setupAlerts` | UI do card de alertas: rotação de dicas/alertas, som (Web Audio), pulsação, `setInterval`s (120s rotação, 30s repetir som, 180s reconsulta `gerarAlertas`) |
| 1186–1223 | `setupCalendar` | wiring do mini calendário |
| 1225–1231 | `toggleCalendar` | abre/fecha popup |
| 1233–1265 | `renderCalendar` | renderiza grid do mês |
| 1267–1282 | `createCalDay` | cria célula de dia |
| 1284–1295 | `selectCalDay` | seleciona dia, nota em `localStorage` |
| 1298–1302 | `escapeHtml` | utilitário puro |
| 1305–1312 | `setupReloadBtn` | botão de reload da página |
| 1314–1358 | `setupGlobalSearch` | wiring do input de busca global (debounce, teclado) |
| 1360–1366 | `_highlightSearch` | destaque do item ativo (teclado) |
| 1369–1443 | `_loadSearchIndex` | **carrega índice de busca** direto do Firestore: `os`, `clientes`, `estoque_produtos`/`produtos` (cache 60s) |
| 1445–1500 | `performSearch` | filtra o índice + `state.searchData.modulos` (estático), renderiza resultados |
| 1503–1515 | `setupModules` | grid de módulos da home: aplica RBAC (`podeVisualizar`) e navegação |
| 1518–1526 | `setupDockTools` | botão "Ferramentas" da dock |
| 1529–1664 | `setupMinhaSemana_REMOVIDO` | **CÓDIGO MORTO** — comentário diz "movido para acaodasemana/acaodasemana.js"; não é chamado no `init()` |
| 1665–1695 | `setupSidebarNotas_REMOVIDO` | **CÓDIGO MORTO** — mesmo motivo, não chamado |
| 1696–1736 | `navigateTo` | tabela de rotas de todos os módulos (só navegação, sem lógica de negócio) |
| 1743–1786 | `setupConfigAlertas` | wiring do modal de configuração de alertas |
| 1788–1811 | `carregarConfigAlertas` | lê config de `localStorage` (com defaults) |
| 1813–1836 | `carregarConfigAlertasUI` | aplica config nos campos do modal |
| 1838–1862 | `salvarConfigAlertas` | salva config em `localStorage` |
| 1864–1867 | `_setChecked/_getChecked/_setValue/_getValue` | helpers de DOM (1 linha cada) |
| **1870–2846** | **`setupAlarmeOS`** | **~976 linhas (33% do arquivo).** Sistema completo de "alarme de nova OS": Service Worker (`sw-alarme.js`) + Background/Periodic Sync, permissão de Notification, Web Audio (gera beep), Wake Lock API, janela flutuante (PiP), múltiplos alarmes com dias/horário configuráveis, sincronização cross-device via doc Firestore, `onSnapshot` na coleção `os` para detectar chegada de OS nova. Expõe `window.adicionarAlarme/abrirAlarme/removerAlarme/openAlarmePanel/statusAlarme/criarAtalho` (chamados via `onclick=` inline no HTML gerado dinamicamente dentro do próprio método) |
| 2847–2865 | `setupOutsideClicks` | fecha calendário/busca ao clicar fora |
| 2868–2884 | `setupKeyboardShortcuts` | Ctrl/Cmd+K foca busca, Esc fecha popups |
| 2887–2905 | `mostrarAlertaOS` | modal com lista de OS (chamado a partir de alertas com `_osData`) |
| 2908–2976 | `setupSidebar` | drag-and-drop de reordenação da sidebar esquerda (`localStorage`) |
| 2981–2991 | `_bootDashboard` (fora da classe) | `initModulo()` → `carregarPermissoes` → `new Dashboard()` |

## 5. Timers (`setInterval`/`setTimeout`)

24 ocorrências ao todo. As de nível "serviço contínuo" (não pontuais): relógio (1s), `atualizarCardAcaoSemana` (30s), rotação de alertas (120s), repetição de som (30s), reconsulta de alertas (180s), relógio do alarme-OS (1s), verificação do alarme-OS (a cada minuto, dentro de `setupAlarmeOS`). O resto são `setTimeout` pontuais (debounce, animação, cleanup).

## 6. Listeners Firestore (`onSnapshot`) — 5 total

1. `notas_usuarios/{uid}` (bloco de notas do dock)
2. `pre_os` where status=AGUARDANDO_CONVERSAO (badge autoatendimento)
3. `diario_registros` (badge do diário)
4. doc de config do alarme (dentro de `setupAlarmeOS`, sync cross-device)
5. coleção `os` (dentro de `setupAlarmeOS`, detecção de OS nova)

Nenhum desses listeners é desinscrito explicitamente (sem `unsubscribe()` chamado) — são listeners de página que vivem enquanto o Dashboard estiver aberto. Isso já é o comportamento atual; a refatoração **não deve mudar isso** (regra: não otimizar).

## 7. `addEventListener` — 54 ocorrências

Espalhadas por quase todos os métodos `setupX`. Nenhum uso de listener genérico fora de um método `setupX` específico.

## 8. Globals expostos em `window`

`window.adicionarAlarme`, `window.abrirAlarme`, `window.removerAlarme`, `window.openAlarmePanel`, `window.statusAlarme`, `window.criarAtalho` — todos definidos dentro de `setupAlarmeOS`, necessários porque HTML gerado dinamicamente (`innerHTML`) usa `onclick="window.abrirAlarme(...)"` inline. **Restrição para a refatoração:** onde quer que esse código vá, esses nomes em `window.*` têm que continuar existindo exatamente iguais.

## 9. Achado crítico — o plano de Etapas 7–11 não bate com o conteúdo real do arquivo

O plano pede para extrair módulos de **Caixa, Ordem de Serviço, Clientes, Produtos e Financeiro** com operações de CRUD completo (abertura, edição, conclusão, cadastro, estoque, contas, etc.). **Isso não existe dentro de `dashboard.js`** — o CRUD real de cada área vive nos módulos próprios (`caixa.js`, `os.js`, `clientes.js`, `estoque.js`, `financeiro.js`, fora da pasta `dashboard/`). O `dashboard.js` é só o controlador da tela inicial (widgets, alertas, busca, sidebar), com pontos de acoplamento pequenos:

| Área do plano | O que existe de fato em `dashboard.js` |
|---|---|
| **Caixa** | `_verificarFechamentoCaixa()` (25 linhas) + leitura de `caixa_lancamentos` dentro de `_carregarMetaFirestore` (Meta Semanal). Nada de abertura/fechamento/movimentação de Caixa em si. |
| **Ordem de Serviço** | Leitura da coleção `os` espalhada em 3 lugares (Central de Alertas, índice de busca, `setupAlarmeOS`). Nenhuma abertura/edição/conclusão/impressão de OS — isso é 100% do módulo `os.js`. |
| **Clientes** | Só a fatia de `clientes` dentro do índice de busca global (`_loadSearchIndex`). Nenhum cadastro/edição/CRUD. |
| **Produtos** | Só a fatia de `estoque_produtos`/`produtos` dentro do índice de busca global. Nenhum CRUD/estoque. |
| **Financeiro** | **Zero.** Só um mapeamento RBAC estático, uma entrada de texto num card de dica e uma rota de navegação — nenhuma lógica. `dashboard-financeiro.js` ficaria vazio se criado. |

Além disso, o maior bloco do arquivo de longe — `setupAlarmeOS`, 976 linhas / 33% do total — é um sistema de alarme de "nova OS chegou" (Service Worker, notificações, Wake Lock, PiP) que não é CRUD de OS e não cabe com naturalidade em nenhum dos 10 módulos planejados.

**Isso não muda o objetivo (organizar em módulos menores), só a forma de agrupar** — preciso de uma decisão sobre como adaptar as Etapas 7–11 antes de criar a estrutura de pastas na Etapa 2, para não criar arquivos vazios (`dashboard-financeiro.js`) ou um arquivo real de ~1000 linhas (`setupAlarmeOS`) sem um lar claro.

## 10. Código morto encontrado (não pedido, registrado para decisão)

`setupMinhaSemana_REMOVIDO` (135 linhas) e `setupSidebarNotas_REMOVIDO` (30 linhas) — nunca chamados em `init()`, comentário no próprio código diz que a funcionalidade foi migrada para `acaodasemana.js`. Mover como está (dead code, só reorganização) ou descartar é decisão do dono — sinalizado, não decidido unilateralmente.

## 11. Decisões do dono (2026-07-04)

1. **Reagrupar por tema real** (não manter os 10 nomes literais do plano original) — `dashboard-clientes.js`, `dashboard-produtos.js` e `dashboard-financeiro.js` não serão criados (nada para pôr neles). Módulo novo `dashboard-alarme-os.js` para o sistema de alarme.
2. **Excluir agora** os 2 métodos `_REMOVIDO` (código morto) em vez de movê-los.

## 12. Alocação final dos módulos (substitui as Etapas 7–11 do plano original)

Todos os arquivos novos ficam na **mesma pasta já existente** `CRM/pages/dashboard/` (nenhuma pasta nova, nenhum arquivo movido/renomeado — `index.html` não precisa de nenhuma alteração, já que nada fora de `dashboard.js` importa esses módulos).

| Arquivo | Conteúdo (métodos movidos) |
|---|---|
| `dashboard-state.js` | `this.state` inicial, `_uid` (estado mutável compartilhado), `RBAC_CARD_PARA_MODULO_ID` |
| `dashboard-utils.js` | `escapeHtml`, `_setChecked`, `_getChecked`, `_setValue`, `_getValue` |
| `dashboard-events.js` | `setupOutsideClicks`, `setupKeyboardShortcuts`, `setupSidebar`, `setupDockTools`, `setupReloadBtn` |
| `dashboard-ui.js` | `setupClock`, `setupCalendar`, `toggleCalendar`, `renderCalendar`, `createCalDay`, `selectCalDay`, `setupNotas`, `setupConfigAlertas`, `carregarConfigAlertas`, `carregarConfigAlertasUI`, `salvarConfigAlertas`, `setupModules`, `navigateTo`, `mostrarAlertaOS` |
| `dashboard-caixa.js` | `_verificarFechamentoCaixa`, `setupMetaSemanal`, `_carregarMetaFirestore`, `updateMeta` |
| `dashboard-busca.js` | `setupGlobalSearch`, `_highlightSearch`, `_loadSearchIndex`, `performSearch` |
| `dashboard-alertas.js` | `setupAutoatendimento`, `_carregarContadorAutoatendimento`, `setupDiarioBadge`, `_lerAgenda`, `_vencidos`, `_contarAcoesVencidas`, `_proximoCompromisso`, `atualizarCardAcaoSemana`, `gerarAlertas`, `setupAlerts` |
| `dashboard-alarme-os.js` | `setupAlarmeOS` (976 linhas) |
| `dashboard-init.js` | corpo do método `init()` (a sequência de chamadas `setupX()`) |
| `dashboard.js` (final) | imports, `class Dashboard` (constructor delega a `dashboard-state.js`), `Object.assign(Dashboard.prototype, ...)` com os mixins acima, `_bootDashboard()` |

**Técnica de preservação de comportamento:** cada `dashboard-X.js` exporta um objeto plano de métodos (mixin). `dashboard.js` faz `Object.assign(Dashboard.prototype, mixinCaixa, mixinBusca, ...)`. Isso preserva exatamente o mesmo `this` (mesma instância, mesmo prototype chain), os mesmos closures internos de cada método, e não muda nenhuma lógica — é só relocação mecânica de código. `_uid` vira um objeto mutável exportado (ex.: `export const state = { uid: null }`) em vez de uma variável solta, para poder ser lido/escrito através dos módulos sem getter/setter.

**Verificação por etapa (sem browser neste ambiente):** não há ferramenta de automação de navegador disponível aqui. A verificação de cada etapa de código será: (1) checagem de sintaxe de cada arquivo novo, (2) checagem estrutural de que nenhum método foi perdido/duplicado (diff de assinaturas antes/depois), (3) carregar a classe montada num ambiente jsdom com stubs de Firebase/DOM (mesmo método já usado no projeto para RBAC sem navegador) para confirmar que a classe instancia sem erro. **Teste manual real em navegador (Etapa 5/7/8/13) só é possível contra algo publicado** — como a branch de trabalho não é publicada a cada commit, a validação funcional completa em navegador fica concentrada no fim (Etapa 13), quando a branch for mesclada em `develop` e publicada em `/dev`.

## 13. Etapas 2–12 concluídas (2026-07-04) — resultado final

Todas as etapas de código (2 a 12) foram concluídas em sequência na branch `refactor-dashboard-modular`, um commit por etapa, cada um validado com `node --check` + checagem estrutural (grep) antes de commitar.

| Arquivo | Linhas | Conteúdo |
|---|---|---|
| `dashboard.js` | 38 | imports, classe `Dashboard` (constructor), `Object.assign` dos 8 mixins, bootstrap |
| `dashboard-state.js` | 67 | state inicial, `dashboardShared.uid`, `RBAC_CARD_PARA_MODULO_ID` |
| `dashboard-utils.js` | 19 | `escapeHtml`, helpers de DOM |
| `dashboard-events.js` | 139 | cliques fora, atalhos de teclado, sidebar drag-and-drop, dock, reload |
| `dashboard-ui.js` | 425 | relógio, notas, calendário, módulos/RBAC, navegação, config de alertas, modal de OS |
| `dashboard-caixa.js` | 132 | fechamento automático do Caixa, Meta Semanal |
| `dashboard-busca.js` | 197 | índice e busca global (OS/clientes/produtos) |
| `dashboard-alertas.js` | 877 | agenda/Ação da Semana, autoatendimento, diário, motor de alertas |
| `dashboard-alarme-os.js` | 987 | alarme de nova OS (Service Worker, notificações, Wake Lock) |
| `dashboard-init.js` | 29 | sequência do `init()` |
| **Total** | **2910** | (era 2991 em 1 arquivo só — a diferença é o código morto removido, líquido dos imports/cabeçalhos novos) |

**Código morto removido (decisão do dono):** `setupMinhaSemana_REMOVIDO` e `setupSidebarNotas_REMOVIDO` (165 linhas), nunca chamados, já substituídos por `acaodasemana.js`.

**Verificação estrutural (repetida a cada etapa):** `node --check` em todos os 10 arquivos + grep confirmando que os 44 métodos originais (46 menos os 2 mortos) existem em exatamente 1 lugar cada — nenhum perdido, nenhum duplicado.

### Etapa 13 — Validação geral

Validação executada em duas camadas:

1. **Estática** (repetida a cada commit): sintaxe válida nos 10 arquivos + integridade estrutural.
2. **Dinâmica (jsdom)** — método já validado no projeto ([[feedback-homologacao-sem-browser]]): os arquivos **reais** (`dashboard.js` + 8 mixins, cópias exatas, nunca reescritos) e o **`index.html` real** foram carregados num ambiente Node+jsdom isolado no scratchpad, com `kernel.js`/`firebase.js`/`permissoes.js` mockados (nunca os arquivos reais/protegidos). Resultado: **10/10 checagens passaram**:
   - Boot completo (`constructor` → 18 chamadas `setupX()` do `init()`) roda do início ao fim sem lançar exceção.
   - Relógio, calendário, Central de Alertas, alarme de OS, sidebar, grid de módulos e busca global populam o DOM real corretamente.
   - RBAC positivo (`podeVisualizar` sempre `true`) e **negativo** (perfil sem acesso ao módulo Caixa) ambos testados — o card é ocultado corretamente quando o perfil não tem permissão.

**O que este teste NÃO cobre (limitação honesta):** renderização visual/CSS real, comportamento real do Firestore (só mockado), registro real de Service Worker, cliques de mouse reais, outras páginas do checklist do CLAUDE.md (Login, Caixa, Clientes, Produtos, Estoque, Financeiro, Usuários/Permissões, Cloud Functions, Responsividade) — nenhuma delas foi tocada por esta refatoração (só a organização interna de arquivos do Dashboard mudou), então não deveriam ter sido afetadas, mas **não foram re-testadas por mim**. Recomendo abrir o Dashboard de verdade num navegador (console aberto, sem erros) antes de promover para `main`.

**Conclusão:** nenhuma regressão encontrada nas duas camadas de verificação disponíveis.
