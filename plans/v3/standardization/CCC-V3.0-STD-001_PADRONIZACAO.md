```
======================================================================
CELL CITY CRM
VERSÃO 3.0 — PADRONIZAÇÃO

DOCUMENTO CCC-V3.0-STD-001
PADRONIZAÇÃO ARQUITETURAL V3
======================================================================
```

# PADRONIZAÇÃO V3 — Revisão e Padronização Arquitetural

## 1. Objetivo

Revisar a arquitetura, eliminar inconsistências e padronizar nomes,
diretórios, estrutura e documentação entre V2 e V3, sem alterar
regras de negócio.

## 2. Convenções de Nomenclatura

### 2.1 Diretórios

| Padrão | Exemplo V2 | Exemplo V3 |
|---|---|---|
| Scripts: `scripts/<componente>/` | `scripts/control-center/` | `scripts/health-engine/` |
| Planos: `plans/v<versao>/` | `plans/CCC-V2.0-ARCH-001*` | `plans/v3/architecture/` |
| Docs: `plans/v<versao>/<area>/` | — | `plans/v3/health-engine/` |
| Estado: `<componente>/state/` | `state/health-check.json` | `health-engine/state/` |
| Logs: `logs/` | `scripts/control-center/logs/` | `logs/` (raiz por componente) |

### 2.2 Arquivos

| Tipo | Padrão | Exemplo |
|---|---|---|
| Documento arquitetural | `CCC-V3.0-<SIGLA>-<NUM>-<NOME>.md` | `CCC-V3.0-HE-001_HEALTH_ENGINE.md` |
| Script principal | `<nome>.sh` | `engine.sh` |
| Biblioteca | `<nome>.sh` | `utils.sh` |
| Configuração | `<nome>.conf` | `thresholds.conf` |
| Estado | `<nome>.json` | `health-check.json` |

### 2.3 Variáveis

```bash
# Variáveis de ambiente V3
CC_V3_ROOT="${CC_ROOT}/.."           # Raiz da V3
CC_V3_HEALTH="${CC_V3_ROOT}/scripts/health-engine"
CC_V3_MONITOR="${CC_V3_ROOT}/scripts/monitoring"
CC_V3_DIAG="${CC_V3_ROOT}/scripts/diagnostic-engine"
CC_V3_PANEL="${CC_V3_ROOT}/scripts/smart-panel"
CC_V3_PROMPT="${CC_V3_ROOT}/scripts/prompt-generator"
CC_V3_OBSERV="${CC_V3_ROOT}/scripts/observability"
CC_V3_AUTOM="${CC_V3_ROOT}/scripts/automations"
CC_V3_CENTRAL="${CC_V3_ROOT}/scripts/central-modulos-v3"
CC_V3_STATE="${CC_V3_ROOT}/plans/v3/state"
CC_V3_LOGS="${CC_V3_ROOT}/logs"
```

### 2.4 Funções

```bash
# Prefixo: _cc_v3_<componente>_<ação>
_cc_v3_health_executar       # Health Engine
_cc_v3_monitor_evento        # Monitoring
_cc_v3_diag_executar         # Diagnostic Engine
_cc_v3_panel_renderizar      # Smart Panel
_cc_v3_prompt_gerar          # Prompt Generator
_cc_v3_obs_coletar           # Observability
_cc_v3_autom_executar        # Automations
_cc_v3_central_status        # Central de Módulos V3
```

## 3. Padronização de Estrutura

### 3.1 Estrutura de Componente V3

Cada componente V3 segue o mesmo padrão:

```
scripts/<componente>/
├── <componente>.sh       # Orquestrador principal
├── VERSION               # Versão semver
├── README.md             # Documentação
├── core/                 # Núcleo (orquestração, lógica principal)
├── lib/                  # Bibliotecas compartilhadas
├── config/               # Configurações (se aplicável)
└── state/                # Estado (se aplicável)
```

### 3.2 Estrutura de Documento V3

```
plans/v3/
├── architecture/         # Arquitetura geral (ARCH)
├── health-engine/        # Health Engine (HE)
├── monitoring/           # Monitoramento (MON)
├── smart-dashboard/      # Painel Inteligente (SD)
├── diagnostic-engine/    # Motor de Diagnóstico (DE)
├── prompt-generator/     # Gerador de Prompts (PG)
├── central-modules/      # Central de Módulos V3 (CM)
├── observability/        # Observabilidade (OBS)
├── automations/          # Automações (AUT)
├── standardization/      # Padronização (STD)
├── validation/           # Validação (VAL)
└── state/                # Estado compartilhado
```

## 4. Consistências Identificadas e Corrigidas

### 4.1 V2 → V3

| Inconsistência V2 | Correção V3 |
|---|---|
| `state/` na raiz do Control Center | V3 usa `state/` dentro de cada componente |
| Logs espalhados (`control-center/logs/`, `_reports/`) | V3 centraliza em `logs/` com subarquivos por componente |
| Documentos de plano na raiz `plans/` sem versão | V3 organiza em `plans/v3/<area>/` |
| Nomes de módulo misturados (português/inglês) | V3 padroniza em inglês técnico |
| Falta de VERSION em componentes | Todo componente V3 tem VERSION |
| Schemas state com campos null | V3 preenche dados reais |

### 4.2 Padrão de Versionamento

| Componente | Versão Atual | Esquema |
|---|---|---|
| Control Center | 1.0.0 | Semver |
| Health Engine | 3.0.0 (planejado) | Semver |
| Diagnostic Engine | 3.0.0 (planejado) | Semver |
| Monitoring | 3.0.0 (planejado) | Semver |
| Smart Panel | 3.0.0 (planejado) | Semver |
| Prompt Generator | 3.0.0 (planejado) | Semver |
| Observability | 3.0.0 (planejado) | Semver |
| Automations | 3.0.0 (planejado) | Semver |
| Central Modules V3 | 3.0.0 (planejado) | Semver |

### 4.3 Comportamento de Erro Padrão

```bash
# Todo script V3 deve:
set -uo pipefail  # Modo estrito

# Verificar dependências no início
if ! command -v <ferramenta> &>/dev/null; then
  echo "Erro: <ferramenta> não encontrada"
  exit 1
fi

# Usar funções de logging padronizadas
_cc_v3_log "info" "Componente" "Mensagem"
_cc_v3_log "error" "Componente" "Erro ocorrido"
```

## 5. Documentação Padrão

### 5.1 Template de README.md

```markdown
# <Nome do Componente> V3

## Objetivo
<descrição>

## Arquitetura
```
<diagrama textual>
```

## Dependências
- <dependência 1>
- <dependência 2>

## Uso
```bash
<comando de exemplo>
```

## Integração com Control Center
<como é carregado>

## State
<schemas de state>
```

### 5.2 Template de VERSION

```
X.Y.Z
```

Onde:
- X: Major (incompatibilidade arquitetural)
- Y: Minor (nova funcionalidade compatível)
- Z: Patch (correção compatível)
