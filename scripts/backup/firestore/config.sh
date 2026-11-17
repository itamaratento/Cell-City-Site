# Configuração do backup gerenciado Firestore → GCS (Cell City).
# NÃO contém dados de clientes. Só nomes de projetos/buckets/SAs.
#
# Uso: source por export.sh / restore.sh / setup-infra.sh / test-restore-dev.sh

# Projetos Firebase/GCP
FS_PROJECT_PROD="cellcity-crm"
FS_PROJECT_DEV="cellcity-crm-dev"
FS_PROJECT_NUMBER_PROD="645609867368"
# Número do projeto DEV (preencher/ajustar no setup se diferente):
FS_PROJECT_NUMBER_DEV="${FS_PROJECT_NUMBER_DEV:-107140334516}"

# Buckets dedicados — NUNCA o bucket padrão do Firebase Storage do app.
# Nearline + lifecycle 90 dias (definido em setup-infra.sh).
FS_BUCKET_PROD="cellcity-crm-firestore-backups"
FS_BUCKET_DEV="cellcity-crm-dev-firestore-backups"
FS_BUCKET_LOCATION="${FS_BUCKET_LOCATION:-southamerica-east1}"

# Service account dedicada (least privilege). Criada pelo setup-infra.sh.
FS_BACKUP_SA_PROD="github-firestore-backup@${FS_PROJECT_PROD}.iam.gserviceaccount.com"
FS_BACKUP_SA_DEV="github-firestore-backup@${FS_PROJECT_DEV}.iam.gserviceaccount.com"

# Workload Identity (já existe no projeto prod — reutilizado)
FS_WIF_PROVIDER_PROD="projects/${FS_PROJECT_NUMBER_PROD}/locations/global/workloadIdentityPools/github/providers/github-oidc"

# Retenção (dias) — lifecycle GCS apaga objetos com age >= este valor
FS_RETENTION_DAYS=90

# Idade máxima do last-ok antes do keepalive falhar (dias)
FS_LAST_OK_MAX_AGE_DAYS=10

# Prefixo dos exports e do marcador de status (sem dados de cliente no GitHub)
FS_EXPORT_PREFIX="exports"
FS_STATUS_OBJECT="status/last-ok.json"
