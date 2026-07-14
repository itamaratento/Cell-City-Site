#!/bin/bash
# CELL CITY V3 — NOC Data Collectors
# Coletores de dados reais para o NOC Dashboard.
# Cada coletor retorna JSON com status, dados e timestamp.
# Todos usam cache para performance — nunca repetem chamadas caras.
set -uo pipefail

: "${V3_ROOT:?V3_ROOT precisa estar definido antes de carregar services/collectors.sh}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_V3_COLLECTOR_TTL=15
_V3_COLLECTOR_LONG_TTL=60

_v3_collect_git() {
  local cache_key="collector:git"
  local cached
  if cached=$(_v3_cache_get "$cache_key" 2>/dev/null); then
    echo "$cached"
    return 0
  fi

  local branch commit workspace_status ahead behind last_tag last_commit_msg
  branch=$(git -C "$REPO_DIR" branch --show-current 2>/dev/null || echo "unknown")
  commit=$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
  last_commit_msg=$(git -C "$REPO_DIR" log -1 --format=%s 2>/dev/null | head -c 80 || echo "")

  if git -C "$REPO_DIR" diff --quiet 2>/dev/null && git -C "$REPO_DIR" diff --cached --quiet 2>/dev/null; then
    workspace_status="clean"
  else
    workspace_status="dirty"
  fi

  # ahead = commits locais ainda não enviados (@{u}..HEAD); behind = o inverso
  ahead=$(git -C "$REPO_DIR" rev-list --count @{u}..HEAD 2>/dev/null || echo "0")
  behind=$(git -C "$REPO_DIR" rev-list --count HEAD..@{u} 2>/dev/null || echo "0")
  last_tag=$(git -C "$REPO_DIR" describe --tags --abbrev=0 2>/dev/null || echo "none")
  local last_push
  last_push=$(git -C "$REPO_DIR" log -1 --format=%ai origin/HEAD 2>/dev/null | cut -d' ' -f1,2 | head -c 16 || echo "N/A")

  local result
  result=$(jq -n \
    --arg branch "$branch" \
    --arg commit "$commit" \
    --arg ws "$workspace_status" \
    --argjson ahead "$ahead" \
    --argjson behind "$behind" \
    --arg tag "$last_tag" \
    --arg msg "$last_commit_msg" \
    --arg push "$last_push" \
    --arg ts "$(_v3_timestamp)" \
    '{status: (if $ws == "clean" then "OK" else "DIRTY" end), branch: $branch, commit: $commit, workspace: $ws, ahead: $ahead, behind: $behind, last_tag: $tag, last_commit_msg: $msg, last_push: $push, updated_at: $ts}')

  _v3_cache_set "$cache_key" "$result" "$_V3_COLLECTOR_TTL"
  echo "$result"
}

