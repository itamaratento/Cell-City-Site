#!/bin/bash
# Codigo morto: funcoes nao utilizadas, scripts sem referencia, arquivos abandonados.
set -uo pipefail
: "${CC_ROOT:?}"; : "${REPO_DIR:?}"

_cc_man_codigo_morto() {
  _cc_man_mort_funcoes
  _cc_man_mort_scripts
  _cc_man_mort_arquivos
}

_cc_man_mort_funcoes() {
  local declaradas=() nao_usadas=0
  while IFS= read -r -d '' f; do
    while IFS= read -r line; do
      if [[ "$line" =~ ^[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*)\ \(\) ]]; then
        local func="${BASH_REMATCH[1]}"
        [[ "$func" =~ ^_cc_man_ ]] && continue
        declaradas+=("$func|$f")
      fi
    done < "$f"
  done < <(find "$REPO_DIR/scripts" -name '*.sh' -type f 2>/dev/null -print0)
  local entrada func_file func
  for entrada in "${declaradas[@]}"; do
    func="${entrada%%|*}"
    func_file="${entrada#*|}"
    local encontrada=0
    while IFS= read -r -d '' f2; do
      if [ "$f2" != "$func_file" ] && grep -qP "(?<![a-zA-Z_])${func}(?![a-zA-Z_])" "$f2" 2>/dev/null; then
        encontrada=1; break
      fi
    done < <(find "$REPO_DIR/scripts" -name '*.sh' -type f 2>/dev/null -print0)
    [ "$encontrada" -eq 0 ] && nao_usadas=$((nao_usadas + 1)) && _cc_man_encontrar "funcao: $func em $func_file"
  done
  [ "$nao_usadas" -eq 0 ] && _cc_man_adicionar "ok" "Funções Não Utilizadas" "Nenhuma" && return
  _cc_man_adicionar "warn" "Funções Não Utilizadas" "${nao_usadas} funções definidas sem chamada externa" "Código morto no projeto" "Dificulta manutenção" "Revise e remova as funções não utilizadas"
}

_cc_man_mort_scripts() {
  local declarados=() nao_referenciados=0
  while IFS= read -r -d '' f; do
    local nome
    nome=$(basename "$f" .sh)
    declarados+=("$nome|$f")
  done < <(find "$REPO_DIR" -name '*.sh' -type f 2>/dev/null -print0)
  local entrada nome_script path
  for entrada in "${declarados[@]}"; do
    nome_script="${entrada%%|*}"
    path="${entrada#*|}"
    local refs=0
    while IFS= read -r -d '' f2; do
      if [ "$f2" != "$path" ] && grep -q "$nome_script" "$f2" 2>/dev/null; then
        refs=$((refs + 1))
      fi
    done < <(find "$REPO_DIR" -name '*.sh' -type f 2>/dev/null -print0)
    [ "$refs" -eq 0 ] && nao_referenciados=$((nao_referenciados + 1)) && _cc_man_encontrar "script: $(basename "$path")"
  done
  [ "$nao_referenciados" -eq 0 ] && _cc_man_adicionar "ok" "Scripts Sem Referência" "Nenhum" && return
  _cc_man_adicionar "warn" "Scripts Sem Referência" "${nao_referenciados} scripts não referenciados por outros scripts" "Possível código morto" "Dificulta navegação" "Revise e remova se não forem mais necessários"
}

_cc_man_mort_arquivos() {
  local suspensos=0
  while IFS= read -r -d '' f; do
    local nome ext
    nome=$(basename "$f")
    ext="${nome##*.}"
    [[ "$ext" =~ ^(sh|js|py)$ ]] || continue
    local refs=0
    while IFS= read -r -d '' f2; do
      if [ "$f2" != "$f" ]; then
        local base
        base="${nome%.*}"
        grep -q "$base" "$f2" 2>/dev/null && refs=$((refs + 1)) && break
      fi
    done < <(find "$REPO_DIR" -name '*.sh' -type f 2>/dev/null -print0)
    [ "$refs" -eq 0 ] && suspensos=$((suspensos + 1)) && _cc_man_encontrar "$f"
  done < <(find "$REPO_DIR/scripts" -name '*.sh' -type f 2>/dev/null -print0)
  [ "$suspensos" -eq 0 ] && _cc_man_adicionar "ok" "Arquivos Abandonados" "Nenhum" && return
  _cc_man_adicionar "warn" "Arquivos Abandonados" "${suspensos} arquivos sem referência em scripts" "Possível código não utilizado" "Pode indicar funcionalidade obsoleta" "Revise e arquive ou remova"
}
