#!/usr/bin/env bash
# D03 (Fase 3.9) — Concessões IAM pendentes do Workload Identity Federation.
# Já criados nesta data (2026-07-18): pool "github", provider "github-oidc"
# (restrito a itamaratento/Cell-City-Site @ refs/heads/main) e a service
# account github-deploy. Estes 5 bindings foram bloqueados pelo sandbox da
# sessão de IA — executar com um operador humano autenticado no gcloud
# (conta com roles/owner em cellcity-crm).
set -Eeuo pipefail

PROJECT="cellcity-crm"
PROJECT_NUMBER="645609867368"
SA="github-deploy@${PROJECT}.iam.gserviceaccount.com"
POOL_PATH="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github"

# 1-4. Papéis de deploy no projeto (Rules/Indexes/Storage via firebase.admin;
#      Functions Gen2 via cloudfunctions.admin + actAs da SA runtime).
for ROLE in roles/firebase.admin roles/cloudfunctions.admin \
            roles/iam.serviceAccountUser roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${SA}" --role="$ROLE" --condition=None --format=none
  echo "OK: $ROLE"
done

# 5. Permite que tokens OIDC do repo (já filtrados p/ ref main pelo provider)
#    personifiquem a SA de deploy.
gcloud iam service-accounts add-iam-policy-binding "$SA" --project="$PROJECT" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_PATH}/attribute.repository/itamaratento/Cell-City-Site" \
  --format=none
echo "OK: workloadIdentityUser (principalSet do repo)"

echo "Concluído. Validar com: gcloud projects get-iam-policy ${PROJECT} --flatten='bindings[].members' --filter='bindings.members:github-deploy'"
