# 🗂️ PROXIMA_ETAPA.md — MEMÓRIA DO PROJETO (ESTADO ATUAL)

> ⚠️ Leia este arquivo antes de qualquer alteração.
> Para histórico completo, consulte [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md).

---

## 📌 REGRA PERMANENTE DE CONTINUIDADE

### Comando Padrão de Abertura de Sessão

Se o usuário enviar apenas **`CC`** ou **`CONTINUAR`**:

1. **Ler** [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md)
2. **Ler** [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md) apenas se necessário
3. **Gerar relatório contendo:**
   - Onde paramos
   - O que foi concluído
   - O que está em andamento
   - O que está pendente
   - Próxima tarefa recomendada
   - Riscos conhecidos
4. ❌ **Não alterar arquivos**
5. ❌ **Não fazer deploy**
6. ❌ **Não executar correções**
7. ⏳ **Aguardar aprovação**

### Ao retornar ao projeto (comando livre)
1. Ler [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md)
2. Apresentar relatório do estado atual
3. **Sem executar alterações** antes da apresentação

### Ao concluir uma tarefa
1. Atualizar [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md) (estado atual — sobrescrever)
2. Adicionar registro em [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md) (acumulativo — nunca apagar)
3. Informar: *"Arquivos de continuidade atualizados com sucesso."*
4. Aguardar novas instruções

### Modo Somente Leitura
Se a solicitação for **diagnóstico, auditoria, investigação, relatório ou análise**:
- ❌ NÃO atualizar arquivos de continuidade
- ✅ Apenas ler e usar as informações

### Dúvida?
- 🛑 **PARAR** e solicitar confirmação do usuário

---

## ✅ ÚLTIMA ETAPA CONCLUÍDA — Atalho Site Cell City (14/06/2026)

**Atalho fixo para o site institucional em todas as páginas do CRM.**

### O que foi feito
- Botão com logo (`/CRM/assets/logo.png`) adicionado à barra superior do Dashboard (`top-meta-right`) e ao cabeçalho universal (`brand-header.js`)
- Tooltip "Abrir Site da Cell City", abre `https://www.cellcityinformatica.com.br` em nova aba
- CSS isolado (`.site-cc-btn` no Dashboard; `.crm-site-cc-btn` no brand-header) — sem impacto em outros elementos

### Arquivos alterados
- `CRM/pages/dashboard/index.html` — botão no `top-meta-right`
- `CRM/pages/dashboard/dashboard.css` — estilos `.site-cc-btn` e `.site-cc-icon`
- `CRM/shared/brand-header.js` — CSS + injeção do botão no init()

### Backups
- `CRM/shared/BACKUP_SITE_BTN_2026-06-14/`
- `CRM/pages/dashboard/BACKUP_SITE_BTN_2026-06-14/`

> ⚠️ **Pendente: `firebase deploy`** para publicar em produção.

---

## ✅ ETAPA ANTERIOR — Dashboard v4.3 FINAL + Portal do Cliente + Agenda Inteligente + Autoatendimento + Soft Delete Pós-Venda

### O que foi feito (acumulado)
- Dashboard completo com Central de Alertas (Ação da Semana, Pós-Venda, OS sem andamento, Caixa, Pré-OS)
- Portal do Cliente (SPA): login por telefone, OS, garantias, mensagens, avaliações, como chegar
- Agenda Inteligente (Ação da Semana) com prioridade: 1. Atrasadas → 2. Horário atual → 3. Próximas (até 15 min)
- Autoatendimento com redirect `/autoatendimento → CRM/public/abrir-atendimento.html`
- Tarefas atrasadas de dias anteriores **continuam alertando** até conclusão
- **Soft Delete no Pós-Venda:** exclusão lógica com `{ ativo: false, deletedAt: serverTimestamp() }`, modal de confirmação, botão 🗑️ no histórico

### O que foi validado
- Dashboard funcional com todos os módulos
- Portal do Cliente operacional em produção
- Central de Alertas gerando notificações corretamente
- Soft delete implementado sem alterar estrutura do banco

### O que foi aprovado
- Arquitetura do Portal do Cliente (FASE 1)
- Sistema de prioridade da Ação da Semana
- Dashboard v4.3 FINAL
- Soft Delete no Pós-Venda (exclusão lógica apenas)

---

## ✅ ETAPA CONCLUÍDA — Módulo Catálogo FASE 1 (12/06/2026)

**O que foi feito:**
- Catálogo público em `/catalogo` — busca, categorias, destaques, modal de detalhes, botão WhatsApp
- Painel administrativo em `CRM/pages/catalogo/` — CRUD completo com upload de fotos
- Botões: Adicionar, Editar, Duplicar, Ocultar, Excluir
- Tudo editável sem tocar em código: nome, categoria, preço, promoção, descrição, fotos, ordem, destaque, WhatsApp, mensagem automática
- Firebase Hosting: rewrites `/catalogo` e `/catalogo/**` adicionados
- Firestore Rules: leitura pública de `catalogo_produtos` e `catalogo_config`
- Card `📦 Catálogo` adicionado ao Dashboard; rota e favorito registrados

