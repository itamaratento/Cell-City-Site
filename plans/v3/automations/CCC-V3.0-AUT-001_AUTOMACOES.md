```
======================================================================
CELL CITY CRM
VERSÃO 3.0 — AUTOMAÇÕES

DOCUMENTO CCC-V3.0-AUT-001
SISTEMA DE AUTOMAÇÕES V3
======================================================================
```

# AUTOMAÇÕES V3 — Automations Engine

## 1. Objetivo

Automatizar tarefas repetitivas do ecossistema Cell City: auditoria,
health check, backup, limpeza, relatórios e alertas. Reduzir
intervenção manual e garantir consistência nas operações.

## 2. Arquitetura

```
scripts/automations/
├── automations.sh              # Orquestrador principal
├── VERSION
├── README.md
├── core/
│   ├── scheduler.sh            # Agendador (cron wrapper)
│   ├── executor.sh             # Executor de automações
│   ├── condition.sh            # Avaliador de condições
│   └── reporter.sh             # Relatórios de execução
├── tasks/                      # Tarefas automatizadas
│   ├── auto-audit.sh           # Auditoria automática
│   ├── auto-health.sh          # Health automático
│   ├── auto-backup.sh          # Backup automático
│   ├── auto-cleanup.sh         # Limpeza automática
│   ├── auto-report.sh          # Relatórios automáticos
│   ├── auto-alert.sh           # Alertas automáticos
│   └── auto-notify.sh          # Notificações automáticas
├── conditions/                 # Condições de gatilho
│   ├── time-based.sh           # Baseado em horário
│   ├── event-based.sh          # Baseado em evento
│   ├── threshold-based.sh      # Baseado em limiar
│   └── manual.conf             # Configuração manual
├── lib/
│   ├── utils.sh                # Utilitários
│   ├── schedule.sh             # Funções de agendamento
│   └── report.sh               # Geração de relatórios
└── state/
    ├── automation-status.json  # Status das automações
    └── automation-history/     # Histórico de execuções
```

## 3. Tarefas Automatizadas

### 3.1 Auditoria Automática (auto-audit.sh)
- **Frequência:** Diária (06:00)
- **O que faz:**
  - Executa diagnóstico completo
  - Verifica integridade do repositório
  - Verifica regras de Firestore
  - Verifica índices
  - Gera relatório de auditoria
- **Dispara:** Se encontrar critical/high findings

### 3.2 Health Automático (auto-health.sh)
- **Frequência:** A cada 4 horas
- **O que faz:**
  - Executa health check completo
  - Atualiza state/health-check.json
  - Verifica score vs limiar
- **Dispara:** Se score < 70 → auto-alert

### 3.3 Backup Automático (auto-backup.sh)
- **Frequência:** Diária (03:00)
- **O que faz:**
  - Executa backup do projeto (git)
  - Executa backup do Firestore (dados)
  - Verifica integridade do backup
  - Rotaciona backups antigos
- **Dispara:** Se backup falhar → auto-alert (critical)
- **Nota:** Aproveita scripts existentes (`backup.sh`, `backup-dados.js`)

### 3.4 Limpeza Automática (auto-cleanup.sh)
- **Frequência:** Semanal (domingo 04:00)
- **O que faz:**
  - Limpa logs antigos (>30 dias)
  - Limpa state antigo (>90 dias)
  - Remove backups manuais antigos
  - Limpa node_modules não usados (opcional)
  - Limpa branches locais merged
- **Dispara:** Relatório de limpeza

### 3.5 Relatórios Automáticos (auto-report.sh)
- **Frequência:** Diária (07:00) + Semanal (segunda 07:00)
- **O que faz:**
  - Relatório diário: health score, alertas, alterações
  - Relatório semanal: tendências, comparativos, recomendações
- **Formato:** Markdown → `_reports/`

### 3.6 Alertas Automáticos (auto-alert.sh)
- **Frequência:** Contínuo (event-driven)
- **O que faz:**
  - Monitora eventos do monitoring
  - Dispara notificações baseado em regras
  - Escala severidade se não resolvido
- **Canais:** console, arquivo, (futuro: email)

### 3.7 Notificações Automáticas (auto-notify.sh)
- **Frequência:** Após cada automação
- **O que faz:**
  - Notifica resultado da automação
  - Se falha: detalhes do erro
  - Se sucesso: resumo da execução

## 4. Gatilhos

### 4.1 Tempo (time-based)
Expressões cron suportadas:

```bash
# Formato: minuto hora dia mes semana
"0 6 * * *"     # Diário às 06:00
"0 */4 * * *"   # A cada 4 horas
"0 3 * * *"     # Diário às 03:00
"0 4 * * 0"     # Domingo às 04:00
"0 7 * * 1"     # Segunda às 07:00
```

### 4.2 Evento (event-based)
| Evento | Ação |
|---|---|
| health_check_concluido | Se score < 70 → auto-alert |
| build_falhou | auto-audit + auto-alert |
| backup_concluido | auto-notify |
| diagnóstico_concluido | auto-report |
| threshold_atingido | auto-alert |

### 4.3 Limiar (threshold-based)
| Condição | Ação |
|---|---|
| Score < 50 | Alerta crítico + notificação |
| Score 50-70 | Alerta alto |
| Build fails > 3 | Auditoria automática |
| Backup fails > 1 | Alerta crítico |
| Disk > 90% | Alerta alto + cleanup |
| Memory > 80% | Alerta médio |

## 5. Fluxo das Automações

```
[Scheduler] → Verifica agendamento
    │
    ▼
[Condition] → Avalia se deve executar
    │
    ├── Se não → espera próximo ciclo
    │
    └── Se sim → [Executor]
            │
            ▼
        [Task] → Executa automação específica
            │
            ▼
        [Result] → Sucesso ou falha
            │
            ├── Sucesso → [Report] + [Notify]
            │
            └── Falha → [Alert] + [Notify]
            │
            ▼
        [State] → Salva histórico
```

## 6. Configuração de Automações

Arquivo: `config/automations.conf`

```bash
# Formato: TAREFA|ATIVO|CRON|CONDICAO
auto-health|true|0 */4 * * *|always
auto-audit|true|0 6 * * *|always
auto-backup|true|0 3 * * *|workspace_clean
auto-cleanup|true|0 4 * * 0|disk > 80
auto-report|true|0 7 * * *|always
auto-alert|true|* * * * *|event_driven
```

## 7. Relatório de Automação

```
═══════════════════════════════════════════════════════
 RELATÓRIO DE AUTOMAÇÕES — 2026-07-13
═══════════════════════════════════════════════════════

 EXECUÇÕES DO DIA:
 ✅ 06:00 Auto-audit: concluído (0 findings novos)
 ✅ 07:00 Auto-report: relatório diário gerado
 ✅ 08:00 Auto-health: score 92 (saudável)
 ✅ 12:00 Auto-health: score 95 (saudável)

 PRÓXIMAS EXECUÇÕES:
 ⏰ 16:00 Auto-health
 ⏰ 03:00 Auto-backup

 ALERTAS ATIVOS:
 🔴 Nenhum

 RECOMENDAÇÕES:
 - Nenhuma ação necessária
═══════════════════════════════════════════════════════
```
