```
======================================================================
CELL CITY CRM
VERSÃO 3.0 — OBSERVABILIDADE

DOCUMENTO CCC-V3.0-OBS-001
SISTEMA DE OBSERVABILIDADE V3
======================================================================
```

# OBSERVABILIDADE V3 — Logs, Métricas, Telemetria

## 1. Objetivo

Prover observabilidade completa do ecossistema Cell City: logs
estruturados, métricas de performance, telemetria de uso e estatísticas
de ambiente.

## 2. Arquitetura

```
scripts/observability/
├── observability.sh            # Orquestrador principal
├── VERSION
├── README.md
├── core/
│   ├── log-collector.sh        # Coleta de logs
│   ├── metric-collector.sh     # Coleta de métricas
│   ├── telemetry-collector.sh  # Coleta de telemetria
│   ├── stats-aggregator.sh     # Agregação de estatísticas
│   └── data-export.sh          # Exportação de dados
├── collectors/                 # Coletores específicos
│   ├── system-metrics.sh       # CPU, memória, disco
│   ├── build-metrics.sh        # Tempo de build
│   ├── test-metrics.sh         # Tempo de teste
│   ├── audit-metrics.sh        # Tempo de auditoria
│   ├── response-time.sh        # Tempo de resposta
│   ├── memory-usage.sh         # Uso de memória (processos)
│   └── module-telemetry.sh     # Telemetria de módulos
├── lib/
│   ├── log.sh                  # Funções de log
│   ├── metric.sh               # Funções de métrica
│   ├── stats.sh                # Cálculos estatísticos
│   └── format.sh               # Formatação
└── state/
    ├── metrics.json            # Métricas atuais
    ├── telemetry.json          # Dados de telemetria
    └── metrics-history/        # Histórico de métricas
```

## 3. Logs

### 3.1 Formato de Log Estruturado

```json
{
  "timestamp": "2026-07-13T12:00:00-03:00",
  "nivel": "info",
  "componente": "health-engine",
  "modulo": "git",
  "mensagem": "Health check concluído",
  "dados": { "score": 95, "duration_ms": 1200 },
  "contexto": {
    "branch": "develop",
    "ambiente": "dev",
    "sessao": "ses_abc123"
  }
}
```

### 3.2 Níveis de Log

| Nível | Uso |
|---|---|
| debug | Informação detalhada para depuração |
| info | Eventos normais do sistema |
| warning | Situações inesperadas mas não críticas |
| error | Erros que precisam de atenção |
| critical | Erros que comprometem o sistema |

### 3.3 Arquivos de Log

```
logs/
├── observability.log           # Log principal (rotativo)
├── health-engine.log           # Logs do Health Engine
├── diagnostic-engine.log       # Logs do Diagnostic Engine
├── monitoring.log              # Logs do Monitoring
├── automations.log             # Logs das Automações
├── prompt-generator.log        # Logs do Prompt Generator
└── control-center.log          # Logs do Control Center (existente)
```

### 3.4 Rotação de Logs

- Tamanho máximo: 10MB por arquivo
- Retenção: 10 arquivos rotacionados
- Formato: `nome.log`, `nome.log.1`, ..., `nome.log.9`
- Compactação: gzip após 3 rotações

## 4. Métricas

### 4.1 Métricas de Performance

| Métrica | Descrição | Fonte |
|---|---|---|
| build_time_ms | Tempo de build (ms) | build-metrics.sh |
| test_time_ms | Tempo de execução de testes (ms) | test-metrics.sh |
| audit_time_ms | Tempo de auditoria (ms) | audit-metrics.sh |
| response_time_ms | Tempo de resposta (ms) | response-time.sh |
| health_check_time_ms | Tempo de health check (ms) | Health Engine |

### 4.2 Métricas de Sistema

