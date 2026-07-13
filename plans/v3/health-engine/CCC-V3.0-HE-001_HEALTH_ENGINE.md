```
======================================================================
CELL CITY CRM
VERSÃO 3.0 — HEALTH ENGINE

DOCUMENTO CCC-V3.0-HE-001
ARQUITETURA DO HEALTH ENGINE V3
======================================================================
```

# HEALTH ENGINE V3 — Motor de Health Check

## 1. Objetivo

Centralizar, padronizar e automatizar todas as verificações de saúde
do ecossistema Cell City. O Health Engine é o orquestrador que coordena
verificadores, agrega resultados e produz um health score consolidado.

## 2. Arquitetura

```
scripts/health-engine/
├── engine.sh                 # Orquestrador principal
├── VERSION                   # Versão semver
├── README.md                 # Documentação
├── core/
│   ├── orchestrator.sh       # Coordena execução dos checks
│   ├── scheduler.sh          # Agendamento (cron-like)
│   └── reporter.sh           # Geração de relatórios
├── checkers/                 # Verificadores individuais
│   ├── git.sh                # Git health
│   ├── workspace.sh          # Workspace health
│   ├── build.sh              # Build health
│   ├── node.sh               # Node.js health
│   ├── npm.sh                # NPM health
│   ├── firebase.sh           # Firebase health
│   ├── firestore.sh          # Firestore health
│   ├── rules.sh              # Rules health
│   ├── indexes.sh            # Indexes health
│   ├── functions.sh          # Cloud Functions health
│   ├── rbac.sh               # RBAC health
│   ├── repositories.sh       # Repository layer health
│   ├── services.sh           # Services health
│   ├── shared.sh             # Shared modules health
│   ├── modules.sh            # CRM modules health
│   ├── dashboard.sh          # Dashboard health
│   ├── portal.sh             # Portal health
│   ├── central-modulos.sh    # Central de Módulos health
│   ├── control-center.sh     # Control Center health
│   ├── service-worker.sh     # Service Worker health
│   ├── backup.sh             # Backup health
│   └── logs.sh               # Logs health
├── lib/                      # Shared libraries
│   ├── utils.sh              # Utilitários
│   ├── score.sh              # Cálculo de health score
│   ├── compare.sh            # Comparação entre execuções
│   └── format.sh             # Formatação de saída
└── state/                    # Estado das verificações
    ├── health-check.json     # Último resultado completo
    └── health-history/       # Histórico de execuções
```

## 3. Fluxo do Health Engine

```
Início (manual ou agendado)
    │
    ▼
[Orquestrador] → Lê config → Define quais checkers executar
    │
    ▼
[Execução Paralela] → Cada checker roda independentemente
    │
    ├── git.sh          → status, branch, commits
    ├── workspace.sh    → arquivos, estrutura
    ├── build.sh        → validação de build
    ├── node.sh         → versão, módulos
    ├── npm.sh          → dependências, audit
    ├── firebase.sh     → conectividade
    ├── firestore.sh    → regras, índices
    ├── functions.sh    → deploy, erros
    ├── rbac.sh         → permissões, integridade
    ├── modules.sh      → estrutura módulos
    └── ...             → demais checkers
    │
    ▼
[Aggregation] → Reúne resultados de todos os checkers
    │
    ▼
[Score] → Calcula health score (0-100)
    │
    ▼
[Report] → Gera relatório completo
    │
    ▼
[State] → Salva em state/health-check.json
    │
    ▼
[Alert] → Se score < limiar, dispara alerta
```

## 4. Formato de Saída do Checker

Cada checker retorna um JSON com:

```json
{
  "checker": "git",
  "status": "pass",           // pass | fail | warn | error
  "score": 95,                // 0-100
  "timestamp": "2026-07-13T12:00:00-03:00",
  "details": {
    "branch": "develop",
    "commits_ahead": 0,
    "workspace_clean": true,
    "last_commit": "abc123"
  },
  "issues": [
    {
      "severity": "warn",
      "message": "Branch local 3 commits ahead of origin"
    }
  ]
}
```