_v3_collect_system() {
  local cache_key="collector:system"
  local cached
  if cached=$(_v3_cache_get "$cache_key" 2>/dev/null); then
    echo "$cached"
    return 0
  fi

  # LC_ALL=C: em pt_BR o free imprime "Mem.:" e números podem usar vírgula —
  # os padrões awk abaixo só são estáveis no locale C.
  local cpu_usage ram_pct disk_pct uptime_sec
  cpu_usage=$(LC_ALL=C top -bn1 2>/dev/null | awk '/^%Cpu/ {print 100 - $8}' 2>/dev/null) || cpu_usage="0"
  [[ -z "$cpu_usage" ]] && cpu_usage="0"
  cpu_usage=$(LC_ALL=C printf "%.0f" "$cpu_usage" 2>/dev/null || echo "0")

  local ram_total ram_used
  ram_total=$(LC_ALL=C free -m 2>/dev/null | awk '/^Mem:/ {print $2}') || ram_total="0"
  ram_used=$(LC_ALL=C free -m 2>/dev/null | awk '/^Mem:/ {print $3}') || ram_used="0"
  [[ -z "$ram_total" ]] && ram_total="0"
  [[ -z "$ram_used" ]] && ram_used="0"
  if [[ "$ram_total" -gt 0 ]]; then
    ram_pct=$(( ram_used * 100 / ram_total ))
  else
    ram_pct="0"
  fi

  disk_pct=$(df -h / 2>/dev/null | awk 'NR==2 {gsub(/%/,""); print $5}') || disk_pct="0"
  [[ -z "$disk_pct" ]] && disk_pct="0"

  uptime_sec=$(awk '{printf "%.0f", $1}' /proc/uptime 2>/dev/null || echo "0")

  local ram_status="OK"
  [[ "$ram_pct" -gt 80 ]] && ram_status="ATENCAO"
  [[ "$ram_pct" -gt 90 ]] && ram_status="CRITICO"

  local disk_status="OK"
  [[ "$disk_pct" -gt 80 ]] && disk_status="ATENCAO"
  [[ "$disk_pct" -gt 90 ]] && disk_status="CRITICO"

  local result
  result=$(jq -n \
    --argjson cpu "$cpu_usage" \
    --argjson ram "$ram_pct" \
    --argjson disk "$disk_pct" \
    --argjson uptime "$uptime_sec" \
    --arg ram_total "$ram_total" \
    --arg ram_used "$ram_used" \
    --arg ram_status "$ram_status" \
    --arg disk_status "$disk_status" \
    --arg ts "$(_v3_timestamp)" \
    '{status: "OK", cpu_percent: $cpu, ram_percent: $ram, disk_percent: $disk, ram_total_mb: $ram_total, ram_used_mb: $ram_used, ram_status: $ram_status, disk_status: $disk_status, uptime_seconds: $uptime, updated_at: $ts}')

  _v3_cache_set "$cache_key" "$result" "$_V3_COLLECTOR_TTL"
  echo "$result"
}

_v3_collect_firebase() {
  local cache_key="collector:firebase"
  local cached
  if cached=$(_v3_cache_get "$cache_key" 2>/dev/null); then
    echo "$cached"
    return 0
  fi

  local firestore_status="checking" functions_status="checking" rules_status="checking"
  local project_id=""

  project_id=$(grep -oP '"default"\s*:\s*"\K[^"]+' "$REPO_DIR/.firebaserc" 2>/dev/null || echo "")
  [[ -z "$project_id" ]] && project_id=$(grep -oP 'project\s+\K\S+' "$REPO_DIR/.firebaserc" 2>/dev/null || echo "unknown")

  if [[ -f "$REPO_DIR/CRM/firestore.rules" ]]; then
    rules_status="configured"
  else
    rules_status="missing"
  fi

  if [[ -d "$REPO_DIR/functions" ]]; then
    functions_status="configured"
  else
    functions_status="missing"
  fi

  if [[ -f "$REPO_DIR/CRM/firestore.indexes.json" ]]; then
    firestore_status="configured"
  fi

  local num_collections
  num_collections=$(grep -c 'match /' "$REPO_DIR/CRM/firestore.rules" 2>/dev/null) || true
  [[ -z "$num_collections" ]] && num_collections=0

  local result
  result=$(jq -n \
    --arg proj "$project_id" \
    --arg fs "$firestore_status" \
    --arg fn "$functions_status" \
    --arg rules "$rules_status" \
    --argjson cols "$num_collections" \
    --arg ts "$(_v3_timestamp)" \
    '{status: "configured", project_id: $proj, firestore: $fs, functions: $fn, rules: $rules, collections: $cols, updated_at: $ts}')

  _v3_cache_set "$cache_key" "$result" "$_V3_COLLECTOR_LONG_TTL"
  echo "$result"
}

