# Abertura do próximo ciclo — pós Release v3.2.0

**Data:** 2026-07-21  
**Script:** Abertura do próximo ciclo de desenvolvimento  
**Modo:** documental — **sem** código · Rules · Functions · IAM · deploy · merge · tag  
**Linha base declarada:** commit `b663a13` · Release `v3.2.0` · branch `develop`

---

## FASE 1 — Congelamento da base (verificação)

| Check | Resultado |
|-------|-----------|
| Branch atual `develop` | ✅ |
| `HEAD` = `b663a13` | ✅ (`b663a13e5b6d16171c9198a466b41fb09f840f3c`) |
| Homologação funcional encerrada | ✅ ETAPA 6.4 — 🟡 Homologada com ressalvas |
| ADR_AUTH_001 publicada | ✅ Alternativa A (ACEITO) |
| Pendência operacional ETAPA 6.x | ✅ nenhuma aberta (B1/B2 resolvidos; B3 encerrado por ADR) |
| Documentação no **commit** `b663a13` | ⚠️ contém até ETAPA 6.3 / ADR; **não** inclui ainda o parecer 6.4 |
| Working tree | ⚠️ docs 6.4 + ponteiros locais **não commitados** (ver §Ressalva) |

### Ressalva de congelamento (não bloqueia o encerramento do ciclo)

Existem alterações **somente documentais** fora de `b663a13`, relativas à ETAPA 6.4:

- `plans/CERTIFICACAO_ETAPA64_RELEASE_V320_20260721.md` (untracked)
- `CRM/TECHDOC.md` (§51)
- `PROXIMA_ETAPA.md`
- `plans/CERTIFICACAO_ETAPA63_...md` (adendo §14)
- ruído gerado: `CRM/git-info.json`, `scripts/control-center/state/health-check.json`

**Não há divergência de código de produto, Rules ou Functions.**  
A linha base **técnica** permanece `b663a13`, conforme este script. O commit das docs 6.4 fica como **ação administrativa do dono** (quando autorizar commit) — não inicia novo ciclo de desenvolvimento.

**Decisão desta etapa:** prosseguir com o registro da baseline e do inventário; **não** iniciar backlog.

---

## FASE 2 — Linha base do próximo ciclo

| Campo | Valor |
|-------|-------|
| Release base | **v3.2.0** (`d650464`) |
| Commit base | **`b663a13`** |
| Branch base | `develop` |
| Arquitetura vigente | **ADR-AUTH-001 · Alternativa A** |
| B1 | Resolvido |
| B2 | Resolvido |
| B3 | Encerrado por decisão arquitetural |
| BL-011 | Dívida técnica consciente |

**Declaração:** o ciclo da Release v3.2.0 permanece **oficialmente encerrado**.  
Nenhum trabalho de produto inicia até backlog escolhido + autorização explícita.

---

## FASE 3 — Inventário de itens abertos

Itens **fora** da homologação v3.2.0 (sem acrescentar novos):

| ID | Item | Status inventário |
|----|------|-------------------|
| BL-007 | Runtime Cloud Functions nodejs20 → nodejs22 | ☑ aberto (prazo 2026-10-30) |
| BL-009 | Bucket Firebase Storage (exige Blaze) | ☑ aberto (decisão administrativa) |
| BL-010 | Bypass deploy key — ruleset tags Cell-City-Backup | ☑ aberto (ação manual GitHub UI) |
| — | Migração usuários/módulos legados sem `perfil_operacional_id` | ☑ opcional |
| — | Revisão futura ADR (eventual 6.2-B / Alternativa B ou híbrido) | ☑ eventual; exige autorização Rules |

**Não incluídos como novos itens:** docs 6.4 pendentes de commit (housekeeping da baseline, não backlog de feature).

---

## FASE 4 — Cartões de priorização (obrigatórios antes de executar)

### BL-007 — nodejs22 (Cloud Functions)

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Evitar bloqueio de deploy após descomissionamento Node 20 (2026-10-30). |
| **Escopo** | `functions/package.json` engines; runtime Firebase; alinhar Node do CI (`tests.yml` etc.). |
| **Impacto** | Redeploy das Functions; possível atualização de deps. |
| **Riscos** | Regressão em CF; incompatibilidade de deps; exige autorização (módulo CF). |
| **Dependências** | Autorização explícita do dono; CI verde; ambiente DEV primeiro. |
| **Critérios de aceite** | Runtime 22 em DEV; suíte CF/CI verde; deploy DEV OK; checklist prod sob processo próprio. |
| **Homologação** | Sim — smoke + testes Functions + regressão CI. |

