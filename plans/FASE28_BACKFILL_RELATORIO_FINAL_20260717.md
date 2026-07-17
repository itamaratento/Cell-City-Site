# FASE 2.8 — Backfill de Produção: Relatório Final

**Data:** 2026-07-17
**Executor deste relatório:** Claude (VS Code), papel Revisão Técnica
**Projeto:** `cellcity-crm` (produção)
**Branch:** `develop` · working tree limpa no início da fase

> Registro complementar da execução: `plans/BACKFILL_PRODUCAO_EXECUCAO_20260717.md`
> (sessão concorrente, que executou o `--execute`). Gate prévio:
> `plans/GATE_FINAL_BACKFILL_20260717.md`.

---

## Etapa 1 — Pré-execução ✅

| Item | Evidência |
|---|---|
| Backup atualizado | `~/Músicas/backups/dados/CellCity-dados-2026-07-17-1807.json` (gerado hoje, 15:07) + PITR ativo desde 2026-07-15 (retenção 7 dias) |
| Dry-run aprovado | 4 pendentes, 0 erros (registrado no gate e re-checado imediatamente antes do execute) |
| Projeto correto | `--project prod` → `cellcity-crm` (confirmado no código do script, linha 27); `.firebaserc` default = `cellcity-crm`; `gcloud config` = `cellcity-crm` |
| Credenciais | conta `itamaratento@gmail.com` ativa no gcloud |
| Working tree | limpa (apenas 2 relatórios untracked da própria operação) |
| Branch | `develop` |

## Etapa 2 — Backfill ✅ (executado pela sessão concorrente; revisado, não repetido)

O `--execute` foi realizado pela sessão concorrente minutos antes desta fase
iniciar (`plans/BACKFILL_PRODUCAO_EXECUCAO_20260717.md`, timestamp 15:23).
Decisão desta sessão: **não re-executar** um comando de escrita em produção já
concluído com sucesso — a revisão foi feita por validação independente (Etapa 3).

| Campo | Valor (conforme registro da execução) |
|---|---|
| Comando | `node scripts/backfill-empresa-id.mjs --project prod --execute` |
| Exit | 0 |
| Duração | ~8 s |
| Escaneados | 1.243 |
| Já corretos | 1.239 |
| **Corrigidos** | **4** — `os` (1), `clientes` (1), `estoque_produtos` (1), `agenda` (1) |
| Divergentes (outro empresa_id) | 0 |
| Falhas | 0 |
| Erros / avisos | nenhum |

O script escreve com `updateMask` restrito ao único campo `empresa_id`, é
idempotente e nunca sobrescreve valor existente (auditado em
`PRODUCAO_READINESS.md` §2).

## Etapa 3 — Validação ✅ (independente, executada por esta sessão)

`node scripts/validar-backfill.mjs --project prod` — varredura 100% paginada,
read-only. Executada **duas vezes** por esta sessão (pós-execute e novamente na
Etapa 5):

| Campo | Valor (idêntico nas duas execuções) |
|---|---|
| Exit code | **0** |
| Documentos varridos | 1.243 |
| Pendentes | **0** |
| Divergentes | **0** |
| Erros | **0** |
| Coleções verificadas | 39 com documentos (todas `OK`), 20 vazias |

`empresa_id == 'cellcity-master'` consistente em todas as coleções verificadas.
Números batem exatamente com o registro do execute (1.243 escaneados) — nenhuma
empresa perdeu dados.

## Etapa 4 — Indicador `dados_migrados` ⚠️ NÃO ATUALIZADO NESTA FASE

Registrando **apenas fatos comprovados**, conforme ajuste de auditoria:

1. A leitura direta de `empresas/cellcity-master.dados_migrados` foi
   **impedida pelas permissões da ferramenta** (classificador de permissões
   bloqueou o `GET` read-only à API do Firestore, em duas tentativas — uma na
   Fase 2.7, outra nesta fase).
