#!/bin/bash
# Cell City Control Center — módulo Branches e Sincronização, camada
# "Status" (Fase 5). Leitura via lib/svc-git.sh (compartilhada com
# Desenvolvimento/Release) + campos extras que só este módulo precisa
# (upstream/ahead/behind, última sincronização) — nada duplicado do que já
# existe em lib/svc-git.sh ou lib/ui-status.sh.
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

# Upstream da branch atual + commits à frente/atrás dele. Formato de saída
# "upstream|ahead|behind" (upstream vazio quando não há um configurado) —
# usado por Status do Repositório, Branch Atual e Sincronização, sem
# duplicar a chamada de git em cada tela.
_brs_upstream_info() {
  local upstream ahead behind counts
  upstream="$(git -C "$REPO_DIR" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)"
  if [ -z "$upstream" ]; then
    echo "|0|0"
    return
  fi
  counts="$(git -C "$REPO_DIR" rev-list --left-right --count "HEAD...$upstream" 2>/dev/null)"
  ahead="$(awk '{print $1}' <<< "$counts")"
  behind="$(awk '{print $2}' <<< "$counts")"
  echo "${upstream}|${ahead:-0}|${behind:-0}"
}

# "Última sincronização" é lida do mtime de .git/FETCH_HEAD (atualizado por
# qualquer `git fetch`, inclusive o de Sincronização › Buscar Atualizações)
# — não escrevemos em state/sincronizacao.json (ver README.md: nenhum
# módulo desta versão ainda grava lá, Release/Backup incluídos; manter a
# mesma honestidade evita um módulo novo divergir do padrão real dos
# outros dois já implementados).
_brs_ultima_sincronizacao() {
  local fetch_head="$REPO_DIR/.git/FETCH_HEAD"
  if [ ! -f "$fetch_head" ]; then
    echo "nunca (nenhum fetch encontrado nesta máquina)"
    return
  fi
  date -d "@$(stat -c %Y "$fetch_head")" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "desconhecida"
}

_brs_tempo_desde_sincronizacao() {
  local fetch_head="$REPO_DIR/.git/FETCH_HEAD" mtime agora diff
  if [ ! -f "$fetch_head" ]; then
    echo "nunca"
    return
  fi
  mtime="$(stat -c %Y "$fetch_head" 2>/dev/null)"
  agora="$(date +%s)"
  diff=$((agora - mtime))
  if [ "$diff" -lt 60 ]; then
    echo "${diff}s atrás"
  elif [ "$diff" -lt 3600 ]; then
    echo "$((diff / 60))min atrás"
  elif [ "$diff" -lt 86400 ]; then
    echo "$((diff / 3600))h atrás"
  else
    echo "$((diff / 86400))d atrás"
  fi
}

_brs_status_repositorio() {
  echo "📊 Status do Repositório"
  echo "──────────────────────────"
  local branch workspace arquivos_mod arquivos_novos remote info upstream ahead behind resultado
  branch="$(_cc_git_branch)"
  arquivos_mod="$(_cc_svc_git_arquivos_alterados_count)"
  arquivos_novos="$(git -C "$REPO_DIR" ls-files --others --exclude-standard | grep -c .)"
  remote="$(git -C "$REPO_DIR" remote get-url origin 2>/dev/null)"
  info="$(_brs_upstream_info)"
  IFS='|' read -r upstream ahead behind <<< "$info"

  if _cc_svc_git_workspace_limpo; then
    workspace="limpo"
  else
    workspace="modificado ($arquivos_mod arquivo(s))"
  fi

  echo "Branch atual        : $branch"
  echo "Commit atual        : $(_cc_svc_git_ultimo_commit)"
  echo "Ahead / Behind      : ${ahead} / ${behind} (upstream: ${upstream:-nenhum})"
  echo "Workspace           : $workspace"
  echo "Arq. não rastreados : $arquivos_novos"
  echo "Remote configurado  : ${remote:-nenhum}"
  echo "Última sincronização: $(_brs_ultima_sincronizacao)"

  if [ -z "$remote" ] || [ "$branch" = "desconhecida" ]; then
    resultado="CRÍTICO"
  elif _cc_svc_git_branch_reconhecida && _cc_svc_git_workspace_limpo && [ "$ahead" = "0" ] && [ "$behind" = "0" ]; then
    resultado="SAUDÁVEL"
  else
    resultado="ATENÇÃO"
  fi
  echo ""
  echo "Resultado: $resultado"
  _cc_log "Branches e Sincronização: Status do Repositório consultado (branch=$branch, resultado=$resultado)"
}

_brs_branch_atual() {
  echo "🌿 Branch Atual"
  echo "────────────────"
  local branch info upstream ahead behind
  branch="$(_cc_git_branch)"
  info="$(_brs_upstream_info)"
  IFS='|' read -r upstream ahead behind <<< "$info"

  echo "Nome                    : $branch"
  echo "Último commit           : $(_cc_svc_git_ultimo_commit)"
  echo "Branch remota associada : ${upstream:-nenhuma (sem upstream configurado)}"
  echo "Ahead                   : $ahead"
  echo "Behind                  : $behind"
  if [ -z "$upstream" ]; then
    echo "Sincronização           : sem upstream configurado"
  elif [ "$ahead" = "0" ] && [ "$behind" = "0" ]; then
    echo "Sincronização           : em dia"
  else
    echo "Sincronização           : divergente (ver Ahead/Behind acima)"
  fi
  _cc_log "Branches e Sincronização: Branch Atual consultada (branch=$branch, commit=$(_cc_svc_git_ultimo_commit))"
}
