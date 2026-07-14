# CELL CITY V3 — NOC Architecture Document

Documento: **CCC-V3.0-ARCH-002**  
Versão: **3.0.0**  
Codinome: **NOC** (Network Operations Center)  
Data: **2026-07-13**  
IA Responsável: **DeepSeek**  

## 1. Visão Geral

A V3 é uma **rearquitetura completa** do Cell City Control Center. Deixa de ser
um conjunto de menus para se tornar um verdadeiro **Network Operations Center**.

A arquitetura segue o padrão de **microkernel + plugins**:
- O **Kernel** é mínimo e só orquestra subsistemas
- **Componentes** são descobertos e registrados dinamicamente
- **Comunicação** é exclusivamente via Event Bus (pub/sub)
- **Extensibilidade** é via Plugins com hooks de ciclo de vida

## 2. Camadas da Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    INTERFACE LAYER                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Panels  │  │ Widgets  │  │  Menus   │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
├───────┴──────────────┴──────────────┴────────────────────┤
│                    SERVICE LAYER                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Services │  │  Cache   │  │  Logger  │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
├───────┴──────────────┴──────────────┴────────────────────┤
│                     CORE LAYER                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Kernel  │  │Event Bus │  │ Registry │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
│  ┌────┴──────────────┴──────────────┴────┐              │
│  │         Loader + Plugins               │              │
│  └────────────────────────────────────────┘              │
├─────────────────────────────────────────────────────────┤
│                    ENGINE LAYER                          │
│  ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Health │ │Exec    │ │Diagnostic│ │Automation│ ...    │
│  └────────┘ └────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────┘
```

## 3. Componentes

### 3.1 Kernel (`core/kernel.sh`)
Orquestrador principal. Inicializa todos os subsistemas na ordem correta:
Logger → Cache → Event Bus → Registry → Loader → Plugin System

### 3.2 Event Bus (`core/event-bus.sh`)
Sistema pub/sub com:
- 30+ eventos padrão definidos
- Suporte a handlers síncronos e assíncronos
- Histórico persistente em JSON
- Envelope padrão (source, type, priority, timestamp, data)

### 3.3 Registry (`core/registry.sh`)
Registro central com:
- Descoberta automática de engines, widgets, panels, services
- Verificação de duplicatas
- Estado persistente em JSON

### 3.4 Loader (`core/loader.sh`)
Carregador com:
- Resolução de dependências (carrega deps antes do componente)
- Ordem de prioridade: engines → services → widgets → panels
- Rastreamento de estado (loaded/failed)

### 3.5 Plugin System (`core/plugin.sh`)
Sistema de plugins com:
- 5 hooks de ciclo de vida: on_install, on_load, on_activate, on_deactivate, on_uninstall
- Compatibilidade com plugins V1 legados
- Descoberta automática

### 3.6 Widget System (`widgets/base.sh`)
Sistema de widgets com:
- Interface padrão: register(), refresh(), render(), get_data()
- Detecção de staleness (dados vencidos)
- Cards (widget compacto com título + valor + status)

### 3.7 Panel System (`panels/base.sh`)
Sistema de painéis com:
- Layouts: grid, stacked, single
- Loop interativo com comandos rápidos
- Navegação entre painéis e menu V1

### 3.8 Services Layer (`services/base.sh`)
Camada de abstração para:
- Registro de serviços com init/shutdown hooks
- Chamadas de método por nome (`_v3_svc_<service>_<method>`)
- Health check individual por serviço

### 3.9 Cache (`cache/engine.sh`)
Cache com:
- TTL por entrada
- Hit/miss tracking
- Persistência/restauração em disco
- Invalidação por padrão

### 3.10 Logger (`logs/logger.sh`)
Logger com:
- 5 níveis: debug, info, warn, error, critical
- Rotação automática (>10MB)
- Busca textual
- Estatísticas de uso

## 4. Eventos Padrão

| Evento | Descrição |
|--------|-----------|
| `system.boot` | Boot do kernel concluído |
| `system.shutdown` | Shutdown iniciado |
| `system.error` | Erro crítico do sistema |
| `health.check.completed` | Health check finalizado |
| `health.score.changed` | Health score alterado |
| `health.alert.triggered` | Alerta de health disparado |
| `mission.*` | Ciclo de vida de missões (started/completed/failed/checkpoint) |
| `diagnostic.*` | Ciclo de vida de diagnósticos |
| `backup.*` | Ciclo de vida de backups |
| `release.*` | Ciclo de vida de releases |
| `deploy.completed` | Deploy concluído |
| `config.changed` | Configuração alterada |
| `module.*` | Ciclo de vida de módulos (registered/activated/deactivated) |
| `widget.refreshed` | Widget atualizado |
| `panel.rendered` | Painel renderizado |
| `cache.invalidated` | Cache invalidado |
| `security.alert` | Alerta de segurança |
| `rbac.violation` | Violação RBAC |

## 5. Compatibilidade

A V3 é 100% compatível com V1 e V2:
- Núcleo V1/V2 (core/menu.sh, lib/) intocado; a integração V3 estende 11
  arquivos de motores/módulos existentes sem remover funcionalidades
- O `cellcity` wrapper detecta se V3 está disponível
- Fallback automático para V1 se o Kernel V3 falhar
- Menu V1 acessível via `[.]` no NOC Dashboard (`[m]` abre Banco de Dados)
- Plugin Loader V1 continua funcionando

## 6. Dependências

| Dependência | Uso |
|-------------|-----|
| Bash ≥4.0 | Runtime principal |
| jq | Manipulação de JSON |
| Git | Health checks e status |
| bc | Cálculos (opcional) |
| tput | Cores ANSI (opcional) |
