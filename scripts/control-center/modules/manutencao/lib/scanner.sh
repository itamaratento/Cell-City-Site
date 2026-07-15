#!/bin/bash
# Scanner: arquivos orfos, diretorios vazios, backups antigos, logs esquecidos.
# Modo somente leitura — nenhum arquivo e removido durante a analise.
set -uo pipefail
: "${CC_ROOT:?}"; : "${REPO_DIR:?}"

_cc_man_scanner() {
  _cc_man_scan_orfos
  _cc_man_scan_dirs_vazios
  _cc_man_scan_backups
  _cc_man_scan_logs
  _cc_man_scan_temporarios
}

_cc_man_scan_orfos() {
  local orfos=0
  while IFS= read -r -d '' f; do
    _cc_man_eh_protegido "$f" && _cc_man_bloquear "$f" "arquivo protegido" && continue
    orfos=$((orfos + 1))
    _cc_man_encontrar "$f"
    _cc_man_classificar_item "$f" "orfao"
  done < <(find "$REPO_DIR" -maxdepth 2 \( -name '*.bak' -o -name '*.orig' -o -name '*.rej' \) -type f -print0 2>/dev/null)
  [ "$orfos" -eq 0 ] && _cc_man_adicionar "ok" "Arquivos Órfãos" "Nenhum" && return
  _cc_man_adicionar "warn" "Arquivos Órfãos" "${orfos} encontrados" "Residuos de merge/backup"
}

_cc_man_scan_dirs_vazios() {
  local vazios=0
  while IFS= read -r -d '' d; do
    [ "$(basename "$d")" = ".git" ] && continue
    _cc_man_eh_protegido "$d" && continue
    vazios=$((vazios + 1))
    _cc_man_encontrar "$d"
    _cc_man_classificar_item "$d" "vazio"
  done < <(find "$REPO_DIR" -type d -empty -print0 2>/dev/null)
  [ "$vazios" -eq 0 ] && _cc_man_adicionar "ok" "Diretórios Vazios" "Nenhum" && return
  _cc_man_adicionar "warn" "Diretórios Vazios" "${vazios} encontrados"
}

_cc_man_scan_backups() {
  local encontrados=0 tamanho=0
  while IFS= read -r -d '' f; do
    _cc_man_eh_protegido "$f" && _cc_man_bloquear "$f" "backup protegido" && continue
    encontrados=$((encontrados + 1))
    local sz && sz=$(stat -c%s "$f" 2>/dev/null || echo 0) && tamanho=$((tamanho + sz))
    _cc_man_encontrar "$f"
    _cc_man_classificar_item "$f" "backup"
  done < <(find "$REPO_DIR" -maxdepth 3 \( -name '*.tar.gz' -o -name '*.tgz' -o -name '*backup*' -o -name '*BACKUP*' \) -type f -print0 2>/dev/null)
  [ "$encontrados" -eq 0 ] && _cc_man_adicionar "ok" "Backups Antigos" "Nenhum" && return
  local tam_h && tam_h=$(numfmt --to=iec 2>/dev/null <<< "$tamanho" || echo "${tamanho}B")
  _cc_man_adicionar "warn" "Backups Antigos" "${encontrados} arquivos (${tam_h})"
}

_cc_man_scan_logs() {
  local encontrados=0 tamanho=0
  while IFS= read -r -d '' f; do
    _cc_man_eh_protegido "$f" && _cc_man_bloquear "$f" "log protegido" && continue
    encontrados=$((encontrados + 1))
    local sz && sz=$(stat -c%s "$f" 2>/dev/null || echo 0) && tamanho=$((tamanho + sz))
    _cc_man_encontrar "$f"
    _cc_man_classificar_item "$f" "log"
  done < <(find "$REPO_DIR" -maxdepth 3 \( -name '*.log' -o -name 'npm-debug.log*' \) -type f -print0 2>/dev/null)
  [ "$encontrados" -eq 0 ] && _cc_man_adicionar "ok" "Logs Esquecidos" "Nenhum" && return
  local tam_h && tam_h=$(numfmt --to=iec 2>/dev/null <<< "$tamanho" || echo "${tamanho}B")
  _cc_man_adicionar "warn" "Logs Esquecidos" "${encontrados} arquivos (${tam_h})"
}

_cc_man_scan_temporarios() {
  local encontrados=0 tamanho=0
  while IFS= read -r -d '' f; do
    _cc_man_eh_protegido "$f" && _cc_man_bloquear "$f" "temporario protegido" && continue
    encontrados=$((encontrados + 1))
    local sz && sz=$(stat -c%s "$f" 2>/dev/null || echo 0) && tamanho=$((tamanho + sz))
    _cc_man_encontrar "$f"
    _cc_man_classificar_item "$f" "temporario"
  done < <(find "$REPO_DIR" -maxdepth 3 \( -name '*.tmp' -o -name '*.swp' -o -name '*~' -o -name 'firestore-debug.log' -o -name 'ui-debug.log' \) -type f -print0 2>/dev/null)
  [ "$encontrados" -eq 0 ] && _cc_man_adicionar "ok" "Arquivos Temporários" "Nenhum" && return
  local tam_h && tam_h=$(numfmt --to=iec 2>/dev/null <<< "$tamanho" || echo "${tamanho}B")
  _cc_man_adicionar "warn" "Arquivos Temporários" "${encontrados} arquivos (${tam_h})"
}
