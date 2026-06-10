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

*Fim do histórico — novos registros serão adicionados abaixo.*