_v3_collect_backup() {
  local cache_key="collector:backup"
  local cached
  if cached=$(_v3_cache_get "$cache_key" 2>/dev/null); then
    echo "$cached"
    return 0
  fi

  local backup_dir="$REPO_DIR/_BACKUPS"
  local last_backup="N/A" backup_count=0 backup_size="0"

  if [[ -d "$backup_dir" ]]; then
    backup_count=$(find "$backup_dir" -maxdepth 1 -type d -name "backup_*" 2>/dev/null | wc -l)
    last_backup=$(find "$backup_dir" -maxdepth 1 -type d -name "backup_*" -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | awk '{$1=""; print $0}' | sed 's/.*backup_//' || echo "N/A")
    backup_size=$(du -sh "$backup_dir" 2>/dev/null | awk '{print $1}' || echo "0")
  fi

  local backup_status="OK"
  [[ "$backup_count" -eq 0 ]] && backup_status="ATENCAO"

  local backup_dirs_file="$REPO_DIR/scripts/backup/config.sh"
  local auto_backup="desconhecido"
  if [[ -f "$backup_dirs_file" ]]; then
    auto_backup="configurado"
  fi

  local result
  result=$(jq -n \
    --arg status "$backup_status" \
    --argjson count "$backup_count" \
    --arg last "$last_backup" \
    --arg size "$backup_size" \
    --arg auto "$auto_backup" \
    --arg ts "$(_v3_timestamp)" \
    '{status: $status, count: $count, last_backup: $last, size: $size, auto_configured: $auto, updated_at: $ts}')

  _v3_cache_set "$cache_key" "$result" "$_V3_COLLECTOR_LONG_TTL"
  echo "$result"
}

_v3_collect_release() {
  local cache_key="collector:release"
  local cached
  if cached=$(_v3_cache_get "$cache_key" 2>/dev/null); then
    echo "$cached"
    return 0
  fi

  local last_tag="none" last_release_date="N/A" last_deploy="N/A" release_count=0

  last_tag=$(git -C "$REPO_DIR" describe --tags --abbrev=0 2>/dev/null || echo "none")
  if [[ "$last_tag" != "none" ]]; then
    last_release_date=$(git -C "$REPO_DIR" log -1 --format=%ai "$last_tag" 2>/dev/null | cut -d' ' -f1 || echo "N/A")
  fi
  release_count=$(git -C "$REPO_DIR" tag -l 'v*' 2>/dev/null | wc -l)

  local gh_actions_file="$REPO_DIR/.github/workflows/deploy-pages.yml"
  local deploy_status="desconhecido"
  if [[ -f "$gh_actions_file" ]]; then
    deploy_status="configurado"
  fi

  local result
  result=$(jq -n \
    --arg status "OK" \
    --arg tag "$last_tag" \
    --arg date "$last_release_date" \
    --argjson count "$release_count" \
    --arg deploy "$deploy_status" \
    --arg ts "$(_v3_timestamp)" \
    '{status: $status, last_tag: $tag, last_release_date: $date, total_releases: $count, deploy_status: $deploy, updated_at: $ts}')

  _v3_cache_set "$cache_key" "$result" "$_V3_COLLECTOR_LONG_TTL"
  echo "$result"
}

_v3_collect_crm() {
  local cache_key="collector:crm"
  local cached
  if cached=$(_v3_cache_get "$cache_key" 2>/dev/null); then
    echo "$cached"
    return 0
  fi

  local crm_dir="$REPO_DIR/CRM"
  local status="OK" modules=0 pages=0

  if [[ -d "$crm_dir/pages" ]]; then
    # Módulos do CRM são subpastas de pages/ com index.html (pages/os/index.html)
    modules=$(find "$crm_dir/pages" -mindepth 2 -maxdepth 2 -name "index.html" 2>/dev/null | wc -l)
  fi
  if [[ -f "$crm_dir/index.html" ]]; then
    pages=1
  fi

  local result
  result=$(jq -n \
    --arg status "$status" \
    --argjson modules "$modules" \
    --argjson pages "$pages" \
    --arg ts "$(_v3_timestamp)" \
    '{status: $status, modules: $modules, pages: $pages, updated_at: $ts}')

  _v3_cache_set "$cache_key" "$result" "$_V3_COLLECTOR_LONG_TTL"
  echo "$result"
}