| Métrica | Descrição | Fonte |
|---|---|---|
| cpu_usage_percent | Uso de CPU (%) | system-metrics.sh |
| memory_usage_mb | Uso de memória (MB) | memory-usage.sh |
| memory_percent | Uso de memória (%) | system-metrics.sh |
| disk_usage_percent | Uso de disco (%) | system-metrics.sh |
| disk_free_gb | Espaço livre em disco (GB) | system-metrics.sh |
| uptime_hours | Tempo de atividade (horas) | system-metrics.sh |

### 4.3 Métricas de Build

| Métrica | Descrição |
|---|---|
| files_checked | Arquivos verificados no build |
| modules_built | Módulos processados |
| errors_found | Erros encontrados |
| warnings_found | Avisos encontrados |
| duration_ms | Duração total |

### 4.4 Métricas de Teste

| Métrica | Descrição |
|---|---|
| suites_executed | Suítes executadas |
| tests_passed | Testes aprovados |
| tests_failed | Testes falhos |
| coverage_percent | Cobertura (%) |
| duration_ms | Duração total |

## 5. Estatísticas

### 5.1 Estatísticas Agregadas

O stats-aggregator.sh calcula sobre o histórico:

| Estatística | Descrição |
|---|---|
| Média | Valor médio da métrica |
| Mediana | Valor mediano |
| Mínimo | Valor mínimo |
| Máximo | Valor máximo |
| Desvio padrão | Variação dos valores |
| Tendência | ▲ melhorou | ▼ piorou | ► estável |
| Percentil 95 | P95 da métrica |

### 5.2 Exemplo de Métricas JSON

```json
{
  "timestamp": "2026-07-13T12:00:00-03:00",
  "metrics": {
    "system": {
      "cpu_usage_percent": 23.5,
      "memory_usage_mb": 456,
      "memory_percent": 11.2,
      "disk_usage_percent": 42.1,
      "disk_free_gb": 285,
      "uptime_hours": 168
    },
    "performance": {
      "build_time_ms": 4523,
      "test_time_ms": 12340,
      "audit_time_ms": 890,
      "response_time_ms": 45
    },
    "build": {
      "files_checked": 156,
      "modules_built": 34,
      "errors_found": 0,
      "warnings_found": 3,
      "duration_ms": 4523
    },
    "tests": {
      "suites_executed": 6,
      "tests_passed": 287,
      "tests_failed": 0,
      "duration_ms": 12340
    }
  }
}
```

## 6. Telemetria

### 6.1 Telemetria de Módulos

| Dado | Descrição |
|---|---|
| module_access_count | Quantas vezes o módulo foi acessado |
| last_access | Último acesso |
| average_stay_ms | Tempo médio de permanência |
| error_count | Erros no módulo |
| health_score | Score do módulo |

### 6.2 Telemetria de Operações

| Dado | Descrição |
|---|---|
| operation | Tipo de operação (health, diagnóstico, etc.) |
| frequency | Frequência de execução |
| avg_duration_ms | Duração média |
| success_rate | Taxa de sucesso |

## 7. Coleta e Armazenamento

### 7.1 Ciclo de Coleta

```
[Coletor] → coleta dado bruto
    │
    ▼
[Processador] → formata, valida, agrega
    │
    ▼
[Armazenamento] → salva em state/metrics.json
    │
    ▼
[Histórico] → append em metrics-history/{metric}-{date}.json
```

### 7.2 Frequência de Coleta

| Métrica | Frequência |
|---|---|
| CPU/Memória/Disco | A cada health check |
| Tempo de build | A cada build |
| Tempo de teste | A cada execução de testes |
| Tempo de resposta | A cada operação |
| Telemetria de módulos | A cada acesso |

## 8. Integração com Smart Panel

O Smart Panel consome os dados de observabilidade para exibir:
- Widget de performance (tempos de build, teste, auditoria)
- Widget de sistema (CPU, memória, disco)
- Cards de indicadores (perf card, activity card)
