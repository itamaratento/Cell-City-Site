```
======================================================================
CELL CITY CRM
VERSÃO 3.0 — FUNDAÇÃO

DOCUMENTO CCC-V3.0-ARCH-001
ARQUITETURA OFICIAL DO SISTEMA V3.0

IA RESPONSÁVEL: DeepSeek R1
FUNÇÃO: Arquiteto Principal
DATA: 2026-07-13

PRECEDIDO POR:
- plans/CCC-V2.0-ARCH-001_ARQUITETURA_OFICIAL.md (V2.0)
- scripts/control-center/README.md (Control Center v1.0)
- CRM/TECHDOC.md (Documentação Técnica V2)
======================================================================
```

# CELL CITY CRM — ARQUITETURA V3.0 (Fundação)

## 1. Visão Geral da Arquitetura V3

A V3 é uma camada de **inteligência, automação e observabilidade** que
envolve a V2 sem substituí-la. Nenhuma funcionalidade existente é
alterada. A V3 adiciona:

```
+---------------------------------------------------------------+
|                     CELL CITY V3.0                            |
|    (Inteligência, Automação, Observabilidade)                 |
|                                                               |
|  +------------------+  +------------------+                   |
|  |   Smart Panel    |  |  Prompt Generator|                   |
|  |   (Painel Intel.)|  |  (Gerador Prompt)|                   |
|  +--------+---------+  +--------+---------+                   |
|           |                     |                              |
|  +--------+---------------------+--------+                    |
|  |           Health Engine              |                     |
|  |    (Motor de Health Check V3)        |                     |
|  +--------+---------------------+--------+                    |
|           |                     |                              |
|  +--------+---------+  +--------+---------+                   |
|  | Diagnostic Engine|  |  Observability   |                  |
|  | (Diagnóstico V3) |  | (Telemetria/Mét.)|                  |
|  +--------+---------+  +--------+---------+                   |
|           |                     |                              |
|  +--------+---------------------+--------+                    |
|  |         Automations Engine          |                     |
|  |   (Auditoria, Backup, Relatórios)   |                     |
|  +--------+---------------------+--------+                    |
|           |                     |                              |
+-----------|---------------------|---------------------------+
            |                     |
+-----------v---------------------v---------------------------+
|               CELL CITY V2.0 (inalterado)                   |
|  CRM (pages/, shared/, repos/) | Control Center (scripts/)  |
|  Firebase (Auth, Firestore, Functions, Storage)              |
|  GitHub Pages (main, develop)                                |
+-------------------------------------------------------------+
```

## 2. Camadas da V3

### 2.1 Camada de Observabilidade (Bloco 8)
Responsável por coletar dados brutos do sistema:
- Logs estruturados
- Métricas de performance (build, teste, response time)
- Telemetria de uso (módulos, operações)
- Estatísticas de ambiente (memória, CPU, disco)

### 2.2 Camada de Diagnóstico (Bloco 5)
Analisa os dados da observabilidade e executa verificações:
- Diagnóstico automático (schedule)
- Diagnóstico manual (sob demanda)
- Diagnóstico rápido (superficial)
- Diagnóstico profundo (completo)
- Comparação entre execuções

### 2.3 Camada de Health (Bloco 2)
Interpreta os diagnósticos e produz um health score:
- Verificações de todos os componentes do ecossistema
- State tracking (última execução, status)
- Alertas por componente

### 2.4 Camada de Monitoramento (Bloco 3)
Gerencia eventos e alertas com:
- Níveis de severidade (critical, high, medium, low, info)
- Prioridades (P0-P4)
- Histórico de eventos
- Notificações

### 2.5 Camada de Automação (Bloco 9)
Executa ações programadas ou sob demanda:
- Auditoria automática
- Health automático
- Backup automático
- Limpeza automática
- Relatórios automáticos

### 2.6 Camada de Interface (Bloco 4 + Bloco 7)
Apresenta os dados consolidados:
- Smart Panel (Painel Inteligente)
- Central de Módulos V3
- Widgets e indicadores

### 2.7 Camada de Integração com IA (Bloco 6)
Gera prompts técnicos para IA automaticamente:
- Contexto completo do projeto
- Logs, erros, stack traces
- Estado do sistema
- Restrições e objetivos

## 3. Componentes da V3

| Componente | Localização | Função |
|---|---|---|
| Health Engine | `scripts/health-engine/` | Orquestrador de health checks |
| Diagnostic Engine | `scripts/diagnostic-engine/` | Motor de diagnóstico V3 |
| Monitoring | `scripts/monitoring/` | Sistema de monitoramento |
| Smart Panel | `scripts/smart-panel/` | Painel inteligente |
| Prompt Generator | `scripts/prompt-generator/` | Gerador de prompts para IA |
| Observability | `scripts/observability/` | Observabilidade (logs, métricas) |
| Automations | `scripts/automations/` | Automações programadas |
| Central Modules V3 | `scripts/central-modulos-v3/` | Integração V3 da Central |
| Execution Engine | `scripts/execution-engine/` | Execução de missões com checkpoint/retomada |
| Integration | `scripts/integration/` | Encadeamento entre engines (health→monitor→panel) |

## 4. Fluxo de Dados da V3

```
Coleta (Observability)
    │
    ▼
Armazenamento (state/*.json + logs/*.log)
    │
    ▼
Diagnóstico (Diagnostic Engine)
    │
    ├─► Health Score (Health Engine)
    │       │
    │       ▼
    │   Monitoramento (Eventos + Alertas)
    │       │
    │       ▼
    │   Smart Panel (Widgets + Cards)
    │
    ├─► Automações (se condição for atendida)
    │       │
    │       ▼
    │   Ação (backup, limpeza, relatório)
    │
    ├─► Prompt Generator (se solicitado)
    │       │
    │       ▼
    │   Prompt Técnico para IA
    │
    └─► Central de Módulos V3 (status consolidado)
```

