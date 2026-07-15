#!/bin/bash
# Cell City Control Center — módulo Ferramentas, Auditoria Bash.
# Verifica sintaxe, permissões, scripts duplicados e não utilizados.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_ferr_auditoria_bash() {
  _cc_ferr_aud_bash_sintaxe
  _cc_ferr_aud_bash_permissoes
  _cc_ferr_aud_bash_duplicados
  _cc_ferr_aud_bash_nao_utilizados
}

_cc_ferr_aud_bash_sintaxe() {
  local invalidos=0 verificados=0 lista=""
  while IFS= read -r -d '' f; do
    if head -1 "$f" 2>/dev/null | grep -q '^#!/bin/bash'; then
      verificados=$((verificados + 1))
      if ! bash -n "$f" 2>/dev/null; then
        invalidos=$((invalidos + 1))
        lista="${lista}$(basename "$f") "
      fi
    fi
  done < <(find "$REPO_DIR" -name '*.sh' -type f -print0 2>/dev/null)
  if [ "$invalidos" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Sintaxe Bash" "${verificados} scripts válidos"
  else
    _cc_ferr_adicionar "fail" "Sintaxe Bash" "${invalidos}/${verificados} com erro: ${lista}" "Scripts com erro de sintaxe" "Não podem ser executados" "Corrija com bash -n"
  fi
  if command -v shellcheck &>/dev/null; then
    _cc_ferr_info "ShellCheck está disponível no sistema"
  else
    _cc_ferr_info "ShellCheck CLI não encontrado (instale com: apt install shellcheck)"
  fi
}

_cc_ferr_aud_bash_permissoes() {
  local nao_exec=0 total=0
  while IFS= read -r -d '' f; do
    total=$((total + 1))
    [ ! -x "$f" ] && nao_exec=$((nao_exec + 1))
  done < <(find "$REPO_DIR/scripts" -name '*.sh' -type f -print0 2>/dev/null)
  if [ "$nao_exec" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Permissões" "Todos executáveis"
  else
    _cc_ferr_adicionar "warn" "Permissões" "${nao_exec}/${total} não executáveis"
  fi
}

_cc_ferr_aud_bash_duplicados() {
  local -A seen=() duplicados=0
  while IFS= read -r -d '' f; do
    local nome
    nome=$(basename "$f")
    if [ -n "${seen[$nome]:-}" ]; then
      duplicados=$((duplicados + 1))
    fi
    seen[$nome]="$f"
  done < <(find "$REPO_DIR" -name '*.sh' -type f -print0 2>/dev/null)
  if [ "$duplicados" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Scripts Duplicados" "Nenhum"
  else
    _cc_ferr_adicionar "warn" "Scripts Duplicados" "${duplicados} nome(s) duplicado(s)"
  fi
}

_cc_ferr_aud_bash_nao_utilizados() {
  local -A chamados=() suspeitos=0
  while IFS= read -r -d '' f; do
    while IFS= read -r line; do
      if [[ "$line" =~ ^[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*)\ \(\) ]]; then
        local func="${BASH_REMATCH[1]}"
        chamados["$func"]=1
      fi
    done < "$f"
  done < <(find "$REPO_DIR/scripts" -name '*.sh' -type f -print0 2>/dev/null)
  while IFS= read -r -d '' f; do
    while IFS= read -r line; do
      for func in "${!chamados[@]}"; do
        if echo "$line" | grep -qP "(?<![a-zA-Z_])${func}(?![a-zA-Z_])" && ! echo "$line" | grep -qP "^\s*${func}\s*\(\)"; then
          unset "chamados[$func]"
        fi
      done
    done < "$f"
  done < <(find "$REPO_DIR/scripts" -name '*.sh' -type f -print0 2>/dev/null)
  for func in "${!chamados[@]}"; do
    suspeitos=$((suspeitos + 1))
  done
  if [ "$suspeitos" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Scripts Não Utilizados" "Nenhum"
  else
    _cc_ferr_adicionar "warn" "Scripts Não Utilizados" "${suspeitos} função(ões) definida(s) mas sem referência externa"
  fi
}
