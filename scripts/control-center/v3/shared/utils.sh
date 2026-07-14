#!/bin/bash
: "${V3_ROOT:?V3_ROOT precisa estar definido antes de carregar shared/utils.sh}"

_v3_timestamp() {
  date '+%Y-%m-%dT%H:%M:%S%:z'
}

_v3_timestamp_epoch() {
  date +%s
}

_v3_json_get() {
  local file="$1" query="$2" default="${3:-}"
  if [[ -f "$file" ]]; then
    jq -r "$query" "$file" 2>/dev/null || echo "$default"
  else
    echo "$default"
  fi
}

_v3_json_set() {
  local file="$1" query="$2" value="$3"
  mkdir -p "$(dirname "$file")"
  if [[ -f "$file" ]]; then
    local tmp
    tmp=$(jq "$query = $value" "$file" 2>/dev/null) && echo "$tmp" > "$file"
  else
    jq -n "$query = $value" > "$file"
  fi
}

_v3_json_append() {
  local file="$1" query="$2" value="$3"
  mkdir -p "$(dirname "$file")"
  if [[ -f "$file" ]]; then
    local tmp
    tmp=$(jq "$query += [$value]" "$file" 2>/dev/null) && echo "$tmp" > "$file"
  else
    jq -n "$query = [$value]" > "$file"
  fi
}

_v3_file_age_seconds() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local now mtime
    now=$(_v3_timestamp_epoch)
    mtime=$(stat -c %Y "$file" 2>/dev/null || echo "$now")
    echo $(( now - mtime ))
  else
    echo "-1"
  fi
}

_v3_is_stale() {
  local file="$1" max_age_seconds="$2"
  local age
  age=$(_v3_file_age_seconds "$file")
  [[ "$age" -gt "$max_age_seconds" ]]
}

_v3_truncate() {
  local text="$1" max="$2"
  if [[ "${#text}" -gt "$max" ]]; then
    echo "${text:0:$((max-3))}..."
  else
    echo "$text"
  fi
}

_v3_colorize_status() {
  local status="$1"
  case "$status" in
    pass|ok|healthy|online|ativo|EXCELENTE|BOM)
      echo "${_CC_C_VERDE}${status}${_CC_C_RESET}" ;;
    warn|warning|ATENCAO|degraded)
      echo "${_CC_C_AMARELO}${status}${_CC_C_RESET}" ;;
    fail|error|critical|CRITICO|offline|inativo)
      echo "${_CC_C_VERMELHO}${status}${_CC_C_RESET}" ;;
    *)
      echo "${_CC_C_CIANO}${status}${_CC_C_RESET}" ;;
  esac
}

_v3_health_label() {
  local score="$1"
  if (( score >= 95 )); then echo "EXCELENTE"
  elif (( score >= 80 )); then echo "BOM"
  elif (( score >= 60 )); then echo "ATENCAO"
  else echo "CRITICO"
  fi
}

_v3_format_duration() {
  local seconds="$1"
  local h m s
  h=$(( seconds / 3600 ))
  m=$(( (seconds % 3600) / 60 ))
  s=$(( seconds % 60 ))
  if (( h > 0 )); then printf '%dh %dm %ds' "$h" "$m" "$s"
  elif (( m > 0 )); then printf '%dm %ds' "$m" "$s"
  else printf '%ds' "$s"
  fi
}

_v3_format_bytes() {
  local bytes="$1"
  if (( bytes > 1073741824 )); then printf '%.1f GB' "$(echo "scale=1; $bytes/1073741824" | bc)"
  elif (( bytes > 1048576 )); then printf '%.1f MB' "$(echo "scale=1; $bytes/1048576" | bc)"
  elif (( bytes > 1024 )); then printf '%.1f KB' "$(echo "scale=1; $bytes/1024" | bc)"
  else echo "${bytes} B"
  fi
}
