#!/bin/bash
# Duplicados: scripts repetidos por nome, funcoes duplicadas, codigo redundante.
set -uo pipefail
: "${CC_ROOT:?}"; : "${REPO_DIR:?}"

_cc_man_duplicados() {
  _cc_man_dup_scripts
  _cc_man_dup_funcoes
  _cc_man_dup_conteudo
}

_cc_man_dup_scripts() {
  local -A seen=() duplicados=0
  while IFS= read -r -d '' f; do
    local nome
    nome=$(basename "$f")
    if [ -n "${seen[$nome]:-}" ]; then
      duplicados=$((duplicados + 1))
      _cc_man_encontrar "$f (duplicado de ${seen[$nome]})"
    fi
    seen[$nome]="$f"
  done < <(find "$REPO_DIR" -name '*.sh' -type f 2>/dev/null -print0)
  [ "$duplicados" -eq 0 ] && _cc_man_adicionar "ok" "Scripts Repetidos" "Nenhum" && return
  _cc_man_adicionar "warn" "Scripts Repetidos" "${duplicados} nome(s) duplicados" "Scripts com mesmo nome em diretórios diferentes" "Confusão e risco de execução errada" "Renomeie ou unifique"
}

_cc_man_dup_funcoes() {
  local -A funcoes=() duplicadas=0
  while IFS= read -r -d '' f; do
    while IFS= read -r line; do
      if [[ "$line" =~ ^[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*)\ \(\) ]]; then
        local func="${BASH_REMATCH[1]}"
        if [ -n "${funcoes[$func]:-}" ]; then
          duplicadas=$((duplicadas + 1))
          _cc_man_encontrar "função $func em $f (também em ${funcoes[$func]})"
        fi
        funcoes[$func]="$f"
      fi
    done < "$f"
  done < <(find "$REPO_DIR/scripts" -name '*.sh' -type f 2>/dev/null -print0)
  [ "$duplicadas" -eq 0 ] && _cc_man_adicionar "ok" "Funções Duplicadas" "Nenhuma" && return
  _cc_man_adicionar "warn" "Funções Duplicadas" "${duplicadas} função(ões) definida(s) em múltiplos arquivos" "Duplicação de lógica" "Dificulta manutenção" "Extraia para um arquivo compartilhado"
}

_cc_man_dup_conteudo() {
  local -A md5s=() duplicados=0
  while IFS= read -r -d '' f; do
    local hash
    hash=$(md5sum "$f" 2>/dev/null | cut -d' ' -f1)
    [ -z "$hash" ] && continue
    if [ -n "${md5s[$hash]:-}" ]; then
      duplicados=$((duplicados + 1))
      _cc_man_encontrar "$f (conteúdo idêntico a ${md5s[$hash]})"
    fi
    md5s[$hash]="$f"
  done < <(find "$REPO_DIR" -name '*.sh' -type f 2>/dev/null -print0)
  [ "$duplicados" -eq 0 ] && _cc_man_adicionar "ok" "Código Redundante" "Nenhum conteúdo duplicado" && return
  _cc_man_adicionar "warn" "Código Redundante" "${duplicados} arquivo(s) com conteúdo idêntico" "Código duplicado literal" "Aumenta custo de manutenção" "Extraia o código compartilhado para uma biblioteca"
}
