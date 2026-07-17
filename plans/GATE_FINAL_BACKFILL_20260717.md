# FASE 2.6 — Gate Final Antes do Backfill

**Data:** 2026-07-17  
**Resultado do gate:** 🟡 **APROVADO COM RESSALVA** (backup via PITR OK; export JSON de dados desatualizado)  
**Ação:** **NÃO executar backfill** até aprovação humana explícita deste plano.

---

## ETAPA 1 — Estado do repositório

| Item | Evidência |
|---|---|
| Branch | `develop` ✅ |
| Working tree | **Limpa** ✅ |
| HEAD local | `eb63dd1` |
| `origin/develop` | `a6c7a56` (CI **success**) |
| Divergência | Local **à frente 4** (docs/refactor portal — não bloqueia backfill) |

```
eb63dd1 docs(certificacao): relatório final da Fase 2.3 — validação pré-main
4ce40ef docs(fase2.3): registra achados e regressão da validação final pré-main
8cd46e5 refactor(portal): extrai horariosOcupadosDaEmpresa (sem mudar comportamento)
a1ea1b6 docs(release): atualiza Fase 2.5 com HEAD a6c7a56 e CI verde
a6c7a56 ci: liga a suíte de regressão de segurança da Fase 2.2 ao workflow
```

CI remota em `a6c7a56`: Testes ✅ · Pages ✅ · Firebase skipped ✅

---

## ETAPA 2 — Backup

### Dados Firestore (o que o backfill altera)

| Camada | Estado | Avaliação |
|---|---|---|
| **PITR** `cellcity-crm` | `POINT_IN_TIME_RECOVERY_ENABLED` desde `2026-07-15T17:15:00Z`, retenção **7 dias** | ✅ **Válido** — restauração possível para janela atual |
| Export JSON `~/Músicas/backups/dados/` | Último: `CellCity-dados-2026-07-03-0200.json` (~467–478 KB, 21 coleções, JSON íntegro) | ⚠️ **Desatualizado (~14 dias)** — cobertura parcial (sem RBAC) |
| Cron `cc-backup-dados` | Sem entrada no `historico.log` após 2026-07-03 | ⚠️ Parado / falhando |

### Código (não substitui backup de dados)

| Camada | Estado |
|---|---|
| ZIP semanal `~/Músicas/backups/` | Último: `2026-07-12` (~890 KB) — OK para código |
| `_BACKUPS/` slots | Snapshots de código (jun/2026) — **não** cobrem Firestore |

**Decisão ETAPA 2:** não há **PARADA dura** porque o PITR está ativo e cobre a janela de um backfill hoje.  
**Ressalva obrigatória:** antes do `--execute`, recomenda-se um export fresco:

```bash
node backup-dados.js --prod
```

---

## ETAPA 3 — Configuração

| Item | Valor | Status |
|---|---|---|
| Projeto prod (scripts) | `--project prod` → `cellcity-crm` | ✅ |
| Projeto default `.firebaserc` | `cellcity-crm` | ✅ |
| `gcloud` project | `cellcity-crm` | ✅ |
| Conta `gcloud` | configurada (sessão local) | ✅ |
| ADC | ausente (backfill usa `gcloud auth print-access-token`) | ℹ️ OK se token user funcionar |
| `sa-key.json` | presente localmente, **gitignored**, perms `600` | ✅ não versionado |
| Chaves no git | nenhum `sa-key` tracked | ✅ |

---

## ETAPA 4 — Plano de execução (aguardar aprovação)

### Pré-execução (recomendado)

```bash
# 0) Export fresco de dados (ressalva do gate)
node backup-dados.js --prod

# 1) Confirmar token
gcloud auth print-access-token >/dev/null
```

### Comandos do backfill

```bash
# 2) Dry-run (leitura apenas) — OBRIGATÓRIO primeiro
node scripts/backfill-empresa-id.mjs --project prod

# 3) Execução (só após dry-run revisado e aprovação)
node scripts/backfill-empresa-id.mjs --project prod --execute

# 4) Validação completa — exit 0 obrigatório
node scripts/validar-backfill.mjs --project prod

# 5) Flag (só se validar exit 0)
# empresas/cellcity-master.dados_migrados = true
```

**Nota:** `PRODUCAO_READINESS.md` registra backfill prévio (2026-07-14, 822 docs). Script é **idempotente** — só toca `empresa_id` ausente/null. Novas coleções no script (`pre_os`, `catalogo_*`, etc.) podem ainda ter pendentes.

### Critérios de sucesso

1. Dry-run termina sem erro fatal  
2. `--execute`: falhas = 0; corrigidos = pendentes do dry-run  
3. `validar-backfill.mjs --project prod` → **exit 0** (`PENDENTE == 0`)  
4. Divergentes (outro `empresa_id`) preservados, não sobrescritos  
5. App continua legível (smoke mínimo Login / OS / Dashboard)

### Critérios de rollback

| Situação | Ação |
|---|---|
| Dry-run com erro de auth/projeto | **Não executar** — corrigir credencial |
| Execute parcial / falhas > 0 | **Não** marcar `dados_migrados`; **não** promover Rules; reexecutar backfill |
| Regressão grave pós-execute | PITR: restaurar ponto pré-backfill (janela 7 dias desde 2026-07-15) |
| Export JSON | Restauração **manual** seletiva (cobertura parcial) — último recurso |

Não existe undo automático no script (só escreve 1 campo; nunca sobrescreve valor existente).

### Verificações pós-backfill

- [ ] `validar-backfill` exit 0  
- [ ] Contagem pendentes = 0 em todas as coleções do script  
- [ ] `dados_migrados` ainda **não** true até decisão explícita (ou true só após validar)  
- [ ] Smoke: Login, Dashboard, OS, Caixa, Financeiro, Portal  
- [ ] **Não** deploy Rules / merge `main` nesta etapa

---

## Classificação do gate

### 🟡 APROVADO COM RESSALVA

- Backup de **restauração**: PITR ✅  
- Backup de **export JSON**: desatualizado ⚠️ — gerar antes do `--execute`  
- Repo / CI / projeto Firebase: OK  

**Bloqueios mantidos até sua aprovação explícita:**

- ❌ backfill `--execute`  
- ❌ merge `develop` → `main`  
- ❌ tag  
- ❌ deploy Firebase  

---

*Aguardando aprovação humana do plano (ETAPA 4) e, se desejado, autorização para o export `--prod` + dry-run.*