**Coleções novas:** `catalogo_produtos`, `catalogo_config`
**URL pública:** `https://cellcity-crm.web.app/catalogo`
**Backup:** `CRM/pages/catalogo/BACKUP_CATALOGO_2026-06-12/`

> ⚠️ **Pendente: `firebase deploy`** — publicar o módulo em produção.
> ⚠️ Antes do deploy: configurar número do WhatsApp no painel (Configurações → WhatsApp).

---

## ✅ ETAPA CONCLUÍDA — Central de Organização: WhatsApp + Cabeçalho Universal (12/06/2026)

**O que foi feito:**
- Formulário WhatsApp agora suporta múltiplos e-mails e senhas (arrays dinâmicos com botão `+`)
- Campos na ordem: Nome → Número → E-mails → Senhas → Observação
- Estrutura de dados: `{ nome, numero, emails: [], senhas: [], obs }`
- Botão **✏️ Editar** em cada card WhatsApp (carrega todos os dados para edição sem excluir e recadastrar)
- Cabeçalho próprio substituído pelo **cabeçalho universal** (`brand-header.js`): logo Cell City + título centralizado + Fixar nos Favoritos
- `central-organizacao` registrado no mapa de módulos de `favoritos.js`
- Compatível com registros antigos (sem `emails`/`senhas`)

**Arquivos alterados:** `central-organizacao/index.html`, `central-organizacao/central.js`, `central-organizacao/central.css`, `shared/favoritos.js`
**Backup:** `CRM/pages/central-organizacao/BACKUP_WHATSAPP_CENTRAL_2026-06-12/`

---

## ✅ ETAPA CONCLUÍDA — Central de Retorno na O.S. (12/06/2026)

**O que foi feito:**
- Botão **🔔 Retorno** adicionado ao cabeçalho da OS ao lado de 👤 Cliente e 🏭 Fornecedor
- Mini painel "Central de Retorno" (toggle, oculto por padrão) com:
  - **Status de Retorno**: 7 checkboxes (Orçamento enviado, Retorno 1–4, Aprovado, Recusado)
  - Ao marcar: registra data, hora e nome do operador automaticamente
  - **Mensagens Prontas**: botões que copiam mensagem configurável E marcam o checkbox automaticamente
  - **Próximo Retorno**: campo de data + botões +1/+3/+7 dias (salvo no Firestore)
  - **Histórico de Retornos**: lista cronológica dos registros
  - **⚙️ Editar Mensagens**: modal para editar as 5 mensagens (salvas em `config/retorno_mensagens`)
- Nome do operador: salvo em `localStorage('cc_operador_nome')` com prompt na primeira vez
- Dados salvos em `os/{id}.retorno` (campo no documento existente — sem nova coleção)
- Mensagens configuráveis em `config/retorno_mensagens` (coleção já coberta pelas Firestore Rules)

**Arquivos alterados:** `CRM/pages/os/os.js`, `CRM/pages/os/os.css`
**Backup:** `CRM/pages/os/BACKUP_RETORNO_OS_2026-06-12/`

> ⚠️ **Pendente: `firebase deploy`** — publicar em produção.

---

## ✅ ETAPA CONCLUÍDA — Central de Informações: Visualização Split (12/06/2026)

**O que foi feito:**
- Backup criado em `CRM/pages/central-informacoes/BACKUP_VISUALIZACAO_SPLIT_2026-06-12/`
- `index.html` atualizado com container split: lista à esquerda e painel de leitura à direita
- `visualizacao.css` criado com layout desktop, overlay mobile, seleção visual e modo impressão
- `visualizacao.js` criado com viewer por tipo: Comando, Site, Senha, Anotação e Documento
- Clique simples no título agora abre o painel de visualização; duplo clique continua abrindo edição
- `informacoes.js` expõe `window._informacoes` também ao carregar do cache, mantendo o viewer funcional na primeira renderização
- Compatibilidade reforçada para registros de Site com múltiplas URLs
- Viewer fecha/atualiza quando o item ativo sai do filtro, é excluído ou recebe atualização do Firestore

**Arquivos alterados:** `CRM/pages/central-informacoes/index.html`, `CRM/pages/central-informacoes/informacoes.js`
**Arquivos criados:** `CRM/pages/central-informacoes/visualizacao.css`, `CRM/pages/central-informacoes/visualizacao.js`
**Backup:** `CRM/pages/central-informacoes/BACKUP_VISUALIZACAO_SPLIT_2026-06-12/`

> ⚠️ **Validação pendente:** teste visual no navegador, pois `node` não está instalado neste ambiente para checagem automática de JS.

---

