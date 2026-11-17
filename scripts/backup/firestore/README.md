# Backup de DADOS Firestore → Google Cloud Storage

Export **gerenciado** (oficial Google) de todas as coleções, guardado **fora**
do Firestore, com retenção de **90 dias** via lifecycle do bucket.  
**Nunca** versiona dados de clientes no GitHub.

Complementa (não substitui):

| Camada | O que cobre | Onde |
|---|---|---|
| Código | espelho git semanal | repo `Cell-City-Backup` (`backup-weekly.yml`) |
| PITR | rebobinar 7 dias | nativo Firestore (prod) |
| **Este pacote** | export semanal completo ≥90d | GCS Nearline |

## Custo estimado (ordem de grandeza)

Base histórica do banco (~600–alguns mil docs, << 10 MB):

| Item | Estimativa |
|---|---|
| Leituras do export semanal | 1 leitura/doc ≈ desprezível no free tier Blaze |
| GCS Nearline (~5 MB × 13 semanas) | ≪ **R$ 1/mês** |
| Operações Class A/B do bucket | centavos |
| **Total típico** | **~R$ 0 a R$ 2/mês** |

Export/import **não aparecem** no gráfico de uso do console Firestore, mas
entram na fatura Blaze com o label `goog-firestoremanaged:exportimport`.

## Fluxo obrigatório (develop → DEV → aprovação → main/prod)

1. Código deste diretório + workflows entram primeiro em **`develop`**.
2. Operador com `gcloud` (Owner) roda o setup **só no DEV** (`CONFIRM=YES ENV=dev`).
3. Roda **teste real de restauração** no DEV (`test-restore-dev.sh`).
4. Dono aprova custo/risco → setup **prod** + variável
   `BACKUP_FIRESTORE_PROD_ENABLED=true` na main.
5. Schedule semanal passa a exportar produção.

Ações que geram custo ou são difíceis de reverter (criar bucket, IAM, primeiro
export, import) **exigem `CONFIRM=YES`** e, em produção, aprovação explícita.

## Pré-requisitos

- Projetos Blaze: `cellcity-crm` (prod) e `cellcity-crm-dev` (dev).
- `gcloud` autenticado com permissão suficiente (Owner/Editor).
- Workload Identity do repo (já existe em prod para deploy). A SA de backup
  é **separada** (`github-firestore-backup@…`) — least privilege.

### WIF e branch `develop`

O provider `github-oidc` em prod hoje restringe tokens a `refs/heads/main`
(ver `scripts/infra/wif-conceder-papeis.sh`). Consequências:

- Schedule de produção e dispatch `prod` → só na **main** (gate no workflow).
- Teste Actions `environment=dev` exige WIF no projeto DEV
  (`vars.BACKUP_FIRESTORE_DEV_WIF_PROVIDER`). Enquanto isso não existir,
  use o teste **local** abaixo (recomendado na 1ª vez).

## Comandos

```bash
# 1) Plano (não altera nada)
ENV=dev ./scripts/backup/firestore/setup-infra.sh

# 2) Criar bucket DEV + SA + IAM  ← CUSTO MÍNIMO — peça aprovação se não for o dono
CONFIRM=YES ENV=dev ./scripts/backup/firestore/setup-infra.sh

# 3) Teste real de restauração no DEV (escreve/apaga só _cc_backup_probe)
CONFIRM=YES ./scripts/backup/firestore/test-restore-dev.sh

# 4) Export completo DEV (opcional)
ENV=dev ./scripts/backup/firestore/export.sh

# 5) Consultar último OK
ENV=dev ./scripts/backup/firestore/verify-last-ok.sh
#    → lê gs://cellcity-crm-dev-firestore-backups/status/last-ok.json
```

Produção (só após aprovação do dono):

```bash
CONFIRM=YES ENV=prod ./scripts/backup/firestore/setup-infra.sh
# No GitHub → Settings → Variables:
#   BACKUP_FIRESTORE_PROD_ENABLED = true
# Depois: Actions → "Backup Firestore (GCS)" → Run workflow → prod
```

## Restauração (runbook)

### DEV (padrão de teste)

```bash
# Usa o exportUri gravado em status/last-ok.json
ENV=dev ./scripts/backup/firestore/restore.sh

# Ou aponta um export específico
ENV=dev EXPORT_URI=gs://cellcity-crm-dev-firestore-backups/exports/20260101T000000Z \
  ./scripts/backup/firestore/restore.sh
```

### Produção (emergência)

Import **sobrescreve** documentos com o mesmo id. Bloqueado por padrão:

```bash
ENV=prod ALLOW_PROD_RESTORE=EU_ENTENDO_O_RISCO \
  EXPORT_URI=gs://cellcity-crm-firestore-backups/exports/YYYYMMDDTHHMMSSZ \
  ./scripts/backup/firestore/restore.sh
```

Alternativa rápida (< 7 dias): PITR no console GCP
(`gcloud firestore databases restore` / UI), sem este pacote.

## Marcador `last-ok` (consulta)

Objeto: `gs://<bucket>/status/last-ok.json`

```json
{
  "ok": true,
  "env": "prod",
  "project": "cellcity-crm",
  "exportedAt": "2026-11-17T06:00:00Z",
  "exportUri": "gs://…/exports/…",
  "retentionDays": 90,
  "runUrl": "https://github.com/…/actions/runs/…"
}
```

Também aparece no **Job Summary** do Actions. O workflow **falha** se o
export ou a verificação do last-ok falhar. O keepalive falha se o last-ok
de prod estiver com mais de 10 dias (quando a variável de prod estiver ligada).

## Keepalive (anti-desligamento GitHub)

`.github/workflows/workflows-keepalive.yml` (dias 1 e 15):

- Reabilita workflows em `disabled_inactivity` / `disabled_manually`
  (`backup-weekly`, `backup-firestore`, pages, tests…).
- Se prod estiver ligado, verifica frescor do last-ok.

Pushes regulares em `main`/`develop` também resetam o timer de inatividade.

## O que este pacote NÃO faz

- Não substitui o backup de **código** (`backup-weekly.yml` → Cell-City-Backup).
- Não amplia sozinho o PITR além de 7 dias.
- Não envia JSON de clientes para artefato GitHub / repo git.
- Não liga produção sem `BACKUP_FIRESTORE_PROD_ENABLED=true`.