2. **Nenhuma tentativa foi feita para contornar essas permissões.**
3. Existem **documentos históricos conflitantes** quanto ao estado da flag:
   - `PRODUCAO_READINESS.md` (2026-07-15) registra que a flag **foi marcada
     `true` em 2026-07-14** ("Antes: ausente → Depois: true", §2 item 7) e que
     a reversão pós-incidente P0 desfez apenas as Rules, mantendo a flag como
     "efeito colateral inofensivo".
   - Os relatórios de hoje (`ACOMPANHAMENTO_LIBERACAO_20260717.md`,
     `PROMOCAO_CONTROLADA_PRODUCAO_20260717.md`,
     `BACKFILL_PRODUCAO_EXECUCAO_20260717.md`) tratam a marcação da flag como
     **passo ainda pendente**, sem mencionar o registro de 07-14.
   - Não há evidência disponível a esta sessão que resolva o conflito (a flag
     pode estar `true` desde 07-14, ou ter sido revertida em algum momento não
     documentado).
4. Por não haver valor de partida comprovado, **nenhum valor "anterior" é
   registrado neste relatório** e **a escrita não foi executada**.

**Encaminhamento:** a confirmação do valor atual — e, se necessário, a
atualização — deverá ser feita por um operador com acesso administrativo ao
Console do Firebase ou por outro método oficialmente autorizado. Observação
técnica: a escrita é idempotente e o valor-alvo (`true`) é o mesmo em qualquer
cenário; o bloqueio aqui é de rastreabilidade de auditoria, não de risco
técnico da operação em si.

## Etapa 5 — Verificação final ✅

| Verificação | Resultado |
|---|---|
| Nenhuma coleção inconsistente | ✅ `validar-backfill` re-executado nesta etapa: 39/39 coleções `OK`, exit 0 |
| Nenhum documento pendente | ✅ 0 pendentes |
| Nenhuma empresa perdeu dados | ✅ 1.243 docs antes = 1.243 depois; backfill só adiciona 1 campo via `updateMask`, nunca remove/sobrescreve |
| Nenhuma permissão alterada indevidamente | ✅ Rules ativas em produção re-verificadas via API após o backfill: mesmo ruleset `86bac9a1-9fb7-43fb-b8d8-4691e68150ab`, `updateTime` inalterado (`2026-07-14T22:36:19Z`) — idêntico à leitura da Fase 2.7, anterior ao backfill |

---

## Relatório Final

### Backfill
- **Sucesso** · ~8 s · **4 documentos atualizados** (`os`, `clientes`,
  `estoque_produtos`, `agenda` — 1 cada) · 1.239 ignorados (já corretos) ·
  0 falhas.

### Validação
- Exit code **0** · **0 pendentes** · **0 inconsistências** · resultado:
  **aprovada** (duas execuções independentes com resultado idêntico).

### Produção
- Ambiente estável; Rules de produção inalteradas (confirmado por leitura API
  antes e depois); nenhuma permissão modificada; dados íntegros.
- Migração de dados (`empresa_id`): **concluída e validada**.
- Indicador `dados_migrados`: **estado atual não confirmado por leitura direta**
  (bloqueio de permissão da ferramenta; documentação histórica conflitante);
  **não atualizado nesta fase**; confirmação delegada a operador com acesso
  administrativo.

### Não executado (conforme instrução da missão)
- merge `develop` → `main` · tag · deploy Firebase · deploy de Rules ·
  smoke tests — aguardam nova autorização explícita.

### Parecer

## 🟡 BACKFILL CONCLUÍDO COM RESSALVAS

**Ressalva única:** o indicador `dados_migrados` não foi atualizado nem teve
seu valor atual confirmado, pelos motivos de auditoria documentados na Etapa 4.
O backfill em si — a operação de dados desta fase — está **concluído, validado
(exit 0, 0 pendentes) e com integridade de produção confirmada**. A pendência
da flag não bloqueia a análise deste relatório; bloqueia apenas a declaração de
"migração 100% sinalizada ao runtime" até a confirmação por operador.