## ✅ ETAPA CONCLUÍDA — Central de Informações: Tela Cheia de Leitura (12/06/2026)

**O que foi feito:**
- Backup criado em `CRM/pages/central-informacoes/BACKUP_TELA_CHEIA_2026-06-12/`
- Mantido o comportamento atual: clique simples abre o painel dividido e duplo clique edita
- Botão **⛶ Tela Cheia** adicionado ao painel de visualização
- Modal de leitura com aproximadamente 90% da tela, fundo escuro, conteúdo centralizado e scroll próprio
- Tipografia ampliada para anotações, comandos, procedimentos, scripts, senhas e documentação longa
- Ações dentro da tela cheia: Editar, Copiar, Imprimir e Fechar
- Fechamento por botão, clique no fundo escuro ou tecla `ESC`
- Ao editar pela tela cheia, o modal fecha antes de abrir o formulário de edição
- Impressão pela tela cheia prioriza o conteúdo aberto

**Arquivos alterados:** `CRM/pages/central-informacoes/index.html`, `CRM/pages/central-informacoes/visualizacao.css`, `CRM/pages/central-informacoes/visualizacao.js`
**Backup:** `CRM/pages/central-informacoes/BACKUP_TELA_CHEIA_2026-06-12/`

> ⚠️ **Validação pendente:** teste visual no navegador em notebook/tela menor.

---

## ✅ ETAPA CONCLUÍDA — Central de Informações: Restauração + Tela Cheia sem Split (12/06/2026)

**O que foi feito:**
- Backup solicitado criado em `CRM/pages/central-informacoes/BACKUP_RESTAURACAO_TELA_CHEIA_2026-06-12/`
- Central de Informações restaurada a partir de `BACKUP_VISUALIZACAO_SPLIT_2026-06-12/`, voltando ao layout original anterior ao painel dividido
- Removidos da tela ativa os arquivos `visualizacao.css` e `visualizacao.js`
- Mantido o comportamento original:
  - Clique simples no título copia o conteúdo
  - Duplo clique no título abre edição
- Implementado apenas o botão **⛶ Tela Cheia** em cada registro
- Tela cheia em modal grande (~90% da tela), com título, categoria/tipo e conteúdo completo
- Ações no modal: Editar, Copiar, Imprimir e Fechar
- Fechamento por `ESC`, botão Fechar ou clique no fundo escuro

**Arquivos ativos da Central:** `index.html`, `informacoes.css`, `informacoes.js`
**Arquivos alterados:** `CRM/pages/central-informacoes/index.html`, `CRM/pages/central-informacoes/informacoes.css`, `CRM/pages/central-informacoes/informacoes.js`
**Backup:** `CRM/pages/central-informacoes/BACKUP_RESTAURACAO_TELA_CHEIA_2026-06-12/`

> ✅ `git diff --check` sem erros.
> ⚠️ **Validação pendente:** teste visual no navegador.

---

## ✅ ETAPA CONCLUÍDA — Central de Informações: Ajuste Tela Cheia + Legibilidade (12/06/2026)

**O que foi feito:**
- Backup criado em `CRM/pages/central-informacoes/BACKUP_AJUSTE_TELA_CHEIA_LEITURA_2026-06-12/`
- Botão **⛶ Tela Cheia** agora bloqueia propagação/default do clique e preserva a posição atual da página
- Removido foco automático no painel para evitar rolagem até o fim do documento
- Modal abre sobre a tela atual, centralizado, sem jogar o usuário para baixo
- Textos longos agora são formatados para leitura:
  - Títulos em caixa alta viram seções
  - Linhas com `*`, `-`, `✓`, `•` ou numeração viram listas
  - Quebras em branco viram separação de parágrafos
  - Espaçamento entre linhas, margens e contraste melhorados
- Observações de sites, senhas e comandos também usam a nova formatação

**Arquivos alterados:** `CRM/pages/central-informacoes/index.html`, `CRM/pages/central-informacoes/informacoes.css`, `CRM/pages/central-informacoes/informacoes.js`
**Backup:** `CRM/pages/central-informacoes/BACKUP_AJUSTE_TELA_CHEIA_LEITURA_2026-06-12/`

> ✅ `git diff --check` sem erros.
> ⚠️ **Validação pendente:** teste visual no navegador.

---

## ✅ ETAPA CONCLUÍDA — Central de Informações: Auditoria e Fix Real da Tela Cheia (12/06/2026)

**O que foi feito:**
- Backup criado em `CRM/pages/central-informacoes/BACKUP_AUDITORIA_TELA_CHEIA_FIX_2026-06-12/`
- Auditado o modal de tela cheia: o problema estava ligado ao posicionamento depender do fluxo/viewport calculado da página
- Overlay passou a usar `position: fixed !important`, `inset: 0`, `100vw` e `100dvh`
- Painel passou a ser fixo no viewport, com `top: 16px`, `left: 50%`, largura quase total e altura `100dvh - 32px`
- Removida dependência de centralização por `flex` para evitar deslocamento vertical
- `html` e `body` agora são travados durante a leitura
- Scroll anterior é restaurado apenas ao fechar o modal

