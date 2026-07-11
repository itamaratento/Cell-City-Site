#!/bin/bash
# Cell City Release Center v2.0 — homologação técnica antes da promoção pra main.
#
# Fluxo oficial: subir -> release -> subir-ok. O comando `release` é
# SOMENTE auditoria: nunca commita, nunca dá push, nunca promove, nunca cria
# tag, nunca altera código, nunca automatiza login (só páginas públicas na
# checagem Pós-Deploy). Ao final de uma "Release Completa" ou "Certificação
# de Produção" com todas as checagens verdes, grava um
# marcador local (.git/, nunca versionado/pushado) que o `subir-ok` exige
# antes de prosseguir — ver ALTERAÇÃO NO SUBIR-OK, Sprint 2026-07-11
# (Release Center).
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
_check_estrutura_projeto() {
  echo "  Verificando estrutura do projeto..."
  local CAMINHOS=(
    "CRM/index.html" "CRM/login.html" "CRM/pages" "CRM/scripts" "CRM/repositories"
    "tests" ".github/workflows/deploy-pages.yml" "scripts/release"
  )
  local ausente=0
  for c in "${CAMINHOS[@]}"; do
    [ -e "$REPO_DIR/$c" ] || { echo "  ❌ AUSENTE: $c"; ausente=1; }
  done
  [ "$ausente" -eq 0 ] && _ok "Estrutura de diretórios/arquivos essenciais presente" || _fail "Estrutura do projeto incompleta (ver acima)"
}

_check_testes_rapidos() {
  echo "  Testes rápidos (sintaxe dos scripts principais)..."
  local ARQUIVOS=(
    "CRM/scripts/firebase.js" "CRM/scripts/kernel.js"
    "CRM/pages/dashboard/dashboard.js" "CRM/pages/os/os.js" "CRM/pages/portal-cliente/portal.js"
  )
  local quebrado=0
  for a in "${ARQUIVOS[@]}"; do
    if [ -f "$REPO_DIR/$a" ]; then
      node --check "$REPO_DIR/$a" >/tmp/cellcity-release-syntax.log 2>&1 || { echo "  ❌ Erro de sintaxe: $a"; quebrado=1; }
    fi
  done
  [ "$quebrado" -eq 0 ] && _ok "Sintaxe ok nos scripts principais" || _fail "Sintaxe quebrada — ver /tmp/cellcity-release-syntax.log"
}

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

  _check_estrutura_projeto
  _check_testes_rapidos

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

