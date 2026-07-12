#!/bin/bash
# Cell City Control Center — módulo Diagnóstico, verificações de estrutura
# do projeto (diretórios obrigatórios, arquivos obrigatórios, permissões,
# links simbólicos, dependências e integridade de scripts).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido antes de carregar lib/projeto.sh}"
: "${REPO_DIR:?REPO_DIR precisa estar definido antes de carregar lib/projeto.sh}"

_ARQS_OBRIGATORIOS=(
  "package.json"
  "firebase.json"
  "firestore.rules"
  "firestore.indexes.json"
  "storage.rules"
  ".firebaserc"
)

_DIRS_OBRIGATORIOS=(
  "CRM"
  "scripts"
  "css"
  "js"
  "functions"
  "assets"
  "pages"
)

_cc_diag_projeto() {
  _cc_diag_estrutura_projeto
  _cc_diag_arquivos_obrigatorios
  _cc_diag_diretorios_obrigatorios
  _cc_diag_permissoes_projeto
  _cc_diag_links_simbolicos
  _cc_diag_dependencias
  _cc_diag_integridade_scripts
}

_cc_diag_estrutura_projeto() {
  if [ -d "$REPO_DIR" ]; then
    local total_entradas
    total_entradas=$(ls -1A "$REPO_DIR" 2>/dev/null | wc -l)
    _cc_diag_adicionar "ok" "Estrutura do Projeto" "Diretório raiz OK ($total_entradas entradas)"
  else
    _cc_diag_adicionar "fail" "Estrutura do Projeto" "Diretório raiz não encontrado" "REPO_DIR não existe ou não é acessível" "Nenhuma verificação de projeto possível" "Verifique o caminho: $REPO_DIR"
  fi
}

_cc_diag_arquivos_obrigatorios() {
  local ausentes=0
  for arq in "${_ARQS_OBRIGATORIOS[@]}"; do
    if [ ! -f "$REPO_DIR/$arq" ]; then
      _cc_diag_adicionar "fail" "Arquivos Obrigatórios" "Ausente: $arq" "Arquivo crítico não encontrado" "Componente do projeto pode não funcionar" "Verifique se o arquivo foi deletado ou movido"
      ausentes=$((ausentes + 1))
    fi
  done
  if [ "$ausentes" -eq 0 ]; then
    _cc_diag_adicionar "ok" "Arquivos Obrigatórios" "Todos os ${#_ARQS_OBRIGATORIOS[@]} arquivos presentes"
  fi
}

_cc_diag_diretorios_obrigatorios() {
  local ausentes=0
  for dir in "${_DIRS_OBRIGATORIOS[@]}"; do
    if [ ! -d "$REPO_DIR/$dir" ]; then
      _cc_diag_adicionar "fail" "Diretórios Obrigatórios" "Ausente: $dir" "Diretório crítico não encontrado" "Estrutura do projeto incompleta" "Crie o diretório: $dir"
      ausentes=$((ausentes + 1))
    fi
  done
  if [ "$ausentes" -eq 0 ]; then
    _cc_diag_adicionar "ok" "Diretórios Obrigatórios" "Todos os ${#_DIRS_OBRIGATORIOS[@]} diretórios presentes"
  fi
}

_cc_diag_permissoes_projeto() {
  local scripts_exec=0 scripts_total=0
  while IFS= read -r -d '' script; do
    scripts_total=$((scripts_total + 1))
    [ -x "$script" ] && scripts_exec=$((scripts_exec + 1))
  done < <(find "$REPO_DIR/scripts" -name '*.sh' -type f -print0 2>/dev/null)
  if [ "$scripts_total" -eq 0 ]; then
    _cc_diag_adicionar "ok" "Permissões" "Nenhum script .sh encontrado para verificar"
  elif [ "$scripts_exec" -eq "$scripts_total" ]; then
    _cc_diag_adicionar "ok" "Permissões" "Todos os $scripts_total scripts são executáveis"
  else
    local nao_exec=$((scripts_total - scripts_exec))
    _cc_diag_adicionar "warn" "Permissões" "${nao_exec} de ${scripts_total} scripts não executáveis" "Scripts sem permissão de execução" "Impossível executar scripts diretamente" "Execute: chmod +x scripts/**/*.sh"
  fi
}

_cc_diag_links_simbolicos() {
  local quebrados=0
  while IFS= read -r -d '' link; do
    if [ ! -e "$link" ]; then
      quebrados=$((quebrados + 1))
    fi
  done < <(find "$REPO_DIR" -type l -print0 2>/dev/null)
  if [ "$quebrados" -eq 0 ]; then
    _cc_diag_adicionar "ok" "Links Simbólicos" "Nenhum link quebrado"
  else
    _cc_diag_adicionar "warn" "Links Simbólicos" "${quebrados} link(s) quebrado(s)" "Links simbólicos apontando para destino inexistente" "Podem causar erros em scripts e builds" "Remova ou corrija os links quebrados"
  fi
}

_cc_diag_dependencias() {
  if [ -d "$REPO_DIR/node_modules" ]; then
    local pacotes
    pacotes=$(ls -1 "$REPO_DIR/node_modules" 2>/dev/null | wc -l)
    if [ "$pacotes" -gt 0 ]; then
      _cc_diag_adicionar "ok" "Dependências Instaladas" "${pacotes} pacotes em node_modules"
    else
      _cc_diag_adicionar "warn" "Dependências Instaladas" "node_modules vazio" "node_modules existe mas está vazio" "Dependências podem estar corrompidas" "Execute: npm install"
    fi
  else
    _cc_diag_adicionar "fail" "Dependências Instaladas" "node_modules não encontrado" "Dependências não instaladas" "Projeto não pode ser executado" "Execute: npm install"
  fi
}

_cc_diag_integridade_scripts() {
  local erros=0 verificados=0
  while IFS= read -r -d '' script; do
    verificados=$((verificados + 1))
    if ! bash -n "$script" 2>/dev/null; then
      erros=$((erros + 1))
      _cc_diag_adicionar "fail" "Integridade dos Scripts" "Erro de sintaxe: $(basename "$script")" "Script contém erro de sintaxe bash" "Script pode não executar corretamente" "Corrija o erro de sintaxe no script"
    fi
  done < <(find "$REPO_DIR/scripts" -name '*.sh' -type f -print0 2>/dev/null)
  if [ "$erros" -eq 0 ] && [ "$verificados" -gt 0 ]; then
    _cc_diag_adicionar "ok" "Integridade dos Scripts" "${verificados} scripts verificados, sem erros de sintaxe"
  elif [ "$verificados" -eq 0 ]; then
    _cc_diag_adicionar "ok" "Integridade dos Scripts" "Nenhum script .sh encontrado"
  fi
}
