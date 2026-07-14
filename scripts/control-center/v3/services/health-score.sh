#!/bin/bash
# CELL CITY V3 - NOC Health Score Engine
# Calculo de health score consolidado com pesos por componente.
# Faixas: EXCELENTE (95-100), BOM (80-94), ATENCAO (60-79), CRITICO (0-59)
set -uo pipefail

: "${V3_ROOT:?V3_ROOT precisa estar definido antes de carregar services/health-score.sh}"

declare -A _V3_HEALTH_COMPONENT_WEIGHTS
_V3_HEALTH_COMPONENT_WEIGHTS["git"]=10
_V3_HEALTH_COMPONENT_WEIGHTS["system"]=10
_V3_HEALTH_COMPONENT_WEIGHTS["firebase"]=10
_V3_HEALTH_COMPONENT_WEIGHTS["backup"]=10
_V3_HEALTH_COMPONENT_WEIGHTS["release"]=10
_V3_HEALTH_COMPONENT_WEIGHTS["crm"]=10
_V3_HEALTH_COMPONENT_WEIGHTS["security"]=10
_V3_HEALTH_COMPONENT_WEIGHTS["modules"]=10
_V3_HEALTH_COMPONENT_WEIGHTS["site"]=10
_V3_HEALTH_COMPONENT_WEIGHTS["workspace"]=10

declare -A _V3_HEALTH_SCORES
declare -A _V3_HEALTH_DETAILS

_v3_health_compute_score() {
  local component="$1" data="$2"
  local status score=0

  status=$(echo "$data" | jq -r '.status // "error"' 2>/dev/null)

  case "$component" in
    git)
      local ws branch
      ws=$(echo "$data" | jq -r '.workspace // "dirty"')
      branch=$(echo "$data" | jq -r '.branch // "unknown"')
      [[ "$ws" == "clean" ]] && ((score+=5)) || score=0
      [[ "$branch" != "unknown" ]] && ((score+=3))
      local ahead behind
      ahead=$(echo "$data" | jq -r '.ahead // 0')
      behind=$(echo "$data" | jq -r '.behind // 0')
      [[ "$ahead" == "0" ]] && [[ "$behind" == "0" ]] && ((score+=2))
      ;;
    system)
      local cpu ram disk
      cpu=$(echo "$data" | jq -r '.cpu_percent // 100')
      ram=$(echo "$data" | jq -r '.ram_percent // 100')
      disk=$(echo "$data" | jq -r '.disk_percent // 100')
      # if/elif por métrica: a forma "A && B || C && D" somava as duas faixas
      # quando a primeira condição era verdadeira (precedência do bash)
      if   [[ "$cpu" -lt 80 ]];  then ((score+=4)); elif [[ "$cpu" -lt 90 ]];  then ((score+=2)); fi
      if   [[ "$ram" -lt 80 ]];  then ((score+=3)); elif [[ "$ram" -lt 90 ]];  then ((score+=1)); fi
      if   [[ "$disk" -lt 80 ]]; then ((score+=3)); elif [[ "$disk" -lt 90 ]]; then ((score+=1)); fi
      ;;
    firebase)
      [[ "$status" == "configured" ]] && score=8
      local rules
      rules=$(echo "$data" | jq -r '.rules // "missing"')
      [[ "$rules" == "configured" ]] && ((score+=2))
      ;;
    backup)
      local count
      count=$(echo "$data" | jq -r '.count // 0')
      [[ "$count" -gt 0 ]] && score=6 || score=2
      local last
      last=$(echo "$data" | jq -r '.last_backup // "N/A"')
      [[ "$last" != "N/A" ]] && ((score+=2))
      local auto
      auto=$(echo "$data" | jq -r '.auto_configured // "desconhecido"')
      [[ "$auto" == "configurado" ]] && ((score+=2))
      ;;
    release)
      local tag deploy
      tag=$(echo "$data" | jq -r '.last_tag // "none"')
      [[ "$tag" != "none" ]] && score=7 || score=3
      deploy=$(echo "$data" | jq -r '.deploy_status // "desconhecido"')
      [[ "$deploy" == "configurado" ]] && ((score+=3))
      ;;
    crm)
      local modules pages
      modules=$(echo "$data" | jq -r '.modules // 0')
      pages=$(echo "$data" | jq -r '.pages // 0')
      [[ "$modules" -gt 0 ]] && ((score+=6))
      [[ "$pages" -gt 0 ]] && ((score+=4))
      ;;
    security)
      local rbac rbac_tests
      rbac=$(echo "$data" | jq -r '.rbac // "unknown"')
      rbac_tests=$(echo "$data" | jq -r '.rbac_tests // 0')
      [[ "$rbac" == "configured" ]] && ((score+=5))
      [[ "$rbac_tests" -gt 0 ]] && ((score+=5))
      ;;
    modules)
      local total
      total=$(echo "$data" | jq -r '.total_modules // 0')
      [[ "$total" -ge 10 ]] && score=10 || score="$total"
      ;;
    site)
      [[ "$status" == "OK" ]] && score=10 || score=0
      ;;
    workspace)
      # Não existe coletor "workspace" em _v3_collect_all — o status vinha sempre
      # "error" e este componente pontuava 0, limitando o score global a 90.
      # O estado do workspace é medido direto no git, sem depender de coletor.
      if git -C "$REPO_DIR" diff --quiet 2>/dev/null && git -C "$REPO_DIR" diff --cached --quiet 2>/dev/null; then
        score=10
      else
        score=5
      fi
      ;;
    *)
      [[ "$status" == "OK" ]] && score=10 || score=5
      ;;
  esac

  [[ "$score" -gt 10 ]] && score=10
  [[ "$score" -lt 0 ]] && score=0

  _V3_HEALTH_SCORES["$component"]=$score
  _V3_HEALTH_DETAILS["$component"]=$(echo "$data" | jq -c --argjson sc "$score" '. + {score: $sc}' 2>/dev/null)
}