**Arquivos alterados:** `CRM/pages/central-informacoes/informacoes.css`, `CRM/pages/central-informacoes/informacoes.js`
**Backup:** `CRM/pages/central-informacoes/BACKUP_AUDITORIA_TELA_CHEIA_FIX_2026-06-12/`

> ✅ `git diff --check` sem erros.
> ⚠️ **Validação pendente:** teste visual no navegador.

---

## ✅ ETAPA CONCLUÍDA — Central de Informações: Expansão Inline do Card (12/06/2026)

**O que foi feito:**
- Backup criado em `CRM/pages/central-informacoes/BACKUP_EXPANSAO_INLINE_2026-06-12/`
- Removido o modal separado de leitura da tela ativa
- Botão **⛶ Tela Cheia** agora expande o próprio card/item no mesmo ponto da lista
- Ao clicar novamente, o item volta ao tamanho normal com botão **↙ Restaurar**
- A expansão não muda o contexto visual, não abre conteúdo no fim da página e não desloca para outra área
- Em modo cards, o card expandido ocupa a largura total da grade
- Em modo lista, o item expandido ocupa a largura da lista e mostra a leitura completa logo abaixo das ações
- Conteúdo expandido tem scroll interno e altura baseada na área disponível da tela
- Ações dentro da expansão: Editar, Copiar, Imprimir e Restaurar

**Arquivos alterados:** `CRM/pages/central-informacoes/index.html`, `CRM/pages/central-informacoes/informacoes.css`, `CRM/pages/central-informacoes/informacoes.js`
**Backup:** `CRM/pages/central-informacoes/BACKUP_EXPANSAO_INLINE_2026-06-12/`

> ✅ `git diff --check` sem erros.
> ⚠️ **Validação pendente:** teste visual no navegador.

---

## ✅ ETAPA CONCLUÍDA — Central de Informações: Refinamento da Expansão Inline (12/06/2026)

**O que foi feito:**
- Backup criado em `CRM/pages/central-informacoes/BACKUP_REFINO_EXPANSAO_INLINE_2026-06-12/`
- Botões originais do card/lista ficam ocultos enquanto o item está expandido
- Ações foram movidas para o rodapé da anotação expandida
- Rodapé contém: ações do tipo, Favoritar, Editar, Copiar, Imprimir, Excluir e Restaurar
- Leitura aparece antes dos botões, evitando interrupção no meio do conteúdo
- Texto expandido ficou mais largo (`max-width` maior), com mais margem interna e ritmo visual mais confortável
- Espaçamento de títulos, parágrafos, listas e comandos foi refinado
- Impressão esconde o rodapé de botões e imprime somente a leitura expandida

**Arquivos alterados:** `CRM/pages/central-informacoes/informacoes.css`, `CRM/pages/central-informacoes/informacoes.js`
**Backup:** `CRM/pages/central-informacoes/BACKUP_REFINO_EXPANSAO_INLINE_2026-06-12/`

> ✅ `git diff --check` sem erros.
> ⚠️ **Validação pendente:** teste visual no navegador.

---

## ✅ ETAPA CONCLUÍDA — Dashboard V2 (13/06/2026)

**Modernização completa do layout do Dashboard — implementado.**

### O que foi feito
- **Sidebar esquerda retrátil:** 240px expandida / 72px recolhida, animação 200ms, estado salvo em `localStorage('cc_sidebar_state')`
- **Painel direito retrátil:** 350px expandido / 48px recolhido, animação 200ms, estado salvo em `localStorage('cc_panel_right_state')`
- **Painel Executivo (KPIs):** 2 linhas — OS Abertas, OS em Andamento, Aguardando Aprovação, Faturamento Hoje, Ticket Médio, Peças em Falta / Bancada, Tempo Médio, Lucro da Semana, Clientes Ativos, Orçamentos Enviados — todos via `onSnapshot` Firestore
- **Metas da Semana** movida para o painel direito (mesmos IDs, mesmo `updateMeta()`)
- **Central de Alertas** no painel direito: aprovações, agendamentos, diagnósticos, pré-OS, OS prontas, OS aguardando peça — com ícone, cor, contador e link direto
- **Grid de módulos:** 5 colunas, 140px/card, 16px gap, 16px radius. OS: 168px e destaque verde
- **Novos módulos shells:** CRM Comercial (`pages/crm-comercial/`), Compras (`pages/compras/`), Auditoria (`pages/auditoria/`) — todos com página "em desenvolvimento"
- **Rotas adicionadas:** `crm-comercial`, `compras`, `auditoria`, `relatorios` (→ analise), `impressora` (→ config)
- **favoritos.js:** CRM Comercial, Compras, Auditoria, Relatórios registrados no mapa de módulos
- **Removido:** dock.js do dashboard (dock substituído pela sidebar footer)
- **Módulos removidos da grade:** Ação da Semana (alertas integrados na Central), Análise (renomeada Relatórios)