## 5. Integrações com V2

### 5.1 Control Center (scripts/control-center/)
- V3 adiciona novos módulos no menu do Control Center
- Plugin Loader existente (`lib/plugin-loader.sh`) carrega plugins V3
- Compatível com o Manifesto (`config/modules.conf`)

### 5.2 CRM (CRM/)
- V3 não altera nenhum arquivo do CRM
- Smart Panel é acessível via Control Center, não via navegador
- Dados do CRM são lidos (read-only) para health checks

### 5.3 Firestore/Firebase
- NENHUMA alteração em Firestore, Rules, Indexes, Functions
- V3 só lê estado de arquivos locais (state/, logs/)
- Health checks usam `gcloud` e Firebase CLI, nunca Admin SDK

### 5.4 State Files (state/)
- V2 já possui state schema (`health-check.json`, `release.json`, etc.)
- V3 expande o schema e começa a escrever dados reais
- Compatível com formato existente (campos `timestamp`, `status`)

## 6. Dependências

| Dependência | Uso na V3 |
|---|---|
| Node.js ≥18 | Scripts de diagnóstico e monitoramento |
| Firebase CLI | Health checks de Firestore |
| gcloud | Health checks de ambiente |
| Git | Health checks de repositório |
| Bash | Shell scripts (padrão do Control Center) |
| Python (opcional) | Relatórios avançados |

Nenhuma nova dependência externa é introduzida. Tudo usa ferramentas já
presentes no projeto ou disponíveis no ambiente Ubuntu.

## 7. Registro de Decisões Arquiteturais (ADR)

### ADR-001: V3 como overlay da V2
Decisão: V3 não modifica V2. É uma camada adicional.
Justificativa: V2 está estável e homologada. Alterar V2 para V3
introduziria risco de regressão sem necessidade.

### ADR-002: Tudo em arquivos locais (sem banco)
Decisão: V3 persiste estado em JSON local, logs em arquivos de texto.
Justificativa: Zero alteração em Firestore. Dados de health/diagnóstico
não precisam de replicação multi-usuário.

### ADR-003: Shell como linguagem principal
Decisão: Manter Bash como linguagem padrão da V3, como no Control Center.
Justificativa: Consistência com V2, zero dependência de runtime.

### ADR-004: Plugin Loader para extensibilidade
Decisão: Todo componente V3 é um plugin carregável pelo Control Center.
Justificativa: O Plugin Loader já existe `lib/plugin-loader.sh`.

### ADR-005: Smart Panel não é interface web
Decisão: Smart Panel é um TUI (Terminal UI) como o Control Center.
Justificativa: Evita criar interface web duplicada. Futuramente pode
ter versão web, mas não agora.

### ADR-006: Diagnóstico separado do Health Check
Decisão: Diagnostic Engine coleta/analisa; Health Engine interpreta.
Justificativa: Separação de responsabilidades. Diagnóstico é bruto;
Health é curado.

## 8. Roadmap Técnico V3

| Fase | Descrição | Depende de |
|---|---|---|
| V3-F1 | Fundação (esta missão) | V2 homologada |
| V3-F2 | Health Engine operacional | V3-F1 |
| V3-F3 | Diagnostic Engine operacional | V3-F2 |
| V3-F4 | Monitoring operacional | V3-F3 |
| V3-F5 | Smart Panel (widgets) | V3-F4 |
| V3-F6 | Prompt Generator operacional | V3-F5 |
| V3-F7 | Automations operacional | V3-F6 |
| V3-F8 | Observabilidade completa | V3-F7 |
| V3-F9 | Central de Módulos V3 | V3-F8 |
| V3-F10 | Integração Total | V3-F9 |
| V3-F11 | Homologação e Certificação | V3-F10 |
| V3-F12 | Release V3.0 | V3-F11 |

## 9. Critérios de Encerramento da Fundação

- [x] Arquitetura documentada
- [x] Estrutura de diretórios criada
- [x] Health Engine: core e verificadores esboçados (3 checkers reais; 19 restantes = V3-F2)
- [x] Monitoring: eventos, alertas, níveis definidos
- [x] Smart Panel: estrutura de widgets/cards definida
- [x] Diagnostic Engine: tipos de diagnóstico definidos
- [x] Prompt Generator: formato e arquitetura definidos
- [x] Central de Módulos V3: integração projetada
- [x] Observabilidade: logs, métricas, telemetria definidos
- [x] Automations: esboço das automações
- [x] Padronização: nomenclatura e estrutura revisadas (integration/ normalizado na revisão)
- [x] Documentação atualizada (TECHDOC §35, MASTER_ROADMAP, PROXIMA_ETAPA)
- [x] Validação: compatibilidade V2 confirmada (suítes 457/457, zero arquivos da V2 alterados pela V3)

## 10. Revisão Técnica da Fundação (2026-07-13)

Revisão independente (Claude): fundação **homologada com correções** —
5 fixes de baixo risco aplicados (timestamps -03:00 fixo → %:z; JSON
inválido em observability/metrics e central-modulos-v3; `--category`
ignorando argumento; VERSION do integration). Detalhes: `CRM/TECHDOC.md`
§35. Esta tabela de componentes foi completada com Execution Engine e
Integration, ausentes na versão original do documento.
