#!/bin/bash
# Cell City Control Center — módulo Ferramentas, Auditoria Geral.
# Verifica estrutura do projeto, organização de diretórios, arquivos
# obrigatórios, arquivos órfãos, duplicados, vazios e permissões.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_ARQS_OBRIGATORIOS=(
  "package.json" "firebase.json" "firestore.rules"
  "firestore.indexes.json" "storage.rules" ".firebaserc"
)

_cc_ferr_auditoria_geral() {
  _cc_ferr_aud_estrutura
  _cc_ferr_aud_diretorios
  _cc_ferr_aud_arquivos_obrigatorios
  _cc_ferr_aud_arquivos_orfos
  _cc_ferr_aud_arquivos_duplicados
  _cc_ferr_aud_arquivos_vazios
  _cc_ferr_aud_scripts_invalidos
  _cc_ferr_aud_permissoes
}

_cc_ferr_aud_estrutura() {
  if [ -d "$REPO_DIR" ]; then
    local total pastas arquivos
    total=$(find "$REPO_DIR" -maxdepth 1 2>/dev/null | wc -l)
    pastas=$(find "$REPO_DIR" -maxdepth 1 -type d 2>/dev/null | wc -l)
    arquivos=$(find "$REPO_DIR" -maxdepth 1 -type f 2>/dev/null | wc -l)
    _cc_ferr_adicionar "ok" "Estrutura do Projeto" "${total} entradas na raiz (${pastas} diretórios, ${arquivos} arquivos)"
  else
    _cc_ferr_adicionar "fail" "Estrutura do Projeto" "Diretório raiz não encontrado"
  fi
}

_cc_ferr_aud_diretorios() {
  local dirs=("CRM" "scripts" "css" "js" "functions" "assets" "pages" "tests" "imagens")
  local ausentes=0
  for dir in "${dirs[@]}"; do
    [ ! -d "$REPO_DIR/$dir" ] && ausentes=$((ausentes + 1))
  done
  if [ "$ausentes" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Organização de Diretórios" "Todos os ${#dirs[@]} diretórios esperados presentes"
  else
    _cc_ferr_adicionar "warn" "Organização de Diretórios" "${ausentes} diretório(s) ausente(s)" "Estrutura de diretórios incompleta" "Pode indicar projeto não inicializado" "Verifique a estrutura padrão do projeto"
  fi
}

_cc_ferr_aud_arquivos_obrigatorios() {
  local ausentes=0
  for arq in "${_ARQS_OBRIGATORIOS[@]}"; do
    [ ! -f "$REPO_DIR/$arq" ] && ausentes=$((ausentes + 1))
  done
  if [ "$ausentes" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Arquivos Obrigatórios" "Todos os ${#_ARQS_OBRIGATORIOS[@]} arquivos presentes"
  else
    _cc_ferr_adicionar "fail" "Arquivos Obrigatórios" "${ausentes} arquivo(s) ausente(s)" "Arquivos essenciais faltando" "Projeto pode não funcionar corretamente" "Verifique a integridade do repositório"
  fi
}

_cc_ferr_aud_arquivos_orfos() {
  local orfos=0
  while IFS= read -r -d '' f; do
    [ -f "$f" ] && orfos=$((orfos + 1))
  done < <(find "$REPO_DIR" -maxdepth 2 \( -name '*.bak' -o -name '*.tmp' -o -name '*.swp' -o -name '*~' \) -print0 2>/dev/null)
  if [ "$orfos" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Arquivos Órfãos" "Nenhum arquivo órfão encontrado"
  else
    _cc_ferr_adicionar "warn" "Arquivos Órfãos" "${orfos} arquivo(s) órfão(s) (.bak, .tmp, .swp)" "Arquivos temporários não limpos" "Poluem o repositório" "Execute limpeza de temporários"
  fi
}

_cc_ferr_aud_arquivos_duplicados() {
  local duplicados=0
  local -A seen=()
  while IFS= read -r -d '' f; do
    local nome
    nome=$(basename "$f")
    if [ -n "${seen[$nome]:-}" ]; then
      duplicados=$((duplicados + 1))
    else
      seen[$nome]="$f"
    fi
  done < <(find "$REPO_DIR" -name '*.sh' -type f 2>/dev/null -print0)
  if [ "$duplicados" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Arquivos Duplicados" "Nenhum script com nome duplicado"
  else
    _cc_ferr_adicionar "warn" "Arquivos Duplicados" "${duplicados} nome(s) de script duplicado(s)" "Scripts com mesmo nome podem causar conflitos" "Dificulta manutenção" "Renomeie ou remova as duplicatas"
  fi
}

_cc_ferr_aud_arquivos_vazios() {
  local vazios=0
  while IFS= read -r -d '' f; do
    [ ! -s "$f" ] && vazios=$((vazios + 1))
  done < <(find "$REPO_DIR" -type f \( -name '*.sh' -o -name '*.json' -o -name '*.md' -o -name '*.js' -o -name '*.html' -o -name '*.css' \) 2>/dev/null -print0)
  if [ "$vazios" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Arquivos Vazios" "Nenhum arquivo vazio encontrado"
  else
    _cc_ferr_adicionar "fail" "Arquivos Vazios" "${vazios} arquivo(s) vazio(s)" "Arquivos sem conteúdo" "Podem causar erros de compilação ou execução" "Revise e remova ou preencha os arquivos"
  fi
}

_cc_ferr_aud_scripts_invalidos() {
  local invalidos=0 verificados=0
  while IFS= read -r -d '' f; do
    verificados=$((verificados + 1))
    if ! bash -n "$f" 2>/dev/null; then
      invalidos=$((invalidos + 1))
    fi
  done < <(find "$REPO_DIR/scripts" -name '*.sh' -type f 2>/dev/null -print0)
  if [ "$invalidos" -eq 0 ] && [ "$verificados" -gt 0 ]; then
    _cc_ferr_adicionar "ok" "Scripts Inválidos" "${verificados} scripts verificados, sem erros"
  elif [ "$verificados" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Scripts Inválidos" "Nenhum script encontrado"
  else
    _cc_ferr_adicionar "fail" "Scripts Inválidos" "${invalidos} script(s) com erro de sintaxe" "Scripts bash com erro" "Não podem ser executados" "Corrija os erros com bash -n"
  fi
}

_cc_ferr_aud_permissoes() {
  local nao_exec=0 total=0
  while IFS= read -r -d '' f; do
    total=$((total + 1))
    [ ! -x "$f" ] && nao_exec=$((nao_exec + 1))
  done < <(find "$REPO_DIR/scripts" -name '*.sh' -type f 2>/dev/null -print0)
  if [ "$nao_exec" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Permissões" "Todos os scripts são executáveis"
  else
    _cc_ferr_adicionar "warn" "Permissões" "${nao_exec} de ${total} scripts não executáveis" "Scripts sem permissão de execução" "Impossível executar diretamente" "Execute: chmod +x scripts/**/*.sh"
  fi
}