### Arquivos alterados
- `CRM/pages/dashboard/index.html` — reescrita completa (V2)
- `CRM/pages/dashboard/dashboard.css` — novo bloco V2 ao final (layout sidebar/painel/exec/grid)
- `CRM/pages/dashboard/dashboard.js` — `setupSidebar()`, `setupPanelRight()`, `setupExecutivePanel()` adicionados; rotas novas; chamada no `init()`
- `CRM/shared/favoritos.js` — 4 novos módulos no mapa `MODULES`

### Arquivos criados
- `CRM/pages/crm-comercial/index.html`
- `CRM/pages/compras/index.html`
- `CRM/pages/auditoria/index.html`

**Backup:** `CRM/BACKUP_DASHBOARD_V2_2026-06-13/`

> ⚠️ **Pendente: `firebase deploy`** — publicar em produção.
> ⚠️ **Validação visual** necessária no navegador (layout responsivo, sidebar, painel direito, KPIs).

---

## 🔧 ETAPA ATUAL

**Portal Técnico (Etapas 1 e 2) — PUBLICADO EM PRODUÇÃO (08/06/2026).**

> ✅ Módulo `CRM/pages/portal-tecnico/` (header padrão, busca, 6 cards "Em desenvolvimento"): Celulares, FRP e Contas, Softwares, Firmwares, Soluções Técnicas, Tutoriais.
> ✅ Integrado aos **Favoritos** (registro em `shared/favoritos.js` → botão "📌 Fixar") e à **Barra Superior** do Dashboard (card + rota); drag & drop + persistência reaproveitados.
> ✅ Commit `e8e049c` em produção (página 200, CSS 200, 6 cards + busca, registro/card confirmados).
> ✅ Backups: `CRM/shared/BACKUP_PORTAL_TECNICO_2026-06-08_0835/`, `CRM/pages/dashboard/BACKUP_PORTAL_TECNICO_2026-06-08_0835/`.
> ⛔ FRP/Softwares/Firmwares/Soluções/upload/banco **não** implementados (próximas etapas).

### 📌 PENDÊNCIA REGISTRADA — Melhoria futura: Favoritos Mobile (NÃO INICIAR AGORA)
**Objetivo:** reorganizar favoritos por **toque prolongado** no celular.
**Escopo:** Drag & Drop por toque (Touch/Pointer Events); Android; iPhone; persistência da ordem; compatibilidade com o sistema atual de favoritos, **Portal Técnico**, **Autoatendimento**, **Wiki**, **OS em Andamento** e **Continuar de Onde Parei**.
**Requisitos:** backup antes; não afetar o desktop; validar persistência após atualizar a página e após logout/login.
**Status:** **PENDENTE — NÃO INICIAR NESTA ETAPA** (tarefa isolada futura). Detalhes no `HISTORICO_PROJETO.md`.

---

## ✅ ETAPA ANTERIOR (Site público)

**Auditoria + correção do site público em produção — CONCLUÍDA (aguarda deploy) (07/06/2026).**

> 🌐 URL: https://www.cellcityinformatica.com.br (GitHub Pages, repo `Cell-City-Site`). CRM/Portal = Firebase Hosting (`CRM/`).
> 🐞 Único recurso quebrado em página navegável: `logooficial.png` 404 (home) → corrigido para `.jpeg` (favicon, rodapé, og/twitter). Header global já usava `.jpeg` (OK).
> 🐞 `sistema/` (órfã): vídeos `imagens/`→`videos/` corrigidos. `1_INDEX` (rascunho órfão): fachada inexistente — não corrigido.
> ✅ Validação local: refs quebradas 4→1 (resta só asset do rascunho órfão).
> ✅ Backup: [`BACKUP_SITE_PUBLICO_2026-06-07_1415/`](BACKUP_SITE_PUBLICO_2026-06-07_1415/)
> ⚠️ **Pendente: `git push` para `Cell-City-Site`** — produção só atualiza após o deploy (não executado).

**Pendências (aguardam decisão):**
- **Deploy do site público** (`git push` → GitHub Pages) para publicar a correção do logo.
- Páginas órfãs `1_/2_/3_*.html` e `sistema/`: avaliar remover ou linkar.
- Consolidação dos 38 `BACKUP_*`.
- ETAPA 7 — Segurança (Firebase/Auth/Rules) — **não iniciar ainda** (instrução do usuário).

---

## ✅ ETAPA ANTERIOR (Limpeza)

**Organização e limpeza (conservadora) — CONCLUÍDA (07/06/2026).**

