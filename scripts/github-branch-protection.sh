#!/usr/bin/env bash
# ============================================================
# Configura Branch Protection para main e develop
# Uso: ./scripts/github-branch-protection.sh
# Requer: gh CLI autenticado (gh auth login)
# ============================================================
set -euo pipefail

REPO="itamaratento/Cell-City-Site"

echo "=== Configurando branch protection para $REPO ==="

# main: proteção total
gh api "repos/$REPO/branches/main/protection" --method PUT \
  --header "Accept: application/vnd.github.v3+json" \
  --input - <<'EOF' || echo "main já configurada ou erro"
{
  "required_status_checks": {
    "strict": true,
    "contexts": []
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF

# develop: proteção com validação CI
gh api "repos/$REPO/branches/develop/protection" --method PUT \
  --header "Accept: application/vnd.github.v3+json" \
  --input - <<'EOF' || echo "develop já configurada ou erro"
{
  "required_status_checks": {
    "strict": false,
    "contexts": []
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": true,
  "allow_deletions": false,
  "required_conversation_resolution": false
}
EOF

echo "=== Branch protection configurada ==="
