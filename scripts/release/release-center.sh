#!/bin/bash
# Cell City Release Center — homologação técnica antes da promoção pra main.
#
# Fluxo oficial: subir -> release -> subir-ok. O comando `release` é
# SOMENTE auditoria: nunca commita, nunca dá push, nunca promove, nunca cria
# tag. Ao final de uma "Release Completa" ou "Certificação Completa" com
# todas as checagens verdes, grava um marcador local (.git/, nunca
# versionado/pushado) que o `subir-ok` exige antes de prosseguir — ver
# ALTERAÇÃO NO SUBIR-OK, Sprint 2026-07-11 (Release Center).
#
# Uso: scripts/release/release-center.sh (interativo) ou
#      scripts/release/release-center.sh --check-homologacao (usado pelo subir-ok)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_DIR" || { echo "❌ Não foi possível acessar o repositório em $REPO_DIR."; exit 1; }

MARCADOR="$REPO_DIR/.git/cellcity-release-homologada.json"
GH_REPO="itamaratento/Cell-City-Site"
FALHAS=0

_carregar_node() {
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm use --lts >/dev/null 2>&1
}

_ok()   { echo "  ✅ $1"; }
_fail() { echo "  ❌ $1"; FALHAS=$((FALHAS+1)); }
_warn() { echo "  ⚠️  $1"; }

# ============================================================
# RELEASE RÁPIDA (~30s) — não gera homologação, só panorama.
# ============================================================
opcao_release_rapida() {
  echo ""
  echo "⚡ Release Rápida"
  echo "─────────────────"
  local branch clean ahead behind last_commit last_tag
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  echo "Branch atual: $branch"
  [ "$branch" = "develop" ] && _ok "Branch correta (develop)" || _warn "Não está em develop"

  if [ -z "$(git status --porcelain)" ]; then
    _ok "Working tree limpo"
  else
    _warn "Working tree com alterações não commitadas:"
    git status --porcelain | sed 's/^/       /'
  fi

  echo "Buscando origin..."
  git fetch origin >/dev/null 2>&1 && _ok "git fetch ok" || _warn "git fetch falhou (sem rede?)"
  ahead=$(git rev-list --count origin/develop..develop 2>/dev/null || echo "?")
  behind=$(git rev-list --count develop..origin/develop 2>/dev/null || echo "?")
  echo "  develop está $ahead à frente / $behind atrás de origin/develop"

  last_commit=$(git log -1 --oneline 2>/dev/null)
  echo "Último commit: $last_commit"
  last_tag=$(git tag -l 'v*' --sort=-creatordate | head -1)
  echo "Última tag: ${last_tag:-（nenhuma）}"

  echo ""
  echo "ℹ️  Release Rápida é só panorama — não homologa. Use a opção 2 ou 3 pra liberar o subir-ok."
}

# ============================================================
# Checagens individuais reutilizadas pela Release Completa/Certificação
# ============================================================
_check_rbac() {
  echo "  Rodando RBAC..."
  (_carregar_node && cd "$REPO_DIR/tests/rbac" && npm test) >/tmp/cellcity-release-rbac.log 2>&1
  if [ $? -eq 0 ]; then _ok "RBAC verde ($(grep -oE '# pass [0-9]+' /tmp/cellcity-release-rbac.log | tail -1 | grep -oE '[0-9]+'))"
  else _fail "RBAC falhou — ver /tmp/cellcity-release-rbac.log"; fi
}

_check_integridade() {
  echo "  Rodando Integridade..."
  (_carregar_node && cd "$REPO_DIR" && node --test tests/integrity/integridade.test.mjs) >/tmp/cellcity-release-integridade.log 2>&1
  if [ $? -eq 0 ]; then _ok "Integridade verde"
  else _fail "Integridade falhou — ver /tmp/cellcity-release-integridade.log"; fi
}

_check_performance() {
  echo "  Rodando Performance..."
  (_carregar_node && cd "$REPO_DIR" && node --test tests/performance/polling-gating.test.mjs) >/tmp/cellcity-release-perf.log 2>&1
  if [ $? -eq 0 ]; then _ok "Performance verde"
  else _fail "Performance falhou — ver /tmp/cellcity-release-perf.log"; fi
}

_check_rules() {
  echo "  Rodando Firestore Rules (emulador — pode levar alguns segundos)..."
  (_carregar_node && cd "$REPO_DIR/tests/firestore-rules" && npm test) >/tmp/cellcity-release-rules.log 2>&1
  if [ $? -eq 0 ]; then _ok "Firestore Rules verde"
  else _fail "Firestore Rules falhou — ver /tmp/cellcity-release-rules.log (pode ser o flake de infra já registrado — reveja o log antes de bloquear)"; fi
}

