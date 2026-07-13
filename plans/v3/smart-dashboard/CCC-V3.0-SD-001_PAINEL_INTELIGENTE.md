```
======================================================================
CELL CITY CRM
VERSÃO 3.0 — PAINEL INTELIGENTE

DOCUMENTO CCC-V3.0-SD-001
ESTRUTURA DO PAINEL INTELIGENTE V3
======================================================================
```

# PAINEL INTELIGENTE V3 — Smart Panel

## 1. Objetivo

Fornecer uma visão consolidada e em tempo real da saúde do ecossistema
Cell City através de widgets, cards e indicadores visuais no terminal.

## 2. Arquitetura

```
scripts/smart-panel/
├── panel.sh                   # Orquestrador do painel
├── VERSION
├── README.md
├── core/
│   ├── renderer.sh            # Renderização TUI
│   ├── layout.sh              # Layout de widgets
│   ├── refresh.sh             # Auto-refresh
│   └── interact.sh            # Navegação interativa
├── widgets/                   # Widgets individuais
│   ├── health-score.sh        # Widget de health score
│   ├── last-tests.sh          # Últimos testes
│   ├── last-commits.sh        # Últimos commits
│   ├── last-backups.sh        # Últimos backups
│   ├── last-releases.sh       # Últimos releases
│   ├── alerts.sh              # Alertas ativos
│   ├── system-status.sh       # Status do sistema
│   ├── module-status.sh       # Status dos módulos
│   └── general-status.sh      # Status geral
├── cards/                     # Cards de indicadores
│   ├── health-card.sh         # Card de saúde
│   ├── perf-card.sh           # Card de performance
│   ├── security-card.sh       # Card de segurança
│   └── activity-card.sh       # Card de atividade
├── lib/
│   ├── widget-utils.sh        # Utilitários de widget
│   ├── card-utils.sh          # Utilitários de card
│   ├── colors.sh              # Cores (herdado do CC)
│   └── format.sh              # Formatação
└── state/
    └── panel-state.json       # Estado do painel
```

## 3. Layout do Painel

```
┌─────────────────────────────────────────────────────────────┐
│  CELL CITY CRM — PAINEL INTELIGENTE V3      [auto-refresh 30s]│
├─────────────────────────────────────────────────────────────┤
│ 🟢 Saúde Geral: 92/100   │ 📊 Módulos: 32/32 operacionais   │
│ 🔴 Alertas: 2 ativos     │ 💾 Backup: Hoje 03:00            │
├──────────────────┬──────────────────┬───────────────────────┤
│  HEALTH SCORE    │  ÚLTIMOS TESTES  │  ÚLTIMOS COMMITS      │
│  ┌────────────┐  │  ┌────────────┐  │  ┌──────────────────┐ │
│  │   92/100   │  │  │ ✅ RBAC    │  │  │ abc123 - fix... │ │
│  │   🟢       │  │  │ ✅ Rules   │  │  │ def456 - feat.. │ │
│  │            │  │  │ ✅ Perf    │  │  │ ghi789 - docs.. │ │
│  └────────────┘  │  └────────────┘  │  └──────────────────┘ │
├──────────────────┼──────────────────┼───────────────────────┤
│  ÚLTIMOS BACKUPS │  ÚLTIMOS RELEASES│  ALERTAS             │
│  ┌────────────┐  │  ┌────────────┐  │  ┌──────────────────┐ │
│  │ 2026-07-13 │  │  │ v1.0.0     │  │  │ ⚠️ build warn   │ │
│  │ 03:00 ✅   │  │  │ 2026-07-10 │  │  │ 🔴 score < 70   │ │
│  └────────────┘  │  └────────────┘  │  └──────────────────┘ │
├──────────────────┴──────────────────┴───────────────────────┤
│  DETALHES: [1] Health  [2] Testes  [3] Git  [4] Backup      │
│  [5] Release  [6] Alertas  [7] Módulos  [8] Sair            │
└─────────────────────────────────────────────────────────────┘
```

## 4. Widgets

### 4.1 Health Score Widget
- Fonte: Health Engine (`state/health-check.json`)
- Exibe: score geral, score por categoria, tendência
- Cor: verde (≥90), amarelo (≥70), laranja (≥50), vermelho (<50)

### 4.2 Last Tests Widget
- Fonte: Control Center state (`state/homologacao.json`)
- Exibe: último resultado de cada suíte de testes
- Categorias: RBAC, Rules, Functions, Performance, Integrity

### 4.3 Last Commits Widget
- Fonte: Git log
- Exibe: últimos 5 commits da branch atual
- Info: hash (abreviado), mensagem, autor, data

### 4.4 Last Backups Widget
- Fonte: Control Center state (`state/backup.json`)
- Exibe: data do último backup, status, tipo

### 4.5 Last Releases Widget
- Fonte: Control Center state (`state/release.json`)
- Exibe: última tag, data, changelog resumido

### 4.6 Alerts Widget
- Fonte: Monitoring (`state/alert-history.json`)
- Exibe: alertas ativos (não resolvidos) por severidade

### 4.7 System Status Widget
- Fonte: Observability + Health Engine
- Exibe: CPU, memória, disco, tempo de atividade

### 4.8 Module Status Widget
- Fonte: Central de Módulos + Health Engine
- Exibe: módulos operacionais vs. total, problemas por módulo

## 5. Cards de Indicadores

| Card | Indicadores | Fonte |
|---|---|---|
| Health Card | Score geral, tendência (▲▼), último check | Health Engine |
| Performance Card | Tempo de build, tempo de teste, tempo de resposta | Observability |
| Security Card | Alertas de segurança, vulnerabilidades, RBAC | Monitoring |
| Activity Card | Commits hoje, deploys hoje, alterações | Git + Release |

## 6. Modos de Visualização

| Modo | Comando | Conteúdo |
|---|---|---|
| Dashboard | `panel.sh` | Visão completa com todos widgets |
| Compacto | `panel.sh --compact` | Apenas health score + alertas |
| Detalhe | `panel.sh --detail <widget>` | Widget específico expandido |
| Fullscreen | `panel.sh --full` | Um widget ocupando a tela toda |
| Histórico | `panel.sh --history` | Gráfico de score ao longo do tempo |

## 7. Atualização

- Auto-refresh: a cada 30 segundos (configurável)
- Manual: tecla `r` recarrega
- Event-driven: quando um health check termina, painel atualiza
