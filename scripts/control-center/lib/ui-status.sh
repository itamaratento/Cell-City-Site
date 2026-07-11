#!/bin/bash
# Cell City Control Center — componente de Status (Fase 1.2, "UX do
# Terminal"). Lê o estado real do repositório (branch atual, working tree)
# pra exibir no bloco "Projeto/Branch/Status" do menu principal.
#
# Heurística deliberadamente simples e honesta — isto NÃO é o Health Check
# automático da Versão 3.0 do Roadmap (auditorias, monitoramento). É só um
# resumo de 1 linha: branch reconhecida (develop/main) e working tree limpo
# = "Saudável"; qualquer outra coisa = "Atenção". Nunca reporta "quebrado"
# — não existe verificação real de saúde ainda, só de estado do Git.

_cc_git_branch() {
  : "${REPO_DIR:?REPO_DIR precisa estar definido antes de chamar _cc_git_branch}"
  git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "desconhecida"
}

_cc_projeto_status_label() {
  : "${REPO_DIR:?REPO_DIR precisa estar definido antes de chamar _cc_projeto_status_label}"
  local branch
  branch="$(_cc_git_branch)"
  if [[ "$branch" =~ ^(develop|main)$ ]] && [ -z "$(git -C "$REPO_DIR" status --porcelain 2>/dev/null)" ]; then
    printf '%sSaudável%s' "$_CC_C_VERDE" "$_CC_C_RESET"
  else
    printf '%sAtenção%s' "$_CC_C_AMARELO" "$_CC_C_RESET"
  fi
}