_v3_health_calculate() {
  _V3_HEALTH_SCORES=()
  _V3_HEALTH_DETAILS=()

  if ! declare -f _v3_collect_all >/dev/null 2>&1; then
    source "$V3_ROOT/services/collectors.sh" 2>/dev/null || true
  fi

  local all_data
  all_data=$(_v3_collect_all 2>/dev/null || echo "{}")

  local component
  for component in "${!_V3_HEALTH_COMPONENT_WEIGHTS[@]}"; do
    local data
    data=$(echo "$all_data" | jq -c ".$component // {status: \"error\"}" 2>/dev/null)
    _v3_health_compute_score "$component" "$data"
  done

  local total_score=0 total_weight=0
  for component in "${!_V3_HEALTH_COMPONENT_WEIGHTS[@]}"; do
    local weight="${_V3_HEALTH_COMPONENT_WEIGHTS[$component]}"
    local score="${_V3_HEALTH_SCORES[$component]:-0}"
    total_score=$((total_score + score * weight))
    total_weight=$((total_weight + weight))
  done

  local final_score=0
  if [[ "$total_weight" -gt 0 ]]; then
    # Scores por componente vão de 0-10; ×10 converte a média ponderada para a
    # escala 0-100 dos thresholds (sem isso o máximo era 10 → sempre CRITICO).
    final_score=$(( total_score * 10 / total_weight ))
  fi

  local level
  if [[ "$final_score" -ge 95 ]]; then level="EXCELENTE"
  elif [[ "$final_score" -ge 80 ]]; then level="BOM"
  elif [[ "$final_score" -ge 60 ]]; then level="ATENCAO"
  else level="CRITICO"
  fi

  local components_json="{}"
  for component in "${!_V3_HEALTH_DETAILS[@]}"; do
    components_json=$(echo "$components_json" | jq --arg key "$component" --argjson val "${_V3_HEALTH_DETAILS[$component]}" '. + {($key): $val}' 2>/dev/null)
  done

  local result
  result=$(jq -n \
    --argjson score "$final_score" \
    --arg level "$level" \
    --arg ts "$(_v3_timestamp)" \
    --argjson weight "$total_weight" \
    --argjson components "$components_json" \
    '{score: $score, level: $level, total_weight: $weight, components: $components, updated_at: $ts}')

  echo "$result"
}

_v3_health_quick() {
  local git_data system_data
  git_data=$(_v3_collect_git 2>/dev/null || echo '{"status":"error"}')
  system_data=$(_v3_collect_system 2>/dev/null || echo '{"status":"error"}')

  local ws cpu score=50
  ws=$(echo "$git_data" | jq -r '.workspace // "dirty"')
  cpu=$(echo "$system_data" | jq -r '.cpu_percent // 50')

  [[ "$ws" == "clean" ]] && ((score+=20))
  [[ "$cpu" -lt 50 ]] && ((score+=15))
  [[ "$cpu" -lt 80 ]] && ((score+=10))

  local level
  if [[ "$score" -ge 95 ]]; then level="EXCELENTE"
  elif [[ "$score" -ge 80 ]]; then level="BOM"
  elif [[ "$score" -ge 60 ]]; then level="ATENCAO"
  else level="CRITICO"
  fi

  jq -n --argjson sc "$score" --arg lv "$level" --arg ts "$(_v3_timestamp)" \
    '{score: $sc, level: $lv, updated_at: $ts}'
}