_v3_collect_security() {
  local cache_key="collector:security"
  local cached
  if cached=$(_v3_cache_get "$cache_key" 2>/dev/null); then
    echo "$cached"
    return 0
  fi

  local status="OK" rbac_status="checking" service_account_leak="unknown"

  if [[ -f "$REPO_DIR/CRM/firestore.rules" ]]; then
    rbac_status="configured"
  fi

  local rbac_test_dir="$REPO_DIR/tests/rbac"
  local rbac_tests=0
  if [[ -d "$rbac_test_dir" ]]; then
    rbac_tests=$(find "$rbac_test_dir" -name "*.mjs" -o -name "*.js" 2>/dev/null | wc -l)
  fi

  if [[ "$rbac_tests" -gt 0 ]] && [[ "$rbac_status" == "configured" ]]; then
    status="OK"
  fi

  local result
  result=$(jq -n \
    --arg status "$status" \
    --arg rbac "$rbac_status" \
    --argjson rbac_tests "$rbac_tests" \
    --arg ts "$(_v3_timestamp)" \
    '{status: $status, rbac: $rbac, rbac_tests: $rbac_tests, updated_at: $ts}')

  _v3_cache_set "$cache_key" "$result" "$_V3_COLLECTOR_LONG_TTL"
  echo "$result"
}

_v3_collect_modules() {
  local cache_key="collector:modules"
  local cached
  if cached=$(_v3_cache_get "$cache_key" 2>/dev/null); then
    echo "$cached"
    return 0
  fi

  local cc_modules_dir="$CC_ROOT/modules"
  local active_count=0

  if [[ -d "$cc_modules_dir" ]]; then
    for mdir in "$cc_modules_dir"/*/; do
      [[ -d "$mdir" ]] || continue
      [[ -f "$mdir/menu.sh" ]] && ((active_count++))
    done
  fi

  local result
  result=$(jq -n \
    --arg status "OK" \
    --argjson total "$active_count" \
    --arg ts "$(_v3_timestamp)" \
    '{status: $status, total_modules: $total, updated_at: $ts}')

  _v3_cache_set "$cache_key" "$result" "$_V3_COLLECTOR_LONG_TTL"
  echo "$result"
}

_v3_collect_site() {
  local cache_key="collector:site"
  local cached
  if cached=$(_v3_cache_get "$cache_key" 2>/dev/null); then
    echo "$cached"
    return 0
  fi

  local index="$REPO_DIR/index.html"
  local status="OK"

  if [[ ! -f "$index" ]]; then
    status="MISSING"
  fi

  local result
  result=$(jq -n \
    --arg status "$status" \
    --arg ts "$(_v3_timestamp)" \
    '{status: $status, updated_at: $ts}')

  _v3_cache_set "$cache_key" "$result" "$_V3_COLLECTOR_LONG_TTL"
  echo "$result"
}

_v3_collect_all() {
  local collectors=("git" "system" "firebase" "backup" "release" "crm" "security" "modules" "site")
  local results="{}"

  for collector in "${collectors[@]}"; do
    local fn="_v3_collect_$collector"
    local data
    if data=$($fn 2>/dev/null); then
      results=$(echo "$results" | jq --arg key "$collector" --argjson val "$data" '. + {($key): $val}' 2>/dev/null || echo "$results")
    else
      results=$(echo "$results" | jq --arg key "$collector" '. + {($key): {status: "error"}}' 2>/dev/null || echo "$results")
      _v3_log "warn" "Collector" "Falha no coletor: $collector"
    fi
  done

  echo "$results"
}
