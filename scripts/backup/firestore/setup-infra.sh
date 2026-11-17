#!/usr/bin/env bash
# Cria bucket GCS + lifecycle 90d + SA + IAM + (opcional) binding WIF.
# GERA CUSTO MÍNIMO (bucket vazio ≈ R$ 0; lifecycle não cobra).
#
# Por padrão é DRY — só imprime o plano.
# Para aplicar de verdade:
#   CONFIRM=YES ENV=dev ./scripts/backup/firestore/setup-infra.sh
#   CONFIRM=YES ENV=prod ./scripts/backup/firestore/setup-infra.sh
#
# Requer gcloud autenticado com permissão Owner/Editor no projeto alvo.
set -euo pipefail

# shellcheck source=config.sh
source "$(dirname "$0")/config.sh"

ENV="${ENV:-}"
CONFIRM="${CONFIRM:-}"
EXTEND_WIF_FOR_DEVELOP="${EXTEND_WIF_FOR_DEVELOP:-0}"

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "❌ Informe ENV=dev ou ENV=prod"
  exit 1
fi

if [[ "$ENV" == "prod" ]]; then
  PROJECT="$FS_PROJECT_PROD"
  PROJECT_NUMBER="$FS_PROJECT_NUMBER_PROD"
  BUCKET="$FS_BUCKET_PROD"
  SA_EMAIL="$FS_BACKUP_SA_PROD"
  SA_ID="github-firestore-backup"
else
  PROJECT="$FS_PROJECT_DEV"
  PROJECT_NUMBER="$FS_PROJECT_NUMBER_DEV"
  BUCKET="$FS_BUCKET_DEV"
  SA_EMAIL="$FS_BACKUP_SA_DEV"
  SA_ID="github-firestore-backup"
fi

echo "============================================================"
echo " PLANO — infra de backup Firestore ($ENV)"
echo "============================================================"
echo " Projeto:     $PROJECT ($PROJECT_NUMBER)"
echo " Bucket:      gs://$BUCKET  (location=$FS_BUCKET_LOCATION, Nearline)"
echo " Lifecycle:   Delete age>=${FS_RETENTION_DAYS} dias"
echo " SA:          $SA_EMAIL"
echo " Papéis:      roles/datastore.importExportAdmin (projeto)"
echo "              roles/storage.objectAdmin (bucket)"
echo "              roles/storage.legacyBucketReader (bucket)"
echo " WIF:         personificar SA a partir do repo Cell-City-Site"
echo " Custo est.:  ≪ R\$ 1/mês com ~1–5 MB × 13 semanas (Nearline)"
echo "              + 1 leitura/doc por export semanal (free tier tipicamente cobre)"
echo "============================================================"

if [[ "$CONFIRM" != "YES" ]]; then
  echo ""
  echo "Nada aplicado (falta CONFIRM=YES). Revise o plano e rode de novo."
  exit 0
fi

echo "-- Habilitando APIs necessárias --"
gcloud services enable \
  firestore.googleapis.com \
  storage.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  --project="$PROJECT"

echo "-- Criando bucket (idempotente) --"
if gcloud storage buckets describe "gs://${BUCKET}" --project="$PROJECT" >/dev/null 2>&1; then
  echo "Bucket já existe: gs://${BUCKET}"
else
  gcloud storage buckets create "gs://${BUCKET}" \
    --project="$PROJECT" \
    --location="$FS_BUCKET_LOCATION" \
    --default-storage-class=NEARLINE \
    --uniform-bucket-level-access
fi

echo "-- Lifecycle ${FS_RETENTION_DAYS} dias --"
LIFECYCLE_JSON="$(mktemp)"
cat > "$LIFECYCLE_JSON" <<JSON
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": ${FS_RETENTION_DAYS}}
    }
  ]
}
JSON
gcloud storage buckets update "gs://${BUCKET}" --lifecycle-file="$LIFECYCLE_JSON"
rm -f "$LIFECYCLE_JSON"

echo "-- Service account (idempotente) --"
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT" >/dev/null 2>&1; then
  echo "SA já existe: $SA_EMAIL"
else
  gcloud iam service-accounts create "$SA_ID" \
    --project="$PROJECT" \
    --display-name="GitHub Actions Firestore backup"
fi

echo "-- IAM no projeto (import/export) --"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/datastore.importExportAdmin" \
  --condition=None \
  --format=none

echo "-- IAM no bucket --"
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin"
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.legacyBucketReader"

# App Engine default SA também precisa escrever no bucket em alguns fluxos
# de export gerenciado (o serviço Firestore usa SA do projeto).
APPENGINE_SA="${PROJECT}@appspot.gserviceaccount.com"
if gcloud iam service-accounts describe "$APPENGINE_SA" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
    --member="serviceAccount:${APPENGINE_SA}" \
    --role="roles/storage.admin" || true
fi

echo "-- WIF: permitir Actions personificar a SA de backup --"
# Prod já tem pool github. DEV pode não ter — criar só se pedido.
if [[ "$ENV" == "prod" ]]; then
  POOL_PATH="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github"
  gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
    --project="$PROJECT" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/${POOL_PATH}/attribute.repository/itamaratento/Cell-City-Site" \
    --format=none

  if [[ "$EXTEND_WIF_FOR_DEVELOP" == "1" ]]; then
    echo "AVISO: o provider github-oidc hoje restringe attribute.ref a refs/heads/main."
    echo "Para testar o workflow a partir de develop, um operador Owner precisa"
    echo "atualizar a condition do provider (ver README.md § WIF)."
  fi
else
  echo "DEV: se ainda não houver pool WIF neste projeto, use chave local do dono"
  echo "para o primeiro teste (gcloud auth application-default login) OU"
  echo "reutilize o WIF do projeto prod com impersonation cross-project"
  echo "(documentado no README — exige aprovação)."
fi

echo ""
echo "✅ Setup $ENV concluído."
echo "   Próximo: ENV=$ENV ./scripts/backup/firestore/export.sh"
echo "   Depois:  ENV=dev ./scripts/backup/firestore/test-restore-dev.sh"