> ✅ Removidos (reversível via git): `_backup_old/` (cópia antiga completa), `autoatendimento-OLD.html`, `consultar-os-OLD.html`, 3 scripts one-off de auditoria.
> ✅ HTMLs ativos 51→42; refs quebradas 10→4 (as 4 restantes = site público raiz, não tocado). Módulos CRM: 0 refs quebradas.
> ✅ Mantidos: 38 `BACKUP_*` (checkpoints), `1_/2_/3_` (docs de deploy), homolog-*.js reutilizáveis.
> 📋 **Recomendação:** consolidar os 38 `BACKUP_*` em um único `_ARQUIVO_BACKUPS/` (aguarda decisão — são snapshots intencionais).

**Pendências reportadas (aguardam decisão):**
- Site público raiz: logo `.png`→`.jpeg`, vídeo `imagens/`→`videos/`, fachada inexistente (confirmar se está no ar).
- Consolidação dos 38 backups.
- ETAPA 7 — Segurança (Firebase/Auth/Rules) — depende de autorização.

---

## ✅ ETAPA ANTERIOR (Wiki Técnica)

**Revisão da Wiki Técnica (Central de Informações) — CONCLUÍDA (07/06/2026).**

> ✅ "Wiki Técnica" = módulo `central-informacoes` (confirmado com o usuário).
> ✅ 3 bugs corrigidos em `informacoes.js`: (1) `storageUrl` divergente no upload → download quebrado; (2) edição apagava senha salva; (3) render sem escape quebrava cards de comando/prompt. `escapeHtml` agora null-safe.
> ✅ Validado: `node --check` OK + teste unitário `escapeHtml` 4/4.
> ✅ Backup: [`CRM/pages/central-informacoes/BACKUP_REVISAO_2026-06-07_1400/`](CRM/pages/central-informacoes/BACKUP_REVISAO_2026-06-07_1400/)
> ⚠️ `escapeBotoes` (copiar senha no popover) — edge case pré-existente anotado como melhoria futura.

**Próximo:** Prioridade 3 — Organização e limpeza do projeto (inclui consolidar os muitos backups do Portal e os scripts de `_runtime_audit/`).

---

## ✅ ETAPA ANTERIOR (Homologação)

**Homologação geral dos módulos (estática) — CONCLUÍDA (07/06/2026).**

> ✅ 30 JS ativos: **0 erros de sintaxe**. Handlers inline: 0 bugs reais (7 falso-positivos, definidos inline).
> ✅ Módulos CRM: **0 referências quebradas** após limpeza de 2 `<link>` mortos no módulo OS (`index.html` — HTML apenas, `os.js` intacto).
> ✅ Backup: [`CRM/pages/os/BACKUP_HOMOLOG_2026-06-07_1355/`](CRM/pages/os/BACKUP_HOMOLOG_2026-06-07_1355/)
> ⚠️ **Pendências reportadas (não corrigidas):** site público raiz com logo `.png`→`.jpeg`, vídeo `imagens/`→`videos/`, fachada inexistente (confirmar se está no ar — hosting serve `CRM/`). Auth Anônima desabilitada = ETAPA 7 (Segurança), depende de autorização.
> 🔎 Scripts de homologação reutilizáveis em [`_runtime_audit/`](_runtime_audit/): `homolog-refs.js`, `homolog-handlers.js`.

**Próximo:** Revisão da Wiki Técnica → Organização e limpeza do projeto.

---

## ✅ ETAPA ANTERIOR (Portal)

**ETAPA 1 — Item 2: Portal do Cliente — OS e Garantias não apareciam — CONCLUÍDO E VALIDADO (07/06/2026).**

> ✅ **Causa-raiz:** o login salvava só a máscara `(NN) NNNNN-NNNN` na sessão e o listener consultava só esse formato, mas há OS gravadas como dígitos puros → listener retornava 0.
> ✅ **Correção:** helpers `_phoneVariants`/`_phoneMask` + consultas `where('phone','in', variantes)` em `doLogin` e `_listenOS`. Corrigido também falso positivo de garantia em OS `devolvido_orcamento` (`_getDeliveryDate`).
> ✅ **Validado com clientes reais:** Mauricio MID (0→2 OS, 2 garantias) e Maria Cuba (0→1 OS). Sem regressão (Joaquim 1/1).
> ✅ Apenas lógica de consulta no front-end. Sem impacto em Firebase, Firestore, Auth, Rules ou dados.
> ✅ Backup: [`BACKUP_2026-06-07_1338/`](CRM/BACKUP_2026-06-07_1338/)

**Arquivos:** [`portal-cliente/portal.js`](CRM/pages/portal-cliente/portal.js)

---

## 🔧 ETAPA ANTERIOR (CRM)

**Continuar de onde parei — CONCLUÍDO E VALIDADO.**

> ✅ Reabertura direta da última tela utilizada (última OS aberta, Em Andamento, Finalizados ou Clientes).
> ✅ Deep-link de OS específico (`#os-<id>`) funcionando.
> ✅ `localStorage` (`cc_ultima_tela`). Sem impacto em Firebase, Firestore, Auth ou Rules.
> ✅ Backup: [`BACKUP_CONTINUAR_2026-06-06/`](BACKUP_CONTINUAR_2026-06-06/)

