#!/usr/bin/env bash
# TESTE REAL de restauração — SOMENTE no projeto DEV (cellcity-crm-dev).
# Nunca toca em produção.
#
# Estratégia (baixo risco):
#  1) Cria/atualiza um documento-sonda em _cc_backup_probe/ping
#  2) Exporta só essa collection-id para o bucket DEV
#  3) Apaga o documento-sonda
#  4) Importa o export de volta
#  5) Confirma que o documento voltou com o mesmo token
#
# Uso:
#   CONFIRM=YES ./scripts/backup/firestore/test-restore-dev.sh
#   DRY_RUN=1 ./scripts/backup/firestore/test-restore-dev.sh
set -euo pipefail

# shellcheck source=config.sh
source "$(dirname "$0")/config.sh"

CONFIRM="${CONFIRM:-}"
DRY_RUN="${DRY_RUN:-0}"
PROJECT="$FS_PROJECT_DEV"
BUCKET="$FS_BUCKET_DEV"
PROBE_COLLECTION="_cc_backup_probe"
PROBE_DOC="ping"
TOKEN="probe-$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
EXPORT_URI="gs://${BUCKET}/restore-tests/${STAMP}"

echo "== Teste de restauração DEV =="
echo "Projeto:     $PROJECT"
echo "Bucket:      gs://$BUCKET"
echo "Sonda:       ${PROBE_COLLECTION}/${PROBE_DOC}"
echo "Token:       $TOKEN"
echo "Export:      $EXPORT_URI"

if [[ "$PROJECT" == "$FS_PROJECT_PROD" ]]; then
  echo "❌ Recusado: PROJECT aponta para produção."
  exit 1
fi

if [[ "$DRY_RUN" == "1" ]]; then
  echo "DRY_RUN=1 — nenhuma escrita."
  exit 0
fi

if [[ "$CONFIRM" != "YES" ]]; then
  echo "Nada executado (falta CONFIRM=YES). Este teste ESCREVE e APAGA no DEV."
  exit 0
fi

if ! gcloud storage buckets describe "gs://${BUCKET}" --project="$PROJECT" >/dev/null 2>&1; then
  echo "❌ Bucket DEV ausente. Rode: CONFIRM=YES ENV=dev ./scripts/backup/firestore/setup-infra.sh"
  exit 1
fi

echo "-- 1) Escrevendo documento-sonda via REST (Access Token gcloud) --"
ACCESS_TOKEN="$(gcloud auth print-access-token)"
PROBE_URL="https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${PROBE_COLLECTION}/${PROBE_DOC}"
BODY=$(python3 - <<PY
import json
print(json.dumps({
  "fields": {
    "token": {"stringValue": "${TOKEN}"},
    "purpose": {"stringValue": "restore-test"},
    "createdAt": {"stringValue": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
  }
}))
PY
)
curl -sS -X PATCH \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "${PROBE_URL}?updateMask.fieldPaths=token&updateMask.fieldPaths=purpose&updateMask.fieldPaths=createdAt" \
  >/dev/null

echo "-- 2) Export collection-ids=${PROBE_COLLECTION} --"
gcloud firestore export "$EXPORT_URI" \
  --project="$PROJECT" \
  --collection-ids="$PROBE_COLLECTION" \
  --async=false

echo "-- 3) Apagando sonda --"
curl -sS -X DELETE \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "$PROBE_URL" >/dev/null

echo "-- 4) Import de volta --"
gcloud firestore import "$EXPORT_URI" \
  --project="$PROJECT" \
  --async=false

echo "-- 5) Verificando token restaurado --"
GOT="$(curl -sS -H "Authorization: Bearer ${ACCESS_TOKEN}" "$PROBE_URL" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('fields',{}).get('token',{}).get('stringValue',''))")"

if [[ "$GOT" != "$TOKEN" ]]; then
  echo "❌ FALHA: esperado token=$TOKEN ; obtido='$GOT'"
  exit 1
fi

echo "✅ Teste de restauração DEV OK (token recuperado)."
echo "   Export de teste: $EXPORT_URI"
echo "   (lifecycle do bucket apaga após ${FS_RETENTION_DAYS} dias)"
