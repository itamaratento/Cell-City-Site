# CELL CITY V3 — NOC Architecture

Documentacao oficial da arquitetura V3 do Cell City Control Center.
Codename: **NOC** (Network Operations Center).
Fase 1: **Dashboard Operacional** — concluida.

## Objetivo

A V3 transforma o Control Center em um verdadeiro **Centro de Operacoes**
capaz de monitorar, diagnosticar, automatizar e controlar todo o
ecossistema Cell City.

## Status da Fase 1 (Dashboard Operacional)

| Componente | Status |
|-----------|--------|
| Data Collectors (9 coletores) | Concluido |
| Health Score Engine (10 componentes) | Concluido |
| NOC Dashboard (20 indicadores) | Concluido |
| Painel de Alertas | Concluido |
| Painel de Missoes | Concluido |
| Navegacao por Teclado | Concluido |
| Auto-refresh Configuravel | Concluido |
| Compatibilidade V1/V2 | Concluida |
| Test Suite (71 testes) | 71/71 passando (pós-auditoria 2026-07-13) |

## Estrutura de Diretorios

```
scripts/control-center/v3/
├── VERSION                    # 3.0.0
├── noc.sh                     # Entry point do NOC
├── cellcity.sh                # CLI wrapper
├── core/                      # Nucleo da arquitetura
│   ├── kernel.sh              # Orquestrador principal
│   ├── event-bus.sh           # Barramento pub/sub (30 eventos)
│   ├── registry.sh            # Registro de componentes
│   ├── loader.sh              # Carregador desacoplado
│   └── plugin.sh              # Sistema de plugins (5 hooks)
├── services/                  # Camada de servicos
│   ├── base.sh                # Base do sistema de servicos
│   ├── collectors.sh          # Coletores de dados reais (9)
│   └── health-score.sh        # Motor de health score
├── panels/                    # Paineis
│   ├── base.sh                # Base do sistema de paineis
│   └── noc-dashboard.sh       # Dashboard completo (Fase 1)
├── widgets/                   # Widgets
│   └── base.sh                # Base do sistema de widgets
├── shared/                    # Codigo compartilhado
│   ├── constants.sh           # Constantes
│   ├── utils.sh               # Utilitarios
│   └── types.sh               # Tipos de dados
├── cache/engine.sh            # Cache TTL com persistencia
├── logs/logger.sh             # Logger estruturado (5 niveis)
├── config/                    # Configuracao
│   ├── v3.conf                # Config principal
│   └── v3-modules.conf        # Manifesto de modulos
├── state/                     # Estado persistente
├── plugins/                   # Plugins V3 (criado sob demanda)
└── docs/                      # Documentacao
```

## Data Collectors (9 coletores)

| Coletor | Dados |
|---------|-------|
| git | Branch, commit, workspace status, ahead/behind, ultima tag |
| system | CPU, RAM, disco, uptime |
| firebase | Project ID, Firestore, Functions, Rules, colecoes |
| backup | Quantidade, ultimo backup, tamanho, config automatico |
| release | Ultima tag, data, total releases, deploy status |
| crm | Modulos, paginas |
| security | RBAC, testes RBAC |
| modules | Modulos do Control Center |
| site | Status do index.html |

## Health Score

10 componentes com pesos iguais (10 cada):
- git, system, firebase, backup, release, crm, security, modules, site, workspace

Faixas: EXCELENTE (95-100), BOM (80-94), ATENCAO (60-79), CRITICO (0-59)

## Navegacao

| Tecla | Acao |
|-------|------|
| ENTER / r | Atualizar dashboard |
| D | Modulo Desenvolvimento |
| R | Modulo Release |
| M | Modulo Banco de Dados |
| B | Modulo Backups |
| G | Modulo Git/Branches |
| H | Health Check rapido |
| A | Painel de Alertas |
| N | Painel de Missoes |
| . | Menu V1 classico |
| Q | Sair do NOC |
| 1/2/3/0 | Configurar refresh (5/10/30/manual) |

## Compatibilidade V1/V2

- Núcleo V1/V2 (core/menu.sh, lib/) intocado; integração V3 alterou 11 arquivos
  de motores/módulos existentes (release-center, observability, generator,
  execution-engine, auto-report, restore-backup, validacao, integrity, sync,
  comandos) + 1 linha em modules.conf — ver TECHDOC/relatório da auditoria
- `cellcity` detecta V3 automaticamente com fallback V1
- `cellcity-v1` acessa o menu classico diretamente
- Todos os 10 modulos V1 + scripts passam validacao de sintaxe
