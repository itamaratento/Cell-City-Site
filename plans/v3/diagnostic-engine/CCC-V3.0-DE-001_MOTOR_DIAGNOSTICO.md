```
======================================================================
CELL CITY CRM
VERSÃO 3.0 — MOTOR DE DIAGNÓSTICO

DOCUMENTO CCC-V3.0-DE-001
ARQUITETURA DO MOTOR DE DIAGNÓSTICO V3
======================================================================
```

# MOTOR DE DIAGNÓSTICO V3 — Diagnostic Engine

## 1. Objetivo

Diagnosticar automaticamente problemas no ecossistema Cell City,
substituindo verificações manuais por análise estruturada e comparável
entre execuções.

## 2. Arquitetura

```
scripts/diagnostic-engine/
├── engine.sh                   # Orquestrador principal
├── VERSION
├── README.md
├── core/
│   ├── auto-diagnostic.sh      # Diagnóstico automático
│   ├── manual-diagnostic.sh    # Diagnóstico manual
│   ├── quick-diagnostic.sh     # Diagnóstico rápido
│   ├── deep-diagnostic.sh      # Diagnóstico profundo
│   └── comparator.sh           # Comparação entre execuções
├── analyzers/                  # Analisadores específicos
│   ├── system-analyzer.sh      # Análise de sistema
│   ├── git-analyzer.sh         # Análise de git
│   ├── build-analyzer.sh       # Análise de build
│   ├── dependency-analyzer.sh  # Análise de dependências
│   ├── firebase-analyzer.sh    # Análise de Firebase
│   ├── rules-analyzer.sh       # Análise de Rules
│   ├── performance-analyzer.sh # Análise de performance
│   ├── security-analyzer.sh    # Análise de segurança
│   └── integrity-analyzer.sh   # Análise de integridade
├── lib/
│   ├── utils.sh                # Utilitários
│   ├── findings.sh             # Gerenciamento de achados
│   ├── report.sh               # Geração de relatórios
│   └── format.sh               # Formatação
└── state/
    ├── last-diagnostic.json    # Último diagnóstico
    └── diagnostic-history/     # Histórico de diagnósticos
```

## 3. Tipos de Diagnóstico

### 3.1 Diagnóstico Automático
- Executado por scheduler (cron)
- Verifica alterações desde o último diagnóstico
- Escopo: todos os analisadores
- Agendamento: diário ou a cada health check

### 3.2 Diagnóstico Manual
- Executado sob demanda pelo usuário
- Escopo completo ou por categoria
- Parâmetros: `--category git`, `--depth full`

### 3.3 Diagnóstico Rápido
- Verificação superficial (5-10 segundos)
- Apenas: git status, workspace, Node, estrutura
- Usado para validação rápida antes de operações

### 3.4 Diagnóstico Profundo
- Verificação exaustiva (minutos)
- Todos os analisadores em profundidade
- Inclui: comparação com histórico, tendências
- Gera relatório completo

## 4. Fluxo do Diagnóstico

```
Início do Diagnóstico
    │
    ▼
[Selecionar Tipo] → auto | manual | quick | deep
    │
    ▼
[Coletar Dados] → Observability + Health Engine + analisadores
    │
    ├── Sistema: CPU, memória, disco, uptime
    ├── Git: branch, commits, workspace, tags
    ├── Build: HTML, CSS, JS, ES modules
    ├── Dependências: package.json, node_modules
    ├── Firebase: CLI, login, projeto, rules
    ├── Performance: tempo de build, load time
    ├── Segurança: RBAC, Rules, vulnerabilidades
    └── Integridade: estrutura, referências, coleções
    │
    ▼
[Analisar] → Cada analyzer produz findings
    │
    ▼
[Aggregate] → Reúne findings, classifica por severidade
    │
    ▼
[Comparar] → Com último diagnóstico (se disponível)
    │
    ▼
[Relatório] → Gera relatório estruturado
    │
    ▼
[Salvar] → state/last-diagnostic.json
```

## 5. Formato dos Findings

```json
{
  "diagnostic_id": "diag_20260713_001",
  "tipo": "completo",
  "timestamp": "2026-07-13T12:00:00-03:00",
  "duracao_ms": 15234,
  "analyzers_executados": 9,
  "total_findings": 15,
  "findings": [
    {
      "id": "f-001",
      "analyzer": "git",
      "tipo": "warning",
      "severidade": "low",
      "categoria": "manutencao",
      "mensagem": "Branch local 3 commits ahead of origin",
      "detalhes": {
        "branch": "develop",
        "ahead": 3,
        "behind": 0
      },
      "sugestao": "git push origin develop",
      "primeira_ocorrencia": "2026-07-10",
      "ocorrencias": 3
    },
    {
      "id": "f-002",
      "analyzer": "build",
      "tipo": "error",
      "severidade": "high",
      "categoria": "integracao",
      "mensagem": "Módulo chat/ não compila",
      "detalhes": {
        "modulo": "chat",
        "erro": "import não resolvido"
      },
      "sugestao": "Verificar dependências do módulo chat",
      "primeira_ocorrencia": "2026-07-13",
      "ocorrencias": 1
    }
  ],
  "comparacao": {
    "anterior_id": "diag_20260712_001",
    "findings_novos": 1,
    "findings_resolvidos": 3,
    "findings_persistentes": 12,
    "tendencia": "melhorou"
  }
}
```

## 6. Comparação Entre Execuções

O comparator.sh compara dois diagnósticos e identifica:

| Indicador | Descrição |
|---|---|
| Findings novos | Apareceram desde o último diagnóstico |
| Findings resolvidos | Não aparecem mais |
| Findings persistentes | Continuam presentes |
| Tendência | melhorou | piorou | estável |
| Score delta | Diferença de health score |

## 7. Gatilhos de Diagnóstico

| Gatilho | Tipo | Quando |
|---|---|---|
| Manual | Manual | Usuário executa `diagnostic-engine/engine.sh` |
| Pós-commit | Automático | Após `git commit` |
| Pré-release | Automático | Antes de criar tag |
| Schedule | Automático | Diário (cron) |
| Health baixo | Automático | Quando health score < 70 |
| Erro de build | Automático | Quando build falha |

## 8. Relatório de Diagnóstico

O relatório final contém:

```
═══════════════════════════════════════════════════════
 DIAGNÓSTICO V3 — 2026-07-13 12:00
═══════════════════════════════════════════════════════

 Tipo: Completo | Duração: 15.2s | Analyzers: 9

 RESUMO:
 ✅ 12/15 findings conhecidos
 🆕 1 finding novo
 ✅ 3 findings resolvidos

 FINDINGS POR SEVERIDADE:
 🔴 Críticos:  0
 🟠 Altos:     1 (build: módulo chat)
 🟡 Médios:    3
 🔵 Baixos:    11

 TENDÊNCIA: 📈 Melhorou (3 resolvidos, 1 novo)

 RECOMENDAÇÕES:
 1. Corrigir módulo chat/ (build quebrado)
 2. Executar git push (3 commits ahead)
═══════════════════════════════════════════════════════
```