**Arquivos:** [`os/os.js`](CRM/pages/os/os.js), [`dashboard/index.html`](CRM/pages/dashboard/index.html), [`dashboard/dashboard.js`](CRM/pages/dashboard/dashboard.js), [`dashboard/dashboard.css`](CRM/pages/dashboard/dashboard.css)

---

## ✅ ETAPA ANTERIOR

**Piloto de Favoritos do módulo OS — CONCLUÍDO e APROVADO.**

> ✅ Chips do Dashboard abrem diretamente: **Em Andamento**, **Finalizados** e **Clientes**.
> ✅ Favoritos múltiplos + deep-links validados. Sem impacto em Firebase, Firestore ou Auth.

### Concluído nesta etapa
- ✅ Piloto de Favoritos do módulo OS concluído
- ✅ **Favoritos múltiplos** funcionando (as 3 visões fixáveis simultaneamente)
- ✅ **Deep-links** funcionando (`#fav-andamento` / `#fav-finalizados` / `#fav-clientes`)
- ✅ **Abertura direta das visões validada** a partir da barra de favoritos do Dashboard (1 clique)
- ✅ `os.js` **não alterado neste piloto** — deep-link interpretado por script isolado em [`os/index.html`](CRM/pages/os/index.html)
- ✅ Validação automatizada (Playwright): **6/6** verificações OK
- ✅ Backup: [`CRM/shared/BACKUP_FAVORITOS_PILOTO_OS_2026-06-06/`](CRM/shared/BACKUP_FAVORITOS_PILOTO_OS_2026-06-06/)

### Arquivos desta etapa
- [`CRM/shared/favoritos.js`](CRM/shared/favoritos.js) — seção "Fixar visão de OS" + registro `OS_VIEWS`
- [`CRM/pages/os/index.html`](CRM/pages/os/index.html) — script de deep-link (chama `showList`/`showScreen` globais já existentes)

### Decisão
- **Manter a implementação atual. Não realizar novas alterações nesta funcionalidade.**

### Etapas anteriores (acumulado)
- ✅ Modernização visual do Portal do Cliente (somente `portal.css`) — backup [`BACKUP_PORTAL_UI_MODERNIZACAO_2026-06-06/`](CRM/pages/portal-cliente/BACKUP_PORTAL_UI_MODERNIZACAO_2026-06-06/)
- ✅ Soft Delete do Pós-Venda — backup em [`BACKUP_POSVENDA_SOFT_DELETE_2026-06-06/`](BACKUP_POSVENDA_SOFT_DELETE_2026-06-06/)

### Pendente (não relacionados)
- ❌ **FASE 2 — Painel Administrativo do Portal** não implementado (planejado em [`plans/fase2-portal-admin.md`](plans/fase2-portal-admin.md))
- ❌ Autoatendimento sem deploy no GitHub
- ❌ Página `/consultar-os` ainda é placeholder "Em desenvolvimento"

---

## ✅ BUSCA GLOBAL — CONCLUÍDA E APROVADA (encerrada)

> ✅ Busca real do Firestore (OS, Clientes, Produtos) no Dashboard, com **Ctrl+K / ⌘K**, debounce, cache 60s em memória, navegação por teclado e resultados clicáveis (OS via `#os-<id>`, Clientes → tela de Clientes, Produto → Estoque).
> ✅ Corrigido bug pré-existente: `escapeHtml()` usado mas inexistente.
> ✅ Sem alteração em Firebase, Firestore, Rules, Auth ou schema. Validado (Playwright 5/5 + dados reais).
> ✅ Arquivo: [`dashboard/dashboard.js`](CRM/pages/dashboard/dashboard.js) (backup [`BACKUP_BUSCA_GLOBAL_2026-06-06/`](CRM/pages/dashboard/BACKUP_BUSCA_GLOBAL_2026-06-06/)). Commits `71610f8` (feature) + `0c3112e` (limpeza de evidências).

---

## ✅ ETAPA CONCLUÍDA — Módulo Meta & Evolução: Ajustes Finais (13/06/2026)

