```
======================================================================
CELL CITY CRM
VERSÃO 3.0 — CENTRAL DE MÓDULOS

DOCUMENTO CCC-V3.0-CM-001
INTEGRAÇÃO V3 DA CENTRAL DE MÓDULOS
======================================================================
```

# CENTRAL DE MÓDULOS V3 — Integração com Ecossistema V3

## 1. Objetivo

Evoluir a Central de Módulos V2 (já existente em `CRM/shared/central-modulos.js`
e `CRM/pages/central-modulos/`) para integrar-se com todos os componentes
V3: Health Engine, Diagnóstico, Prompt IA, Status, Versões, Dependências,
Health Score e Histórico.

## 2. Arquitetura

```
scripts/central-modulos-v3/
├── module-center.sh            # Orquestrador
├── VERSION
├── README.md
├── core/
│   ├── catalog-v3.sh           # Catálogo V3 (extends V2 catalog)
│   ├── module-manager.sh       # Gerenciamento de módulos
│   ├── dependency-resolver.sh  # Resolução de dependências
│   └── version-tracker.sh      # Rastreamento de versões
├── integrations/               # Integrações com V3
│   ├── health-integration.sh   # Dados do Health Engine
│   ├── diagnostic-integration.sh  # Dados do Diagnóstico
│   ├── prompt-integration.sh   # Geração de prompt contextual
│   ├── status-integration.sh   # Status dos módulos
│   ├── score-integration.sh    # Health Score por módulo
│   └── history-integration.sh  # Histórico de alterações
├── lib/
│   ├── utils.sh
│   ├── catalog-utils.sh
│   └── format.sh
└── state/
    ├── module-status.json      # Status consolidado dos módulos
    └── module-history/         # Histórico por módulo
```

## 3. Integrações

### 3.1 Control Center
- Central de Módulos V3 é um módulo do Control Center
- Acessível via menu "Central de Módulos V3"
- Exibe status de todos os componentes V2 e V3

### 3.2 Health Engine
- Cada módulo do CRM tem um health score individual
- Health Engine verifica a saúde de cada módulo
- Central de Módulos V3 exibe o score no catálogo

### 3.3 Diagnóstico
- Diagnóstico pode ser executado por módulo
- Resultados ficam associados ao módulo
- Central exibe últimos diagnósticos por módulo

### 3.4 Prompt IA
- Gera prompt contextual para um módulo específico
- Inclui: código do módulo, dependências, status, histórico
- Útil para debugging ou evolução de módulo

### 3.5 Status
- Status operacional de cada módulo: operacional, atencao, critico, offline
- Fonte: Health Engine + Monitoramento
- Atualizado a cada health check

### 3.6 Versões
- Versão atual de cada módulo (git-based)
- Última alteração (commit, data, autor)
- Comparação entre versões

### 3.7 Dependências
- Dependências entre módulos (ex: OS depende de Clientes, Estoque)
- Dependências quebradas ou desatualizadas
- Árvore de dependências

### 3.8 Health Score
- Score individual do módulo (0-100)
- Score do ecossistema completo
- Tendência (▲ melhorou, ▼ piorou, ► estável)

### 3.9 Histórico
- Alterações recentes no módulo
- Health score ao longo do tempo
- Diagnósticos anteriores

## 4. Fluxo da Central de Módulos V3

```
Abertura da Central de Módulos V3
    │
    ▼
[Carregar Catálogo] → modulos.catalogo.json (V2) + metadados V3
    │
    ▼
[Consultar Status] → Health Engine + Monitoring
    │
    ├── Módulo 1: 🟢 operacional (score 95)
    ├── Módulo 2: 🟡 atenção (score 72)
    ├── Módulo 3: 🔴 crítico (score 45)
    └── ...
    │
    ▼
[Exibir Catálogo] → lista interativa com health score
    │
    ▼
[Selecionar Módulo] → Detalhes do módulo
    │
    ├── Informações: nome, grupo, descrição, versão
    ├── Health: score, último check, tendência
    ├── Diagnóstico: último resultado
    ├── Dependências: árvore de dependências
    ├── Histórico: alterações recentes
    └── Ações: gerar prompt, executar diagnóstico
```

## 5. Estado dos Módulos

```json
{
  "timestamp": "2026-07-13T12:00:00-03:00",
  "total_modulos": 34,
  "operacionais": 32,
  "placeholders": 2,
  "status_geral": "atencao",
  "modulos": [
    {
      "slug": "os",
      "nome": "OS",
      "grupo": "Atendimento",
      "versao": "2.1.0",
      "health_score": 95,
      "status": "operacional",
      "ultimo_health_check": "2026-07-13T11:00:00-03:00",
      "ultimo_diagnostico": {
        "id": "diag_20260713_001",
        "timestamp": "2026-07-13T10:00:00-03:00",
        "findings": 0
      },
      "dependencias": ["clientes", "estoque", "financeiro"],
      "dependencias_status": "ok",
      "ultimo_commit": {
        "hash": "abc123",
        "mensagem": "fix: correção de permissão OS",
        "data": "2026-07-12",
        "autor": "dev"
      },
      "alertas": []
    }
  ]
}
```

## 6. Catálogo V3

O catálogo V2 (`modulos.catalogo.json`) é estendido com campos V3:

```json
{
  "slug": "os",
  "nome": "OS",
  "icone": "🔧",
  "grupo": "Atendimento",
  "descricao": "Ordem de Serviço",
  "v3": {
    "health_score": 95,
    "versao": "2.1.0",
    "status": "operacional",
    "tem_diagnostico": true,
    "tem_health_check": true,
    "dependencias": ["clientes", "estoque", "financeiro"],
    "last_updated": "2026-07-13T12:00:00-03:00"
  }
}
```

## 7. Menu da Central de Módulos V3

```
┌─────────────────────────────────────────────────┐
│   CENTRAL DE MÓDULOS V3                         │
├─────────────────────────────────────────────────┤
│  Status Geral: 🟡 Atenção (score: 85/100)       │
│  Módulos: 32 operacionais / 34 total             │
├─────────────────────────────────────────────────┤
│  [1] Listar todos os módulos                    │
│  [2] Módulos por status                         │
│  [3] Módulos por grupo funcional                │
│  [4] Detalhes de um módulo                      │
│  [5] Módulos com alertas                        │
│  [6] Dependências entre módulos                 │
│  [7] Gerar prompt para módulo                   │
│  [8] Executar diagnóstico em módulo             │
│  [9] Histórico de alterações                    │
│  [0] Voltar                                     │
└─────────────────────────────────────────────────┘
```