### BL-009 — Bucket Firebase Storage (Blaze)

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Disponibilizar Storage real para fotos de OS (hoje sem bucket). |
| **Escopo** | Decisão de plano Blaze + criação do bucket; `storage.rules` já preparadas no pipeline. |
| **Impacto** | Custo (Blaze); uploads passam a funcionar de verdade. |
| **Riscos** | Custo contínuo; configuração incorreta de bucket/regras. |
| **Dependências** | Decisão administrativa de custo do dono. |
| **Critérios de aceite** | Bucket existe; rules aplicadas; upload OS validado em DEV. |
| **Homologação** | Sim — upload/download + rules Storage. |

### BL-010 — Bypass deploy key (Cell-City-Backup)

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Espelhar tags no backup (hoje slots viram branches). |
| **Escopo** | UI GitHub do repo backup: ruleset de tags → bypass da deploy key. |
| **Impacto** | Só espelhamento de tags; backups semanais já verdes. |
| **Riscos** | Baixo; misconfiguração de ruleset. |
| **Dependências** | Acesso admin GitHub do dono (plano free: só UI). |
| **Critérios de aceite** | Próximo backup espelha tag; validação manual. |
| **Homologação** | Validação operacional (não suíte CRM). |

### Migração legados (opcional) — `perfil_operacional_id`

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Eliminar fail-open de matriz na UI para contas sem perfil operacional. |
| **Escopo** | Backfill DEV/prod sob política do dono; sem mudar Rules. |
| **Impacto** | Usuários passam a respeitar matriz; risco de restringir quem dependia do fail-open. |
| **Riscos** | Contas legadas perderem acesso UI inesperado. |
| **Dependências** | Inventário de UIDs; matriz por papel; autorização dados. |
| **Critérios de aceite** | Zero (ou lista aprovada) de staff ativo sem `perfil_operacional_id`; smoke por perfil. |
| **Homologação** | Sim — amostra multi-perfil DEV. |

### Revisão futura ADR / 6.2-B (eventual)

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Se o dono quiser defesa em profundidade: Rules passam a ler matriz (B ou híbrido). |
| **Escopo** | Reescrita de `CRM/firestore.rules` + testes emulador + DEV → só então prod. |
| **Impacto** | Alto; custo `get()`; risco de falso negativo. |
| **Riscos** | Regressão ampla; conflito com ADR atual. |
| **Dependências** | **Autorização explícita Rules**; possível emenda à ADR; processo tipo BL-006. |
| **Critérios de aceite** | Matriz (ou subset híbrido) enforced server-side; suíte Rules + RBAC Runtime. |
| **Homologação** | Sim — completa (Rules + runtime + regressão). |
| **Estado** | **Não iniciar** sob Alternativa A vigente. |

---

## FASE 5 — Plano de execução (modelo)

Quando o proprietário **escolher e autorizar** um item acima, abrir ciclo novo com documentação própria:

1. Objetivo  
2. Escopo  
3. Arquivos previstos  
4. Impactos esperados  
5. Plano de testes  
6. Plano de rollback  
7. Critérios de homologação / encerramento  

**Proibir** reutilizar automaticamente os scripts mestres da homologação v3.2.0 (Etapas 5/6.x).

---

## Restrições vigentes (até nova autorização)

Proibido: alterar código · Rules · Functions · IAM · deploy · merge · tag · promoção `main` · modificar ADR_AUTH_001.

---

## Critérios para iniciar o próximo ciclo

- [ ] backlog escolhido  
- [ ] objetivo definido  
- [ ] escopo aprovado  
- [ ] riscos avaliados  
- [ ] autorização explícita do proprietário  

**Estado atual:** ⏳ aguardando seleção + autorização.

---

## Declaração final

```
🟢 CICLO Release v3.2.0 ENCERRADO
📌 LINHA BASE TÉCNICA: b663a13
📌 ARQUITETURA: ADR-AUTH-001 Alternativa A
⏳ PRÓXIMO CICLO: não iniciado
```

Housekeeping opcional (não é início de ciclo): commit das docs ETAPA 6.4 quando o dono autorizar.
