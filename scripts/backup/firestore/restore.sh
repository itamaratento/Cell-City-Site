#!/usr/bin/env bash
# Restaura um export gerenciado Firestore a partir do GCS.
#
# PROTEÇÃO: recusa ENV=prod por padrão. Só restaura em produção com
#   ALLOW_PROD_RESTORE=EU_ENTENDO_O_RISCO
#
# Uso:
#   ENV=dev EXPORT_URI=gs://bucket/exports/2026... ./scripts/backup/firestore/restore.sh
#   ENV=dev   # usa o exportUri do status/last-ok.json do bucket DEV
set -euo pipefail

# shellcheck source=config.sh
source "$(dirname "$0")/config.sh"

ENV="${ENV:-}"
EXPORT_URI="${EXPORT_URI:-}"
DRY_RUN="${DRY_RUN:-0}"
ALLOW_PROD_RESTORE="${ALLOW_PROD_RESTORE:-}"

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "❌ Informe ENV=dev ou ENV=prod"
  exit 1
fi

if [[ "$ENV" == "prod" ]]; then
  if [[ "$ALLOW_PROD_RESTORE" != "EU_ENTENDO_O_RISCO" ]]; then
    echo "❌ Restauração em PRODUÇÃO bloqueada."
    echo "   Use ENV=dev para testar. Em prod, exija ALLOW_PROD_RESTORE=EU_ENTENDO_O_RISCO"
    exit 1
  fi
  PROJECT="$FS_PROJECT_PROD"
  BUCKET="$FS_BUCKET_PROD"
else
  PROJECT="$FS_PROJECT_DEV"
  BUCKET="$FS_BUCKET_DEV"
fi

if [[ -z "$EXPORT_URI" ]]; then
  STATUS_URI="gs://${BUCKET}/${FS_STATUS_OBJECT}"
  echo "-- Lendo exportUri de $STATUS_URI --"
  TMP="$(mktemp)"
  gcloud storage cp "$STATUS_URI" "$TMP"
  EXPORT_URI="$(python3 -c "import json;print(json.load(open('$TMP'))['exportUri'])")"
  rm -f "$TMP"
fi

echo "== Restore Firestore =="
echo "Ambiente:  $ENV"
echo "Projeto:   $PROJECT"
echo "Origem:    $EXPORT_URI"
echo "AVISO: import sobrescreve documentos existentes com o mesmo id."

if [[ "$DRY_RUN" == "1" ]]; then
  echo "DRY_RUN=1 — nenhum import disparado."
  exit 0
fi

gcloud firestore import "$EXPORT_URI" \
  --project="$PROJECT" \
  --async=false

echo "✅ Import concluído em $PROJECT a partir de $EXPORT_URI"