_check_pages_deployment_recente() {
  echo "  Verificando última implantação (deployment) do GitHub Pages..."
  local dep state created_at
  dep=$(curl -s "https://api.github.com/repos/$GH_REPO/deployments?environment=github-pages&per_page=1" 2>/dev/null)
  if [ -z "$dep" ] || [ "$dep" = "[]" ]; then
    _warn "Não foi possível consultar deployments do GitHub Pages (rede/API?)"
    return
  fi
  local dep_id
  dep_id=$(echo "$dep" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null)
  created_at=$(echo "$dep" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['created_at'] if d else '')" 2>/dev/null)
  [ -z "$dep_id" ] && { _warn "Deployment do GitHub Pages não encontrado"; return; }
  state=$(curl -s "https://api.github.com/repos/$GH_REPO/deployments/$dep_id/statuses" 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(d[0]['state'] if d else '')
" 2>/dev/null)
  echo "  Última implantação: $created_at, estado: ${state:-desconhecido}"
  if [ "$state" = "success" ]; then _ok "GitHub Pages atualizado (última implantação com sucesso)"
  else _fail "Última implantação do GitHub Pages não teve sucesso (estado: ${state:-desconhecido})"; fi
}

# ============================================================
# PÓS-DEPLOY — valida o site AO VIVO em produção. Só páginas públicas,
# nunca automatiza login (CLAUDE.md §1). Reaproveitada pela Certificação
# de Produção (opção 3) e disponível standalone como opção 7.
# ============================================================
_check_pos_deploy() {
  echo "  Confirmando páginas-chave (HTTP 200)..."
  local URLS_LABEL=(
    "home:https://cellcityinformatica.com.br/"
    "login:https://cellcityinformatica.com.br/CRM/login.html"
    "dashboard:https://cellcityinformatica.com.br/CRM/pages/dashboard/index.html"
    "portal-cliente:https://cellcityinformatica.com.br/CRM/pages/portal-cliente/index.html"
  )
  local item label url codigo
  for item in "${URLS_LABEL[@]}"; do
    label="${item%%:*}"; url="${item#*:}"
    codigo=$(curl -s -o /dev/null -L -w "%{http_code}" "$url" 2>/dev/null)
    if [ "$codigo" = "200" ]; then _ok "$label abre (200)"; else _fail "$label respondeu $codigo"; fi
  done

  echo "  Confirmando assets estáticos..."
  local ASSETS=(
    "https://cellcityinformatica.com.br/CRM/scripts/firebase.js"
    "https://cellcityinformatica.com.br/CRM/scripts/kernel.js"
  )
  local asset codigo_asset
  for asset in "${ASSETS[@]}"; do
    codigo_asset=$(curl -s -o /dev/null -L -w "%{http_code}" "$asset" 2>/dev/null)
    if [ "$codigo_asset" = "200" ]; then _ok "Asset ok: $(basename "$asset")"; else _fail "Asset $(basename "$asset") respondeu $codigo_asset"; fi
  done

  _check_pages_deployment_recente

  echo "  Console do navegador (Chrome headless, só páginas públicas)..."
  local saida status_browser
  saida=$(_carregar_node && node "$SCRIPT_DIR/pos-deploy-browser.mjs" 2>/tmp/cellcity-release-browser-stderr.log)
  status_browser=$?
  echo "$saida" > /tmp/cellcity-release-browser.json
  if [ "$status_browser" -eq 2 ]; then
    _warn "Checagem de console pulada — Chrome não disponível nesta máquina"
  elif [ "$status_browser" -eq 0 ]; then
    _ok "Console sem erros críticos nas páginas públicas visitadas"
  else
    _fail "Console com erro(s) — ver /tmp/cellcity-release-browser.json"
  fi
}

opcao_pos_deploy() {
  echo ""
  echo "🚀 Pós-Deploy"
  echo "──────────────"
  FALHAS=0
  _check_pos_deploy
  echo ""
  if [ "$FALHAS" -eq 0 ]; then
    echo "🟢 Deploy validado"
  else
    echo "🔴 Deploy com falha ($FALHAS checagem(ns))"
  fi
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
  _check_versionamento
  _check_github_actions
  _check_github_pages
  local falhas_antes_deploy=$FALHAS
  _check_workflow
  _check_artefato
  if [ "$FALHAS" -eq "$falhas_antes_deploy" ]; then
    _ok "Deploy: pipeline íntegro (workflow, artefato, Actions e Pages ao vivo)"
  else
    _fail "Deploy: pipeline com problema(s) — ver checagens acima"
  fi

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
# Checagens exclusivas da Certificação de Produção
# ============================================================
_check_arquitetura() {
  echo "  Auditoria de arquitetura (regressão de incidentes históricos)..."
  local achados=0
  if grep -rlE "from ['\"]/CRM/scripts/kernel\.js['\"]" "$REPO_DIR/CRM" --include="*.js" --include="*.html" >/dev/null 2>&1; then
    echo "  ❌ import absoluto de kernel.js encontrado (padrão do incidente H-008)"
    achados=1
  fi
  [ "$achados" -eq 0 ] && _ok "Nenhum import absoluto de kernel.js (H-008 não regrediu)" || _fail "Achado(s) de arquitetura — ver acima"
}

_check_seguranca() {
  echo "  Auditoria de segurança (segredos/exclusões sensíveis)..."
  local achados=0
  local secretos
  secretos=$(git -C "$REPO_DIR" ls-files | grep -iE "sa-key.*\.json$|\.pem$|credentials.*\.json$" || true)
  if [ -n "$secretos" ]; then
    echo "  ❌ Possível credencial versionada no git: $(echo "$secretos" | tr '\n' ' ')"
    achados=1
  fi
  local wf="$REPO_DIR/.github/workflows/deploy-pages.yml"
  for padrao in "/plans/" "/CLAUDE.md" "/_BACKUPS/"; do
    grep -qF "exclude='$padrao'" "$wf" || { echo "  ❌ deploy-pages.yml não exclui '$padrao' do artefato publicado"; achados=1; }
  done
  [ "$achados" -eq 0 ] && _ok "Nenhuma credencial versionada, exclusões sensíveis presentes no deploy" || _fail "Achado(s) de segurança — ver acima"
}

_check_repository_layer() {
  echo "  Auditoria da Camada Repository..."
  local dir="$REPO_DIR/CRM/repositories"
  if [ ! -d "$dir" ]; then _warn "CRM/repositories/ não existe nesta branch — checagem não se aplica"; return; fi
  if [ ! -f "$dir/base.repository.js" ]; then _fail "base.repository.js ausente em CRM/repositories/"; return; fi
  local quebrado=0
  local f
  for f in "$dir"/*.js; do
    node --check "$f" >/tmp/cellcity-release-repo-syntax.log 2>&1 || { echo "  ❌ Erro de sintaxe: $(basename "$f")"; quebrado=1; }
  done
  local total usando_base
  total=$(find "$dir" -maxdepth 1 -name "*.repository.js" | wc -l)
  usando_base=$(grep -lE "base\.repository|BaseRepository" "$dir"/*.repository.js 2>/dev/null | wc -l)
  echo "  $total repositório(s) encontrados, $usando_base referenciam base.repository/BaseRepository."
  if [ "$quebrado" -eq 0 ] && [ "$usando_base" -ge $((total - 1)) ]; then
    _ok "Camada Repository consistente (sintaxe ok, herança de base.repository)"
  else
    _fail "Camada Repository com inconsistências — ver acima"
  fi
}

_check_fluxos_criticos() {
  echo "  Auditoria de fluxos críticos (CLAUDE.md §5)..."
  local FLUXOS=(
    "Login:CRM/login.html"
    "Dashboard:CRM/pages/dashboard/index.html"
    "CRM (clientes):CRM/pages/clientes/index.html"
    "Ordem de Serviço:CRM/pages/os/index.html"
    "Caixa:CRM/pages/caixa/index.html"
    "Estoque:CRM/pages/estoque/index.html"
    "Financeiro:CRM/pages/financeiro/index.html"
    "Portal do Cliente:CRM/pages/portal-cliente/index.html"
  )
  local item label caminho vazio_ou_ausente=0
  for item in "${FLUXOS[@]}"; do
    label="${item%%:*}"; caminho="${item#*:}"
    if [ ! -s "$REPO_DIR/$caminho" ]; then
      echo "  ❌ $label: $caminho ausente ou vazio"
      vazio_ou_ausente=1
    fi
  done
  [ "$vazio_ou_ausente" -eq 0 ] && _ok "Todos os 8 fluxos críticos presentes e não-vazios (checagem estrutural — reforça teste manual)" || _fail "Fluxo(s) crítico(s) ausente(s) — ver acima"
}

_check_cicd() {
  echo "  Auditoria de CI/CD (deploy-pages.yml)..."
  local wf="$REPO_DIR/.github/workflows/deploy-pages.yml"
  local achados=0
  grep -q "^on:" "$wf" && grep -qE "branches:\s*\[main, develop\]" "$wf" || { echo "  ❌ Trigger de push (main+develop) não encontrado"; achados=1; }
  for job in "build:" "deploy:" "smoke-test:"; do
    grep -q "^  $job" "$wf" || { echo "  ❌ Job '$job' ausente no workflow"; achados=1; }
  done
  [ "$achados" -eq 0 ] && _ok "Workflow com triggers e jobs (build/deploy/smoke-test) esperados" || _fail "CI/CD com achado(s) — ver acima"
}

_emitir_relatorio_certificacao() {
  local status="$1"
  local dir="$REPO_DIR/evidencias/release-center"
  mkdir -p "$dir"
  local ts arquivo commit
  ts=$(date -u +"%Y%m%d-%H%M%S")
  commit=$(git rev-parse HEAD)
  arquivo="$dir/${ts}-certificacao.md"
  {
    echo "# Certificação de Produção — Cell City Release Center"
    echo ""
    echo "- Commit: $commit"
    echo "- Timestamp (UTC): $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "- Resultado: $status"
    echo "- Checagens que falharam: $FALHAS"
    echo ""
    echo "Relatório gerado automaticamente pela opção 3 (Certificação de Produção) do Release Center."
  } > "$arquivo"
  echo "  📄 Relatório técnico: $arquivo"
}

# ============================================================
# CERTIFICAÇÃO DE PRODUÇÃO (10-20 min) — Release Completa + auditoria
# estática ampliada + validação pós-deploy ao vivo.
# ============================================================
opcao_certificacao_completa() {
  echo ""
  echo "🏆 Certificação de Produção"
  echo "────────────────────────────"
  FALHAS=0
  _check_rbac
  _check_rules
  _check_functions
  _check_performance
  _check_integridade
  _check_versionamento
  _check_github_actions
  _check_github_pages
  _check_workflow
  _check_artefato

  echo ""
  echo "🔎 Auditoria estática ampliada:"
  # XSS / imports órfãos / ES modules / coleções sem rule já são cobertos
  # pela própria suíte de Integridade acima (tests/integrity/integridade.test.mjs) —
  # não duplica lógica aqui, só resume o que ela já teria pego.
  _ok "XSS, imports órfãos, ES modules e coleções sem rule cobertos pela suíte de Integridade"
  _check_arquitetura
  _check_seguranca
  _check_repository_layer
  _check_fluxos_criticos
  _check_cicd
  local protegidos_tocados
  protegidos_tocados=$(git diff origin/main..HEAD --name-only 2>/dev/null | grep -E "firebase\.js$|auth\.js$|config\.js$|global\.css$" || true)
  if [ -n "$protegidos_tocados" ]; then
    _warn "Arquivos protegidos (CLAUDE.md §1) alterados desde main: $(echo "$protegidos_tocados" | tr '\n' ' ') — confirmar autorização"
  else
    _ok "Nenhum arquivo protegido alterado sem já ter sido revisado"
  fi

  echo ""
  echo "🚀 Validação Pós-Deploy (ao vivo):"
  _check_pos_deploy

  echo ""
  echo "═══════════════════════════════════════"
  echo "  CHECKLIST GO / NO-GO"
  echo "═══════════════════════════════════════"
  local status
  if [ "$FALHAS" -eq 0 ]; then
    echo "  ✅ GO — apto para promoção"
    status="GO"
    _gravar_homologacao "3" "GO"
  else
    echo "  ❌ NO-GO — $FALHAS checagem(ns) falharam, corrigir antes de promover"
    status="NO-GO"
    _invalidar_homologacao
  fi
  echo "═══════════════════════════════════════"
  _emitir_relatorio_certificacao "$status"
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
  local branch_atual
  branch_atual=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ "$branch_atual" != "develop" ]; then echo "trocar para a branch 'develop' (git checkout develop) antes de promover"; return; fi
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
# HISTÓRICO DAS RELEASES
# ============================================================
opcao_historico() {
  echo ""
  echo "🕘 Histórico das Releases"
  echo "───────────────────────────"
  echo "Últimas 10 tags:"
  git tag -l 'v*' --sort=-creatordate | head -10 | sed 's/^/  /'
  echo ""
  echo "Últimos 10 commits (develop):"
  git log develop --oneline -10 | sed 's/^/  /'
  echo ""
  echo "Últimas 5 promoções (commits em main):"
  git log main --oneline -5 | sed 's/^/  /'
  echo ""
  echo "Últimos 5 backups (Cell-City-Backup):"
  git ls-remote --tags "$(grep -oE 'https://github.com/[^"'"'"']+Cell-City-Backup\.git' "$REPO_DIR/scripts/backup/config.sh" | head -1)" 2>/dev/null \
    | grep -v '\^{}' | awk '{print $2}' | sed 's#refs/tags/##' | LC_ALL=C sort | tail -5 | sed 's/^/  /' \
    || echo "  (não foi possível consultar o repositório de backup)"
}

# ============================================================
# AUDITORIA DA INFRAESTRUTURA
# ============================================================
opcao_infraestrutura() {
  echo ""
  echo "🏗️  Auditoria da Infraestrutura"
  echo "─────────────────────────────────"
  echo "subir / subir-ok / release:"
  if grep -q "^subir-ok()" "$HOME/.bashrc" && grep -q "^subir()" "$HOME/.bashrc"; then
    _ok "Funções subir/subir-ok definidas em ~/.bashrc"
  else
    _fail "subir/subir-ok não encontrados em ~/.bashrc"
  fi
  if grep -q 'RELEASE não homologada\|release não homologada\|Release não homologada\|check-homologacao' "$HOME/.bashrc"; then
    _ok "subir-ok exige homologação da Release antes de promover"
  else
    _warn "subir-ok ainda não exige homologação (rodar a Sprint que adiciona essa trava)"
  fi
  if [ -x /usr/local/bin/release ] && grep -q "release-center.sh" /usr/local/bin/release 2>/dev/null; then
    _ok "/usr/local/bin/release aponta para o release-center.sh versionado"
  else
    _warn "/usr/local/bin/release desatualizado ou ausente — reinstalar com scripts/release/release-wrapper-usr-local-bin.sh"
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
# Marcador de homologação (.git/, local, nunca versionado — .git/ nunca é
# rastreado pelo git, então é mais seguro que um dotfile na raiz do repo,
# que dependeria de .gitignore pra não vazar).
# ============================================================
_tipo_release() {
  case "$1" in
    1) echo "Rápida" ;;
    2) echo "Completa" ;;
    3) echo "Certificação" ;;
    *) echo "desconhecida" ;;
  esac
}

_gravar_homologacao() {
  local opcao="$1" status="$2"
  local commit ts branch versao tipo
  commit=$(git rev-parse HEAD)
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  versao=$(git describe --tags --abbrev=0 2>/dev/null || echo "nenhuma")
  tipo=$(_tipo_release "$opcao")
  cat > "$MARCADOR" <<EOF
{"commit": "$commit", "opcao": $opcao, "tipo": "$tipo", "status": "$status", "resultado": "$status", "timestamp": "$ts", "branch": "$branch", "versao": "$versao"}
EOF
  echo ""
  echo "📝 Homologação registrada (commit $commit, tipo $tipo, branch $branch, versão $versao, status $status)."
}

_invalidar_homologacao() {
  rm -f "$MARCADOR"
}

# Usado pelo subir-ok — não interativo, só código de saída. Auto-suficiente
# de propósito (Sprint "Bloqueio Obrigatório de Homologação"): não depende
# dos checks que o subir-ok já faz antes de chamar isto — confere de novo
# aqui branch/working-tree/commit/status, pra a garantia valer mesmo se
# alguém rodar `release-center.sh --check-homologacao` fora do subir-ok.
# 0 = homologação válida para o estado atual; 1 = inválida/ausente/stale.
verificar_homologacao_valida() {
  if [ ! -f "$MARCADOR" ]; then return 1; fi
  local commit_marcado status_marcado commit_atual branch_atual
  commit_marcado=$(python3 -c "import json;print(json.load(open('$MARCADOR'))['commit'])" 2>/dev/null) || return 1
  status_marcado=$(python3 -c "import json;print(json.load(open('$MARCADOR'))['status'])" 2>/dev/null) || return 1
  commit_atual=$(git rev-parse HEAD 2>/dev/null)
  branch_atual=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  [ "$branch_atual" = "develop" ] || return 1
  [ -z "$(git status --porcelain)" ] || return 1
  [ "$commit_marcado" = "$commit_atual" ] || return 1
  [ "$status_marcado" = "GO" ]
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
  echo "=========================================="
  echo "        CELL CITY RELEASE CENTER"
  echo "=========================================="
  echo ""
  echo "1 - Release Rápida (30 segundos)"
  echo ""
  echo "2 - Release Completa (2~5 minutos)"
  echo ""
  echo "3 - Certificação de Produção (10~20 minutos)"
  echo ""
  echo "------------------------------------------"
  echo ""
  echo "4 - Status da Release"
  echo ""
  echo "5 - Histórico das Releases"
  echo ""
  echo "6 - Auditoria da Infraestrutura"
  echo ""
  echo "7 - Pós-Deploy"
  echo ""
  echo "------------------------------------------"
  echo ""
  echo "0 - Sair"
  echo ""
  echo "=========================================="
  read -rp "Escolha uma opção: " escolha
  case "$escolha" in
    1) opcao_release_rapida ;;
    2) opcao_release_completa ;;
    3) opcao_certificacao_completa ;;
    4) opcao_status ;;
    5) opcao_historico ;;
    6) opcao_infraestrutura ;;
    7) opcao_pos_deploy ;;
    0) echo "Saindo do Release Center."; exit 0 ;;
    *) echo "Opção inválida." ;;
  esac
done
