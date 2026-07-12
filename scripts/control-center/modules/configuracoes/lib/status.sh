#!/bin/bash
# Cell City Control Center — módulo Configurações, Status (Fase 11,
# CCC-F11-001). Somente leitura sobre Backup/Git/Firebase/Banco de Dados
# — nunca reimplementa a lógica real desses módulos (envelopar, nunca
# reimplementar, mesmo princípio de toda esta Sprint); cada tela aponta
# pro módulo correto para qualquer ação de verdade.
#
# Telas de tiro único (sem loop próprio) dispatchadas direto por
# _cc_run_submenu — não chamam _cc_pause aqui: o wrapper de
# _cc_run_submenu já pausa uma vez sozinho depois que a função retorna
# (mesmo padrão de modules/branches-sincronizacao/lib/status.sh e
# modules/diagnostico/menu.sh; chamar _cc_pause aqui também causaria
# pausa dupla e "engoliria" a próxima tecla do usuário).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_cfg_status_backup() {
  local timestamp status
  _cc_screen_title "STATUS DO BACKUP"
  _cc_screen_breadcrumb "Control Center › Configurações › Status do Backup"
  _cc_box_blank
  if [ -f "$CC_ROOT/state/backup.json" ] && command -v jq >/dev/null 2>&1; then
    timestamp=$(jq -r '.timestamp // empty' "$CC_ROOT/state/backup.json" 2>/dev/null)
    status=$(jq -r '.status // empty' "$CC_ROOT/state/backup.json" 2>/dev/null)
  fi
  _cc_box_line "Último backup (timestamp) : ${timestamp:-nunca registrado}"
  _cc_box_line "Status                    : ${status:-desconhecido}"
  _cc_box_blank
  _cc_box_text "Somente leitura — para executar um backup de verdade,"
  _cc_box_text "acesse Control Center › Backup e Recuperação."
  _cc_box_blank
}

_cc_cfg_status_git() {
  local branch upstream ahead behind remote
  branch=$(_cc_git_branch 2>/dev/null || echo "?")
  remote=$(git -C "$REPO_DIR" remote get-url origin 2>/dev/null)
  upstream=$(git -C "$REPO_DIR" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)
  if [ -n "$upstream" ]; then
    local counts
    counts=$(git -C "$REPO_DIR" rev-list --left-right --count "HEAD...$upstream" 2>/dev/null)
    ahead=$(awk '{print $1}' <<< "$counts")
    behind=$(awk '{print $2}' <<< "$counts")
  fi
  _cc_screen_title "STATUS DO GIT"
  _cc_screen_breadcrumb "Control Center › Configurações › Status do Git"
  _cc_box_blank
  _cc_box_line "Branch atual   : $branch"
  _cc_box_line "Remote         : ${remote:-nenhum}"
  _cc_box_line "Upstream       : ${upstream:-sem upstream configurado}"
  _cc_box_line "Ahead / Behind : ${ahead:-0} / ${behind:-0}"
  _cc_box_blank
  _cc_box_text "Somente leitura — para gerenciar branches/sincronização,"
  _cc_box_text "acesse Control Center › Branches e Sincronização."
  _cc_box_blank
}

_cc_cfg_status_firebase() {
  local projeto="não configurado" rules="ausente" indexes="ausente"
  [ -f "$REPO_DIR/.firebaserc" ] && projeto="configurado (.firebaserc)"
  [ -f "$REPO_DIR/firestore.rules" ] && rules="presente"
  [ -f "$REPO_DIR/firestore.indexes.json" ] && indexes="presente"
  _cc_screen_title "STATUS DO FIREBASE"
  _cc_screen_breadcrumb "Control Center › Configurações › Status do Firebase"
  _cc_box_blank
  _cc_box_line "Projeto ativo      : $projeto"
  _cc_box_line "Firestore Rules    : $rules"
  _cc_box_line "Firestore Indexes  : $indexes"
  _cc_box_line "Firebase CLI       : $(command -v firebase >/dev/null 2>&1 && echo 'instalado' || echo 'não encontrado')"
  _cc_box_blank
  _cc_box_text "Somente leitura — para diagnóstico completo do Firebase,"
  _cc_box_text "acesse Control Center › Diagnóstico (opção 6) ou"
  _cc_box_text "Ferramentas › Auditoria Firebase (opção 4)."
  _cc_box_blank
}

_cc_cfg_status_banco() {
  local colecoes="?"
  if [ -f "$REPO_DIR/firestore.rules" ]; then
    colecoes=$(grep -c 'match /' "$REPO_DIR/firestore.rules" 2>/dev/null || echo "?")
  fi
  _cc_screen_title "STATUS DO BANCO DE DADOS"
  _cc_screen_breadcrumb "Control Center › Configurações › Status do Banco de Dados"
  _cc_box_blank
  _cc_box_line "firestore.rules          : $([ -f "$REPO_DIR/firestore.rules" ] && echo 'presente' || echo 'ausente')"
  _cc_box_line "firestore.indexes.json   : $([ -f "$REPO_DIR/firestore.indexes.json" ] && echo 'presente' || echo 'ausente')"
  _cc_box_line "Blocos 'match' em Rules  : $colecoes"
  _cc_box_blank
  _cc_box_text "Somente leitura — para inspeção completa (coleções,"
  _cc_box_text "índices, Cloud Functions), acesse Control Center ›"
  _cc_box_text "Banco de Dados."
  _cc_box_blank
}