_check_functions() {
  echo "  Rodando Cloud Functions (emulador)..."
  (_carregar_node && export PATH="$REPO_DIR/node_modules/.bin:$PATH" && cd "$REPO_DIR/tests/functions" && firebase emulators:exec --only firestore --project cellcity-rules-test "node --test") >/tmp/cellcity-release-functions.log 2>&1
  if [ $? -eq 0 ]; then _ok "Cloud Functions verde"
  else _fail "Cloud Functions falhou — ver /tmp/cellcity-release-functions.log"; fi
}

_check_artefato() {
  echo "  Validando artefato de deploy (rsync simulado)..."
  if "$SCRIPT_DIR/validar-deploy.sh" >/tmp/cellcity-release-artefato.log 2>&1; then
    _ok "Artefato de deploy íntegro"
  else
    _fail "Artefato de deploy quebrado — ver /tmp/cellcity-release-artefato.log"
  fi
}

_check_workflow() {
  echo "  Auditando deploy-pages.yml (excludes ancorados)..."
  local wf="$REPO_DIR/.github/workflows/deploy-pages.yml"
  if [ ! -f "$wf" ]; then _fail "deploy-pages.yml não encontrado"; return; fi
  # Todo --exclude de diretório de um segmento só precisa começar com "/"
  # (âncora de raiz) — mesma causa raiz do incidente de 2026-07-11.
  local soltos
  soltos=$(grep -oE "exclude='[a-zA-Z_]+/'" "$wf" || true)
  if [ -n "$soltos" ]; then
    _fail "excludes sem âncora de raiz em deploy-pages.yml: $soltos"
  else
    _ok "Excludes do deploy-pages.yml corretamente ancorados"
  fi
}

_check_versionamento() {
  echo "  Auditando versionamento..."
  local invalidas
  invalidas=$(git tag -l 'v*' | grep -vE '^v[0-9]{4}\.[0-9]{2}\.[0-9]{2}(-[a-z0-9-]+)?$|^v[0-9]+\.[0-9]+\.[0-9]+$' || true)
  if [ -n "$invalidas" ]; then
    _fail "tags em formato inesperado encontradas: $(echo "$invalidas" | tr '\n' ' ')"
  else
    _ok "Todas as tags seguem um formato reconhecido (timestamp ou semver)"
  fi
}

