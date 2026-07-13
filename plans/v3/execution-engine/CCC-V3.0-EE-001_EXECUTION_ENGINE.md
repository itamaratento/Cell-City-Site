# Execution Engine V3

**Documento:** CCC-V3.0-EE-001  
**Versão:** 3.0.0  
**Data:** 2026-07-13  
**Arquiteto:** DeepSeek R1  
**Status:** Aprovado

## 1. Visão Geral

O Execution Engine é o orquestrador de execução contínua do Cell City CRM V3.  
Ele gerencia filas de missões, controla progresso em tempo real, mantém checkpoints
para retomada automática e fornece barra de progresso com estimativas.

## 2. Princípios

- **Resiliência total**: qualquer falha é registrada como checkpoint, não como fim
- **Observabilidade nativa**: cada passo emite progresso, log e métrica
- **Autonomia**: execução sem supervisão com retomada automática
- **Isolamento**: cada missão tem fila própria, sem interferência entre missões
- **Leveza**: shell puro, zero dependências externas

## 3. Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│                    EXECUTION ENGINE                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Queue   │  │ Progress │  │Checkpoint│  │ Recovery │    │
│  │ Manager  │  │ Tracker  │  │ Manager  │  │  Engine  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐    │
│  │ Mission  │  │   Bar    │  │  State   │  │  Auto-   │    │
│  │ Runner   │  │ Renderer │  │   Save   │  │  Resume  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Integration Bus (via JSON state)        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Health  │  │  Diag.   │  │  Smart   │  │  Monitor │    │
│  │  Engine  │  │  Engine  │  │  Panel   │  │          │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 4. Componentes

### 4.1 Queue Manager (queue.sh)
Gerencia a fila de execução com suporte a:
- Fila FIFO de missões
- Prioridades (P0-P4)
- Dependências entre missões
- Estado da fila (parada, executando, pausada, concluída)

### 4.2 Progress Tracker (progress.sh)
Rastreia progresso da execução atual:
- Percentual (0-100%)
- Etapa atual
- Bloco atual
- Arquivo atual
- Tempo decorrido
- Tempo estimado (baseado em execuções anteriores)
- Tempo restante
- Velocidade (passos/minuto)

### 4.3 Checkpoint Manager (checkpoint.sh)
Mantém pontos de recuperação:
- Checkpoint automático a cada passo
- Checkpoint manual via --checkpoint
- Estado completo serializado em JSON
- Histórico de checkpoints (últimos 10)

### 4.4 Recovery Engine (recovery.sh)
Retomada automática após falha:
- Detecta checkpoint pendente
- Restaura estado completo
- Retoma do passo exato da falha
- Registra causa da falha no relatório

### 4.5 Mission Runner (mission.sh)
Define e executa missões:
- Missão = sequência nomeada de blocos
- Bloco = sequência nomeada de passos
- Passo = comando bash executável
- Metadados: descrição, responsável, estimativa

### 4.6 Bar Renderer (bar.sh)
Renderiza barra de progresso em terminal:
- Barra visual ████░░░░ com percentual
- Informações de tempo
- Etapa/bloco/arquivo atuais
- Status colorido

## 5. Formato de Missão

```json
{
  "id": "v3_foundation",
  "nome": "Fundação V3",
  "prioridade": "P0",
  "blocos": [
    {
      "id": "bloco_01",
      "nome": "Health Engine",
      "passos": [
        {
          "id": "passo_01",
          "comando": "bash scripts/health-engine/engine.sh --quick",
          "descricao": "Executar health check rápido",
          "estimativa_segundos": 30,
          "checkpoint": true
        }
      ]
    }
  ]
}
```

## 6. Formato de Checkpoint

```json
{
  "missao_id": "v3_foundation",
  "bloco_atual": "bloco_01",
  "passo_atual": "passo_03",
  "percentual": 45,
  "status": "executando",
  "timestamp": "2026-07-13T10:30:00-03:00",
  "falhas_anteriores": [],
  "historico": [
    {"passo": "passo_01", "status": "concluido", "duracao": 25},
    {"passo": "passo_02", "status": "concluido", "duracao": 12}
  ]
}
```

## 7. Fluxo de Execução

```
1. INICIAR
   │
   ├─ Carregar missão (arquivo JSON ou stdin)
   ├─ Verificar checkpoint pendente
   │   ├─ Sim → restaurar estado
   │   └─ Não → iniciar do início
   │
   ├─ 2. EXECUTAR
   │   │
   │   ├─ Para cada bloco:
   │   │   ├─ Para cada passo:
   │   │   │   ├─ Atualizar progresso
   │   │   │   ├─ Executar comando
   │   │   │   ├─ Verificar saída
   │   │   │   ├─ Salvar checkpoint
   │   │   │   ├─ Emitir métrica
   │   │   │   └─ Se falha:
   │   │   │       ├─ Registrar falha
   │   │   │       ├─ Se crítico → PARAR
   │   │   │       └─ Se não crítico → CONTINUAR
   │   │   │
   │   │   └─ Avançar bloco
   │   │
   │   └─ 3. CONCLUIR
   │       ├─ Marcar missão como concluída
   │       ├─ Gerar relatório final
   │       └─ Limpar checkpoint
   │
   └─ 4. RELATÓRIO
       ├─ Duração total
       ├─ Passos concluídos / falhos
       ├─ Score final
       └─ Recomendações
```

## 8. Comandos

| Comando | Descrição |
|---------|-----------|
| `engine.sh --run <missao>` | Executa missão |
| `engine.sh --resume` | Retoma última missão |
| `engine.sh --status` | Status da execução atual |
| `engine.sh --queue` | Lista fila de execução |
| `engine.sh --checkpoint` | Cria checkpoint manual |
| `engine.sh --list` | Lista missões disponíveis |

## 9. Integrações

- **Health Engine**: pré-valida ambiente antes de executar missão
- **Smart Panel**: exibe progresso em tempo real no dashboard
- **Monitoring**: emite eventos para cada passo
- **Observability**: registra métricas de execução
- **Diagnostic Engine**: diagnóstico pós-falha automático

## 10. Modos de Execução

| Modo | Descrição |
|------|-----------|
| `autonomo` | Execução completa sem intervenção |
| `manual` | Aguarda confirmação entre blocos |
| `debug` | Execução passo a passo com logs verbose |
| `retry` | Executa apenas blocos com falha |