## 5. Health Score Calculation

O health score é calculado por média ponderada dos checkers:

| Checker | Peso | Impacto |
|---|---|---|
| git | 5 | Baixo |
| workspace | 10 | Médio |
| build | 20 | Alto |
| node | 10 | Médio |
| npm | 10 | Médio |
| firebase | 20 | Alto |
| firestore | 15 | Alto |
| functions | 15 | Alto |
| rbac | 5 | Baixo |
| modules | 5 | Baixo |

Score = Σ(peso × score_checker) / Σ(peso)

Níveis:
- 90-100: 🟢 Saudável
- 70-89: 🟡 Atenção
- 50-69: 🟠 Crítico
- 0-49: 🔴 Ruim

## 6. Verificações por Checker

### git.sh
- Repositório Git existe
- Branch reconhecida (develop/main)
- Workspace limpo (sem modificações não staged)
- Commits ahead/behind origin
- Último commit recente (< 7 dias)
- Tags de release existem

### workspace.sh
- Diretórios obrigatórios existem
- Arquivos críticos presentes
- Permissões de arquivo corretas
- Simlinks válidos

### build.sh
- HTML válido (módulos)
- CSS válido
- JS sem erros de sintaxe
- ES modules importáveis

### node.sh
- Node.js instalado
- Versão compatível (≥18)
- node_modules integro

### npm.sh
- package.json válido
- Dependências instaladas
- npm audit (vulnerabilidades)
- Versões consistentes

### firebase.sh
- Firebase CLI instalado
- Login ativo
- Projeto acessível (dev/prod)
- firebase.json válido

### firestore.sh
- Rules compilam
- Indexes válidos
- Regras implantadas correspondem ao arquivo local
- Nenhuma regra com allow true não documentada

### functions.sh
- Cloud Functions implantadas
- Nenhum erro recente nos logs
- Runtime configurado (nodejs20)

### rbac.sh
- Perfis operacionais existem
- Matriz de permissões íntegra
- Usuários com perfil válido

### repositories.sh
- Todos os repositórios importáveis
- Factory genérica funcional
- Métodos CRUD respondem

## 7. State Schema

Arquivo: `state/health-check.json`

```json
{
  "descricao": "Health Check - Completo",
  "versao": "3.0.0",
  "timestamp": "2026-07-13T12:00:00-03:00",
  "status": "concluido",
  "score": {
    "geral": 92,
    "categorias": {
      "git": 95,
      "workspace": 100,
      "build": 85,
      "node": 90,
      "npm": 88,
      "firebase": 95,
      "firestore": 92,
      "functions": 90,
      "rbac": 100,
      "modules": 95
    }
  },
  "alertas": [
    {
      "severidade": "warn",
      "checker": "build",
      "mensagem": "3 módulos com avisos de lint"
    }
  ],
  "execucao": {
    "tipo": "completo",
    "duracao_ms": 4523,
    "checkers_executados": 11,
    "checkers_falhos": 0
  }
}
```

## 8. Modos de Execução

| Modo | Comando | O que verifica |
|---|---|---|
| Rápido | `engine.sh --quick` | Git, Node, Workspace |
| Padrão | `engine.sh` | Todos os checkers |
| Completo | `engine.sh --full` | Todos + histórico + comparação |
| Categoria | `engine.sh --category git` | Apenas uma categoria |
| Checker | `engine.sh --checker git.sh` | Apenas um checker |

## 9. Integração com Control Center

O Health Engine é carregado como plugin do Control Center via
`lib/plugin-loader.sh`. Manifesto:

```
health-engine|health-engine|Health Engine V3|3
```

Adiciona ao menu:
- Executar Health Check completo
- Executar Health Check rápido
- Verificar componente específico
- Histórico de verificações
- Relatório de saúde
- Configurar alertas