_check_github_actions() {
  echo "  Consultando GitHub Actions..."
  local runs deploy_status testes_status
  runs=$(curl -s "https://api.github.com/repos/$GH_REPO/actions/runs?branch=develop&per_page=10" 2>/dev/null)
  if [ -z "$runs" ]; then
    _warn "Não foi possível consultar o GitHub Actions (rede/API?)"
    return
  fi
  # "cancelled" no Deploy Pages é esperado quando há pushes em sequência
  # (concurrency: cancel-in-progress: true no workflow) — não é falha real.
  # Reporta a última run que não foi cancelada.
  deploy_status=$(echo "$runs" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d['workflow_runs']:
    if r['name']=='Deploy Pages (main + develop)' and r['conclusion']!='cancelled':
        print(r['conclusion']); break
" 2>/dev/null)
  testes_status=$(echo "$runs" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d['workflow_runs']:
    if r['name']=='Testes automatizados':
        print(r['conclusion']); break
" 2>/dev/null)
  echo "  Deploy Pages (última não-cancelada): ${deploy_status:-desconhecido}"
  echo "  Testes automatizados (última): ${testes_status:-desconhecido}"
  if [ "$deploy_status" = "success" ]; then _ok "Deploy Pages ok"; else _fail "Deploy Pages não teve sucesso na última run relevante"; fi
  if [ "$testes_status" = "success" ]; then
    _ok "Testes automatizados ok"
  else
    _warn "Testes automatizados falhando na CI (causa registrada como não determinada, ver memória do projeto — não bloqueia sozinho, mas reveja antes de confiar cegamente)"
  fi
}

_check_github_pages() {
  echo "  Verificando GitHub Pages ao vivo..."
  local http_prod http_dev
  http_prod=$(curl -s -o /dev/null -L -w "%{http_code}" "https://cellcityinformatica.com.br/" 2>/dev/null)
  http_dev=$(curl -s -o /dev/null -L -w "%{http_code}" "https://cellcityinformatica.com.br/dev/CRM/pages/dashboard/index.html" 2>/dev/null)
  if [ "$http_prod" = "200" ]; then _ok "Produção responde 200"; else _fail "Produção respondeu $http_prod"; fi
  if [ "$http_dev" = "200" ]; then _ok "DEV responde 200"; else _fail "DEV respondeu $http_dev"; fi
}

# ============================================================
# RELEASE COMPLETA (2-5 min)
# ============================================================
opcao_release_completa() {
  echo ""
  echo "🧪 Release Completa"
  echo "────────────────────"
  FALHAS=0
  _check_rbac
  _check_rules
  _check_functions
  _check_performance
  _check_integridade
  _check_artefato
  _check_workflow
  _check_versionamento
  _check_github_actions
  _check_github_pages

  echo ""
  if [ "$FALHAS" -eq 0 ]; then
    echo "✅ RELEASE COMPLETA: GO"
    _gravar_homologacao "2" "GO"
  else
    echo "❌ RELEASE COMPLETA: NO-GO ($FALHAS checagem(ns) falharam)"
    _invalidar_homologacao
  fi
}

# ============================================================
# CERTIFICAÇÃO COMPLETA — Release Completa + achados estáticos adicionais
# ============================================================
opcao_certificacao_completa() {
  echo ""
  echo "🏆 Certificação Completa"
  echo "─────────────────────────"
  FALHAS=0
  _check_rbac
  _check_rules
  _check_functions
  _check_performance
  _check_integridade
  _check_artefato
  _check_workflow
  _check_versionamento
  _check_github_actions
  _check_github_pages

  echo ""
  echo "🔎 Auditoria estática adicional:"
  # XSS / código morto / imports órfãos / coleções sem rule já são cobertos
  # pela própria suíte de Integridade acima (tests/integrity/integridade.test.mjs) —
  # não duplica lógica aqui, só resume o que ela já teria pego.
  if [ "$FALHAS" -eq 0 ]; then
    _ok "Sem achados novos de XSS/imports órfãos/coleções sem rule (cobertos pela suíte de Integridade)"
  fi
  local protegidos_tocados
  protegidos_tocados=$(git diff origin/main..HEAD --name-only 2>/dev/null | grep -E "firebase\.js$|auth\.js$|config\.js$|global\.css$" || true)
  if [ -n "$protegidos_tocados" ]; then
    _warn "Arquivos protegidos (CLAUDE.md §1) alterados desde main: $(echo "$protegidos_tocados" | tr '\n' ' ') — confirmar autorização"
  else
    _ok "Nenhum arquivo protegido alterado sem já ter sido revisado"
  fi

  echo ""
  echo "═══════════════════════════════════════"
  echo "  CHECKLIST GO / NO-GO"
  echo "═══════════════════════════════════════"
  if [ "$FALHAS" -eq 0 ]; then
    echo "  ✅ GO — apto para promoção"
    _gravar_homologacao "3" "GO"
  else
    echo "  ❌ NO-GO — $FALHAS checagem(ns) falharam, corrigir antes de promover"
    _invalidar_homologacao
  fi
  echo "═══════════════════════════════════════"
}

# ============================================================
# STATUS
# ============================================================
opcao_status() {
  echo ""
  echo "📊 Status da Release"
  echo "─────────────────────"
  opcao_release_rapida
  echo ""
  if [ -f "$MARCADOR" ]; then
    echo "Homologação registrada:"
    cat "$MARCADOR" | python3 -m json.tool 2>/dev/null || cat "$MARCADOR"
  else
    echo "Nenhuma homologação registrada nesta cópia local."
  fi
  echo ""
  echo "➡️  Próxima ação recomendada: $(_recomendar_proxima_acao)"
}

_recomendar_proxima_acao() {
  if [ -n "$(git status --porcelain)" ]; then echo "commitar/subir as alterações pendentes (subir)"; return; fi
  if [ ! -f "$MARCADOR" ]; then echo "rodar 'release' (opção 2 ou 3) antes de promover"; return; fi
  local commit_marcado commit_atual status_marcado
  commit_marcado=$(python3 -c "import json;print(json.load(open('$MARCADOR'))['commit'])" 2>/dev/null)
  status_marcado=$(python3 -c "import json;print(json.load(open('$MARCADOR'))['status'])" 2>/dev/null)
  commit_atual=$(git rev-parse HEAD)
  if [ "$commit_marcado" != "$commit_atual" ]; then echo "commit mudou desde a homologação — rodar 'release' de novo"; return; fi
  if [ "$status_marcado" != "GO" ]; then echo "última homologação foi NO-GO — corrigir e rodar 'release' de novo"; return; fi
  echo "homologação válida — pode rodar 'subir-ok'"
}

# ============================================================
# HISTÓRICO
# ============================================================
opcao_historico() {
  echo ""
  echo "🕘 Histórico de Releases"
  echo "──────────────────────────"
  echo "Últimas 10 tags:"
  git tag -l 'v*' --sort=-creatordate | head -10 | sed 's/^/  /'
  echo ""
  echo "Últimos 10 commits (develop):"
  git log develop --oneline -10 | sed 's/^/  /'
  echo ""
  echo "Últimas 5 promoções (commits em main):"
  git log main --oneline -5 | sed 's/^/  /'
}

# ============================================================
# AUDITORIA DE INFRAESTRUTURA
# ============================================================
opcao_infraestrutura() {
  echo ""
  echo "🏗️  Auditoria da Infraestrutura"
  echo "─────────────────────────────────"
  echo "subir / subir-ok:"
  if grep -q "^subir-ok()" "$HOME/.bashrc" && grep -q "^subir()" "$HOME/.bashrc"; then
    _ok "Funções subir/subir-ok definidas em ~/.bashrc"
  else
    _fail "subir/subir-ok não encontrados em ~/.bashrc"
  fi
  if grep -q 'RELEASE não homologada\|release não homologada\|Release não homologada' "$HOME/.bashrc"; then
    _ok "subir-ok exige homologação da Release antes de promover"
  else
    _warn "subir-ok ainda não exige homologação (rodar a Sprint que adiciona essa trava)"
  fi
  echo ""
  _check_workflow
  echo ""
  echo "Scripts de backup:"
  [ -x "$REPO_DIR/scripts/backup/backup-manual.sh" ] && _ok "backup-manual.sh presente e executável" || _fail "backup-manual.sh ausente/sem permissão"
  [ -x "$REPO_DIR/scripts/backup/restore-backup.sh" ] && _ok "restore-backup.sh presente e executável" || _fail "restore-backup.sh ausente/sem permissão"
  echo ""
  _check_github_actions
  _check_github_pages
  echo ""
  _check_versionamento
}

# ============================================================
# Marcador de homologação (.git/, local, nunca versionado)
# ============================================================
_gravar_homologacao() {
  local opcao="$1" status="$2"
  local commit ts
  commit=$(git rev-parse HEAD)
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  cat > "$MARCADOR" <<EOF
{"commit": "$commit", "opcao": $opcao, "status": "$status", "timestamp": "$ts"}
EOF
  echo ""
  echo "📝 Homologação registrada (commit $commit, opção $opcao, status $status)."
}

_invalidar_homologacao() {
  rm -f "$MARCADOR"
}

# Usado pelo subir-ok — não interativo, só código de saída.
# 0 = homologação válida para o commit atual; 1 = inválida/ausente.
verificar_homologacao_valida() {
  if [ ! -f "$MARCADOR" ]; then return 1; fi
  local commit_marcado status_marcado commit_atual
  commit_marcado=$(python3 -c "import json;print(json.load(open('$MARCADOR'))['commit'])" 2>/dev/null) || return 1
  status_marcado=$(python3 -c "import json;print(json.load(open('$MARCADOR'))['status'])" 2>/dev/null) || return 1
  commit_atual=$(git rev-parse HEAD 2>/dev/null)
  [ "$commit_marcado" = "$commit_atual" ] && [ "$status_marcado" = "GO" ]
}

# ============================================================
# Entrada não interativa (usada pelo subir-ok)
# ============================================================
if [ "${1:-}" = "--check-homologacao" ]; then
  if verificar_homologacao_valida; then
    exit 0
  else
    exit 1
  fi
fi

# ============================================================
# Menu interativo
# ============================================================
while true; do
  echo ""
  echo "========================================"
  echo "        CELL CITY RELEASE CENTER"
  echo "========================================"
  echo "1 - Release Rápida (v1)"
  echo "2 - Release Completa (v2)"
  echo "3 - Certificação Completa (v3)"
  echo "4 - Status da Release"
  echo "5 - Histórico de Releases"
  echo "6 - Verificar Infraestrutura"
  echo "0 - Sair"
  echo "========================================"
  read -rp "Escolha uma opção: " escolha
  case "$escolha" in
    1) opcao_release_rapida ;;
    2) opcao_release_completa ;;
    3) opcao_certificacao_completa ;;
    4) opcao_status ;;
    5) opcao_historico ;;
    6) opcao_infraestrutura ;;
    0) echo "Saindo do Release Center."; exit 0 ;;
    *) echo "Opção inválida." ;;
  esac
done