**O que foi feito:**
- **Auditoria completa:** seções "Fontes de dados" e "Regra da meta automática"; mostra origem (Caixa, OS, Financeiro, Recebimentos), registros do mês, soma, última atualização com hora
- **Regra da meta:** exibe ambas as opções calculadas (`Mês/ano × 1,20` e `Média × 1,10`), marca a vencedora em verde, a descartada com tachado, mostra valor bruto antes do arredondamento e meta final (múltiplo de R$500)
- **Evolução com hierarquia correta:** valor financeiro (`+R$ 3.600`) é agora o herói (3,4rem); percentual (`+339,9%`) passou para posição secundária (1,5rem)
- **Destaque visual do mês atual:** rótulo do mês no gráfico agora verde (#00e676) + tamanho 13px (demais: 11px cinza)
- **Meta semanal confirmada como funcionando:** usa os mesmos indicadores da mensal (barra, faltante, por dia, dias restantes, crescimento vs semana anterior)
- **`_lastRefresh`:** rastreia horário exato de cada atualização dos dados via onSnapshot

**Arquivos alterados:** `CRM/pages/relatorios/relatorios.js`, `CRM/pages/relatorios/relatorios.css`
**Backup:** `CRM/pages/relatorios/BACKUP_AUDITORIA_EVOLUCAO_2026-06-13/`
**Coleções lidas:** `os`, `caixa_lancamentos`
**Sem novas coleções criadas. Sem alteração em Firestore Rules.**

> ⚠️ **Validação pendente:** teste visual no navegador (auditoria expandida, troca Mês/Semana, herói R$).
> ⚠️ **Pendente: `firebase deploy`** para publicar em produção.

---

## 🎯 PRÓXIMA TAREFA

### 🚀 Deploy do Catálogo

1. Executar `firebase deploy` no diretório do projeto
2. Configurar número do WhatsApp no painel: CRM → Catálogo → ⚙️ Configurações
3. Cadastrar os primeiros produtos pelo painel administrativo
4. Testar o link público: `https://cellcity-crm.web.app/catalogo`

**Depois do deploy:**
- FASE 2 Portal Admin
- Auditoria de Runtime completa

---

### 🔎 Auditoria de Runtime completa (aguardando)

Verificação de erros/avisos de runtime em todos os módulos (console, listeners, falhas de carregamento) antes de avançar no plano oficial. *(Diretório `_runtime_audit/` em andamento por frente paralela.)*

**Plano oficial (sequência):**
1. Portal do Cliente
2. Painel Administrativo (FASE 2 — [`plans/fase2-portal-admin.md`](plans/fase2-portal-admin.md))
3. Integrações
4. Criar OS
5. Performance
6. ETAPA 7 (Claude)

> ⚠️ Aguardar comando do usuário para iniciar cada item (informar antes os arquivos a alterar).

### 📌 Pendências gerais
- ❌ FASE 2 — Painel Administrativo do Portal não implementado
- ❌ Autoatendimento sem deploy no GitHub
- ❌ Página `/consultar-os` ainda é placeholder "Em desenvolvimento"

---

## 📁 ARQUIVOS ENVOLVIDOS

### Última alteração (Soft Delete Pós-Venda)
- [`CRM/pages/pos-venda/posvenda.js`](CRM/pages/pos-venda/posvenda.js) — Lógica de exclusão, modal, filtro
- [`CRM/pages/pos-venda/posvenda.css`](CRM/pages/pos-venda/posvenda.css) — Estilos do modal de exclusão
- [`CRM/pages/dashboard/dashboard.js`](CRM/pages/dashboard/dashboard.js) — Filtro `ativo` no `gerarAlertas()`
- [`BACKUP_POSVENDA_SOFT_DELETE_2026-06-06/`](BACKUP_POSVENDA_SOFT_DELETE_2026-06-06/) — Backup completo dos arquivos alterados

### ⛔ Não foram alterados
- `CRM/scripts/firebase.js` — Firebase SDK
- `CRM/pages/os/os.js` — Módulo OS
- `CRM/pages/caixa/caixa.js` — Módulo Caixa
- `CRM/index.html` — Ponto de entrada
- `firebase.json` / `firestore.rules` — Config Firebase
- Nenhuma regra do Firestore foi alterada
- Nenhuma coleção do Firestore foi criada ou modificada

### Próxima tarefa (FASE 2)
- `CRM/pages/portal-cliente/admin.html`
- `CRM/pages/portal-cliente/admin.js`
- `CRM/pages/portal-cliente/admin.css`
- `CRM/pages/portal-cliente/portal.js` (apenas tracking)
- `CRM/pages/dashboard/dashboard.js` (apenas rota do card)

---

## ⚠️ RISCOS ATUAIS

- Múltiplos backups do Portal do Cliente podem causar confusão — **arquivos ativos estão em** [`CRM/pages/portal-cliente/`](CRM/pages/portal-cliente/)
- Conflito potencial de `sessionStorage` entre Portal (`portal_session`) e CRM (`cc_acesso`) na mesma aba
- ✅ Soft delete é **reversível**: registros com `ativo: false` permanecem no Firestore e podem ser restaurados alterando para `ativo: true`
- ⚠️ Dashboard não contabiliza registros com `ativo === false` — se um registro for excluído acidentalmente, o alerta correspondente desaparece até restauração
- Nenhum bug crítico reportado atualmente

---

*Última atualização: 08/06/2026 — Portal Técnico publicado (commit e8e049c) + pendência "Favoritos Mobile" registrada.*
