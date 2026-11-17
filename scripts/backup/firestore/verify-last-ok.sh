#!/usr/bin/env bash
# Lê gs://…/status/last-ok.json e falha se ausente, ok!=true ou velho demais.
# Usado pelo workflow de backup e pelo keepalive.
#
# Uso:
#   ENV=dev|prod ./scripts/backup/firestore/verify-last-ok.sh
#   ENV=prod MAX_AGE_DAYS=10 ./scripts/backup/firestore/verify-last-ok.sh
set -euo pipefail

# shellcheck source=config.sh
source "$(dirname "$0")/config.sh"

ENV="${ENV:-}"
MAX_AGE_DAYS="${MAX_AGE_DAYS:-$FS_LAST_OK_MAX_AGE_DAYS}"

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "❌ Informe ENV=dev ou ENV=prod"
  exit 1
fi

if [[ "$ENV" == "prod" ]]; then
  BUCKET="$FS_BUCKET_PROD"
  PROJECT="$FS_PROJECT_PROD"
else
  BUCKET="$FS_BUCKET_DEV"
  PROJECT="$FS_PROJECT_DEV"
fi

STATUS_URI="gs://${BUCKET}/${FS_STATUS_OBJECT}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

echo "-- Verificando $STATUS_URI (projeto $PROJECT) --"
if ! gcloud storage cp "$STATUS_URI" "$TMP" 2>/tmp/cc-last-ok-err; then
  echo "❌ last-ok ausente ou inacessível:"
  cat /tmp/cc-last-ok-err >&2 || true
  exit 1
fi

python3 - "$TMP" "$MAX_AGE_DAYS" <<'PY'
import json, sys, datetime
path, max_age = sys.argv[1], int(sys.argv[2])
d = json.load(open(path))
print(json.dumps(d, indent=2))
if not d.get("ok"):
    print("❌ last-ok.ok != true", file=sys.stderr); sys.exit(1)
ts = d.get("exportedAt") or d.get("timestamp")
if not ts:
    print("❌ last-ok sem exportedAt", file=sys.stderr); sys.exit(1)
when = datetime.datetime.strptime(ts.replace("Z",""), "%Y-%m-%dT%H:%M:%S")
age = datetime.datetime.utcnow() - when
if age.days > max_age:
    print(f"❌ last-ok velho demais: {age.days}d > {max_age}d", file=sys.stderr)
    sys.exit(1)
print(f"✅ last-ok fresco ({age.days}d ≤ {max_age}d)")
PY
