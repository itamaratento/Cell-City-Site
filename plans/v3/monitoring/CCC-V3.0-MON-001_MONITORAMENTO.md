```
======================================================================
CELL CITY CRM
VERSÃO 3.0 — MONITORAMENTO

DOCUMENTO CCC-V3.0-MON-001
SISTEMA DE MONITORAMENTO V3
======================================================================
```

# SISTEMA DE MONITORAMENTO V3

## 1. Objetivo

Prover um sistema de monitoramento reutilizável para acompanhar a saúde
do ecossistema, disparar alertas e manter histórico de eventos.

## 2. Arquitetura

```
scripts/monitoring/
├── monitor.sh                 # Orquestrador principal
├── VERSION
├── README.md
├── core/
│   ├── event-manager.sh       # Gerenciamento de eventos
│   ├── alert-engine.sh        # Motor de alertas
│   ├── notification.sh        # Notificações (console, arquivo)
│   └── history.sh             # Histórico de eventos
├── events/                    # Definições de eventos
│   ├── health-events.sh       # Eventos de health check
│   ├── system-events.sh       # Eventos de sistema
│   ├── build-events.sh        # Eventos de build
│   └── custom-events.sh       # Eventos personalizados
├── alerts/                    # Regras de alerta
│   ├── thresholds.conf        # Limiares por componente
│   ├── priorities.conf        # Prioridades (P0-P4)
│   └── notifications.conf     # Config de notificações
├── lib/
│   ├── event.sh               # Funções de evento
│   ├── alert.sh               # Funções de alerta
│   ├── severity.sh            # Níveis de severidade
│   └── format.sh              # Formatação
└── state/
    ├── event-log.json         # Log de eventos
    └── alert-history.json     # Histórico de alertas
```

## 3. Eventos

### 3.1 Estrutura do Evento

```json
{
  "id": "evt_20260713_001",
  "tipo": "health_check_completo",
  "severidade": "info",
  "prioridade": "P3",
  "timestamp": "2026-07-13T12:00:00-03:00",
  "origem": "health-engine",
  "componente": "git",
  "mensagem": "Health check concluído: score 95",
  "dados": { "score": 95, "checkers": 11 },
  "contexto": {
    "branch": "develop",
    "ambiente": "dev",
    "usuario": "sistema"
  }
}
```

### 3.2 Tipos de Evento

| Tipo | Descrição | Severidade Padrão |
|---|---|---|
| health_check_iniciado | Health check começou | info |
| health_check_concluido | Health check terminou | info |
| health_check_falha | Health check falhou | high |
| checker_pass | Verificador passou | info |
| checker_fail | Verificador falhou | warning |
| checker_error | Verificador com erro | high |
| score_abaixo_limiar | Score abaixo do esperado | critical |
| diagnóstico_iniciado | Diagnóstico começou | info |
| diagnóstico_concluido | Diagnóstico terminou | info |
| automação_executada | Automação rodou | info |
| automação_falha | Automação falhou | high |
| backup_iniciado | Backup começou | info |
| backup_concluido | Backup terminou | info |
| backup_falha | Backup falhou | critical |
| limite_atingido | Limite de recurso atingido | warning |

### 3.3 Níveis de Severidade

| Nível | Cor | Significado | Ação |
|---|---|---|---|
| critical | 🔴 | Sistema comprometido | Alerta imediato |
| high | 🟠 | Problema grave | Notificação |
| warning | 🟡 | Atenção necessária | Log + alerta opcional |
| info | 🔵 | Informativo | Apenas log |
| debug | ⚪ | Depuração | Log verboso |

### 3.4 Prioridades (P0-P4)

| Prioridade | Prazo | Exemplo |
|---|---|---|
| P0 | Imediato | Firestore rules quebradas |
| P1 | 1 hora | Build falhando |
| P2 | 1 dia | Dependência desatualizada |
| P3 | 1 semana | Score abaixo do ideal |
| P4 | 1 mês | Melhoria sugerida |

## 4. Alertas

### 4.1 Regras de Alerta (`thresholds.conf`)

```bash
# Formato: COMPONENTE|METRICA|OPERADOR|LIMIAR|SEVERIDADE
health|score|<|70|critical
health|checkers_falhos|>|0|warning
git|commits_ahead|>|5|warning
git|dias_ultimo_commit|>|7|warning
build|modulos_com_erro|>|0|high
firebase|conectividade|==|false|critical
```

### 4.2 Fluxo de Alerta

```
Evento gerado
    │
    ▼
[Avalia Regras] → threshold.conf
    │
    ├─► Se não corresponde → arquiva
    │
    └─► Se corresponde → cria alerta
            │
            ▼
        [Notificação]
            │
            ├─► Console (stdout com cor)
            ├─► Arquivo (alerts.log)
            └─► (futuro: email, webhook)
```

### 4.3 Histórico de Alertas

```json
{
  "alertas": [
    {
      "id": "alert_20260713_001",
      "evento_id": "evt_20260713_001",
      "regra": "health|score|<|70|critical",
      "severidade": "critical",
      "timestamp": "2026-07-13T12:00:00-03:00",
      "mensagem": "Health score 65 abaixo do limiar 70",
      "resolvido": false,
      "resolvido_em": null
    }
  ]
}
```

## 5. Notificações

| Canal | Estado | Descrição |
|---|---|---|
| Console | ✅ Ativo | Saída colorida no terminal |
| Arquivo | ✅ Ativo | Log em `logs/monitoring.log` |
| State | ✅ Ativo | JSON em `state/event-log.json` |
| Email | 🟡 Planejado | Notificação por email (V3-F4) |
| Webhook | 🟡 Planejado | Integração externa (V3-F6) |

## 6. Integração com Health Engine

O monitoramento consome eventos do Health Engine:

```
Health Engine → emite evento "health_check_concluido"
    │
    ▼
Monitoring → avalia regras → se score < 70 → alerta crítico
    │
    ▼
Notificação → console + arquivo + state
```

## 7. Métricas Monitoradas

| Métrica | Fonte | Frequência |
|---|---|---|
| Health score geral | Health Engine | A cada execução |
| Score por categoria | Health Engine | A cada execução |
| Checkers falhos | Health Engine | A cada execução |
| Tempo de execução | Monitoring | A cada execução |
| Alertas ativos | Monitoring | Contínuo |
| Eventos por hora | Monitoring | Agregado |
