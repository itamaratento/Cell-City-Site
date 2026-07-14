#!/bin/bash
# Diagnostic Engine — Analyzer: Structure
# Verifica se a estrutura de diretórios do projeto está conforme esperado
set -uo pipefail

DE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$DE_DIR/lib/utils.sh"

_cc_v3_diag_analyze_structure() {
  local findings=()
  local root="${REPO_DIR:-/home/cellcity/Músicas/projetos/Cell-City-Site}"

  local expected_dirs=(
    "assets"
    "css"
    "js"
    "pages"
    "scripts"
    "scripts/health-engine"
    "scripts/diagnostic-engine"
    "scripts/observability"
    "scripts/monitoring"
    "scripts/automations"
    "scripts/execution-engine"
    "scripts/prompt-generator"
    "scripts/central-modulos-v3"
    "scripts/backup"
    "scripts/release"
    "tests"
    "functions"
    "logs"
    "evidencias"
    "CRM"
    "sistema"
    "catalogo"
    "celular"
    "impressora"
    "notebook"
    "imagens"
    "videos"
    "_BACKUPS"
    "_reports"
    ".github"
  )

  local expected_files=(
    "index.html"
    "package.json"
    "firebase.json"
    "firestore.rules"
    "storage.rules"
    "CNAME"
    "robots.txt"
    "sitemap.xml"
    "README.md"
    "ENGINEERING.md"
    "MASTER_ROADMAP.md"
    "ARQUITETURA_PORTAL_CLIENTE.md"
  )

  local missing_dirs=0
  for dir in "${expected_dirs[@]}"; do
    if [[ ! -d "$root/$dir" ]]; then
      findings+=("{\"analyzer\":\"structure\",\"tipo\":\"warning\",\"severidade\":\"medium\",\"categoria\":\"estrutura\",\"mensagem\":\"Diretório ausente: $dir\"}")
      ((missing_dirs++))
    fi
  done

  local missing_files=0
  for file in "${expected_files[@]}"; do
    if [[ ! -f "$root/$file" ]]; then
      findings+=("{\"analyzer\":\"structure\",\"tipo\":\"warning\",\"severidade\":\"medium\",\"categoria\":\"estrutura\",\"mensagem\":\"Arquivo ausente: $file\"}")
      ((missing_files++))
    fi
  done

  local total_expected=$(( ${#expected_dirs[@]} + ${#expected_files[@]} ))
  local found=$(( total_expected - missing_dirs - missing_files ))
  findings+=("{\"analyzer\":\"structure\",\"tipo\":\"info\",\"severidade\":\"info\",\"categoria\":\"estrutura\",\"mensagem\":\"Estrutura: $found/$total_expected itens encontrados (faltando: $missing_dirs dirs, $missing_files arquivos)\"}")

  if [[ ${#findings[@]} -eq 0 ]]; then
    echo "[]"
    return
  fi

  local json="["
  local first=true
  for f in "${findings[@]}"; do
    [[ "$first" == true ]] && first=false || json+=","
    json+="$f"
  done
  json+="]"
  echo "$json"
}

_cc_v3_diag_analyze_structure
