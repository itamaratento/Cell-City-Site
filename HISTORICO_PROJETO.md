# 📚 HISTORICO_PROJETO.md — MEMÓRIA COMPLETA DO PROJETO

> ⚠️ Este arquivo acumula todo o histórico do projeto.
> **Nunca apagar registros antigos.**
> Para o estado atual, consulte [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md).

---

## ÍNDICE

1. [ARQUITETURA DO PROJETO](#arquitetura-do-projeto)
2. [ESTRUTURA DE MÓDULOS](#estrutura-de-módulos)
3. [COLEÇÕES DO FIRESTORE](#coleções-do-firestore)
4. [SISTEMA DE ALERTAS (DASHBOARD)](#sistema-de-alertas-dashboard)
5. [RESTRIÇÕES COMPLETAS](#restrições-completas)
6. [BACKUPS CATALOGADOS](#backups-catalogados)
7. [COMANDO PADRÃO DE CONTINUIDADE](#comando-padrão-de-continuidade)
8. [HISTÓRICO DE ALTERAÇÕES](#histórico-de-alterações)

---

## ARQUITETURA DO PROJETO

### Diretórios Principais
```
b:/cell-City/                  ← Raiz do projeto (site público + CRM)
├── CRM/                       ← Sistema CRM completo
│   ├── index.html             ← Ponto de entrada (redireciona para dashboard ou login)
│   ├── firebase.json          ← Config Firebase (hosting: public = "CRM")
│   ├── firestore.rules        ← Regras de segurança do Firestore
│   ├── firestore.indexes.json ← Índices do Firestore
│   ├── sw.js                  ← Service Worker
│   ├── manifest.json          ← PWA manifest
│   ├── scripts/
│   │   └── firebase.js        ← Firebase SDK compartilhado (NÃO ALTERAR)
│   ├── shared/                ← Componentes compartilhados
│   │   ├── dock.js / dock.css ← Dock de navegação
│   │   ├── brand-header.js    ← Header da marca
│   │   └── favoritos.js       ← Sistema de favoritos
│   ├── pages/                 ← Módulos do CRM
│   │   ├── dashboard/         ← Dashboard principal
│   │   ├── os/                ← Ordens de Serviço
│   │   ├── caixa/             ← Caixa / Financeiro
│   │   ├── clientes/          ← Clientes
│   │   ├── estoque/           ← Estoque
│   │   ├── portal-cliente/    ← Portal do Cliente (ATIVO)
│   │   ├── pos-venda/         ← Pós-Venda 5/15/30 dias
│   │   ├── autoatendimento/   ← Autoatendimento
│   │   ├── acaodasemana/      ← Agenda Inteligente (Ação da Semana)
│   │   ├── central-comandos/  ← Central de Comandos
│   │   ├── chat/              ← Chat
│   │   ├── config/            ← Configurações
│   │   ├── analise/           ← Análise
│   │   ├── estrategia/        ← Estratégia
│   │   ├── financeiro/        ← Financeiro
│   │   ├── fornecedor/        ← Fornecedor
│   │   ├── campanhas/         ← Campanhas
│   │   └── importar/          ← Importar dados
│   ├── public/
│   │   └── abrir-atendimento.html ← Formulário de autoatendimento
│   └── assets/                ← Assets (logo, imagens)
├── index.html                 ← Site público (página inicial)
├── autoatendimento.html       ← Página de redirect do autoatendimento
├── consultar-os.html          ← Página placeholder "Em desenvolvimento"
├── firebase.json              ← Config Firebase Hosting (raiz)
├── firestore.rules            ← Regras Firestore (raiz)
├── PROXIMA_ETAPA.md           ← Estado atual do projeto (ENXUTO)
└── HISTORICO_PROJETO.md       ← ← VOCÊ ESTÁ AQUI
```

### Hospedagem (Firebase Hosting)
- **Projeto Firebase:** `cellcity-crm`
- **Domínio:** `www.cellcityinformatica.com.br`
- **Pasta pública:** `CRM/`
- **Rewrites configurados:**
  - `/portal` → `/pages/portal-cliente/index.html`
  - `/portal/**` → `/pages/portal-cliente/index.html`
  - `**` → `/index.html` (SPA fallback)

---

## ESTRUTURA DE MÓDULOS

Cada módulo do CRM tem sua própria pasta em `CRM/pages/<modulo>/` com:
- `index.html` — Ponto de entrada do módulo
- `<modulo>.css` — Estilos específicos
- `<modulo>.js` — Lógica do módulo

### Módulos Implementados

| Módulo | Pasta | Status |
|--------|-------|--------|
| Dashboard | `CRM/pages/dashboard/` | ✅ v4.3 FINAL |
| OS (Ordens de Serviço) | `CRM/pages/os/` | ✅ Operacional |
| Caixa | `CRM/pages/caixa/` | ✅ Operacional |
| Clientes | `CRM/pages/clientes/` | ✅ Operacional |
| Estoque | `CRM/pages/estoque/` | ✅ Operacional |
| Portal do Cliente | `CRM/pages/portal-cliente/` | ✅ FASE 1 Completa |
| Pós-Venda | `CRM/pages/pos-venda/` | ✅ Operacional |
| Autoatendimento | `CRM/pages/autoatendimento/` | ✅ Operacional |
| Agenda Inteligente | `CRM/pages/acaodasemana/` | ✅ Operacional |
| Central de Comandos | `CRM/pages/central-comandos/` | ✅ Operacional |
| Chat | `CRM/pages/chat/` | ⚠️ Estrutura criada |
| Configurações | `CRM/pages/config/` | ✅ Operacional |
| Análise | `CRM/pages/analise/` | ✅ Operacional |
| Estratégia | `CRM/pages/estrategia/` | ✅ Operacional |
| Financeiro | `CRM/pages/financeiro/` | ✅ Operacional |
| Fornecedor | `CRM/pages/fornecedor/` | ✅ Operacional |
| Campanhas | `CRM/pages/campanhas/` | ✅ Operacional |
| Importar | `CRM/pages/importar/` | ✅ Estrutura criada |
| Em Breve | `CRM/pages/em-breve/` | ✅ Estrutura criada |

### Carregamento dos Módulos
Os módulos são carregados via **iframe** no Dashboard. Cada card no Dashboard aponta para o `index.html` do respectivo módulo.

---

## COLEÇÕES DO FIRESTORE

| Coleção | Finalidade | Regra de Acesso |
|---------|-----------|-----------------|
| `os` | Ordens de Serviço | get: público; list/create/update/delete: auth |
| `clientes` | Clientes | auth |
| `agenda` | Sticky notes / Ação da Semana | auth |
| `pre_os` | Pré-OS do autoatendimento | create: público; read/update/delete: auth |
| `mensagens_portal` | Mensagens do Portal do Cliente | auth |
| `avaliacoes` | Avaliações do portal | auth |
| `caixa_lancamentos` | Lançamentos do caixa | auth |
| `categorias_caixa` | Categorias do caixa | auth |
| `notas_usuarios` | Bloco de notas do Dashboard | auth |
| `comandos` | Central de Comandos | auth |
| `categorias_comandos` | Categorias de comandos | auth |
| `posvenda_contatos` | Controle de pós-venda | auth |
| `config` | Configurações (impressão, loja) | get: público; list/write: auth |
| `resumo_live` | Meta semanal do Dashboard | auth |
| `metadata` | Metadados do sistema | auth |
| `garantias` | Garantias (planejado) | 🔜 |
| `portal_eventos` | Tracking do portal (planejado FASE 2) | 🔜 |

### Regras de Segurança (firestore.rules)
- Leitura pública apenas para: `os` (get), `config` (get), `pre_os` (create)
- Todo o restante requer autenticação
- Localização: `southamerica-east1`

---

## SISTEMA DE ALERTAS (DASHBOARD)

A Central de Alertas no Dashboard é populada pelo método [`gerarAlertas()`](CRM/pages/dashboard/dashboard.js:558).

### Fontes de Alerta

#### 1. Ação da Semana (Agenda Inteligente)
- **Coleção:** `agenda` no Firestore
- **Formato:** 1 documento por dia com campo `notas: [{texto, cor, concluido}]`
- **Recorrência:** suporta `semanal`, `mensal`, `anual`
- **Prioridade (definida em** [`dashboard.js:458-555`](CRM/pages/dashboard/dashboard.js:458)**):**
  1. ⏰ **Tarefas atrasadas** (qualquer dia passado, não concluídas) — **PRIORIDADE MÁXIMA**
  2. 🔴 **Horário atual** (hoje, janela 0-5 min) — só se não houver atrasadas
  3. 📅 **Próximas** (hoje, janela 6-15 min) — só se não houver atrasadas nem no horário
- **Regra crítica:** Tarefas atrasadas de dias anteriores **continuam alertando** até que `concluido: true`
- **Card da Ação da Semana:** classe `acao-vencida` adicionada enquanto houver pendências

#### 2. Pós-Venda (5/15/30 dias)
- **Coleção:** `posvenda_contatos` + `os`
- **Trigger:** OS com status `entregue`
- **Prazos:** contato aos 5, 15 e 30 dias após entrega
- **Alertas:** pendente (atenção) e vencido (+2 dias, crítico)

#### 3. OS sem Andamento
- OS com status `em_analise` ou `aguardando_aprovacao` por mais de 7 dias

#### 4. Caixa
- Fechamento automático do caixa via iframe invisível
- Verificação diária com cache em `localStorage`

#### 5. Pré-OS (Autoatendimento)
- Pré-OS pendentes de conversão para OS

---

## RESTRIÇÕES COMPLETAS

### Arquivos Protegidos (NÃO ALTERAR)
- `CRM/scripts/firebase.js` — Firebase SDK compartilhado
- `CRM/pages/os/auth.js` — Autenticação do módulo OS
- `CRM/pages/config/config.js` — Configurações do sistema
- `CRM/shared/dock.css` / `dock.js` — Navegação compartilhada

### Proibido
- ❌ Renomear arquivos — quebra imports e referências
- ❌ Mover pastas — quebra caminhos relativos
- ❌ Alterar imports globais — compartilhados entre módulos
- ❌ Trocar estrutura HTML das páginas principais
- ❌ Modificar banco Firestore sem autorização explícita
- ❌ Alterar `firebase.json` sem autorização
- ❌ Alterar `firestore.rules` sem autorização
- ❌ Alterar autenticação sem autorização
- ❌ Alterar estrutura principal do CRM sem autorização

### Permitido
- ✅ Alterar SOMENTE componentes solicitados
- ✅ Criar funções novas isoladas
- ✅ Adicionar comentários no código

### Padrão de Trabalho
- Sempre responder quais arquivos serão alterados
- Mostrar resumo antes da alteração
- Nunca alterar mais de 1 módulo por vez
- Sempre criar backup antes de alterar arquivos críticos

### Estilo de Código
- JavaScript vanilla (sem frameworks)
- Padrão de classes ou objetos globais para cada módulo
- Imports ES6 modules do Firebase SDK
- CSS com nomes de classes prefixadas por módulo
- CRÍTICO: Nunca usar `~` ou `$HOME` em caminhos — sempre caminhos relativos

---

## BACKUPS CATALOGADOS

### Backups do Projeto Geral

| Backup | Data | Conteúdo |
|--------|------|----------|
| [`_BACKUP_COMPLETO_2025-06-05/`](_BACKUP_COMPLETO_2025-06-05/) | 05/06/2025 | Backup completo do projeto |
| [`_backup_old/`](_backup_old/) | Anterior | Cópia antiga da estrutura completa do CRM |

### Backups do CRM

| Backup | Data | Conteúdo |
|--------|------|----------|
| [`CRM/pages/os/BACKUP/os copy.js`](CRM/pages/os/BACKUP/os%20copy.js) | — | Backup do módulo OS |
| [`CRM/scripts/BACKUP/firebase copy.js`](CRM/scripts/BACKUP/firebase%20copy.js) | — | Backup do Firebase SDK |
| [`CRM/shared/BACKUP_FAVORITOS_PILOTO_OS_2026-06-06/`](CRM/shared/BACKUP_FAVORITOS_PILOTO_OS_2026-06-06/) | 06/06/2026 | Backup do sistema de favoritos + dock + dashboard |
| [`BACKUP_POSVENDA_SOFT_DELETE_2026-06-06/`](BACKUP_POSVENDA_SOFT_DELETE_2026-06-06/) | 06/06/2026 | Backup do Pós-Venda (pré-soft delete): posvenda.js, index.html, posvenda.css, dashboard.js |

### Backups do Portal do Cliente (ordem cronológica)

| Backup | Data | Etapa |
|--------|------|-------|
| [`pages/portal-cliente/BACKUP_ETAPA1/`](pages/portal-cliente/BACKUP_ETAPA1/) | — | Etapa 1 |
| [`pages/portal-cliente/BACKUP_ETAPA2/`](pages/portal-cliente/BACKUP_ETAPA2/) | — | Etapa 2 (admin) |
| [`pages/portal-cliente/BACKUP_ETAPA2_TELA_INICIAL/`](pages/portal-cliente/BACKUP_ETAPA2_TELA_INICIAL/) | — | Etapa 2 Tela Inicial |
| [`pages/portal-cliente/BACKUP_ETAPA3/`](pages/portal-cliente/BACKUP_ETAPA3/) | — | Etapa 3 |
| [`pages/portal-cliente/BACKUP_ETAPA3/FINAL/`](pages/portal-cliente/BACKUP_ETAPA3/FINAL/) | — | Etapa 3 Final |
| [`pages/portal-cliente/BACKUP_ETAPA3_FALE_CONOSCO/`](pages/portal-cliente/BACKUP_ETAPA3_FALE_CONOSCO/) | — | Etapa 3 Fale Conosco |
| [`pages/portal-cliente/BACKUP_ETAPA4/`](pages/portal-cliente/BACKUP_ETAPA4/) | — | Etapa 4 |
| [`pages/portal-cliente/BACKUP_ETAPA5/`](pages/portal-cliente/BACKUP_ETAPA5/) | — | Etapa 5 |
| [`pages/portal-cliente/BACKUP_FIREBASE/`](pages/portal-cliente/BACKUP_FIREBASE/) | — | Config Firebase |
| [`pages/portal-cliente/BACKUP_NOVAS_ETAPAS/`](pages/portal-cliente/BACKUP_NOVAS_ETAPAS/) | — | Novas Etapas |
| [`pages/portal-cliente/BACKUP_P5_PRE_MELHORIAS/`](pages/portal-cliente/BACKUP_P5_PRE_MELHORIAS/) | — | P5 Pré-Melhorias |
| [`pages/portal-cliente/BACKUP_PORTAL_CLIENTE_PRE_UX_2026/`](pages/portal-cliente/BACKUP_PORTAL_CLIENTE_PRE_UX_2026/) | — | Pré-UX 2026 |
| [`pages/portal-cliente/BACKUP_PORTAL_UI_ETAPA_1/`](pages/portal-cliente/BACKUP_PORTAL_UI_ETAPA_1/) | — | UI Etapa 1 |
| [`pages/portal-cliente/BACKUP_PORTAL_UI_ETAPA_2/`](pages/portal-cliente/BACKUP_PORTAL_UI_ETAPA_2/) | — | UI Etapa 2 |
| [`pages/portal-cliente/BACKUP_PORTAL_UI_ETAPA_3/`](pages/portal-cliente/BACKUP_PORTAL_UI_ETAPA_3/) | — | UI Etapa 3 |
| [`pages/portal-cliente/BACKUP_PORTAL_UI_MODERNIZACAO_2026-06-06/`](pages/portal-cliente/BACKUP_PORTAL_UI_MODERNIZACAO_2026-06-06/) | 06/06/2026 | Modernização UI |
| [`BACKUP_ETAPA4A/`](BACKUP_ETAPA4A/) (raiz) | — | Etapa 4A |
| [`BACKUP_ETAPA35/`](BACKUP_ETAPA35/) (raiz) | — | Etapa 35 |

### Backups Antigos (do diretório `_backup_old/`)

| Backup | Conteúdo |
|--------|----------|
| [`_backup_old/pages/os/BACKUP/os copy.js`](_backup_old/pages/os/BACKUP/os%20copy.js) | Backup OS |
| [`_backup_old/scripts/BACKUP/BACKUP/firebase copy.js`](_backup_old/scripts/BACKUP/BACKUP/firebase%20copy.js) | Backup Firebase SDK |

> ℹ️ **Nota:** O diretório ativo do Portal do Cliente é [`CRM/pages/portal-cliente/`](CRM/pages/portal-cliente/). Os backups em [`pages/portal-cliente/`](pages/portal-cliente/) e na raiz são versões anteriores preservadas.

---

## COMANDO PADRÃO DE CONTINUIDADE

### Comando Padrão de Abertura de Sessão

Se o usuário enviar apenas **`CC`** ou **`CONTINUAR`**:

1. **Ler** [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md) primeiro
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
1. **Ler** [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md) primeiro
2. **Apresentar relatório completo:**
   - Onde paramos
   - O que foi concluído
   - O que está em andamento
   - Próxima tarefa recomendada
3. **Sem executar alterações** — aguardar instruções do usuário

### Ao finalizar qualquer tarefa
1. **Atualizar** [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md) — sobrescrever estado anterior
2. **Inserir novo registro** neste arquivo ([`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md)) — preservar histórico
3. **Informar:** *"Arquivos de continuidade atualizados com sucesso."*
4. **Aguardar** novas instruções

### Registro no Histórico
Cada registro deve conter:
- **Data e hora**
- **Tarefa concluída**
- **Arquivos alterados**
- **Problemas encontrados**
- **Decisões tomadas**
- **Aprovações recebidas**
- **Pendências**

---

## HISTÓRICO DE ALTERAÇÕES

### 15/06/2026 — Tooltip no Menu Lateral da Sidebar

**Tarefa:** Exibir o nome do módulo ao passar o mouse sobre os ícones da sidebar.

**Problema encontrado:** o tooltip via `::after` CSS existia no código mas era invisível — `.sidebar-left` tem `overflow: hidden` (necessário para a animação de colapso), o que cortava qualquer conteúdo posicionado absolutamente fora dos seus limites.

**O que foi feito:**
- Removido o CSS `::after` que não funcionava.
- Tooltip criado via JS: elemento `<div id="cc-sidebar-tooltip">` injetado no `<body>`, com `position: fixed` — imune ao `overflow: hidden` de qualquer ancestral.
- `showTip()` / `hideTip()` via `mouseenter` / `mouseleave` em todos os `[data-tip]` da sidebar.
- Estilo: fundo `#111827`, texto branco, `border-radius: 6px`, `box-shadow: 0 4px 16px rgba(0,0,0,0.45)`, transição de opacidade 80ms.
- Hover no ícone: `filter: brightness(1.5)` + `transform: scale(1.12)` — efeito de destaque visual imediato.

**Arquivos alterados:**
- `CRM/pages/dashboard/dashboard.css` — `#cc-sidebar-tooltip` + `.sidebar-item:hover .sidebar-icon`
- `CRM/pages/dashboard/dashboard.js` — bloco de tooltip no final de `setupSidebar()`

**Backup:** `CRM/pages/dashboard/BACKUP_TOOLTIP_SIDEBAR_2026-06-15/`

---

### 14/06/2026 — Correção Filtro Semana — Caixa Operacional

**Tarefa:** Corrigir filtro "Semana" que mostrava valores zerados e nenhuma movimentação.

**Causa-raiz:** `aplicarFiltros()` em `caixa.js` calculava o início da semana com `setDate(date - getDay())`. Como `getDay()` retorna `0` para domingo, no domingo o início da semana era fixado em "hoje", excluindo todos os registros de segunda a sábado da mesma semana ISO.

**O que foi feito:**
- Filtro `periodoFiltro === 'semana'` agora usa `getWeekKey(hoje)` (semana ISO: segunda→domingo), comparando a chave de semana do registro com a semana atual. Mesma função usada em `atualizarResumosLive` e `gerarFechamentoSemanal` — lógica 100% consistente.
- Logs de auditoria temporários adicionados: `Filtro Semana`, `Inicio Semana`, `Fim Semana`, `Movimentações Encontradas`.

**Arquivo alterado:** `CRM/pages/caixa/caixa.js` — função `aplicarFiltros()` (~linha 1160)
**Backup:** `CRM/pages/caixa/BACKUP_FILTRO_SEMANA_2026-06-14/`

**Pendente:** teste visual no navegador + remover logs de auditoria + `firebase deploy`.

---

### 14/06/2026 — Separação de Papéis: 3 Componentes de Alertas

**Tarefa:** Implementar arquitetura "Sino = agir · Central de Alertas = analisar · Painel Lateral = monitorar", eliminando duplicidade entre os componentes.

**O que foi feito:**
- `gerarAlertas()` simplificado: removidos blocos de Agendamentos do Portal, Diagnósticos do Portal e Solicitações de Serviço (esses dados já existem no sino)
- Painel Lateral Direito convertido de duplicata do sino para painel gerencial, com nova função `setupPainelLateralGerencial()`:
  - Exibe: Meta Semanal (%), Ticket Médio, Pós-venda atrasado/pendente, Avaliações críticas, Estoque baixo, Aparelhos não retirados, Orçamentos sem resposta
  - Refresh automático a cada 3 min + refresh ao focar a aba
  - Header renomeado "⚠️ CENTRAL DE ALERTAS" → "📊 MONITORAMENTO"
- Sino (script inline): função `atualizarAlertasDireita()` removida (efeito colateral), núcleo funcional 100% preservado

**Arquivos alterados:** `CRM/pages/dashboard/dashboard.js`, `CRM/pages/dashboard/index.html`
**Backup:** `CRM/pages/dashboard/BACKUP_REDESIGN_PAINEL_2026-06-14/`

---

### 14/06/2026 — Central de Alertas como Módulo

**Tarefa:** Remover painel rotativo do topo e converter Central de Alertas em card de módulo no grid principal.

**O que foi feito:**
- `alerts-section` ocultada com `display:none` (lógica de som e config permanece ativa)
- Card "⚠️ Central de Alertas" adicionado ao grid de módulos: badge de contagem + subtítulo dinâmico
- Clicar no card abre modal com lista completa de alertas; modal tem botão ⚙️ que abre config
- `navigateTo('central-alertas')` interceptado para abrir modal

**Arquivos alterados:** `CRM/pages/dashboard/dashboard.js`, `CRM/pages/dashboard/dashboard.css`, `CRM/pages/dashboard/index.html`
**Backup:** `CRM/pages/dashboard/BACKUP_UNIF_ALERTAS_2026-06-14/`

---

### 14/06/2026 — Unificação da Central de Alertas (sistema base)

**Tarefa:** Unificar `setupAvisoAcoes()`, `monitorarCardAcaoSemana()` e `gerarAlertas()` em sistema único com configuração pelo usuário.

**O que foi feito:**
- `setupAvisoAcoes()` removida; `monitorarCardAcaoSemana()` substituída por `atualizarCardAcaoSemana()` (só visual)
- Cada alerta ganhou flags `som`, `pulsar`, `repetir`, `tipo`
- `setupAlerts()` integra som + pulsação respeitando config; config salva em `localStorage('cc_config_alertas')`
- Modal de configuração: som on/off, dias da semana, horário de silêncio, toggles por tipo de alerta, pulsação

**Arquivos alterados:** `CRM/pages/dashboard/dashboard.js`, `CRM/pages/dashboard/dashboard.css`, `CRM/pages/dashboard/index.html`
**Backup:** `CRM/pages/dashboard/BACKUP_UNIF_ALERTAS_2026-06-14/`

---

### 14/06/2026 — Atalho Site Cell City

**Tarefa:** Adicionar acesso rápido ao site institucional em todas as páginas do CRM.

**O que foi feito:**
- Botão com logo da Cell City adicionado à `top-meta-right` do Dashboard e injetado pelo `brand-header.js` em todos os demais módulos
- Abre `https://www.cellcityinformatica.com.br` em nova aba (`target="_blank"`, `rel="noopener noreferrer"`)
- Tooltip "Abrir Site da Cell City"
- CSS isolado em classes próprias: `.site-cc-btn` (dashboard) e `.crm-site-cc-btn` (brand-header)
- Sem impacto em Firebase, Firestore, Auth, Rules ou dados

**Arquivos alterados:** `CRM/pages/dashboard/index.html`, `CRM/pages/dashboard/dashboard.css`, `CRM/shared/brand-header.js`
**Backups:** `CRM/shared/BACKUP_SITE_BTN_2026-06-14/`, `CRM/pages/dashboard/BACKUP_SITE_BTN_2026-06-14/`

---

### 12/06/2026 — Central de Retorno na O.S.

**Tarefa:** Adicionar controle de retorno ao cliente dentro da própria tela da O.S., sem criar novo módulo.

**O que foi feito:**
- Botão 🔔 Retorno adicionado ao cabeçalho da OS (ao lado de 👤 Cliente e 🏭 Fornecedor)
- Painel Central de Retorno com: checkboxes de status, mensagens prontas configuráveis, próximo retorno com atalhos (+1/+3/+7 dias) e histórico de retornos
- Ao clicar nos botões de mensagem: copia o texto E marca o checkbox automaticamente com data, hora e operador
- Mensagens editáveis via modal ⚙️ (salvas em `config/retorno_mensagens` no Firestore)
- Nome do operador salvo em `localStorage('cc_operador_nome')` com prompt na primeira vez

**Arquivos alterados:** `CRM/pages/os/os.js`, `CRM/pages/os/os.css`
**Backup:** `CRM/pages/os/BACKUP_RETORNO_OS_2026-06-12/`
**Coleção nova:** nenhuma — dados de retorno em `os/{id}.retorno`; mensagens em `config/retorno_mensagens` (já coberto pelas Rules)

---

### 12/06/2026 — Módulo Catálogo (FASE 1)

**Tarefa:** Criar o módulo Catálogo com link público, painel administrativo completo, integração WhatsApp e cadastro total de produtos sem alterar código.

**O que foi feito:**
- Criado `CRM/pages/catalogo/public/index.html` — catálogo público (sem login)
- Criado `CRM/pages/catalogo/public/catalogo-publico.js` — busca, filtros, modal de detalhes, botão WhatsApp
- Criado `CRM/pages/catalogo/public/catalogo-publico.css` — visual padrão Cell City dark
- Criado `CRM/pages/catalogo/index.html` — painel administrativo (requer login CRM)
- Criado `CRM/pages/catalogo/catalogo.js` — CRUD completo: adicionar, editar, duplicar, ocultar, excluir, upload de fotos, reordenar, destaque
- Criado `CRM/pages/catalogo/catalogo.css` — estilos do painel admin
- `firebase.json` — +2 rewrites: `/catalogo` e `/catalogo/**` → catálogo público
- `CRM/firestore.rules` — leitura pública de `catalogo_produtos` e `catalogo_config`
- `CRM/pages/dashboard/index.html` — +card `📦 Catálogo`
- `CRM/pages/dashboard/dashboard.js` — +rota `catalogo`
- `CRM/shared/favoritos.js` — +entrada `catalogo` no mapa MODULES

**Coleções Firestore criadas pelo painel (não existiam antes):**
- `catalogo_produtos/{id}` — nome, categoria, preco, precoPromo, descricao, fotos[], fotoPrincipal, ativo, destaque, ordem, criadoEm, atualizadoEm
- `catalogo_config/geral` — whatsapp, mensagemTemplate

**URL pública:** `https://cellcity-crm.web.app/catalogo`

**Arquivos alterados:** `firebase.json`, `CRM/firestore.rules`, `CRM/pages/dashboard/index.html`, `CRM/pages/dashboard/dashboard.js`, `CRM/shared/favoritos.js`
**Backup:** `CRM/pages/catalogo/BACKUP_CATALOGO_2026-06-12/`

**Pendente — FASE 2 (futuro):** integração CRM Operacional, Controle de Estoque, Promoções automáticas, analytics de cliques.

---

### 06/06/2026 — Continuar de onde parei

**Tarefa:** Permitir que o Dashboard reabra exatamente a última tela importante usada no módulo OS.

**O que foi feito:**
- `os.js`: registro da última tela em `localStorage` (chave `cc_ultima_tela` = `{modulo, view, label, sub, hash, url, ts}`) ao abrir Em Andamento, Finalizados, Clientes e detalhe de uma OS
- `os.js`: deep-link `#os-<id>` para reabrir uma OS específica (prioridade: `#os-<id>` > `#fav-...` > favorito-estrela) + listener `hashchange`
- `dashboard/index.html`: botão `▶ Continuar de onde parei` no topo do workspace
- `dashboard.js`: `setupContinuar()` lê `cc_ultima_tela`, exibe rótulo (ex.: "OS 1045 → Em reparo") e navega para a URL salva
- `dashboard.css`: estilo do botão `.continuar-btn`

**Arquivos alterados:**
- `CRM/pages/os/os.js`
- `CRM/pages/dashboard/index.html`
- `CRM/pages/dashboard/dashboard.js`
- `CRM/pages/dashboard/dashboard.css`
- Backup: `BACKUP_CONTINUAR_2026-06-06/`

**Status:** ✅ CONCLUÍDO E VALIDADO. Reabertura direta da última tela utilizada; deep-link de OS específico (`#os-<id>`) funcionando. Sem impacto em Firebase, Firestore, Auth ou Rules. Backup: `BACKUP_CONTINUAR_2026-06-06`.

### 06/06/2026 — Favoritos das visões do módulo OS

**Tarefa:** Permitir favoritar uma visão do módulo OS para abertura direta

**O que foi feito:**
- Estrela ⭐ (☆/★) adicionada nos cards "Em Andamento", "Finalizados" e "Clientes" da home do OS
- Favorito salvo em `localStorage` (chave `cc_os_fav`) — sem Firestore
- Ao entrar no módulo OS, se houver favorito, abre direto na visão correspondente
- Clicar na estrela do favorito atual remove o favorito (volta a abrir na home)

**Arquivos alterados:**
- `CRM/pages/os/index.html` — botão `.fav-star` nos 3 cards
- `CRM/pages/os/os.js` — `toggleFav`, `getFav`, `openFav`, `updateFavStars` + abertura direta no `init()`
- `CRM/pages/os/os.css` — estilos da estrela `.fav-star`
- Backup: `BACKUP_OS_FAVORITOS_2026-06-06/`

**Problemas encontrados:** Nenhum (sintaxe JS validada via `node --check`)

### 06/06/2026 — Integração OS ↔ Barra de Favoritos (deep-link #fav-...)

**Tarefa:** Conectar o módulo OS à barra de favoritos já existente (`shared/favoritos.js`)

**Contexto:** Já existia um sistema de favoritos completo (`shared/favoritos.js`): barra horizontal no Dashboard + lançador "📌 Fixar" nas demais páginas, com piloto de visões de OS (`OS_VIEWS`) apontando para deep-links `#fav-andamento/#fav-finalizados/#fav-clientes`. Faltava o `os.js` interpretar esses hashes.

**O que foi feito:**
- `os.js`: `getHashView()` mapeia `#fav-andamento/#fav-finalizados/#fav-clientes` → visão
- `init()`: abre a visão do deep-link (prioridade) ou, na ausência, o favorito de abertura padrão (estrela)
- Listener de `hashchange` para abrir a visão quando o hash muda sem recarregar (navegação pelo dropdown na própria página de OS)

**Arquivos alterados:**
- `CRM/pages/os/os.js` — `getHashView`, lógica no `init()`, listener `hashchange`

**Problemas encontrados:** Nenhum (sintaxe validada via `node --check`)

**Status:** ✅ CONCLUÍDO E VALIDADO. Os chips do Dashboard abrem diretamente as visões de OS — Em Andamento, Finalizados e Clientes. Sem impacto em Firebase, Firestore ou Auth.

**Observação:** A barra de favoritos do Dashboard NÃO precisou de alteração — já estava pronta em `shared/favoritos.js`.

### 06/06/2026 — 19:40 BRT

**Tarefa:** Reorganização do sistema de memória do projeto

**O que foi feito:**
- [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md) foi enxugado para conter apenas o estado atual do projeto
- [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md) foi criado com todo o histórico completo e acumulativo
- Regras de funcionamento documentadas: PROXIMA_ETAPA.md = curto/estado atual, HISTORICO_PROJETO.md = longo/histórico completo

**Arquivos alterados:**
- `PROXIMA_ETAPA.md` — Reescreto como arquivo enxuto (estado atual)
- `HISTORICO_PROJETO.md` — Criado com arquitetura, restrições, backups, alertas, Firestore, histórico

**Problemas encontrados:** Nenhum

**Decisões tomadas:**
- PROXIMA_ETAPA.md será sempre sobrescrito (não acumula histórico)
- HISTORICO_PROJETO.md será sempre preservado (acumula todo o histórico)
- Padrão de continuidade obrigatório para todas as futuras sessões

**Pendências:**
- ❌ FASE 2 — Painel Admin do Portal não implementado
- ❌ Autoatendimento sem deploy no GitHub
- ❌ Página `/consultar-os` placeholder

---

### 06/06/2026 — 19:38 BRT

**Tarefa:** Adicionar Regras Permanentes de Continuidade

**O que foi feito:**
- Adicionada seção "REGRA PERMANENTE DE CONTINUIDADE" no PROXIMA_ETAPA.md
- Regras de atualização obrigatória, modo somente leitura e regra de segurança

**Arquivos alterados:**
- `PROXIMA_ETAPA.md` — Adicionada seção de regras

**Decisões tomadas:**
- Modo somente leitura para diagnósticos/auditorias
- Regra de segurança: parar e perguntar em caso de dúvida

---

### 06/06/2026 — 19:34 BRT

**Tarefa:** Criação inicial do sistema de memória do projeto

**O que foi feito:**
- Criado [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md) na raiz do projeto
- Mapeamento completo do estado do projeto: arquitetura, módulos, Firestore, alertas, backups, restrições

**Arquivos alterados:**
- `PROXIMA_ETAPA.md` — Criado (versão inicial completa)

**Decisões tomadas:**
- Documentar todo o projeto como memória permanente para continuidade entre sessões
- Arquivo deve ser lido antes de qualquer alteração

---

### 06/06/2026 — 20:30 BRT

**Tarefa:** Implementação de Soft Delete no módulo Pós-Venda

**O que foi feito:**
- Análise completa do módulo Pós-Venda (717 linhas) — constatada ausência total de funcionalidade de exclusão
- Proposta e aprovação de exclusão lógica (soft delete) com campos `{ ativo: false, deletedAt: serverTimestamp() }`
- Backup criado em [`BACKUP_POSVENDA_SOFT_DELETE_2026-06-06/`](BACKUP_POSVENDA_SOFT_DELETE_2026-06-06/) (4 arquivos)
- [`posvenda.js`](CRM/pages/pos-venda/posvenda.js): implementado filtro `ativo === false` no `loadData()`, botão 🗑️ no card histórico, handler de delegação de eventos, função `abrirModalExclusao()` com confirmação, função `excluirContato()` com `updateDoc`
- [`posvenda.css`](CRM/pages/pos-venda/posvenda.css): estilos completos do modal de exclusão (overlay, modal, header, body, info, warning, footer, botões)
- [`dashboard.js`](CRM/pages/dashboard/dashboard.js): adicionado filtro `if (c.ativo === false) return;` no `gerarAlertas()` linha 669 para não contabilizar registros excluídos

**Arquivos alterados:**
- `CRM/pages/pos-venda/posvenda.js` — Adicionada lógica de soft delete
- `CRM/pages/pos-venda/posvenda.css` — Adicionados estilos do modal
- `CRM/pages/dashboard/dashboard.js` — Adicionado filtro ativo no gerarAlertas()

**Arquivos NÃO alterados (conforme restrições):**
- `CRM/scripts/firebase.js` — ⛔ Não alterado
- `CRM/pages/os/os.js` — ⛔ Não alterado
- `CRM/pages/caixa/caixa.js` — ⛔ Não alterado
- `CRM/index.html` — ⛔ Não alterado
- `firebase.json` / `firestore.rules` — ⛔ Não alterado

**Problemas encontrados:** Nenhum

**Decisões tomadas:**
- Exclusão lógica apenas (sem `deleteDoc` físico)
- Modal de confirmação obrigatório antes da exclusão
- Botão 🗑️ somente nos cards do histórico (não nos pendentes)
- Registro excluído é filtrado da listagem principal mas permanece no Firestore
- Dashboard ignora registros com `ativo === false` para não gerar alertas falsos
- Preparado para futura "lixeira" (basta remover o filtro `ativo === false`)

**Pendências:**
- ❌ Futuramente: criar interface "Lixeira" para visualizar e restaurar registros excluídos
- ❌ FASE 2 — Painel Admin do Portal não implementado
- ❌ Autoatendimento sem deploy no GitHub
- ❌ Página `/consultar-os` placeholder

---

### 06/06/2026 — 21:55 BRT — Piloto de Favoritos do módulo OS (deep-link via favoritos.js, os.js intacto)

**Tarefa:** Permitir fixar múltiplas visões do módulo OS na barra de favoritos e abri-las direto em 1 clique a partir do Dashboard.

**O que foi feito:**
- [`shared/favoritos.js`](CRM/shared/favoritos.js): nova seção **"Fixar visão de OS"** no menu ★ (somente na página do OS), com o registro `OS_VIEWS` (`os-andamento`, `os-finalizados`, `os-clientes`). Cada visão vira um favorito normal (chip na barra do Dashboard) com URL deep-link.
- [`os/index.html`](CRM/pages/os/index.html): **script isolado de deep-link** que lê `location.hash` (`#fav-andamento/#fav-finalizados/#fav-clientes`) e chama as funções globais já existentes `showList()` / `showScreen()`. **`os.js` não foi alterado neste piloto.**
- Armazenamento: mesmo `localStorage cc_favoritos` (sem novo schema; keys `os-*`).
- Backup: [`CRM/shared/BACKUP_FAVORITOS_PILOTO_OS_2026-06-06/`](CRM/shared/BACKUP_FAVORITOS_PILOTO_OS_2026-06-06/) (favoritos.js, dock.js, dashboard_index.html, os_index.html).

**Validação (Playwright — 6/6 OK):**
- Seção com as 3 visões aparece no menu ★ do OS
- As 3 visões fixadas **simultaneamente** (favoritos múltiplos) persistem no localStorage
- Os 3 chips aparecem na barra do Dashboard
- Cada chip abre a visão correta: Em Andamento e Finalizados → `screen-list` (filtros andamento/finalizados); Clientes → `screen-clientes`

**Decisões/aprovações:**
- Implementação **aprovada pelo usuário**. Manter como está; não realizar novas alterações nesta funcionalidade.
- Abordagem por deep-link + `favoritos.js` escolhida para **não tocar no `os.js`**.

**Problemas encontrados:** Nenhum (sintaxe validada via `node --check`; testes 6/6).

**Observação:** Há atividade git concorrente neste repositório (commits "ok" automáticos de outra sessão do usuário). O conteúdo do `favoritos.js` foi verificado **idêntico** ao backup do piloto (sem alteração por terceiros).

**Próxima melhoria de produtividade recomendada:** Busca Global real (⌘K) — conectar a busca do Dashboard (hoje com dados mock) às coleções reais do Firestore (`os`, `clientes`, `estoque_produtos`).

---

### 07/06/2026 — 08:05 BRT — Busca Global real (Ctrl+K / ⌘K) — CONCLUÍDA E APROVADA

**Tarefa:** Substituir a busca mock do Dashboard por busca real do Firestore (OS, Clientes, Produtos), com resultados clicáveis abrindo o registro/módulo correspondente.

**O que foi feito (apenas `dashboard/dashboard.js`):**
- `_loadSearchIndex(force)` (nova): carrega e cacheia em memória (60s) `os`, `clientes` e `estoque_produtos` (fallback `produtos`). Cada coleção em `try/catch` independente (falha segura).
- `setupGlobalSearch()` (reescrita): debounce 200ms, foco, **Ctrl+K/⌘K** (já existia o gancho) e navegação por teclado **↑ ↓ Enter**.
- `_highlightSearch(items)` (nova): destaque do item ativo.
- `performSearch()` (reescrita): filtra o índice cacheado e renderiza resultados clicáveis — **OS → `#os-<id>`** (abre a OS exata), **Clientes → tela de Clientes do OS** (`#fav-clientes`), **Produto → Estoque**.
- `escapeHtml(s)` (nova): corrige bug pré-existente (era usado mas não existia → a busca antiga quebrava).

**Arquivos alterados:** apenas `CRM/pages/dashboard/dashboard.js` (backup `CRM/pages/dashboard/BACKUP_BUSCA_GLOBAL_2026-06-06/`).
**Funções novas:** `escapeHtml`, `_highlightSearch`, `_loadSearchIndex`. **Removidas:** nenhuma.

**NÃO alterado:** Firebase, Firestore, Rules, Autenticação, schema (somente leituras via `getDocs`/`collection` já importados). Cache 60s é **memória local** (sem gravação persistente).

**Validação:** Playwright **5/5** + dados reais do Firestore (OS:18, clientes:21, produtos:14). Busca por OS/Cliente/Produto retorna resultados e o clique abre o registro/módulo correto.

**Limpeza/commit:** removidos scripts de teste (`test_busca.mjs` etc.) e evidências (`validation_busca/`, `validation_portal/`, `validation_pilot_os/`). Commits `71610f8` (feature) e `0c3112e` (limpeza). Mantidos (de frente paralela, fora do escopo): `CRM/pages/os/BACKUP_DEEPLINK_OS_2026-06-06/`, `_runtime_audit/`.

**Observação:** atividade git concorrente (commits "ok" da sessão paralela) capturou parte das mudanças antes do meu commit; estado final em `HEAD` está correto e validado.

---

### 07/06/2026 — 13:38 BRT — Portal do Cliente: OS e Garantias não apareciam (divergência de formato de telefone) — CONCLUÍDA E VALIDADA

**ETAPA 1 — Item 2.** Cliente logava no Portal mas determinadas OS e Garantias não apareciam.

**Causa-raiz confirmada (com evidência real do Firestore):**
- O login normaliza o telefone para a **máscara** `(NN) NNNNN-NNNN` e salvava **apenas esse formato** na sessão (`portal_session.telefone`).
- Os listeners em tempo real (`_listenOS`) consultavam `where('phone','==', telefone)` com esse único formato.
- Porém o `os.js` grava o `phone` em **formatos divergentes** — há OS gravadas como **dígitos puros** (`62991768442`). O login tinha fallback p/ dígitos, mas o **listener não tinha** → retornava 0 documentos.
- Auditoria (`_runtime_audit/inspect-cases.js`) confirmou exatamente os 2 casos relatados:
  - **Mauricio MID** (`62991768442`): 2 OS gravadas como dígitos puros → 0 visíveis no portal.
  - **Maria Cuba** (`62998532325`): 1 OS gravada como dígitos puros → 0 visível.

**Correção aplicada (somente `CRM/pages/portal-cliente/portal.js`):**
- Novos helpers `_phoneMask(dg)` e `_phoneVariants(input)`: geram todas as variantes plausíveis (máscara-11, raw-11, máscara-10, raw-10 e divergência do 9º dígito).
- `doLogin()`: consultas de `clientes` e `os` passaram a usar `where('phone','in', variantes)` (Firestore aceita até 30 valores). Sessão agora guarda `telefoneVariants`.
- `_listenOS()`: passou a consultar `where('phone','in', variantes)`, com fallback que recalcula as variantes para sessões antigas restauradas do `sessionStorage`.
- **Bug secundário corrigido:** `_getDeliveryDate()` caía no fallback `updatedAt` para qualquer status, fazendo OS `devolvido_orcamento` (orçamento recusado, aparelho devolvido) contarem como em garantia. Agora o fallback `updatedAt` só vale para `status === 'entregue'` (a data via timeline "Entregue" permanece inalterada).

**Arquivos alterados:** `CRM/pages/portal-cliente/portal.js`.
**Backup:** `CRM/BACKUP_2026-06-07_1338/portal.js`.
**NÃO alterado:** Firebase, Firestore Rules, Authentication, Storage, schema, coleções, `os.js`, `admin.js`. Apenas leituras (`getDocs`/`onSnapshot`).

**Validação (dados reais — `_runtime_audit/validate-e2e.js`):**
- Mauricio MID: **2 OS** + **2 garantias ativas** (antes 0/0). ✅
- Maria Cuba: **1 OS** visível + 0 garantias (correto — orçamento recusado). ✅
- Regressão (Joaquim, máscara-11): 1 OS / 1 garantia, **inalterado**. ✅
- `node --check portal.js` → SYNTAX OK.

**Observação:** Os dados não foram alterados no Firestore — a correção é exclusivamente de lógica de consulta no front-end. A normalização de formato de telefone **na gravação** (`os.js`) é uma melhoria futura recomendada (preventiva), mas não foi necessária para resolver o problema relatado.

---

### 07/06/2026 — 13:55 BRT — Homologação geral dos módulos (estática) — CONCLUÍDA

**Tarefa:** Homologação geral dos módulos do CRM (Prioridade 1), read-only, sem tocar em produção.

**Método (3 varreduras automatizadas em `_runtime_audit/`):**
1. **Sintaxe** (`node --check`) — 30 arquivos JS ativos (exclui BACKUP/OLD/node_modules).
2. **Integridade de referências** (`homolog-refs.js`) — 51 HTMLs, 185 referências locais (`src`/`href`).
3. **Handlers inline** (`homolog-handlers.js`) — funções em `onclick`/`oninput`/etc. sem definição.

**Resultados:**
- ✅ Sintaxe: **0 erros** nos 30 JS ativos.
- ✅ Handlers: 7 candidatos, **todos falso-positivo** (definidos em `<script>` inline da própria página). 0 bugs reais.
- ⚠️ Referências quebradas (módulos CRM): **apenas o módulo OS** — `index.html` apontava para `../../styles/global.css` e `list.css` (inexistentes → 404 no console).
- ⚠️ Site público (hosting é `CRM/`, fora dos módulos): `index.html` usa `imagens/logooficial.png` (arquivo real é `.jpeg`); `sistema/index.html` aponta `../imagens/anuncio-cellcity.mp4` (arquivo real em `videos/`); `1_INDEX_MENU_ATUALIZADO.html` referencia `imagens/celula-city-fachada.jpg` (inexistente). **Não corrigidos** — pendência reportada para decisão.

**Correção aplicada (segura, somente HTML):**
- `CRM/pages/os/index.html`: removidos os 2 `<link>` mortos. Estilo permanece via `os.css` + `dock.css`. **Lógica de `os.js` NÃO tocada.**
- Re-verificação: módulos CRM agora **0 referências quebradas**.

**Arquivos alterados:** `CRM/pages/os/index.html`.
**Backup:** `CRM/pages/os/BACKUP_HOMOLOG_2026-06-07_1355/index.html`.
**NÃO alterado:** `os.js` (e toda a lógica de criação/edição de OS), Firebase, Rules, Auth, Storage, schema.

**Pendências (reportadas, fora do escopo de módulos):**
- Site público raiz: logo quebrado (`.png`→`.jpeg`), vídeo (`imagens/`→`videos/`) e fachada inexistente em página-template. Aguardando decisão (confirmar se essas páginas estão no ar — hosting do Firebase serve `CRM/`).
- Auth Anônima desabilitada no Firebase Console (erro 400 em runtime) — item de **Segurança (ETAPA 7)**, depende de autorização.

---

### 07/06/2026 — 14:05 BRT — Revisão da Wiki Técnica (Central de Informações) — CONCLUÍDA

**Tarefa:** Prioridade 2 — Revisão da Wiki Técnica. Confirmado com o usuário que a "Wiki Técnica" corresponde ao módulo **Central de Informações** (`central-informacoes`): base de conhecimento com Comandos, Sites, Senhas, Anotações e Documentos por categoria.

**Auditoria do módulo (index.html + informacoes.js + informacoes.css):**
- ✅ Dependência `CryptoJS` (CDN) está carregada no `index.html` (linha 228) — sem problema.
- 🐞 3 bugs reais encontrados e corrigidos.

**Correções aplicadas (somente `informacoes.js`):**
1. **Upload de documento — `storageUrl` divergente (download quebrado).** O path era gerado **2×** com `Date.now()` (um para `uploadBytes`, outro para `storageUrl`), podendo diferir em ms → `storageUrl` não batia com o arquivo enviado (download falhava / arquivo órfão no Storage). Agora o path é calculado **uma única vez**.
2. **Perda de senha ao editar.** Editar um *Site* sem redigitar a senha gravava `senhaOculta = ''` → **apagava a senha salva**. Agora, na edição, senha em branco **preserva** a senha atual. Mesmo comportamento aplicado ao tipo *Senha* (não obriga mais redigitar a senha a cada edição; só exige no cadastro novo).
3. **Render sem escape (quebra de layout / XSS).** Título, conteúdo, URL, usuário, serviço e descrição eram injetados via `innerHTML` **sem escape** — comandos/prompts (uso principal) frequentemente contêm `< > & "`, quebrando o card. `escapeHtml` agora é **null-safe** e aplicado em `renderItemLista`/`renderItemCard`.

**Arquivos alterados:** `CRM/pages/central-informacoes/informacoes.js`.
**Backup:** `CRM/pages/central-informacoes/BACKUP_REVISAO_2026-06-07_1400/` (js + html + css).
**NÃO alterado:** Firebase, Rules, Auth, Storage (config), schema. O upload/download usa a API de Storage **já existente** (não é alteração de configuração).

**Validação:**
- `node --check` (modo ESM) → SYNTAX OK.
- Teste unitário de `escapeHtml`: undefined/null → `''`; `git commit -m "<fix> & test"` → escapado corretamente; aspas simples → `&#039;`. 4/4 OK.

**Observação (não corrigido — pré-existente, edge case):** `escapeBotoes` (usado no `onclick` do botão "Copiar" do popover de senha) só escapa aspas simples; senhas com barra invertida/quebra de linha poderiam quebrar o atributo. Cópia principal (`copiarSenha`) não é afetada. Anotado como melhoria futura.

---

### 07/06/2026 — 14:15 BRT — Organização e limpeza do projeto (conservadora) — CONCLUÍDA

**Tarefa:** Prioridade 3 — Organização e limpeza. Inventário read-only + remoção apenas de itens **inequivocamente obsoletos**, todos **versionados no git** (reversíveis via histórico).

**Inventário levantado:**
- 38 pastas `BACKUP_*` (checkpoints de etapas) — **mantidas** (snapshots deliberados; remoção em massa seria decisão do usuário).
- `_backup_old/` — cópia completa antiga do projeto (352K, tracked) — **removida**.
- HTMLs raiz `*-OLD.html` — **removidos** (`autoatendimento-OLD.html`, `consultar-os-OLD.html`; sem referências vivas, só no índice git).
- HTMLs numerados `1_/2_/3_` — **mantidos** (referenciados pela documentação de deploy `5_INSTRUCOES_DEPLOY...`).
- `_runtime_audit/` scripts one-off da tarefa Portal (`inspect-cases.js`, `validate-fix.js`, `validate-e2e.js`) — **removidos**. Mantidos os reutilizáveis (`homolog-refs.js`, `homolog-handlers.js`, `inspect-phones.js`) e screenshots.

**Resultado:** HTMLs ativos 51→42; referências quebradas 10→4. As 4 restantes são do **site público raiz** (logo `.png`→`.jpeg`, fachada inexistente em template, vídeo em `videos/`) — **não tocadas** (hosting serve `CRM/`; confirmar se estão no ar). **Módulos CRM: 0 referências quebradas.**

**Removido (tudo reversível via git):** `_backup_old/`, `autoatendimento-OLD.html`, `consultar-os-OLD.html`, 3 scripts one-off de auditoria.
**NÃO alterado:** nenhum módulo ativo, Firebase, Rules, Auth, Storage, schema. Os 38 `BACKUP_*` permanecem intactos.

**Recomendação futura (aguarda decisão):** arquivar/consolidar os 38 `BACKUP_*` (ex.: mover para um único `_ARQUIVO_BACKUPS/`) — reduz ruído sem perder histórico. Não executado por serem snapshots intencionais.

---

### 07/06/2026 — 14:20 BRT — Auditoria e correção do site público em produção — CONCLUÍDA (aguarda deploy)

**Tarefa:** Verificar o estado real do site público em produção (somente leitura) e aplicar correções de baixo risco.

**URL analisada:** https://www.cellcityinformatica.com.br (GitHub Pages, repo `Cell-City-Site`, serve a raiz). O CRM/Portal é servido separadamente pelo Firebase Hosting (`public: "CRM"`).

**Diagnóstico (HTTP real em produção):**
- Páginas **navegáveis** (via `header-component.js`): home `/`, `celular/`, `notebook/`, `impressora/`, `autoatendimento.html`, `consultar-os.html`, Portal. Todas 200.
- O **header global usa `logooficial.jpeg` (correto)** — logo do topo OK em todo o site.
- 🐞 **`imagens/logooficial.png` → 404** (×4 em `index.html`: favicon, logo do rodapé, og:image, twitter:image). Arquivo real é `logooficial.jpeg` (200). Impacto médio-alto: favicon/rodapé quebrados + **preview social** (WhatsApp/Facebook/Twitter) sem imagem.
- 🐞 `sistema/index.html`: 2 vídeos referenciados de `imagens/` mas existem em `videos/` → 404. Impacto baixo (página **órfã**, fora do nav).
- 🐞 `1_INDEX_MENU_ATUALIZADO.html`: `imagens/celula-city-fachada.jpg` 404 (rascunho órfão; asset não existe). **Não corrigido** (rascunho não usado).
- Páginas antigas `1_/2_/3_*.html` e `sistema/`: acessíveis por URL direta mas **não linkadas** pelo header → órfãs.
- Demais CSS/JS/imagens/vídeos: 200 OK.

**Correções aplicadas (baixo risco):**
1. `index.html`: 4× `logooficial.png` → `logooficial.jpeg` (favicon com `type="image/jpeg"`).
2. `sistema/index.html`: `../imagens/*.mp4` → `../videos/*.mp4` (2 vídeos).

**Arquivos alterados:** `index.html`, `sistema/index.html`.
**Backup:** `BACKUP_SITE_PUBLICO_2026-06-07_1415/` (index.html + sistema/index.html).
**NÃO alterado:** Firebase, Rules, Auth, CRM, e o rascunho órfão `1_INDEX`.

**Validação:** referências quebradas no projeto 4→1 (resta só o asset inexistente do rascunho órfão). Arquivos-alvo confirmados (`logooficial.jpeg`, ambos os `videos/*.mp4`).

**⚠️ Deploy:** as correções estão no working tree. **A produção (GitHub Pages) só refletirá após `git push`** para `Cell-City-Site`. Push/deploy não executado (aguarda autorização do usuário).

---

### 08/06/2026 — Portal Técnico (Etapas 1 e 2) — PUBLICADO

**Tarefa:** Criar o módulo Portal Técnico integrado ao CRM (estrutura + favoritos/barra superior). FRP/Softwares/Firmwares/Soluções **não** implementados nesta etapa (apenas estrutura).

**Entregue (commit `e8e049c`, em produção):**
- **Etapa 1 — Estrutura:** `CRM/pages/portal-tecnico/index.html` + `portal-tecnico.css` (tema Cell City, responsivo). Header padrão "🔓 Portal Técnico", busca "🔍 Pesquisar no Portal Técnico" (filtra os cards) e 6 cards que exibem toast "🚧 Em desenvolvimento": 📱 Celulares, 🔓 FRP e Contas, 🛠️ Softwares, 📂 Firmwares, 📖 Soluções Técnicas, 🎥 Tutoriais.
- **Etapa 2 — Favoritos/Barra Superior:** registrado em `MODULES` de `shared/favoritos.js` → botão "📌 Fixar nos Favoritos" automático; rota em `dashboard.js`; card 🔓 Portal Técnico no grid do Dashboard. Drag & drop + persistência (localStorage `cc_favoritos`) reaproveitam o sistema existente.

**Arquivos:** criados `CRM/pages/portal-tecnico/{index.html, portal-tecnico.css}`; alterados `CRM/shared/favoritos.js`, `CRM/pages/dashboard/{dashboard.js, index.html}`.
**Backups:** `CRM/shared/BACKUP_PORTAL_TECNICO_2026-06-08_0835/`, `CRM/pages/dashboard/BACKUP_PORTAL_TECNICO_2026-06-08_0835/`.
**Validação produção:** página 200, CSS 200, 6 cards + busca servidos, registro em favoritos e card no dashboard confirmados.

---

### 08/06/2026 — PENDÊNCIA REGISTRADA — Melhoria futura: Favoritos Mobile (drag & drop por toque)

> **MELHORIA FUTURA — FAVORITOS MOBILE** — **STATUS: PENDENTE — NÃO INICIAR NESTA ETAPA.**
>
> **Objetivo:** Permitir reorganização dos favoritos por **toque prolongado** no celular.
>
> **Escopo:**
> - Drag & Drop por toque (Touch/Pointer Events)
> - Compatibilidade **Android**
> - Compatibilidade **iPhone**
> - Persistência da ordem dos favoritos
> - Compatibilidade com o sistema atual de favoritos
> - Compatibilidade com **Portal Técnico**
> - Compatibilidade com **Autoatendimento**
> - Compatibilidade com **Wiki** (Central de Informações)
> - Compatibilidade com **OS em Andamento**
> - Compatibilidade com **Continuar de Onde Parei**
>
> **Requisitos:**
> - Criar backup antes das alterações
> - Não afetar o funcionamento atual do **desktop**
> - Validar persistência após **atualização da página**
> - Validar persistência após **logout/login**
>
> **Causa:** o `shared/favoritos.js` usa `draggable` HTML5, que não suporta toque nativo → reordenar por toque no mobile ainda não funciona (limitação pré-existente).
>
> **Observação:** Portal Técnico já publicado e funcionando. Esta melhoria será tratada posteriormente em tarefa isolada.

---

### 12/06/2026 — Central de Informações: Refinamento da Expansão Inline — CONCLUÍDA

**Tarefa:** Melhorar ergonomia da expansão inline, removendo botões do meio da leitura e refinando a apresentação do texto.

**Entregue:**
- Backup criado em `CRM/pages/central-informacoes/BACKUP_REFINO_EXPANSAO_INLINE_2026-06-12/`.
- Botões originais do card/lista ficam ocultos enquanto o item está expandido.
- Ações foram movidas para um rodapé ao final da anotação expandida.
- Rodapé contém ações do tipo, Favoritar, Editar, Copiar, Imprimir, Excluir e Restaurar.
- Conteúdo de leitura vem antes dos botões, evitando interrupção visual no meio do texto.
- Largura máxima do texto aumentada para `1080px`.
- Margens internas, espaçamento entre títulos/parágrafos/listas e comandos foram refinados.
- Impressão esconde o rodapé de botões e prioriza a leitura expandida.

**Arquivos alterados:** `CRM/pages/central-informacoes/informacoes.css`, `CRM/pages/central-informacoes/informacoes.js`, `PROXIMA_ETAPA.md`, `HISTORICO_PROJETO.md`.
**Validação:** `git diff --check` sem erros. Teste visual em navegador ainda recomendado.

---

### 12/06/2026 — Central de Informações: Expansão Inline do Card — CONCLUÍDA

**Tarefa:** Trocar o conceito de tela cheia para expansão do próprio card/item, evitando mudança de contexto e conteúdo deslocado para baixo.

**Entregue:**
- Backup criado em `CRM/pages/central-informacoes/BACKUP_EXPANSAO_INLINE_2026-06-12/`.
- Modal separado removido da tela ativa.
- Botão **⛶ Tela Cheia** agora expande o próprio card/list item no mesmo local da lista.
- Segundo clique restaura o tamanho normal e o botão vira **↙ Restaurar** durante a expansão.
- Em modo cards, o card expandido ocupa a largura total da grade.
- Em modo lista, o item expandido abre o conteúdo completo logo abaixo da linha original.
- Conteúdo expandido usa scroll interno e altura proporcional à área disponível do viewport.
- Ações mantidas dentro da expansão: Editar, Copiar, Imprimir e Restaurar.
- Mantida a formatação melhorada de textos longos em títulos, listas e parágrafos.

**Arquivos alterados:** `CRM/pages/central-informacoes/index.html`, `CRM/pages/central-informacoes/informacoes.css`, `CRM/pages/central-informacoes/informacoes.js`, `PROXIMA_ETAPA.md`, `HISTORICO_PROJETO.md`.
**Validação:** `git diff --check` sem erros. Teste visual em navegador ainda recomendado.

---

### 12/06/2026 — Central de Informações: Auditoria e Fix Real da Tela Cheia — CONCLUÍDA

**Tarefa:** Auditar a função de tela cheia porque o modal ainda aparecia deslocado para baixo.

**Diagnóstico:** O posicionamento ainda dependia demais do fluxo/viewport calculado da página, o que podia deslocar o painel em cenários com container alto, iframe/painel principal ou rolagem interna.

**Entregue:**
- Backup criado em `CRM/pages/central-informacoes/BACKUP_AUDITORIA_TELA_CHEIA_FIX_2026-06-12/`.
- Overlay de leitura passou a usar `position: fixed !important`, `inset: 0`, `100vw` e `100dvh`.
- Painel passou a ser fixo no viewport, com `top: 16px`, `left: 50%`, largura quase total e altura `100dvh - 32px`.
- Removida dependência da centralização vertical por `flex`, evitando o deslocamento para baixo.
- `html` e `body` são travados durante a leitura.
- A posição de scroll anterior é restaurada apenas ao fechar o modal.

**Arquivos alterados:** `CRM/pages/central-informacoes/informacoes.css`, `CRM/pages/central-informacoes/informacoes.js`, `PROXIMA_ETAPA.md`, `HISTORICO_PROJETO.md`.
**Validação:** `git diff --check` sem erros. Teste visual em navegador ainda recomendado.

---

### 12/06/2026 — Central de Informações: Ajuste Tela Cheia + Legibilidade — CONCLUÍDA

**Tarefa:** Corrigir a abertura da tela cheia para não rolar a página e melhorar a leitura de textos longos.

**Entregue:**
- Backup criado em `CRM/pages/central-informacoes/BACKUP_AJUSTE_TELA_CHEIA_LEITURA_2026-06-12/`.
- Botão **⛶ Tela Cheia** passou a usar `type="button"`, bloquear default/propagação e preservar a posição de rolagem.
- Removido foco automático no painel, evitando que o navegador role até a posição do modal no fim do HTML.
- Modal abre sobre a tela atual, centralizado, sem levar o usuário para a parte inferior da página.
- Textos longos ganharam formatação semântica:
  - linhas em caixa alta viram títulos/seções;
  - linhas iniciadas por `*`, `-`, `✓`, `•` ou numeração viram listas;
  - linhas em branco separam parágrafos;
  - observações também usam a nova renderização.
- CSS ajustado para maior espaçamento entre linhas, margens internas, contraste e legibilidade.

**Arquivos alterados:** `CRM/pages/central-informacoes/index.html`, `CRM/pages/central-informacoes/informacoes.css`, `CRM/pages/central-informacoes/informacoes.js`, `PROXIMA_ETAPA.md`, `HISTORICO_PROJETO.md`.
**Validação:** `git diff --check` sem erros. Teste visual em navegador ainda recomendado.

---

### 12/06/2026 — Central de Informações: Restauração + Tela Cheia sem Split — CONCLUÍDA

**Tarefa:** Reverter a Central de Informações para o estado anterior ao painel dividido e manter somente uma melhoria de leitura em tela cheia.

**Motivo:** O painel dividido reduziu a área útil em notebooks e piorou a leitura diária de conteúdos longos.

**Entregue:**
- Backup solicitado criado em `CRM/pages/central-informacoes/BACKUP_RESTAURACAO_TELA_CHEIA_2026-06-12/`.
- `index.html`, `informacoes.css` e `informacoes.js` restaurados a partir de `BACKUP_VISUALIZACAO_SPLIT_2026-06-12/`.
- Arquivos ativos `visualizacao.css` e `visualizacao.js` removidos da Central de Informações.
- Interface original preservada:
  - clique simples no título copia o conteúdo;
  - duplo clique no título abre edição;
  - lista/cards voltam a ocupar a tela como antes.
- Nova melhoria isolada: botão **⛶ Tela Cheia** em cada registro.
- Modal grande (~90% da tela) com título, categoria/tipo, conteúdo completo e scroll próprio.
- Ações no modal: Editar, Copiar, Imprimir e Fechar.
- Fechamento por `ESC`, botão Fechar ou clique no fundo escuro.

**Arquivos alterados:** `CRM/pages/central-informacoes/index.html`, `CRM/pages/central-informacoes/informacoes.css`, `CRM/pages/central-informacoes/informacoes.js`, `PROXIMA_ETAPA.md`, `HISTORICO_PROJETO.md`.
**Validação:** `git diff --check` sem erros; inspeção confirmou ausência de referências ativas a `info-split`, `visualizacao` e `abrirViewer`. Teste visual em navegador ainda recomendado.

---

### 12/06/2026 — Central de Informações: Tela Cheia de Leitura — CONCLUÍDA

**Tarefa:** Melhorar a leitura de conteúdos longos na Central de Informações sem remover o painel dividido já implementado.

**Entregue:**
- Backup criado em `CRM/pages/central-informacoes/BACKUP_TELA_CHEIA_2026-06-12/`.
- Botão **⛶ Tela Cheia** adicionado ao header do viewer.
- Modal de leitura com aproximadamente 90% da tela, fundo escuro, conteúdo centralizado e scroll próprio.
- Tipografia ampliada para leitura de processos, comandos, procedimentos técnicos, scripts, senhas, documentação interna e textos extensos.
- Botões dentro da tela cheia: Editar, Copiar, Imprimir e Fechar.
- Fechamento por `ESC`, botão Fechar/X ou clique no fundo escuro.
- O comportamento anterior foi preservado: clique simples abre o painel dividido; duplo clique abre edição.
- Ao acionar Editar pela tela cheia, o modal fecha antes de abrir o formulário.
- Impressão com a tela cheia aberta prioriza o conteúdo do modal.

**Arquivos alterados:** `CRM/pages/central-informacoes/index.html`, `CRM/pages/central-informacoes/visualizacao.css`, `CRM/pages/central-informacoes/visualizacao.js`, `PROXIMA_ETAPA.md`, `HISTORICO_PROJETO.md`.
**Validação:** revisão de diff e inspeção manual dos trechos HTML/CSS/JS. Validação visual em navegador permanece recomendada.

---

### 12/06/2026 — Central de Informações: Visualização Split — CONCLUÍDA

**Tarefa:** Transformar a Central de Informações em layout de leitura com lista à esquerda e painel de visualização à direita.

**Entregue:**
- Backup criado em `CRM/pages/central-informacoes/BACKUP_VISUALIZACAO_SPLIT_2026-06-12/`.
- `index.html` recebeu o container split, painel esquerdo para a biblioteca e painel direito para leitura.
- Criados `visualizacao.css` e `visualizacao.js` para o viewer.
- Clique simples no título abre o registro no painel; duplo clique mantém o fluxo de edição.
- Viewer renderiza conteúdos por tipo: comando, site, senha, anotação e documento.
- Ações do painel: editar, copiar, imprimir, fechar, abrir URL, copiar usuário/senha e download de documento.
- `informacoes.js` agora expõe `window._informacoes` ao carregar do cache e ao receber snapshot do Firestore.
- Compatibilidade melhorada para sites com múltiplas URLs.
- Viewer atualiza o item aberto após renderização/snapshot e fecha quando o item é excluído ou some dos filtros.

**Arquivos alterados:** `CRM/pages/central-informacoes/index.html`, `CRM/pages/central-informacoes/informacoes.js`, `PROXIMA_ETAPA.md`, `HISTORICO_PROJETO.md`.
**Arquivos criados:** `CRM/pages/central-informacoes/visualizacao.css`, `CRM/pages/central-informacoes/visualizacao.js`.
**Validação:** revisão de diff e inspeção manual dos trechos críticos. Checagem automática com `node --check` não executada porque `node` não está instalado no ambiente.

---

---

## 14/06/2026 — Unificação da Central de Alertas + Modal de Configuração

**Tarefa:** Unificar `setupAvisoAcoes()` + `monitorarCardAcaoSemana()` + `gerarAlertas()` em um único sistema centralizado, com configuração pelo usuário.

**Contexto:** No Dashboard V2 (13/06), o `alerts-card` rotativo havia sido removido do layout, tornando `setupAlerts()` e `setupAvisoAcoes()` inoperantes. Esta etapa reativou e unificou o sistema.

**Entregue:**
- **`alerts-card` re-adicionado** ao `index.html` como seção dedicada entre o Painel Executivo e o grid de módulos.
- **Botão ⚙️** (`btn-abrir-config-alertas`) no canto do card de alertas.
- **Modal de configuração** com: som global on/off, horário de funcionamento, dias da semana, horário de silêncio, alertas individuais com som, pulsação visual.
- **`setupAvisoAcoes()`** — **removida** (sobrepunha o card, brigava com `setupAlerts()`).
- **`monitorarCardAcaoSemana()`** — **substituída** por `atualizarCardAcaoSemana()` (só marca `acao-vencida` no card, sem som).
- **`gerarAlertas()`** — cada alerta ganhou flags: `som`, `pulsar`, `repetir`, `tipo`.
- **`setupAlerts()`** — funções de som movidas para cá; `verificarConfigSom()` e `verificarPulsacao()` integradas ao `mostrar()`; intervalo de 30s para re-tocar som em alertas `repetir:true`.
- **Novas funções:** `setupConfigAlertas()`, `carregarConfigAlertas()`, `salvarConfigAlertas()`, `carregarConfigAlertasUI()`, helpers `_setChecked/_getChecked/_setValue/_getValue`.
- Config salva em `localStorage('cc_config_alertas')`.

**Arquivos alterados:**
- `CRM/pages/dashboard/dashboard.js`
- `CRM/pages/dashboard/dashboard.css` (seção `.alerts-section`, `.btn-config-alertas`, modal)
- `CRM/pages/dashboard/index.html` (alerts-card + modal HTML)

**Backup:** `CRM/pages/dashboard/BACKUP_UNIF_ALERTAS_2026-06-14/`

**Validação:** chaves JS balanceadas (862/862), todas as funções novas presentes, `setupAvisoAcoes` e `monitorarCardAcaoSemana` zeradas.
Pendente: teste visual no navegador.

---

---

### 04/07/2026 — Auditoria Geral do Projeto + Encerramento da Fase de Auditoria e Planejamento — CONCLUÍDA

**Tarefa:** Consolidar os resultados da auditoria geral do sistema em um plano de execução organizado e priorizado, e em seguida encerrar formalmente essa fase antes do início da próxima sprint de desenvolvimento. Nenhuma funcionalidade nova foi implementada; nenhum código, Firestore Rule, branch ou tag foi alterado.

**Contexto:** o projeto acumulou, ao longo do dia, uma saga de correções de segurança (escalada de privilégio via `usuarios/{uid}`), a primeira Cloud Function (`excluirUsuarioAdmin`), migração de Spark para Blaze, refatoração modular do Dashboard e a correção H-009 — tudo já registrado no `CRM/TECHDOC.md`, mas não refletido em `MASTER_ROADMAP.md`/`PROXIMA_ETAPA.md`, que seguiam desatualizados desde 2026-07-02. Uma auditoria geral foi conduzida para levantar o estado real de todos os ~35 módulos, banco de dados, arquitetura, segurança e performance.

**Entregue:**
- `plans/AUDITORIA_GERAL_20260704.md` — inventário completo dos módulos, banco de dados, arquitetura, segurança e performance; identificou um achado crítico novo (exposição de dados reais de clientes no fluxo OS/Portal do Cliente, ainda sem correção) e 3 módulos aparentando funcionar sem funcionar (Análise, Catálogo, Central de Organização).
- `plans/AUDITORIA_EXECUTIVA_GERAL_20260704.md` — complemento cobrindo branches, TECHDOC, `plans/`, Cloud Functions, PWA e uma Fase de Qualidade dedicada (confirmou zero suíte de testes automatizados persistente).
- `plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md` — consolidação em roadmap oficial (15 itens com objetivo/dependências/complexidade/esforço/critério de aceite/prioridade), plano de qualidade, organização do repositório e priorização.
- `plans/ENCERRAMENTO_AUDITORIA_PLANEJAMENTO_20260704.md` — encerramento formal: revisão de consistência entre os 4 documentos estratégicos (encontrou e corrigiu 2 divergências: cota Firestore desatualizada, prioridade do próximo passo desatualizada; sinalizou 1 inconsistência estrutural não resolvida — escopo de `empresa_id`/multiempresa das Fases 3/6 do Master Roadmap descreve arquitetura já revertida em 2026-06-27), revisão de segurança dos documentos antes do commit (corrigiu 2 trechos do Plano Diretor que expunham o mecanismo da vulnerabilidade do Portal/OS além da política do projeto), definição oficial da ordem das próximas sprints, classificação de toda a documentação do projeto (Oficiais/Históricos/Arquivados/Internos), e preparação (sem implementar) da Sprint 1.
- `MASTER_ROADMAP.md` atualizado: nova seção "Situação em 2026-07-04" (achado crítico + nova prioridade), avisos de desatualização nas Fases 3 e 6, conclusão final revisada.
- `PROXIMA_ETAPA.md` atualizado: estado atual, próximas tarefas e riscos realinhados a 2026-07-04 (Sprint 1 = segurança do Portal/OS, antes da homologação do Sprint 3 RBAC).

**Decisão oficial resultante:** Sprint 1 = corrigir a exposição do Portal do Cliente/OS pública (incidente ativo, dado real exposto); homologação do Sprint 3 do RBAC (Estoque+Caixa) segue como item 2, podendo correr em paralelo. Início de qualquer um dos dois exige autorização explícita do proprietário, por tocar Autenticação/Firestore Rules (`CLAUDE.md` §1).

**Arquivos criados:** `plans/AUDITORIA_GERAL_20260704.md`, `plans/AUDITORIA_GERAL_20260704_INTERNO.md` (interno, não versionado), `plans/AUDITORIA_EXECUTIVA_GERAL_20260704.md`, `plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md`, `plans/ENCERRAMENTO_AUDITORIA_PLANEJAMENTO_20260704.md`.
**Arquivos alterados:** `MASTER_ROADMAP.md`, `PROXIMA_ETAPA.md`, `HISTORICO_PROJETO.md`.
**Validação:** conferência de consistência cruzada entre os 4 documentos estratégicos e revisão de segurança da documentação pública antes do commit, ambas registradas em `plans/ENCERRAMENTO_AUDITORIA_PLANEJAMENTO_20260704.md`. Nenhum teste de código aplicável — esta entrega é só documentação.
**Pendente:** aprovação formal do proprietário para este encerramento; autorização explícita para iniciar a Sprint 1 (Portal/OS) e/ou a homologação do Sprint 3 (RBAC).

---

### 05/07/2026 — Sprint 1a: Segurança do Portal do Cliente / OS pública — CONCLUÍDA

**Tarefa:** corrigir o achado crítico de 2026-07-04 (exposição de dados reais de clientes no fluxo OS/Portal do Cliente).

**Entregue:** gate de autenticação em `admin.html` do Portal (não tinha nenhum); duas Cloud Functions novas (`consultarOSPublica`, `consultarOSPorTelefonePublica`, Admin SDK, whitelist de campos — nunca senha/padrão/foto/endereço/IMEI); `os/{osId}.get` fechado nas Rules; `garantia.html`/`consultar-os.html` (raiz e CRM) migrados para as Cloud Functions; suíte de testes de Rules (`tests/firestore-rules/`, primeira suíte automatizada persistente do projeto).

**Incidentes durante a entrega:** hotfix P0 em produção (commit `60173b7`) — `temAcessoLiberado()` aplicado mecanicamente a ~45 coleções (2026-07-04) bloqueava sessão anônima do Portal/Consultar OS; revertido só nas 6 coleções afetadas. Tentativa de fechar a Rule antes do push do site quebrou `garantia.html` por ~2min (revertido, corrigido, replicado).

**Resultado:** homologado e promovido a produção. Detalhe completo: `CRM/TECHDOC.md` §17-18. Pendência formalmente proposta e não implementada: Sprint 1b (migrar as 5 coleções do Portal + aprovar/recusar orçamento para Cloud Functions).

---

### 06/07/2026 — Sprint 1b: Portal do Cliente migrado para Cloud Functions — CONCLUÍDA e INTEGRADA em `develop`

**Tarefa:** migrar as 7 funcionalidades restantes do Portal do Cliente (mensagens, avaliações, agendamentos, solicitação de diagnóstico, eventos, aprovar/recusar orçamento) de acesso direto ao Firestore para Cloud Functions, fechando a brecha de conta `pendente` reaberta pela reconciliação do hotfix P0 da Sprint 1a.

**Entregue:** 13 Cloud Functions novas em `functions/index.js` (incluindo fix definitivo do nome do cliente no login, substituindo um hotfix órfão reconciliado nesta sprint); Firestore Rules fechadas para `avaliacoes`/`mensagens_portal`/`portal_eventos`/`agendamentos`/`solicitacoes_diagnostico` (completo) e `os` (parcial — `create/update/delete` fechados, `list` deliberadamente aberto, ver TECHDOC §19.5); suíte de testes ampliada (`tests/functions/`, 25 casos; `tests/firestore-rules/`, 31 casos); whitelist de campos nas 3 functions de listagem do Portal.

**Bugs encontrados e corrigidos durante homologação com fluxo real de login (9 no total):** normalização de rota com hash "/", link do WhatsApp travando testes automatizados, race condition DOM-após-await em 2 handlers, "Invalid Date" nas mensagens (Timestamp achatado pelo encoder do `onCall`), fuso horário errado no orçamento (código de browser copiado para Cloud Function sem `timeZone` explícito), `phoneDigits` reconstruído via regex quebrando silenciosamente, imports mortos, corrida em avaliação duplicada.

**Decisões técnicas registradas (não são pendências esquecidas):** `os.list` continua aberto (migrar login/listener exige tocar Autenticação — autorização explícita, fora do escopo mecânico da sprint); de-duplicação dos 4 handlers "enviar X" do Portal avaliada e não extraída (risco/benefício desfavorável em código já homologado).

**Integração:** branch `sprint-1b-portal-cloud-functions` (14 commits) integrada em `develop` via fast-forward (sem merge commit, mesmo padrão já usado no projeto) — commit final `f0d2389229cf51a53b2dcef8da9c72583fe98060`. **Não promovida a `main`, sem deploy em produção.**

**Resultado:** homologado (12/12 Puppeteer com login real, 0 erro), documentado em `CRM/TECHDOC.md` §19-19.8.

---

### 06/07/2026 — Auditoria de preparação da próxima Sprint (pós-integração da 1b) — CONCLUÍDA

**Tarefa:** auditoria somente-leitura do projeto (dívida técnica, segurança, testes, documentação) para planejar a sprint seguinte — nenhum código, Rule ou Cloud Function alterado.

**Entregue:** `plans/AUDITORIA_GERAL_20260706.md` (público) + `plans/AUDITORIA_GERAL_20260706_INTERNO.md` (detalhe explorável, gitignored) — inventário priorizado de riscos, dívida técnica e ordem recomendada das próximas sprints.

**Achado crítico, ainda sem correção (fora do escopo desta rodada, só documentação/planejamento):** credencial administrativa (service account) vazada em commit antigo de 2026-06-25, confirmada **ainda ativa** em produção — conhecida desde 2026-07-03, nunca rotacionada. Detalhe técnico completo (ID da chave, comando de remediação) só no documento interno. Recomendado tratar como item isolado e urgente antes de qualquer outra prioridade.

**Documentação sincronizada nesta rodada:** vários itens do registro de dívida técnica (`GUIA_MANUTENCAO.md`) e do estado do projeto (`PROXIMA_ETAPA.md`, `MASTER_ROADMAP.md`) estavam desatualizados desde 2026-07-04 (não refletiam a conclusão das Sprints 1a/1b, a separação DEV/PROD já promovida, a migração Spark→Blaze, e outras correções já feitas) — atualizados para o estado real confirmado nesta auditoria.

**Nenhum código, dado ou configuração de produção alterado nesta rodada** — só documentação e planejamento.

---

### 07/07/2026 — Preparação para SQL: modelagem relacional completa — CONCLUÍDA (só planejamento)

**Tarefa:** fechar a lacuna de 0% em modelagem relacional/SQL registrada desde a criação da Camada Repository (2026-07-05) — produzir um destino relacional completo e documentado para uma eventual migração futura, sem migrar nada agora.

**Entregue:** novo diretório `sql/` — `00_visao_geral.md` (motivação, banco recomendado PostgreSQL/Cloud SQL com justificativa comparativa, decisões de modelagem array-vs-JSONB), `01_der_mestre.md` (DER em Mermaid), `02_migracao_estrategia.md` (7 ondas por risco crescente, rollback por onda, coexistência, sincronização, testes, homologação — nada executado), `03_repository_adapter.md` (como cada `*.repository.js` se conectaria ao SQL sem alterar páginas consumidoras), `schema/*.sql` (8 arquivos por domínio, 75 tabelas, 62 relacionamentos, cobrindo as 54 coleções ativas de `COLECOES_FIRESTORE.md`). `CRM/TECHDOC.md` (§23, nova seção + linha na tabela de histórico) e `MASTER_ROADMAP.md` (nova seção transversal, mesmo padrão da Infraestrutura de Ambientes DEV/PROD) atualizados.

**Erro encontrado e corrigido na própria revisão:** a ordem de carga dos arquivos `.sql` recomendada inicialmente estava invertida entre os domínios 05 e 06 (uma FK via `ALTER TABLE` foi confundida com uma dependência de criação de tabela) — corrigido antes de qualquer commit, ordem final é puramente numérica (01 a 08).

**Nenhum banco SQL instalado, nenhum ORM adicionado, nenhum dado migrado, nenhum código funcional do CRM alterado.** O Firestore continua sendo o banco oficial do projeto — mesma diretriz permanente desde a criação da Camada Repository.

**Pendências registradas para uma eventual migração futura:** nenhum teste de execução real do DDL contra um Postgres de verdade (exigiria instalar um banco, fora do escopo autorizado); `LISTEN/NOTIFY` como estratégia de tempo real não validado na prática.

---

### 07/07/2026 — Reconciliação `develop`↔`origin/develop` (Camada Repository) + Re-homologação técnica do Sprint 3 RBAC

**Tarefa 1 — Divergência de branch:** `develop` local estava 6 commits à frente (Camada Repository Fase 0+1, órfã desde 2026-07-05) e 25 atrás (Sprint 1b + hardening + promoção, já publicados em `origin/develop`) — divergência legítima (reset+cherry-pick anterior), não reescrita de histórico. Diagnóstico completo (merge-base, arquivos tocados por cada lado, `git cherry`) confirmou zero sobreposição de arquivo entre os dois conjuntos de commits.

**Resolução:** branch de backup (`backup-develop-local-20260707-1019`) criada antes de qualquer operação; `git rebase origin/develop` executado. Único ponto de conflito real: numeração de seção duplicada no `CRM/TECHDOC.md` (ambos os lados usaram "§19" para conteúdo diferente — Sprint 1b/Hardening de um lado, Camada Repository do outro). Resolvido renumerando a seção da Camada Repository para §22 (nenhum conteúdo removido de nenhum dos dois lados). Commit final revisado item a item (`COLECOES_FIRESTORE.md` novo + 2 linhas de TECHDOC — sem artefato acidental, sem segredo/credencial). Publicado em `origin/develop` via fast-forward simples (sem `--force`), autorizado explicitamente pelo dono em duas etapas (rebase e push separados).

**Tarefa 2 — Sprint 3 do RBAC (Estoque+Caixa):** re-homologação técnica solicitada como "próxima fase" (escolhida pelo dono entre as frentes candidatas, após eu sinalizar que o modo de execução autônoma proposto conflitava com o congelamento de escopo/produção em vigor desde 2026-07-03). Motivo da re-verificação: os 2 arquivos mudaram desde a evidência original de 02/07 (`H-006`: fix do prefixo `/dev` no redirect; Camada Repository: `estoque.js` migrado para o padrão Repository) — a evidência antiga tecnicamente não cobria mais o código vigente.

**Concorrência de sessão detectada durante o trabalho:** outra sessão Claude Code, no mesmo checkout, commitou (`c3510af`, correção de análise de Firestore Rules órfãs) e trocou o branch em checkout enquanto esta sessão trabalhava — identificado via `git reflog` antes de qualquer escrita, sem colisão de arquivo (commit deles não tocou `estoque.js`/`caixa.js`/roadmap). Registrado como risco já conhecido do projeto (múltiplas sessões simultâneas no mesmo checkout).

**Método de verificação:** Node + jsdom (mesmo padrão já validado no projeto), desta vez isolado 100% em scratchpad — `jsdom` nunca entrou no `package.json`/`node_modules` do repositório. HTML real das duas páginas carregado no jsdom; código de `estoque.js`/`caixa.js` copiado sem alteração, só a borda do SDK (Firestore, `kernel.js`, `shared/permissoes.js`) mockada. Os 12 cenários do plano original (`plans/fase2-sprint3-estoque-caixa-rbac.md` §6) foram reproduzidos e ampliados (cobertura extra de botões de card/lembrete) — **34/34 asserções aprovadas (16 Estoque + 18 Caixa), zero regressão**.

**Não coberto:** o roteiro de homologação manual em navegador real (§8 do plano) — sem navegador disponível neste ambiente, mesma limitação já registrada em sessões anteriores do projeto.

**Documentação sincronizada nesta rodada** (estava desatualizada desde 2026-07-06, não refletia a promoção da Sprint 1b a produção, o encerramento do incidente de credencial, o hardening, nem a Camada Repository): `CRM/TECHDOC.md` §7.3 (resultado da re-homologação) e §22 (renumeração), `MASTER_ROADMAP.md` (nova seção "Situação em 2026-07-07"), `PROXIMA_ETAPA.md` (estado atual, próximas tarefas e riscos realinhados).

**Resultado:** `develop` publicada e sincronizada com `origin/develop`. Sprint 3 do RBAC com evidência técnica completa e sem regressão — **aprovação formal do usuário continua pendente** (não é uma decisão que esta sessão pode tomar sozinha; Sprint 4 do RBAC só inicia depois dela, por processo já estabelecido nas Sprints 1 e 2).

**Arquivos alterados:** `CRM/TECHDOC.md`, `MASTER_ROADMAP.md`, `PROXIMA_ETAPA.md`, `HISTORICO_PROJETO.md`. Nenhum código de produto (`CRM/pages/estoque/estoque.js`, `CRM/pages/caixa/caixa.js`) foi alterado — a re-homologação não encontrou necessidade de correção.
**Validação:** `git fsck --full` sem erro/corrupção; histórico linear preservado; branch de backup mantida.
**Pendente:** aprovação formal do Sprint 3 do RBAC pelo dono do projeto.

---

---

### 07/07/2026 — Auditoria de Prontidão da Plataforma + eliminação dos bloqueadores técnicos (Fases 1-2)

**Tarefa:** auditoria somente-leitura de 40 itens de infraestrutura respondendo "a plataforma está pronta para novos módulos?" (entregue como artifact), seguida — em nova rodada autorizada — da eliminação dos bloqueadores identificados, mantendo tudo em `develop` (sem push/merge/deploy).

**Auditoria (resumo):** maturidade geral 68%, 3 itens críticos (zero teste persistido para os 34 módulos de UI, nenhuma CI executando os testes existentes, nenhum monitoramento de erro em produção). Parecer: "não ainda, mas a poucos passos de um sim" — bloqueantes de esforço baixo, já reconhecidos nos próprios documentos do projeto.

**Fase 1 — Testes persistidos:** o harness jsdom descartável (reconstruído 4 vezes em sessões anteriores) foi definitivamente persistido em `tests/rbac/`. Arquitetura: um loader ESM (`tests/rbac/loader.mjs`, via `node:module.register`) redireciona só as importações de infraestrutura (`scripts/firebase.js`, `scripts/kernel.js`, `shared/permissoes.js`, `firebase/client.js`, CDN do Firestore) para mocks — o código real das páginas é importado **sem cópia**, eliminando o risco de a evidência ficar obsoleta (o que já tinha acontecido com Estoque entre 02/07 e 07/07). Persistidos os 34 cenários das Sprints 2 e 3 do RBAC (`crm`, `entrada`, `chips`, `chips-entrada`, `agenda`, `estoque`, `caixa`), convertidos para `node:test`. Dashboard (Sprint 1) ficou fora do escopo desta rodada — arquitetura de mixins bem mais complexa, recomendado como próximo passo dedicado.

**Bugs encontrados e corrigidos no próprio harness durante a construção:** `sessionStorage`/`localStorage`/`requestAnimationFrame` não expostos como globais (o código de página os referencia soltos, não via `window.`); `window.foo = function(){}` seguido de chamada solta `foo()` quebra quando `window` não é o mesmo objeto que `globalThis` do processo (corrigido com um `Proxy` cujo `set` espelha no `globalThis` real); `jsdom` não implementa `Element.prototype.scrollIntoView`; e o mais sério — `setInterval(renderCalendario, 60000)` em `acaodasemana.js` nunca limpo, resolvendo para o `setInterval` real do Node (não o do jsdom), travando o processo indefinidamente ao rodar múltiplos arquivos de teste juntos (corrigido rastreando e limpando os handles manualmente no cleanup — tentar redirecionar `setInterval`/`setTimeout` para o jsdom quebrou os internals do próprio jsdom em recursão infinita).

**Concorrência de sessão (evento novo):** enquanto este trabalho estava em andamento, outra sessão neste mesmo checkout (a) criou de forma independente um workflow de CI (`'.github/workflows/tests.yml`, commit `05eacf3`) cobrindo as 2 suítes pré-existentes — tarefa que coincidia com a Fase 2 deste escopo — e (b) rodou o backup automático do dono (`subir()`), cujo `git add .` capturou todos os arquivos de `tests/rbac/` ainda não commitados por esta sessão (commit `aacadb0`, mesma classe de efeito colateral já documentada em `CRM/TECHDOC.md` §21.3). Nenhum dado foi perdido — os arquivos capturados eram idênticos ao trabalho em andamento, só commitados antes da hora por um processo externo.

**Fase 2 — CI:** em vez de duplicar o workflow já criado pela outra sessão, foi **estendido** para incluir `tests/rbac/` ao lado das suítes de Rules e Functions. Validado localmente com a mesma invocação da CI: 52/52 (Rules) + 25/25 (Functions) + 34/34 (RBAC) = **111/111 testes automatizados**.

**Fase 3 — Homologação:** lint não existe no projeto (nenhuma configuração ESLint encontrada) — etapa não aplicável. `node --check` limpo em todos os arquivos novos. Confirmado via `git diff` que nenhum arquivo de código de produto, Repository, Firestore Rules ou Cloud Function foi alterado nesta rodada. `CRM/TECHDOC.md` §7.2 e §7.3 atualizados registrando a persistência.

**Arquivos criados:** `tests/rbac/` completo (`loader.mjs`, `register-loader.mjs`, `package.json`, `helpers/dom-harness.mjs`, `mocks/{firestore-mock,permissoes,kernel,firebase-client,firebase-scripts}.js`, 7 arquivos `*.test.mjs`).
**Arquivos alterados:** `.github/workflows/tests.yml` (estendido), `CRM/TECHDOC.md`.
**Nenhum arquivo de código de produto alterado.**
**Validação:** `git fsck --full` sem erro; histórico linear preservado; 111/111 testes passando localmente com a mesma invocação da CI.
**Pendente:** Fase 4 (performance) e Fase 5 (re-auditoria) desta mesma rodada; push/merge/deploy aguardando autorização explícita.

---

### 07/07/2026 — Auditoria de performance: validação item a item do plano de 03/07

**Escopo:** revisão completa de `plans/PLANO_OTIMIZACAO_PERFORMANCE_20260703.md` — os 20 hotspots (H1-H20), os 4 padrões estruturais e as 7 fases, um a um, por leitura direta do código vigente (não só releitura do plano). Módulos refatorados desde 03/07 (Dashboard → 10 arquivos mixin; CRM/Entrada/Chips/Estoque/OS/Posvenda/Autoatendimento migrados para a Camada Repository) foram relocalizados antes de classificar. Resultado completo em `plans/PLANO_OTIMIZACAO_PERFORMANCE_20260703.md` §8.

**Achado principal:** o hotspot H13 (`estoque.js::descontarEstoque()`, descrito como "chamado pelo Caixa a cada venda, varre a coleção inteira") tinha premissa desatualizada — a função **não tinha nenhum chamador real** em todo o código vivo (confirmado por `grep` cruzado). O Caixa usa sua própria função local (`descontarEstoqueLocal`, `caixa.js:699`), que já lia com `getDoc` direto desde antes desta auditoria — ou seja, esse hotspot nunca custou uma leitura sequer em produção; era um caminho de código morto, não um caminho quente. Função removida de `estoque.js` (única alteração de código desta rodada) — não elimina custo real (já era zero), mas fecha uma armadilha de manutenção (reimportar essa função reintroduziria a leitura de coleção inteira por venda).

**Demais 19 hotspots:** classificados como **pendentes**, cada um com justificativa própria — a maioria exige mudança real de comportamento (cadência de atualização, o que aparece na tela, tempo real vs. sob demanda), o que está fora de "não alterar comportamento funcional" desta rodada; ou toca arquivo/módulo protegido (Dashboard, `scripts/firebase.js`) sem autorização nomeada; ou depende de medição contra Firestore ao vivo (fora do escopo de trabalho em git/develop). Nenhum foi classificado como "obsoleto" além do H13.

**Validação:** RBAC completo 34/34 (2 execuções, incluindo o teste de integração Estoque↔Caixa que exercita exatamente `descontarEstoqueLocal`), Firestore Rules 52/52, Cloud Functions 25/25 — **111/111, zero regressão**.

**Arquivos alterados:** `CRM/pages/estoque/estoque.js` (código morto removido), `plans/PLANO_OTIMIZACAO_PERFORMANCE_20260703.md` (§8 classificação completa, §9 registro da execução), `CRM/TECHDOC.md` (nota em §7.3).
**Nenhuma Firestore Rule, Cloud Function, arquivo da Camada Repository ou SQL alterado.**
**Pendente:** os 19 hotspots restantes — a maioria recomendada como sprints próprias (Dashboard, Financeiro, paginação) com autorização explícita nomeando o módulo, seguindo o processo já estabelecido nas Sprints de RBAC. Push/merge/deploy aguardando autorização explícita.

---

---

### 09/07/2026 — Sprint 8: WhatsApp Templates (CRM Comercial) — CONCLUÍDA

**Tarefa:** Implementar sistema de templates de mensagens WhatsApp no módulo CRM Comercial, com CRUD completo, variáveis dinâmicas e seletor de templates ao enviar WhatsApp para um lead.

**O que foi feito:**
- Coleção `crm_templates` no Firestore com regra de segurança (leitura: auth, escrita: temAcessoLiberado)
- Função `carregarTemplates()` carrega templates no cache ao iniciar o módulo
- Função `substituirVars()` substitui variáveis `{nome}`, `{aparelho}`, `{servico}`, `{valor}`, `{tel}`, `{obs}` nos templates
- `abrirWhatsApp()` reformulado: se há templates, abre seletor modal; senão, envia mensagem padrão direto
- Modal `abrirTemplatePicker()` com cards de templates clicáveis e botão "Gerenciar Templates" (visível só com permissão)
- `abrirGerenciarTemplates()` — listagem, edição e exclusão de templates em modal dedicado
- `abrirFormTemplate()` — formulário de criação/edição com preview das variáveis disponíveis
- `salvarTemplate()` — integração Firestore com feedback toast
- Fallback para mensagem padrão quando não há templates cadastrados
- Segurança por escopo de edição corrigido: de `podeCriar('crm')` para `podeEditar('crm')` por decisão explícita

**Arquivos alterados:**
- `CRM/pages/crm-comercial/crm.js` — +130 linhas de templates + gate RBAC + segurança de XSS em IDs
- `CRM/firestore.rules` — regra para coleção `crm_templates` (leitura: auth, escrita: temAcessoLiberado)
- `tests/rbac/crm-templates.test.mjs` — NOVO: 10 testes (substituirVars, carregarTemplates, picker, RBAC gates, adminLegado)
- `PROXIMA_ETAPA.md` — estado atual atualizado

**Problemas encontrados:**
- Função `editarTemplate()` referenciada no HTML inline mas nunca definida — corrigido para `abrirFormTemplate()`
- `substituirVars()` e `templatesCache` não expostos ao window — expostos para testabilidade via `window.substituirVars` e `window.__templatesCache`
- Gate RBAC inicial usava `podeCriar('crm')` — substituído por `podeEditar('crm')` conforme especificação do usuário

**RBAC implementado:**
- `abrirTemplatePicker()`: só exibe botão "⚙️ Gerenciar Templates" se `podeEditar('crm')`
- `abrirGerenciarTemplates()`: bloqueia início com toast se sem permissão
- `salvarTemplate()`: bloqueia execução se sem permissão
- `excluirTemplate()`: bloqueia execução se sem permissão
- Usuários com `podeVisualizar('crm')` podem usar templates normalmente via `abrirWhatsApp()`

**Validação:** RBAC completo 67/68 (única falha é a pré-existente do Caixa, inalterada). 10/10 testes novos.

---

### 09/07/2026 — Sprint 9: Financeiro — Relatório Mensal + Fluxo de Caixa Projetado — CONCLUÍDA

**Tarefa:** Implementar relatório mensal financeiro com demonstrativo receita/despesa/saldo, fluxo de caixa projetado 30/60/90 dias, geração automática de despesas recorrentes e resumo expandido no módulo Financeiro.

**O que foi feito:**
1. **Relatório Mensal** — Nova aba "📊 Relatório Mensal" com:
   - Seletor de mês (últimos 12 meses + próximo)
   - Cards de Receita Total (recebido/pendente), Despesa Total (pago/pendente), Fixas/mês
   - Saldo do mês com indicador positivo/negativo
   - Lista de lançamentos do mês (receber + pagar em ordem cronológica)
2. **Fluxo de Caixa Projetado** — Três cards de projeção 30/60/90 dias com base em contas pendentes + despesas fixas
3. **Geração Automática de Despesas Recorrentes** — Botão "Gerar Despesas do Mês (Fixas)" que cria contas a pagar a partir das despesas fixas, com verificação de duplicidade por mês
4. **Resumo Expandido** — Barra de resumo no topo agora inclui vencidos e pendentes, além dos totais anteriores

**Arquivos alterados:**
- `CRM/pages/financeiro/financeiro.js` — +~110 linhas: renderRelatorio, renderFluxoCaixa, gerarDespesasDoMes, atualizarResumoCompleto, gerarMesesOption; exports globais
- `CRM/pages/financeiro/index.html` — nova aba "📊 Relatório Mensal", painel com cards/seletor/fluxo/geração, resumo expandido com vencidos/pendentes
- `CRM/pages/financeiro/financeiro.css` — estilos para relatório (.fin-rel-*), fluxo de caixa (.fin-fluxo-*), botão de geração (.fin-btn-gerar-fixas)
- `tests/rbac/financeiro-relatorio.test.mjs` — NOVO: 4 testes (cálculo receita/despesa, fluxo de caixa, meses option, resumo expandido)
- `PROXIMA_ETAPA.md` — estado atual atualizado

**Problemas encontrados:**
- Duplicidade de `fmt()`: já existia como const arrow function no topo do módulo; a nova implementação tentou redefinir como function — removido, todas as funções novas usam a `fmt` global existente
- `limit` importado de firebase.js mas não exportado pelo mock de testes — removido do import por não ser usado na implementação atual
- Testes do relatório exigem chamada explícita a `renderRelatorio()` e `renderFluxoCaixa()` pois o módulo não ativa a aba de relatório automaticamente no boot (só sob demanda ao clicar na aba)

**Arquitetura:**
- Toda lógica nova está dentro do módulo `financeiro.js` existente, sem dependências externas
- Reaproveita as estruturas de dados existentes (`dadosPagar`, `dadosReceber`, `dadosFixas`)
- Nenhuma nova coleção Firestore, nenhuma Firestore Rule alterada, nenhuma Cloud Function
- RBAC: `gerarDespesasDoMes()` verifica `podeCriar('financeiro')`

**Validação:** RBAC completo 71/72 (única falha é a pré-existente do Caixa, inalterada). 4/4 testes novos.

---

### 09/07/2026 — Sprint 10: Financeiro — Fechamento Mensal Automático + Análise por Categoria — CONCLUÍDA

**Tarefa:** Implementar fechamento mensal automático, análise de despesas por categoria e histórico de fechamentos no módulo Financeiro. Conclui o ÉPICO Financeiro (Fase 9+10 do roadmap).

**O que foi feito:**

1. **Fechamento Mensal Automático** (`financeiro_fechamentos`):
   - Nova coleção Firestore: `financeiro_fechamentos/{mes}`
   - Botão 🔒 Fechar Mês na aba Relatório (gate RBAC: `podeEditar('financeiro')`)
   - Calcula receita total, despesa total, saldo final do mês selecionado
   - Gera automaticamente despesas do próximo mês a partir das fixas
   - Verifica se mês já foi fechado antes de criar duplicata
   - Indicador visual na aba: "📂 Mês aberto" / "🔒 Fechado — Saldo: R$ X"
   - Botão desaparece após fechamento

2. **Análise por Categoria**:
   - Barras de distribuição de despesas por categoria no relatório mensal
   - Cada categoria exibe: ícone, nome, valor total e percentual do total
   - Barra visual com preenchimento proporcional (`fin-analise-bar-fill`)
   - Receitas mostradas como total consolidado

3. **Histórico de Fechamentos**:
   - Grid de cards com meses fechados, ordenados do mais recente
   - Cada card: mês, receita, despesa, saldo (verde/vermelho), contagem de itens
   - Clique no card navega para o mês correspondente no relatório

**Arquivos alterados:**
- `CRM/pages/financeiro/financeiro.js` — +150 linhas (carregarFechamentos, fecharMes, renderAnaliseCategoria, renderHistoricoFechamentos; exports globais; integração com boot e renderRelatorio)
- `CRM/pages/financeiro/index.html` — status bar, análise por categoria, histórico de fechamentos
- `CRM/pages/financeiro/financeiro.css` — estilos .fin-rel-status-*, .fin-analise-*, .fin-hist-*
- `tests/rbac/financeiro-relatorio.test.mjs` — +4 testes (fecharMes, renderHistoricoFechamentos, renderAnaliseCategoria, carregarFechamentos)
- `PROXIMA_ETAPA.md` — estado atual atualizado

**Coleção nova:** `financeiro_fechamentos` — `{mes, label, receitaTotal, despesaTotal, saldoFinal, totalRecebido, totalAReceber, totalPago, totalAPagar, totalFixas, qtdPagar, qtdReceber, qtdFixas, fechadoEm}`

**Firestore Rules:** Nenhuma alteração — todas as coleções de negócio já usam `temAcessoLiberado()`.

**Validação:** RBAC completo 75/76 (única falha é a pré-existente do Caixa, inalterada). 8/8 testes.

---

### 09/07/2026 — Sprint 11: Usuários e Permissões — Políticas de Senha — CONCLUÍDA

**Tarefa:** Implementar políticas de senha no módulo Usuários e Permissões — pendência formal da Fase 1 (UI já sinalizava "não habilitado nesta fase"). Conclui o ÉPICO Segurança de Senhas.

**O que foi feito:**

1. **Nova aba 🔑 Políticas de Senha** no módulo Usuários e Permissões com:
   - Seleção de expiração (30/60/90/180 dias ou nunca)
   - Configuração de força mínima (comprimento 6/8/10/12, maiúscula, minúscula, dígito, especial)
   - Configuração de histórico (3/5/10 senhas anteriores ou não impedir reuso)
   - Teste de senha em tempo real com barra de força (score 0-100%)
   - Botão "💾 Salvar Políticas"

2. **Funções de validação:**
   - `validarSenhaPoliticas(senha)` — retorna array de erros baseado nas políticas configuradas
   - `calcularForcaSenha(s)` — score de 0 a 100 baseado em comprimento, variedade de caracteres

3. **Integração com formulários existentes:**
   - Criação de novo usuário: senha temporária validada contra políticas
   - Redefinição de senha: nova senha validada contra políticas
   - `abrirFormUsuario()` e `abrirRedefinirSenha()` estendidos

4. **Persistência:** Documento `config/politicas_senha` no Firestore (já coberto por regras existentes)

**Arquivos alterados:**
- `CRM/pages/usuarios-permissoes/usuarios-permissoes.js` — +110 linhas (carregarPoliticas, renderPoliticas, salvarPoliticas, testarSenha, calcularForcaSenha, validarSenhaPoliticas, setupPoliticasUI; integração boot)
- `CRM/pages/usuarios-permissoes/index.html` — nova aba + panel com configurações
- `CRM/pages/usuarios-permissoes/usuarios-permissoes.css` — estilos .pol-*
- `tests/rbac/usuarios-politicas-senha.test.mjs` — NOVO: 10 testes
- `tests/rbac/loader.mjs` — redirecionamento de firebase-auth.js/firebase-functions.js para mocks
- `tests/rbac/mocks/firestore-mock.js` — add getApp/initializeApp/getApps exports
- `tests/rbac/mocks/firebase-auth-mock.js` — NOVO: mock de Auth
- `tests/rbac/mocks/firebase-functions-mock.js` — NOVO: mock de Functions
- `tests/rbac/mocks/firebase-scripts.js` — add limit ao re-export
- `tests/rbac/mocks/kernel.js` — add getUid/getNome/temPermissao
- `PROXIMA_ETAPA.md` — estado atual atualizado

**Problemas encontrados:**
- `firebase-secondary.js` importa do CDN (firebase-auth.js) — não coberto pelos mocks existentes; criado mock de Auth e de Functions, ajustado loader para rotear corretamente
- `validarSenhaPoliticas` e `calcularForcaSenha` não expostos ao window — exportados para testabilidade
- `limit` importado em usuarios-permissoes.js mas mock de firebase-scripts.js não o re-exportava — adicionado ao re-export

**Validação:** RBAC completo 85/86 (única falha é a pré-existente do Caixa, inalterada). 10/10 testes novos.

### 09/07/2026 — Sprint 16-19: Consolidação + Fornecedores + RBAC + firestore.rules — CONCLUÍDAS

Sprints 16-18: OS templates configuráveis, wppHistorico, 14 mensagens prontas.
Sprint 19: Fornecedores — nova aba cadastro (10 campos, CRUD), initModulo+RBAC.
firestore.rules: cópia raiz sincronizada com CRM/ (493 linhas).
Config page: initModulo+RBAC.

Testes: 97/97.

---

### 09/07/2026 — MARCO: Desenvolvimento Principal Concluído — Entrada em Modo Estabilidade

**Tarefa:** Reconhecer formalmente a conclusão do desenvolvimento principal do Cell City CRM. Após 22+ sprints consecutivas, a plataforma atinge maturidade operacional e entra em modo de estabilidade.

**O que foi reconhecido:**

1. **Arquitetura consolidada:** MPA + ES Modules + Repository Layer (20 repositórios) + Firebase (Auth/Firestore/Storage/Cloud Functions) + GitHub Pages. Zero build step, zero bundler.

2. **34 módulos:** 32 operacionais, 2 placeholders mantidos como espaço reservado (Estratégia, Em Breve).

3. **RBAC duas camadas** integrado em todos os módulos ativos.

4. **Firestore Rules** com `temAcessoLiberado()` bloqueando contas pendentes.

5. **25 arquivos de teste RBAC** + 52 Firestore Rules + 25 Cloud Functions.

6. **CI/CD** com GitHub Actions (deploy, testes, backup semanal).

7. **Ambientes separados** MAIN/DEVELOP com backends Firebase independentes.

8. **Incidente de credencial** encerrado com rotação de chaves e hardening.

9. **Modelagem SQL** concluída (planejamento, sem migração).

**Documentos criados:**
- `plans/PORTAL_TECNICO_PLANEJAMENTO.md` — Planejamento estratégico para futura implementação de conteúdo técnico, condicionado a processo de curadoria e engajamento da equipe.

**Política de novos desenvolvimentos:**
Novas sprints serão abertas apenas por:
- Problemas encontrados durante uso diário
- Novos requisitos de negócio
- Funcionalidades aprovadas no roadmap

Não serão criadas sprints para preencher placeholders, adicionar conteúdo ao Portal Técnico sem curadoria, ou manter "desenvolvimento contínuo" sem entrega de valor.

**Status formal do projeto:**
- ✅ Arquitetura consolidada
- ✅ Desenvolvimento principal concluído
- 🟡 Plataforma em fase de homologação funcional e estabilização
- 🟡 `develop` 45 commits à frente de `origin/develop` — push pendente

*Fim do histórico — novos registros serão adicionados abaixo.*

---

## 2026-07-10 — Release v2026.07.10: revisão técnica, promoção e desativação do Chat

- **Revisão técnica pré-promoção** (Revisor Principal, TECHDOC §30) dos 92 commits das Sprints 5–19: 7 grupos de problemas encontrados e corrigidos — 4 coleções sem rule (Chat/Compras/Fechamento/Fornecedores quebrados por deny-by-default), `garantia.html`+`catalogo.html` deletados mas ainda linkados (restaurados), 8 redirects RBAC sem prefixo `/dev`, links `wa.me` sem DDI 55, import errado no `brand-header.js`, gate ausente na Auditoria, e **12 testes RBAC commitados vermelhos** (reescritos).
- **Promoção**: `develop`→`main` por fast-forward (histórico linear — regra GH013 só proíbe merge commits), `main`=`0860d91`, tag `v2026.07.10-1253`. Push de develop+main+tags.
- **Sprint Desativação do Chat** (`b6c1122`, TECHDOC §31): `CHAT_ENABLED=false`, acesso direto mostra "Módulo desativado." sem tocar Firestore; código/testes/rules/coleção 100% preservados; nunca houve entrada de menu a remover.
- **Fechamento da release**: `_BACKUPS/` e backups avulsos excluídos do artefato do GitHub Pages (estavam sendo publicados — 2.263 arquivos); COLECOES_FIRESTORE §22; checklist de deploy das rules em `plans/CHECKLIST_DEPLOY_RULES_20260710.md`.
- **Pendência para homologação**: deploy das Firestore Rules corrigidas em `cellcity-crm-dev` (DEV) e `cellcity-crm` (PROD) — até lá, Compras, Fechamento Mensal e Cadastro de Fornecedores continuam indisponíveis em runtime.

**Suítes:** RBAC 149/149 · Rules 73/73 · Functions 25/25 · Performance 4/4.

---

## 2026-07-10 — Engenharia Principal: correção de path absoluto + remoção de código morto

- **Bug fix — path absoluto no `dashboard-alarme-os.js`** (GUIA_MANUTENCAO.md item 21): `window.open()` para janela flutuante do alarme usava `/CRM/...` sem prefixo `/dev`, mesma classe do bug H-009 já corrigido no Caixa. Adicionado `prefix` dinâmico com o mesmo padrão usado em `dashboard-caixa.js:32`.
- **Dead code removal** (GUIA_MANUTENCAO.md item 23): `CRM/repositories/saas.repository.js` — 4 exports com zero imports no código atual. Sobrevivente do multiempresa revertido.
- **Arquivos alterados:** `CRM/pages/dashboard/dashboard-alarme-os.js`, `CRM/repositories/saas.repository.js` (removido).
- **Suítes:** RBAC 153/153 · Performance 4/4.

---

## 2026-07-10 — Engenharia Principal: card da Agenda adicionado ao Dashboard + hardening do deploy

- **Bug fix — card da Agenda ausente no Dashboard** (GUIA_MANUTENCAO.md item 12, TECHDOC §7.2): CSS e JS do Dashboard referenciavam `.module-card[data-module="acaodasemana"]` mas o card não existia no HTML. `atualizarCardAcaoSemana()` retornava sem efeito e CSS de pulsação ficava inativo. Card adicionado ao grid + entrada `'acaodasemana': 'agenda'` em `RBAC_CARD_PARA_MODULO_ID` para ocultação por RBAC.
- **Hardening do artefato Pages** (GUIA item 5): `_runtime_audit/`, `sql/`, `pages/`, `scripts/`, `sistema/` eram publicados no GitHub Pages sem intenção. Adicionados ao `--exclude` do `deploy-pages.yml`.
- **Arquivos alterados:** `CRM/pages/dashboard/index.html`, `CRM/pages/dashboard/dashboard-state.js`, `.github/workflows/deploy-pages.yml`.
- **Suítes:** RBAC 153/153 · Performance 4/4.

---

## 2026-07-10 — Modo evolução contínua (Engenheiro Principal): correções pós-certificação

Sprints de qualidade após a Certificação v1.0, ordem de prioridade bug→segurança:

- **`3bc4a4f` — WhatsApp do catálogo público sem DDI 55:** os 3 links `wa.me`
  do catálogo público (header, card, botão comprar) quebravam se o número
  fosse salvo sem o `55` (o campo admin só instrui no placeholder, não valida).
  Canal de venda direto ao cliente. Helper `_waDigits()` (mesmo padrão do
  `portal.js`), lógica validada em 5 casos.
- **`d8dec82` — Central de Comandos quebrada no boot (P0):** `comandos.js`
  usava `initModulo()`/`carregarPermissoes()`/`podeVisualizar()` desde
  `7e5d224` mas **não importava nenhum** — a página quebrava com
  `ReferenceError`, o gate RBAC nunca rodava e os comandos não carregavam.
  Único módulo com o defeito (varredura confirmou os demais OK). Escapou das
  auditorias porque `node --check` só valida sintaxe e não havia teste.
  Corrigido + nova suíte `central-comandos.test.mjs` (3 testes) que reproduz
  o bug e trava regressão.

Método que achou o P0: escrever teste para módulo gated sem cobertura →
regra reforçada de que `node --check` verde ≠ módulo funcional. Suítes: RBAC
156/156 · Rules 73/73 · Functions 25/25 · Performance 4/4.

---

## 2026-07-11 — Sprint S1: Ampliação da matriz RBAC (16 gates fail-open → gerenciáveis)

**Evidência:** `PROXIMA_ETAPA.md` §136 — "IDs de gate fora da matriz RBAC. Gates novos (`analise`, `compras`, `chat`...) fail-open — a UI só gerencia 9 IDs."

**Problema:** O array `MODULOS` em `usuarios-permissoes.js` continha apenas 9 módulos. Os 16 módulos restantes que utilizam `podeVisualizar()`/`podeCriar()`/etc. (via `permissoes.js`) não apareciam na UI de gerenciamento de permissões, permanecendo fail-open para todos os perfis operacionais — admins não conseguiam restringir acesso a esses módulos.

**Solução:** Mapeamento exaustivo de todos os `moduloId` utilizados nas chamadas RBAC em todo o código-fonte (`grep` em 34 diretórios de página). Array `MODULOS` expandido de 9 → 25 entries:
- `configuracoes` renomeado para `config` (alinhado com o ID real usado por `clientes/clientes.js`)
- Adicionados: `compras`, `fornecedor`, `catalogo`, `pos-venda`, `contas`, `diario`, `chat`, `minha-semana`, `autoatendimento`, `importar`, `campanhas`, `analise`, `auditoria`, `central-alertas`, `central-comandos`, `central-informacoes`

**Alterações:**
- `CRM/pages/usuarios-permissoes/usuarios-permissoes.js` — MODULOS array (linhas 56-82)
- `PROXIMA_ETAPA.md` — item §136 marcado como corrigido
- `HISTORICO_PROJETO.md` — este registro

**Testes:** RBAC 156/156 (sem regressão — testes não dependem do conteúdo de MODULOS).

**Como validar:** Abrir módulo Usuários e Permissões → aba Permissões → tabela agora exibe 25 linhas (vs. 9 anteriores). Perfis existentes mantêm fail-open para os novos módulos até que o admin edite as permissões.

**Pendências:** Perfis operacionais existentes no Firestore não têm entrada na matriz para os 16 novos módulos — continuam fail-open até que o admin ajuste manualmente as permissões de cada perfil. Isto é esperado e seguro (fail-open é o comportamento conservador).

---

## 2026-07-11 — Sprint UX: Melhorias no Portal do Cliente (textos + dead-end)

**Evidência:** Auditoria completa do Portal do Cliente — 7 telas analisadas (Início, OS, Garantias, Agendamentos, Avaliações, Mensagens, Contato).

**Problemas encontrados:**
1. **Dead-end UX** — Link "📚 Ver todas as mensagens" na tela de Mensagens exibia apenas `alert('Em breve: histórico completo.')`. O histórico completo já é exibido na tela desde o carregamento — o link não levava a lugar nenhum e frustrava o cliente.
2. **Mensagem técnica** — Fallback de OS não encontrada exibia "OS não encontrada na lista local" (jargão técnico interno) em vez de um texto amigável.
3. **Acentos/cedilhas ausentes** — 8 ocorrências em modais e toasts de orçamento: `orcamento`→`orçamento`, `aprovacao`→`aprovação`, `observacao`→`observação`, `opcao`→`opção`, `urgencia`→`urgência`, `peca`→`peça`, `amanha`→`amanhã`, `sera`→`será`.

**Solução aplicada** (commit `c319551`):
- Removido link "Ver todas as mensagens" (comentário explicativo no lugar)
- "OS não encontrada na lista local" → "Ordem de serviço não encontrada."
- Correção de acentos/cedilhas nos modais `_confirmarAprovacaoDireta()`, `_exibirModalEscolhaOrcamento()`, toasts `_executarAprovacao()` e `recusarOrcamento()`

**Arquivo alterado:** `CRM/pages/portal-cliente/portal.js`

**Testes:** Nenhum teste quebra — alterações exclusivamente em strings de UI.

**Como validar:** Abrir Portal do Cliente → OS Detalhe de orçamento pendente → clicar Aprovar → textos do modal agora com acentos corretos. Abrir link direto de OS inválida → mensagem "Ordem de serviço não encontrada." Abrir Mensagens → link "Ver todas" não existe mais.

**Pendências:** Nenhuma.
