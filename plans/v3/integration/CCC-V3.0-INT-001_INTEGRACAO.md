# Integração V3 — Arquitetura de Integração

**Documento:** CCC-V3.0-INT-001  
**Versão:** 3.0.0  
**Data:** 2026-07-13  
**Arquiteto:** DeepSeek R1  
**Status:** Aprovado

## 1. Visão Geral

A integração V3 conecta todos os componentes através de um barramento de estado
compartilhado via JSON. Nenhum componente chama funções de outro diretamente —
a comunicação é exclusivamente via arquivos de estado e logs.

## 2. Diagrama de Integração

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BAR RAMENTO V3 (JSON State)                     │
│  scripts/*/state/*.json + logs/*.log                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Health  │  │  Diag.   │  │  Observ. │  │  Monitor │  │   Exec.  │ │
│  │  Engine  │  │  Engine  │  │  ability │  │          │  │  Engine  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       │             │             │             │             │        │
│       └─────────────┼─────────────┼─────────────┼─────────────┘        │
│                     │             │             │                       │
│              ┌──────┴──────┐ ┌────┴────┐ ┌─────┴──────┐               │
│              │    Smart   │ │ Central │ │  Prompt   │               │
│              │   Panel    │ │ Módulos │ │ Generator │               │
│              └──────┬──────┘ └────┬────┘ └─────┬──────┘               │
│                     │             │             │                       │
│                     └─────────────┴─────────────┘                       │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Control Center (V2)                           │   │
│  │  Lê state/health-check.json e state/automation-status.json      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3. Contratos de Estado

### 3.1 Health Engine → Todos
**Arquivo:** `scripts/health-engine/state/health-check.json`

```json
{
  "score": { "geral": 75 },
  "nivel": "atencao",
  "execucao": {
    "checkers_pass": 5,
    "checkers_fail": 1
  }
}
```

**Consumido por:** Smart Panel, Central Modules, Prompt Generator, Execution Engine

### 3.2 Observability → Smart Panel / Monitor
**Arquivo:** `scripts/observability/state/metrics.json`

```json
{
  "metrics": {
    "system": { "memory_percent": 65, "disk_usage_percent": 72 }
  }
}
```

**Consumido por:** Smart Panel, Monitoring

### 3.3 Monitoring → Smart Panel
**Arquivo:** `scripts/monitoring/state/alert-history.json`

```json
{
  "alertas": [{"componente": "git", "severidade": "warning"}]
}
```

**Consumido por:** Smart Panel, Automations

### 3.4 Diagnostic Engine → Prompt Generator
**Arquivo:** `scripts/diagnostic-engine/state/last-diagnostic.json`

```json
{
  "total_findings": 3,
  "findings": [{"analyzer": "system", "mensagem": "...", "severidade": "warning"}]
}
```

**Consumido por:** Prompt Generator, Smart Panel

### 3.5 Execution Engine → Todos
**Arquivo:** `scripts/execution-engine/state/checkpoint.json`

```json
{
  "missao_id": "v3_foundation",
  "percentual": 75,
  "status": "executando"
}
```

**Consumido por:** Smart Panel (progresso em tempo real)

### 3.6 Automations → Control Center
**Arquivo:** `scripts/automations/state/automation-status.json`

```json
{
  "ultima_tarefa": "auto-health",
  "status": "concluido"
}
```

**Consumido por:** Smart Panel, Control Center

## 4. Fluxos de Integração

### Fluxo 1: Health Check → Painel
1. Health Engine executa checkers
2. Salva `health-check.json`
3. Smart Panel lê o JSON
4. Renderiza score no dashboard

### Fluxo 2: Diagnóstico → Prompt
1. Diagnostic Engine executa analyzers
2. Salva `last-diagnostic.json`
3. Prompt Generator coleta findings
4. Gera prompt com contexto completo

### Fluxo 3: Execução → Monitoramento
1. Execution Engine executa missão
2. A cada passo: salva checkpoint
3. Se falha: Monitoring registra alerta
4. Smart Panel exibe progresso

### Fluxo 4: Automação → Cadeia Completa
1. Automation executa auto-health
2. Health Engine roda checkers
3. Monitoring avalia thresholds
4. Smart Panel atualiza dashboard

## 5. Script de Integração

O script `scripts/integration/integration.sh` orquestra a execução em cadeia:

```bash
integration.sh --health     # Health → Monitor → Panel
integration.sh --diagnose   # Diag → Prompt
integration.sh --full        # Toda a cadeia
integration.sh --status      # Status consolidado de todos os componentes
```
