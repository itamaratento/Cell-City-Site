#!/bin/bash
# Cell City Control Center — módulo Desenvolvimento, telas de Status/Git
# (Fase 2). Só formata pra exibição — toda a lógica de Git real vive em
# lib/svc-git.sh (compartilhada com o módulo Release), nada duplicado aqui.
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_dev_status_projeto() {
  local branch workspace arquivos ultimo
  branch="$(_cc_git_branch)"
  arquivos="$(_cc_svc_git_arquivos_alterados_count)"
  ultimo="$(_cc_svc_git_ultimo_commit)"
  if _cc_svc_git_workspace_limpo; then workspace="limpo"; else workspace="com alterações ($arquivos arquivo(s))"; fi

  echo "📊 Status do Projeto"
  echo "─────────────────────"
  echo "Projeto        : Cell City CRM"
  echo "Branch atual   : $branch"
  echo "Workspace      : $workspace"
  echo "Arq. alterados : $arquivos"
  echo "Último commit  : $ultimo"
  if _cc_svc_git_branch_reconhecida && _cc_svc_git_workspace_limpo; then
    echo "Status geral   : Saudável"
  else
    echo "Status geral   : Atenção"
  fi
}

_dev_git_status() {
  echo "📄 git status"
  echo "──────────────"
  _cc_svc_git_status_verbose
}

_dev_git_diff() {
  echo "🔍 git diff"
  echo "────────────"
  local saida
  saida="$(_cc_svc_git_diff)"
  if [ -z "$saida" ]; then
    echo "Nenhuma alteração no working tree."
  else
    echo "$saida"
  fi
}

_dev_git_log() {
  echo "📜 Últimos commits"
  echo "───────────────────"
  _cc_svc_git_log 20
}

_dev_alteracoes_locais() {
  echo "🗂️  Alterações Locais"
  echo "──────────────────────"
  local total
  total="$(_cc_svc_git_arquivos_alterados_count)"
  if [ "$total" -eq 0 ]; then
    echo "Nenhuma alteração local — workspace limpo."
    return
  fi
  echo "$total arquivo(s) alterado(s):"
  git -C "$REPO_DIR" status --porcelain
}
