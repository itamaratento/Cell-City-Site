#!/usr/bin/env bash
# Export gerenciado Firestore → GCS (semanal / manual).
# NÃO grava dados de clientes no GitHub — só em gs://.
#
# Uso:
#   ENV=dev|prod ./scripts/backup/firestore/export.sh
#   ENV=dev DRY_RUN=1 ./scripts/backup/firestore/export.sh
#
# Variáveis opcionais:
#   RUN_URL   — URL do GitHub Actions run (gravada no last-ok)
#   GITHUB_STEP_SUMMARY — se definido, anexa resumo legível
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
# shellcheck source=config.sh
source "$(dirname "$0")/config.sh"

ENV="${ENV:-}"
DRY_RUN="${DRY_RUN:-0}"
RUN_URL="${RUN_URL:-}"

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "❌ Informe ENV=dev ou ENV=prod"
  exit 1
fi

if [[ "$ENV" == "prod" ]]; then
  PROJECT="$FS_PROJECT_PROD"
  BUCKET="$FS_BUCKET_PROD"
else
  PROJECT="$FS_PROJECT_DEV"
  BUCKET="$FS_BUCKET_DEV"
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
EXPORT_URI="gs://${BUCKET}/${FS_EXPORT_PREFIX}/${STAMP}"
STATUS_URI="gs://${BUCKET}/${FS_STATUS_OBJECT}"

echo "== Backup Firestore (export gerenciado) =="
echo "Ambiente:  $ENV"
echo "Projeto:   $PROJECT"
echo "Destino:   $EXPORT_URI"
echo "Last-ok:   $STATUS_URI"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "DRY_RUN=1 — nenhum export disparado."
  exit 0
fi

# Confirma que o bucket existe (falha visível se setup não rodou)
if ! gcloud storage buckets describe "gs://${BUCKET}" --project="$PROJECT" >/dev/null 2>&1; then
  echo "❌ Bucket gs://${BUCKET} ausente no projeto ${PROJECT}."
  echo "   Rode setup-infra.sh com CONFIRM=YES (gera custo mínimo de GCS)."
  exit 1
fi

echo "-- Disparando gcloud firestore export (todas as coleções) --"
gcloud firestore export "$EXPORT_URI" \
  --project="$PROJECT" \
  --async=false

# Marcador de sucesso — metadados operacionais apenas (sem docs de clientes)
LAST_OK_JSON=$(python3 - <<PY
import json, os, datetime
print(json.dumps({
  "ok": True,
  "env": "${ENV}",
  "project": "${PROJECT}",
  "exportedAt": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  "exportUri": "${EXPORT_URI}",
  "retentionDays": ${FS_RETENTION_DAYS},
  "runUrl": os.environ.get("RUN_URL", "") or None,
}, indent=2))
PY
)

echo "$LAST_OK_JSON" | gcloud storage cp - "$STATUS_URI" --content-type=application/json
echo "✅ last-ok gravado em $STATUS_URI"
echo "$LAST_OK_JSON"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "## Backup Firestore — OK"
    echo ""
    echo "| Campo | Valor |"
    echo "|---|---|"
    echo "| Ambiente | \`$ENV\` |"
    echo "| Projeto | \`$PROJECT\` |"
    echo "| Export | \`$EXPORT_URI\` |"
    echo "| Quando (UTC) | \`$(date -u +%Y-%m-%dT%H:%M:%SZ)\` |"
    echo "| Retenção | ${FS_RETENTION_DAYS} dias (lifecycle GCS) |"
  } >> "$GITHUB_STEP_SUMMARY"
fi

echo "✅ Export concluído: $EXPORT_URI"
