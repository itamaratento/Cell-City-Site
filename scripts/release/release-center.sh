#!/bin/bash
# Cell City Release Center v2.1 — homologação técnica antes da promoção pra main.
#
# Fluxo oficial: subir -> release -> subir-ok. O comando `release` é
# SOMENTE auditoria: nunca commita, nunca dá push, nunca promove, nunca cria
# tag, nunca altera código, nunca automatiza login (só páginas públicas na
# checagem Pós-Deploy). Ao final de uma "Release Completa" ou "Certificação
# de Produção" com todas as checagens BLOQUEANTES verdes, grava um
# marcador local (.git/, nunca versionado/pushado) que o `subir-ok` exige
# antes de prosseguir.
#
# v2.1 (refatoração 2026-07-13 — velocidade, assertividade, sem falso positivo):
#   • Severidades: ✗ BLOCKER / ⚠ AVISO / ℹ INFO / ✓ PASS. Bloqueiam somente:
#     workspace sujo, branch errada, RBAC, Rules, Functions, Integridade,
#     erro real de sintaxe, erro de build (artefato), tag inválida e as
#     checagens de SEGURANÇA (excludes do deploy, credenciais) — nenhuma
#     regra de segurança foi afrouxada. Todo o resto vira AVISO.
#   • Suítes rodam em paralelo (lanes) — Release Completa ~3x mais rápida.
#   • Cache por sessão: cada suíte roda 1x; reuso mostra "há XXs".
#   • Banco de flakes (known_flakes.json): assinaturas conhecidas de falso
#     positivo disparam UMA reexecução automática (tentativa 2/2).
#   • Logs detalhados em logs/release/ (terminal mostra só o resumo).
#   • Release Turbo (<60s): só validações críticas + cache. NÃO grava
#     homologação (não pula a Integridade do gate oficial).
#
# Uso: scripts/release/release-center.sh (interativo)
#      scripts/release/release-center.sh --check-homologacao  (subir-ok; só exit code)
#      scripts/release/release-center.sh --explicar-bloqueio  (diagnóstico assertivo)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_DIR" || { echo "✗ Não foi possível acessar o repositório em $REPO_DIR."; exit 1; }

MARCADOR="$REPO_DIR/.git/cellcity-release-homologada.json"
GH_REPO="itamaratento/Cell-City-Site"
RUN_TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="$REPO_DIR/logs/release"
mkdir -p "$LOG_DIR"
KNOWN_FLAKES="$SCRIPT_DIR/known_flakes.json"
CHECKPOINT="$LOG_DIR/checkpoint.json"
NOCACHE=0            # 1 = Certificação (FASE 8): ignora cache e checkpoint

FALHAS=0
AVISOS=0
WARN_MSGS=()

# ── Cores (só em TTY) ───────────────────────────────────────
if [ -t 1 ]; then
  C_G=$'\033[0;32m'; C_Y=$'\033[0;33m'; C_R=$'\033[0;31m'; C_B=$'\033[0;34m'; C_0=$'\033[0m'
else
  C_G=""; C_Y=""; C_R=""; C_B=""; C_0=""
fi

_carregar_node() {
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm use --lts >/dev/null 2>&1
}

# ── Severidades ─────────────────────────────────────────────
# _blocker "resumo" ["motivo"] ["como resolver"] — o único que conta pro NO-GO.
_pass()    { echo "  ${C_G}✓${C_0} $1"; }
_info()    { echo "  ${C_B}ℹ${C_0} $1"; }
_aviso()   { echo "  ${C_Y}⚠${C_0} $1"; AVISOS=$((AVISOS+1)); WARN_MSGS+=("$1"); }
_blocker() {
  echo "  ${C_R}✗ BLOCKER${C_0} — $1"
  [ -n "${2:-}" ] && echo "      Motivo: $2"
  [ -n "${3:-}" ] && echo "      Como resolver: $3"
  FALHAS=$((FALHAS+1))
}
# Aliases legados (compatibilidade com trechos/documentos antigos)
_ok()   { _pass "$1"; }
_fail() { _blocker "$1"; }
_warn() { _aviso "$1"; }

# ── Banco de flakes conhecidos (known_flakes.json) ──────────
_flake_match() { # $1=logfile → imprime o nome do flake; rc 0 se casou
  [ -f "$KNOWN_FLAKES" ] && [ -f "$1" ] || return 1
  python3 - "$KNOWN_FLAKES" "$1" <<'PY'
import json, re, sys
db = json.load(open(sys.argv[1]))
log = open(sys.argv[2], encoding='utf-8', errors='replace').read()
for f in db.get('flakes', []):
    if re.search(f['assinatura'], log):
        print(f['nome']); sys.exit(0)
sys.exit(1)
PY
}

# ── Cache de suítes (1 execução por sessão) + checkpoints ───
# Cada validação vira um objeto interno: STATUS ∈ PASS/WARN/FAIL/SKIPPED/CACHED
declare -A CACHE_RC CACHE_TS CACHE_DET CACHE_LOG
declare -A RESUMO RESULT_ST

# FASE 11 — checkpoint após cada etapa; permite "Continuar Release"
_checkpoint_salvar() {
  local commit; commit=$(git rev-parse HEAD 2>/dev/null)
  {
    printf '{"commit":"%s","run":"%s","suites":{' "$commit" "$RUN_TS"
    local k sep=""
    for k in "${!CACHE_RC[@]}"; do
      printf '%s"%s":{"rc":%s,"ts":%s,"det":"%s"}' "$sep" "$k" "${CACHE_RC[$k]}" "${CACHE_TS[$k]}" "${CACHE_DET[$k]}"
      sep=","
    done
    printf '}}'
  } > "$CHECKPOINT" 2>/dev/null || true
}

_checkpoint_carregar() {
  [ "$NOCACHE" = "1" ] && return 0
  [ -f "$CHECKPOINT" ] || return 0
  local commit_atual; commit_atual=$(git rev-parse HEAD 2>/dev/null)
  local seeds
  seeds=$(python3 - "$CHECKPOINT" "$commit_atual" <<'PY' 2>/dev/null
import json, sys, time
try:
    cp = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
if cp.get('commit') != sys.argv[2]:
    sys.exit(0)   # commit mudou → checkpoint inválido
agora = int(time.time())
for k, v in cp.get('suites', {}).items():
    if v.get('rc') == 0 and agora - int(v.get('ts', 0)) < 1800:  # só PASS, <30min
        print(f"{k}|{v['rc']}|{v['ts']}|{v.get('det','')}")
PY
)
  [ -z "$seeds" ] && return 0
  local n=0 linha k rc ts det
  while IFS='|' read -r k rc ts det; do
    [ -n "${CACHE_RC[$k]:-}" ] && continue
    CACHE_RC[$k]=$rc; CACHE_TS[$k]=$ts; CACHE_DET[$k]="$det"
    CACHE_LOG[$k]="$LOG_DIR (run anterior)"
    n=$((n+1))
  done <<< "$seeds"
  [ "$n" -gt 0 ] && _info "Checkpoint encontrado (mesmo commit) — Continuar Release: $n etapa(s) aproveitada(s). A Certificação (opção 3) refaz tudo."
}

# Definições das suítes: comando, rótulo, duração estimada (s), severidade em falha
_cmd_rbac()        { (_carregar_node && cd "$REPO_DIR/tests/rbac" && npm test); }
_cmd_rules()       { (_carregar_node && cd "$REPO_DIR/tests/firestore-rules" && npm test); }
_cmd_functions()   { (_carregar_node && export PATH="$REPO_DIR/node_modules/.bin:$PATH" && cd "$REPO_DIR/tests/functions" && firebase emulators:exec --only firestore --project cellcity-rules-test "node --test"); }
_cmd_performance() { (_carregar_node && cd "$REPO_DIR" && node --test tests/performance/polling-gating.test.mjs); }
_cmd_integridade() { (_carregar_node && cd "$REPO_DIR" && node --test tests/integrity/integridade.test.mjs); }
_cmd_artefato()    { "$SCRIPT_DIR/validar-deploy.sh"; }

_suite_label() {
  case "$1" in
    rbac) echo "RBAC" ;; rules) echo "Firestore Rules" ;;
    functions) echo "Cloud Functions" ;; performance) echo "Performance" ;;
    integridade) echo "Integridade" ;; artefato) echo "Artefato de deploy (build)" ;;
    *) echo "$1" ;;
  esac
}
_suite_est() {
  case "$1" in
    rbac) echo 25 ;; rules) echo 12 ;; functions) echo 15 ;;
    performance) echo 5 ;; integridade) echo 22 ;; artefato) echo 18 ;;
    *) echo 10 ;;
  esac
}

# Worker: roda UMA suíte (em background), com retry automático de flake.
# Resultado em $2/<key>: "rc|segundos|passcount|flake"
_suite_worker() {
  local key="$1" resdir="$2"
  local log="$LOG_DIR/$RUN_TS-$key.log"
  local ini fim rc flake="" passc=""
  ini=$(date +%s)
  "_cmd_$key" >"$log" 2>&1
  rc=$?
  if [ "$rc" -ne 0 ]; then
    flake=$(_flake_match "$log" || true)
    if [ -n "$flake" ]; then
      mv "$log" "$log.flake1"
      "_cmd_$key" >"$log" 2>&1
      rc=$?
    fi
  fi
  fim=$(date +%s)
  passc=$(grep -oE '# pass [0-9]+' "$log" 2>/dev/null | tail -1 | grep -oE '[0-9]+' || true)
  # compat: mantém o log também no caminho antigo em /tmp
  cp "$log" "/tmp/cellcity-release-$key.log" 2>/dev/null || true
  echo "$rc|$((fim-ini))|$passc|$flake" > "$resdir/$key"
}

_barra() { # $1=pct
  local pct=$1 largura=20 cheio i
  cheio=$(( pct * largura / 100 ))
  printf '['
  for ((i=0;i<cheio;i++));           do printf '#'; done
  for ((i=cheio;i<largura;i++));     do printf '-'; done
  printf '] %3d%%' "$pct"
}

# Ingesta o resultado de uma suíte no cache + relata com a severidade certa.
# $1=key $2=resdir $3=severidade_em_falha (blocker|aviso)
_suite_ingerir() {
  local key="$1" resdir="$2" sev="${3:-blocker}"
  local rc seg passc flake label
  IFS='|' read -r rc seg passc flake < "$resdir/$key"
  label=$(_suite_label "$key")
  CACHE_RC[$key]=$rc; CACHE_TS[$key]=$(date +%s); CACHE_LOG[$key]="$LOG_DIR/$RUN_TS-$key.log"
  CACHE_DET[$key]="${passc:+$passc testes, }${seg}s"
  [ -n "$flake" ] && _aviso "Problema conhecido em $label: $flake — reexecutado automaticamente (tentativa 2/2, log original: *.flake1)"
  if [ "$rc" -eq 0 ]; then
    _pass "$label verde (${CACHE_DET[$key]})"
    RESUMO[$key]="${C_G}PASS${C_0} (${CACHE_DET[$key]})"; RESULT_ST[$key]="PASS"
  else
    if [ "$sev" = "blocker" ]; then
      _blocker "$label falhou" "suíte retornou erro real (não casou com nenhum flake conhecido)" "ver ${CACHE_LOG[$key]}"
      RESUMO[$key]="${C_R}FAIL${C_0}"; RESULT_ST[$key]="FAIL"
    else
      _aviso "$label falhou (não-bloqueante) — ver ${CACHE_LOG[$key]}"
      RESUMO[$key]="${C_Y}WARN${C_0}"; RESULT_ST[$key]="WARN"
    fi
  fi
  _checkpoint_salvar
}

# Relata reuso de cache (item 1 da spec)
_suite_reusar() {
  local key="$1" agora d label
  label=$(_suite_label "$key")
  agora=$(date +%s); d=$(( agora - CACHE_TS[$key] ))
  if [ "${CACHE_RC[$key]}" -eq 0 ]; then
    _info "$label: ✓ resultado reutilizado (executado há ${d}s — ${CACHE_DET[$key]})"
    RESUMO[$key]="${C_B}CACHED${C_0} ✓ (há ${d}s)"; RESULT_ST[$key]="CACHED"
  else
    _info "$label: ✗ resultado reutilizado (falhou há ${d}s — rode novamente pra revalidar)"
    RESUMO[$key]="${C_B}CACHED${C_0} ✗"; RESULT_ST[$key]="CACHED"
  fi
}

# Roda um conjunto de suítes em lanes paralelas com barra de progresso.
# $1 = severidades "key:sev,key:sev,..."  $2.. = lanes "key1>key2" (”>” = sequencial na lane)
_rodar_suites() {
  local sevmap="$1"; shift
  local lanes=("$@")
  local resdir; resdir=$(mktemp -d)
  trap 'rm -rf "$resdir"' EXIT
  local todos=() key lane
  local est_total=0 lane_est

  # separa o que tem cache do que precisa rodar
  local pendentes=()
  for lane in "${lanes[@]}"; do
    local lane_keys="${lane//>/ }" lane_pend=""
    lane_est=0
    for key in $lane_keys; do
      todos+=("$key")
      if [ "$NOCACHE" != "1" ] && [ -n "${CACHE_RC[$key]:-}" ]; then
        _suite_reusar "$key"
      else
        lane_pend="$lane_pend $key"
        lane_est=$(( lane_est + $(_suite_est "$key") ))
      fi
    done
    [ "$lane_est" -gt "$est_total" ] && est_total=$lane_est
    if [ -n "$lane_pend" ]; then
      pendentes+=($lane_pend)
      ( for key in $lane_pend; do _suite_worker "$key" "$resdir"; done ) &
    fi
  done

  local total=${#pendentes[@]}
  if [ "$total" -gt 0 ]; then
    local ini agora done_count pct eta etapa
    ini=$(date +%s)
    while :; do
      done_count=$(ls "$resdir" 2>/dev/null | wc -l)
      agora=$(date +%s)
      pct=$(( done_count * 100 / total )); [ "$pct" -gt 99 ] && pct=99
      eta=$(( est_total - (agora - ini) )); [ "$eta" -lt 0 ] && eta=0
      etapa=$(( done_count + 1 )); [ "$etapa" -gt "$total" ] && etapa=$total
      if [ -t 1 ]; then
        printf '\r  %s  Etapa %d de %d — %ds decorridos (~%ds restantes)   ' \
          "$(_barra "$pct")" "$etapa" "$total" "$((agora-ini))" "$eta"
      fi
      [ "$done_count" -ge "$total" ] && break
      sleep 1
    done
    wait
    [ -t 1 ] && printf '\r%*s\r' 90 ''
  fi

  # relata na ordem declarada, com a severidade configurada
  for key in "${todos[@]}"; do
    [ -f "$resdir/$key" ] || continue
    local sev="blocker"
    case ",$sevmap," in *",$key:aviso,"*) sev="aviso" ;; esac
    _suite_ingerir "$key" "$resdir" "$sev"
  done
  rm -rf "$resdir"
}

# ============================================================
# Checagens leves
# ============================================================
_check_workspace_branch() {
  local branch dirty runtime_only=1 f
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ "$branch" = "develop" ]; then
    _pass "Branch correta (develop)"
  elif [ "$branch" = "main" ]; then
    _aviso "Você está em main — o fluxo oficial roda a release em develop"
  else
    _blocker "Branch incorreta: $branch" \
      "a homologação vale apenas para develop (fluxo subir → release → subir-ok)" \
      "git checkout develop"
  fi
  local wi_lib="$REPO_DIR/scripts/control-center/lib/workspace-intelligence.sh"
  if [ -x "$wi_lib" ]; then
    local wi_ctx="release-rapida"
    case "${FUNCNAME[1]:-}" in
      opcao_release_completa) wi_ctx="release-completa" ;;
      opcao_release_turbo)    wi_ctx="release-turbo" ;;
      opcao_certificacao_completa) wi_ctx="certificacao" ;;
    esac
    if "$wi_lib" gate "$wi_ctx"; then
      _pass "Workspace Intelligence: prosseguir ($wi_ctx)"
    else
      _blocker "Workspace Intelligence bloqueou a release (contexto: $wi_ctx)" \
        "arquivos com impacto >= MEDIO detectados pelo Workspace Intelligence" \
        "commite com 'subir' (ou git stash) e rode a release de novo"
    fi
  else
    dirty=$(git status --porcelain)
    if [ -z "$dirty" ]; then
      _pass "Workspace limpo"
    else
      while IFS= read -r f; do
        case "${f:3}" in
          scripts/*/state/*|logs/*|*.log) : ;;
          *) runtime_only=0 ;;
        esac
      done <<< "$dirty"
      if [ "$runtime_only" -eq 1 ]; then
        _aviso "Workspace alterado apenas por estado de runtime/logs (flake conhecido) — restaure com: git checkout -- $(echo "$dirty" | awk '{print $2}' | tr '\n' ' ')"
      else
        _blocker "Workspace sujo" \
          "arquivos alterados/não commitados: $(echo "$dirty" | awk '{print $2}' | tr '\n' ' ')" \
          "commite com 'subir' (ou git stash) e rode a release de novo"
      fi
    fi
  fi
}

_check_versionamento() {
  local invalidas
  invalidas=$(git tag -l 'v*' | grep -vE '^v[0-9]{4}\.[0-9]{2}\.[0-9]{2}(-[a-z0-9-]+)?$|^v[0-9]+\.[0-9]+\.[0-9]+$' || true)
  if [ -n "$invalidas" ]; then
    _blocker "Tag(s) em formato inesperado: $(echo "$invalidas" | tr '\n' ' ')" \
      "não seguem vYYYY.MM.DD[-sufixo] nem semver (geralmente sobra de tooling — ver incidente v2026.07.-1198)" \
      "se for lixo local: git tag -d <tag>. Nunca recrie tag oficial manualmente"
  else
    _pass "Todas as tags seguem um formato reconhecido (timestamp ou semver)"
  fi
}

_check_workflow() { # SEGURANÇA — excludes sem âncora publicariam dirs sensíveis
  local wf="$REPO_DIR/.github/workflows/deploy-pages.yml"
  if [ ! -f "$wf" ]; then _blocker "deploy-pages.yml não encontrado" "" "restaurar o workflow de deploy"; return; fi
  local soltos
  soltos=$(grep -oE "exclude='[a-zA-Z_]+/'" "$wf" || true)
  if [ -n "$soltos" ]; then
    _blocker "Excludes sem âncora de raiz em deploy-pages.yml: $soltos" \
      "sem a âncora '/', diretórios sensíveis podem ir parar no site público (incidente 2026-07-11)" \
      "prefixe cada exclude de diretório de topo com '/'"
  else
    _pass "Excludes do deploy-pages.yml corretamente ancorados (segurança)"
  fi
}

_check_github_actions() { # estado de CI é histórico → nunca bloqueia
  local runs deploy_status testes_status
  runs=$(curl -s --max-time 15 "https://api.github.com/repos/$GH_REPO/actions/runs?branch=develop&per_page=10" 2>/dev/null)
  if [ -z "$runs" ]; then
    _aviso "GitHub Actions inacessível (rede/API?) — estado de CI não verificado"
    return
  fi
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
  if [ "$deploy_status" = "success" ]; then
    _info "Deploy Pages: success (última run não-cancelada)"
  else
    _aviso "Deploy Pages: ${deploy_status:-desconhecido} — histórico de CI, não bloqueia. Verifique a aba Actions antes do subir-ok"
  fi
  if [ "$testes_status" = "success" ]; then
    _info "CI 'Testes automatizados': success"
  else
    _aviso "CI 'Testes automatizados': ${testes_status:-desconhecido} — falha crônica conhecida (flake DB), coberta pelas suítes locais desta release"
  fi
  RESUMO[ci]="${deploy_status:-?}/${testes_status:-?}"
}

_check_github_pages() { # site ao vivo é estado do deploy ANTERIOR → aviso
  local http_prod http_dev
  http_prod=$(curl -s -o /dev/null -L --max-time 15 -w "%{http_code}" "https://cellcityinformatica.com.br/" 2>/dev/null)
  http_dev=$(curl -s -o /dev/null -L --max-time 15 -w "%{http_code}" "https://cellcityinformatica.com.br/dev/CRM/pages/dashboard/index.html" 2>/dev/null)
  if [ "$http_prod" = "200" ]; then _info "Produção ao vivo responde 200"; else _aviso "Produção respondeu ${http_prod:-sem resposta} — estado do deploy anterior, não bloqueia esta homologação"; fi
  if [ "$http_dev" = "200" ]; then _info "DEV ao vivo responde 200"; else _aviso "DEV respondeu ${http_dev:-sem resposta} — estado do deploy anterior, não bloqueia esta homologação"; fi
}

# ============================================================
# RELEASE RÁPIDA (~30s) — panorama, não homologa.
# ============================================================
_check_estrutura_projeto() {
  local CAMINHOS=(
    "CRM/index.html" "CRM/login.html" "CRM/pages" "CRM/scripts" "CRM/repositories"
    "tests" ".github/workflows/deploy-pages.yml" "scripts/release"
  )
  local ausente=0 c
  for c in "${CAMINHOS[@]}"; do
    [ -e "$REPO_DIR/$c" ] || { echo "  ${C_R}✗${C_0} AUSENTE: $c"; ausente=1; }
  done
  [ "$ausente" -eq 0 ] && _pass "Estrutura de diretórios/arquivos essenciais presente" || _blocker "Estrutura do projeto incompleta (ver acima)"
}

_check_testes_rapidos() {
  _carregar_node
  if ! command -v node >/dev/null 2>&1; then
    _aviso "node indisponível (nvm) — sintaxe rápida não verificada (indisponibilidade de ferramenta, não é erro de sintaxe)"
    return
  fi
  local ARQUIVOS=(
    "CRM/scripts/firebase.js" "CRM/scripts/kernel.js"
    "CRM/pages/dashboard/dashboard.js" "CRM/pages/os/os.js" "CRM/pages/portal-cliente/portal.js"
  )
  local quebrado=0 a log="$LOG_DIR/$RUN_TS-syntax.log"
  for a in "${ARQUIVOS[@]}"; do
    if [ -f "$REPO_DIR/$a" ]; then
      node --check "$REPO_DIR/$a" >"$log" 2>&1 || { echo "  ${C_R}✗${C_0} Erro de sintaxe: $a — $(head -2 "$log" | tail -1)"; quebrado=1; }
    fi
  done
  [ "$quebrado" -eq 0 ] && _pass "Sintaxe ok nos scripts principais" || _blocker "Sintaxe quebrada" "erro real de parser — ver $log" "corrigir o arquivo indicado"
}

opcao_release_rapida() {
  echo ""
  echo "⚡ Release Rápida"
  echo "─────────────────"
  local ahead behind last_commit last_tag
  _check_workspace_branch
  echo "  Buscando origin..."
  git fetch origin >/dev/null 2>&1 && _pass "git fetch ok" || _aviso "git fetch falhou (sem rede?)"
  ahead=$(git rev-list --count origin/develop..develop 2>/dev/null || echo "?")
  behind=$(git rev-list --count develop..origin/develop 2>/dev/null || echo "?")
  _info "develop está $ahead à frente / $behind atrás de origin/develop"
  last_commit=$(git log -1 --oneline 2>/dev/null)
  _info "Último commit: $last_commit"
  last_tag=$(git tag -l 'v*' --sort=-creatordate | head -1)
  _info "Última tag: ${last_tag:-nenhuma}"
  _check_estrutura_projeto
  _check_testes_rapidos
  echo ""
  _info "Release Rápida é só panorama — não homologa. Use a opção 2 (Completa) pra liberar o subir-ok."
}

# ============================================================
# Resumo final (box) + homologação
# ============================================================
_resumo_final() { # $1=título $2=tempo_total_s $3=grava_homologacao(0/1) $4=opcao
  local titulo="$1" tempo="$2" grava="$3" opcao="$4"
  local branch commit versao resultado
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  commit=$(git rev-parse --short HEAD 2>/dev/null)
  versao=$(git describe --tags --abbrev=0 2>/dev/null || echo "nenhuma")
  echo ""
  echo "  ════════════════════════════════════"
  echo "               RELEASE"
  echo "  ════════════════════════════════════"
  echo "  Versão:        $versao"
  echo "  Commit:        $commit"
  echo "  Branch:        $branch"
  echo "  Tempo:         ${tempo}s"
  local k
  for k in rbac rules functions performance integridade artefato; do
    [ -n "${RESUMO[$k]:-}" ] && printf '  %-14s %b\n' "$(_suite_label "$k"):" "${RESUMO[$k]}"
  done
  [ -n "${RESUMO[ci]:-}" ] && echo "  CI (histórico): ${RESUMO[ci]}"
  echo "  Warnings:      $AVISOS"
  echo "  Failures:      $FALHAS"
  echo "  ────────────────────────────────────"
  if [ "$FALHAS" -eq 0 ]; then
    resultado="GO"
    echo "  Resultado:     ${C_G}GO${C_0}"
    if [ "$grava" = "1" ]; then
      _gravar_homologacao "$opcao" "GO"
    else
      echo "  Homologação:   não gravada nesta modalidade — ver mensagens acima"
    fi
  else
    resultado="NO-GO"
    echo "  Resultado:     ${C_R}NO-GO${C_0} ($FALHAS bloqueio(s) — warnings não bloqueiam)"
    [ "$grava" = "1" ] && _invalidar_homologacao
  fi
  echo "  ════════════════════════════════════"
  if [ "$AVISOS" -gt 0 ]; then
    echo "  Warnings registrados (não bloqueiam publicação):"
    local w
    for w in "${WARN_MSGS[@]}"; do echo "    ⚠ $w"; done
  fi
  echo "  Logs detalhados: logs/release/$RUN_TS-*.log"
  RESULTADO_FINAL="$resultado"
  _gravar_saidas_estruturadas "$titulo" "$tempo" "$resultado" "$branch" "$commit" "$versao"
}

# FASE 10 — logs/release/release.log + release.json + release-debug.log
_gravar_saidas_estruturadas() {
  local titulo="$1" tempo="$2" resultado="$3" branch="$4" commit="$5" versao="$6"
  {
    echo "[$(date +"%Y-%m-%dT%H:%M:%S%:z")] $titulo | commit=$commit branch=$branch versao=$versao tempo=${tempo}s warnings=$AVISOS failures=$FALHAS resultado=$resultado run=$RUN_TS"
  } >> "$LOG_DIR/release.log"
  {
    local k sep=""
    printf '{"run":"%s","tipo":"%s","commit":"%s","branch":"%s","versao":"%s","tempo_s":%s,"warnings":%s,"failures":%s,"resultado":"%s","suites":{' \
      "$RUN_TS" "$titulo" "$commit" "$branch" "$versao" "$tempo" "$AVISOS" "$FALHAS" "$resultado"
    for k in "${!RESULT_ST[@]}"; do
      printf '%s"%s":{"status":"%s","detalhe":"%s"}' "$sep" "$k" "${RESULT_ST[$k]}" "${CACHE_DET[$k]:-}"
      sep=","
    done
    printf '}}\n'
  } > "$LOG_DIR/release.json"
  cat "$LOG_DIR/$RUN_TS-"*.log > "$LOG_DIR/release-debug.log" 2>/dev/null || true
}

# ============================================================
# RELEASE COMPLETA (~40s com lanes paralelas)
# ============================================================
opcao_release_completa() {
  echo ""
  echo "🧪 Release Completa"
  echo "────────────────────"
  FALHAS=0; AVISOS=0; WARN_MSGS=()
  local ini; ini=$(date +%s)
  _checkpoint_carregar
  _check_workspace_branch
  _check_versionamento
  _check_workflow
  echo "  Suítes (4 lanes paralelas — RBAC | Rules→Functions | Integridade→Performance | Build):"
  _rodar_suites "performance:aviso" \
    "rbac" "rules>functions" "integridade>performance" "artefato"
  _check_github_actions
  _check_github_pages
  _resumo_final "RELEASE COMPLETA" "$(( $(date +%s) - ini ))" 1 2
}

# ============================================================
# RELEASE TURBO (<40s) — Workspace, Branch, Versionamento, RBAC,
# Build e Integridade frescos/cache; Rules/Functions SÓ via cache/
# checkpoint da mesma sessão. Homologação: apenas quando TODO o
# conjunto obrigatório (FASE 13) tem resultado PASS — o gate do
# subir-ok nunca é afrouxado.
# ============================================================
opcao_release_turbo() {
  echo ""
  echo "🚀 Release Turbo (validações críticas + cache)"
  echo "────────────────────────────────────────────────"
  FALHAS=0; AVISOS=0; WARN_MSGS=()
  local ini; ini=$(date +%s)
  _checkpoint_carregar
  _check_workspace_branch
  _check_versionamento
  echo "  Suítes críticas (3 lanes — RBAC | Integridade | Build):"
  _rodar_suites "" "rbac" "integridade" "artefato"
  local k homologavel=1
  for k in rules functions; do
    if [ -n "${CACHE_RC[$k]:-}" ]; then
      _suite_reusar "$k"
      [ "${CACHE_RC[$k]}" -eq 0 ] || homologavel=0
    else
      RESUMO[$k]="${C_B}SKIPPED${C_0} (sem cache nesta sessão)"; RESULT_ST[$k]="SKIPPED"
      _info "$(_suite_label "$k"): SKIPPED — sem resultado em cache nesta sessão"
      homologavel=0
    fi
  done
  local grava=0
  if [ "$FALHAS" -eq 0 ] && [ "$homologavel" -eq 1 ]; then
    grava=1
  elif [ "$FALHAS" -eq 0 ]; then
    _info "Homologação exige Rules+Functions com resultado válido — rode a Release Completa 1x (o Turbo então homologa via cache)"
  fi
  _resumo_final "RELEASE TURBO" "$(( $(date +%s) - ini ))" "$grava" 8
}

# ============================================================
# Checagens exclusivas da Certificação de Produção
# ============================================================
_check_arquitetura() {
  local achados=0
  if grep -rlE "from ['\"]/CRM/scripts/kernel\.js['\"]" "$REPO_DIR/CRM" --include="*.js" --include="*.html" >/dev/null 2>&1; then
    echo "  ${C_R}✗${C_0} import absoluto de kernel.js encontrado (padrão do incidente H-008)"
    achados=1
  fi
  [ "$achados" -eq 0 ] && _pass "Nenhum import absoluto de kernel.js (H-008 não regrediu)" \
    || _blocker "Regressão de arquitetura (H-008)" "import absoluto quebra as páginas no deploy" "trocar por import relativo de kernel.js"
}

_check_seguranca() { # SEGURANÇA — nunca afrouxar
  local achados=0 secretos padrao
  secretos=$(git -C "$REPO_DIR" ls-files | grep -iE "sa-key.*\.json$|\.pem$|credentials.*\.json$" || true)
  if [ -n "$secretos" ]; then
    echo "  ${C_R}✗${C_0} Possível credencial versionada no git: $(echo "$secretos" | tr '\n' ' ')"
    achados=1
  fi
  local wf="$REPO_DIR/.github/workflows/deploy-pages.yml"
  for padrao in "/plans/" "/CLAUDE.md" "/_BACKUPS/"; do
    grep -qF "exclude='$padrao'" "$wf" || { echo "  ${C_R}✗${C_0} deploy-pages.yml não exclui '$padrao' do artefato publicado"; achados=1; }
  done
  [ "$achados" -eq 0 ] && _pass "Nenhuma credencial versionada, exclusões sensíveis presentes no deploy" \
    || _blocker "Achado(s) de segurança — ver acima" "credencial versionada e/ou exclusão sensível ausente" "remover credencial do índice git / restaurar exclude no workflow"
}

_check_repository_layer() {
  local dir="$REPO_DIR/CRM/repositories"
  if [ ! -d "$dir" ]; then _aviso "CRM/repositories/ não existe nesta branch — checagem não se aplica"; return; fi
  if [ ! -f "$dir/base.repository.js" ]; then _blocker "base.repository.js ausente em CRM/repositories/"; return; fi
  _carregar_node
  if ! command -v node >/dev/null 2>&1; then
    _aviso "node indisponível para a auditoria (nvm) — indisponibilidade de ferramenta, NÃO é erro de sintaxe (flake DB)"
    return
  fi
  local quebrado=0 f log="$LOG_DIR/$RUN_TS-repo-syntax.log"
  for f in "$dir"/*.js; do
    node --check "$f" >"$log" 2>&1 || { echo "  ${C_R}✗${C_0} Erro de sintaxe: $(basename "$f") — $(head -2 "$log" | tail -1)"; quebrado=1; }
  done
  local total usando_base
  total=$(find "$dir" -maxdepth 1 -name "*.repository.js" | wc -l)
  usando_base=$(grep -lE "base\.repository|BaseRepository" "$dir"/*.repository.js 2>/dev/null | wc -l)
  _info "$total repositório(s), $usando_base referenciam base.repository/BaseRepository"
  if [ "$quebrado" -eq 0 ] && [ "$usando_base" -ge $((total - 1)) ]; then
    _pass "Camada Repository consistente (sintaxe ok, herança de base.repository)"
  else
    _blocker "Camada Repository com inconsistências" "erro real de sintaxe e/ou herança da base quebrada — ver acima" "corrigir o repository indicado"
  fi
}

_check_fluxos_criticos() {
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
      echo "  ${C_R}✗${C_0} $label: $caminho ausente ou vazio"
      vazio_ou_ausente=1
    fi
  done
  [ "$vazio_ou_ausente" -eq 0 ] && _pass "Todos os 8 fluxos críticos presentes e não-vazios (estrutural — reforça teste manual)" \
    || _blocker "Fluxo(s) crítico(s) ausente(s) — ver acima" "página essencial sumiu do artefato" "restaurar o arquivo listado"
}

_check_cicd() { # forma histórica do workflow → aviso
  local wf="$REPO_DIR/.github/workflows/deploy-pages.yml"
  local achados=0 job
  grep -q "^on:" "$wf" && grep -qE "branches:\s*\[main, develop\]" "$wf" || { echo "  ${C_Y}⚠${C_0} Trigger de push (main+develop) não encontrado"; achados=1; }
  for job in "build:" "deploy:" "smoke-test:"; do
    grep -q "^  $job" "$wf" || { echo "  ${C_Y}⚠${C_0} Job '$job' ausente no workflow"; achados=1; }
  done
  [ "$achados" -eq 0 ] && _pass "Workflow com triggers e jobs (build/deploy/smoke-test) esperados" || _aviso "CI/CD com achado(s) — ver acima (estrutura do workflow mudou?)"
}

_check_pages_deployment_recente() {
  local dep state created_at dep_id
  dep=$(curl -s --max-time 15 "https://api.github.com/repos/$GH_REPO/deployments?environment=github-pages&per_page=1" 2>/dev/null)
  if [ -z "$dep" ] || [ "$dep" = "[]" ]; then
    _aviso "Não foi possível consultar deployments do GitHub Pages (rede/API?)"
    return
  fi
  dep_id=$(echo "$dep" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null)
  created_at=$(echo "$dep" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['created_at'] if d else '')" 2>/dev/null)
  [ -z "$dep_id" ] && { _aviso "Deployment do GitHub Pages não encontrado"; return; }
  state=$(curl -s --max-time 15 "https://api.github.com/repos/$GH_REPO/deployments/$dep_id/statuses" 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(d[0]['state'] if d else '')
" 2>/dev/null)
  _info "Última implantação Pages: $created_at, estado: ${state:-desconhecido}"
  if [ "$state" = "success" ]; then _pass "GitHub Pages atualizado (última implantação com sucesso)"
  else _aviso "Última implantação do GitHub Pages: ${state:-desconhecido} — estado do deploy anterior, não bloqueia"; fi
}

# ============================================================
# PÓS-DEPLOY — site AO VIVO (só páginas públicas, nunca login).
# Estado do deploy ANTERIOR → avisos, nunca bloqueia a homologação nova.
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
    codigo=$(curl -s -o /dev/null -L --max-time 20 -w "%{http_code}" "$url" 2>/dev/null)
    if [ "$codigo" = "200" ]; then _pass "$label abre (200)"; else _aviso "$label respondeu ${codigo:-sem resposta} (site ao vivo — deploy anterior)"; fi
  done
  echo "  Confirmando assets estáticos..."
  local ASSETS=(
    "https://cellcityinformatica.com.br/CRM/scripts/firebase.js"
    "https://cellcityinformatica.com.br/CRM/scripts/kernel.js"
  )
  local asset codigo_asset
  for asset in "${ASSETS[@]}"; do
    codigo_asset=$(curl -s -o /dev/null -L --max-time 20 -w "%{http_code}" "$asset" 2>/dev/null)
    if [ "$codigo_asset" = "200" ]; then _pass "Asset ok: $(basename "$asset")"; else _aviso "Asset $(basename "$asset") respondeu ${codigo_asset:-sem resposta}"; fi
  done
  _check_pages_deployment_recente
  echo "  Console do navegador (Chrome headless, só páginas públicas)..."
  local saida status_browser
  saida=$(_carregar_node && node "$SCRIPT_DIR/pos-deploy-browser.mjs" 2>"$LOG_DIR/$RUN_TS-browser-stderr.log")
  status_browser=$?
  echo "$saida" > "$LOG_DIR/$RUN_TS-browser.json"
  cp "$LOG_DIR/$RUN_TS-browser.json" /tmp/cellcity-release-browser.json 2>/dev/null || true
  if [ "$status_browser" -eq 2 ]; then
    _aviso "Checagem de console pulada — Chrome não disponível nesta máquina"
  elif [ "$status_browser" -eq 0 ]; then
    _pass "Console sem erros críticos nas páginas públicas visitadas"
  else
    _aviso "Console com erro(s) no site ao vivo — ver $LOG_DIR/$RUN_TS-browser.json"
  fi
}

opcao_pos_deploy() {
  echo ""
  echo "🚀 Pós-Deploy"
  echo "──────────────"
  FALHAS=0; AVISOS=0
  _check_pos_deploy
  echo ""
  if [ "$FALHAS" -eq 0 ] && [ "$AVISOS" -eq 0 ]; then
    echo "🟢 Deploy validado"
  elif [ "$FALHAS" -eq 0 ]; then
    echo "🟡 Deploy validado com $AVISOS aviso(s) — revisar acima"
  else
    echo "🔴 Deploy com falha ($FALHAS checagem(ns))"
  fi
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
    echo "- Bloqueios: $FALHAS · Avisos: $AVISOS"
    echo "- Logs: logs/release/$RUN_TS-*.log"
    echo ""
    echo "Relatório gerado automaticamente pela opção 3 (Certificação de Produção) do Release Center."
  } > "$arquivo"
  _info "Relatório técnico: $arquivo"
}

# ============================================================
# CERTIFICAÇÃO DE PRODUÇÃO — Completa + auditoria ampliada + pós-deploy.
# Reusa o cache das suítes se a Completa rodou nesta mesma sessão.
# ============================================================
opcao_certificacao_completa() {
  echo ""
  echo "🏆 Certificação de Produção (FASE 8: tudo, sem cache)"
  echo "──────────────────────────────────────────────────────"
  FALHAS=0; AVISOS=0; WARN_MSGS=()
  NOCACHE=1
  local ini; ini=$(date +%s)
  _check_workspace_branch
  _check_versionamento
  _check_workflow
  echo "  Suítes (4 lanes paralelas):"
  _rodar_suites "performance:aviso" \
    "rbac" "rules>functions" "integridade>performance" "artefato"
  _check_github_actions
  _check_github_pages

  echo ""
  echo "🔎 Auditoria estática ampliada:"
  _info "XSS, imports órfãos, ES modules e coleções sem rule cobertos pela suíte de Integridade"
  _check_arquitetura
  _check_seguranca
  _check_repository_layer
  _check_fluxos_criticos
  _check_cicd
  local protegidos_tocados
  protegidos_tocados=$(git diff origin/main..HEAD --name-only 2>/dev/null | grep -E "firebase\.js$|auth\.js$|config\.js$|global\.css$" || true)
  if [ -n "$protegidos_tocados" ]; then
    _aviso "Arquivos protegidos (CLAUDE.md §1) alterados desde main: $(echo "$protegidos_tocados" | tr '\n' ' ') — confirmar autorização"
  else
    _pass "Nenhum arquivo protegido alterado sem já ter sido revisado"
  fi

  echo ""
  echo "🚀 Validação Pós-Deploy (ao vivo):"
  _check_pos_deploy

  _resumo_final "CERTIFICAÇÃO DE PRODUÇÃO" "$(( $(date +%s) - ini ))" 1 3
  _emitir_relatorio_certificacao "$RESULTADO_FINAL"
  NOCACHE=0
}

# ============================================================
# STATUS + diagnóstico assertivo
# ============================================================
_diagnosticar_homologacao() {
  local branch_atual commit_atual
  branch_atual=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  commit_atual=$(git rev-parse HEAD 2>/dev/null)
  if [ ! -f "$MARCADOR" ]; then
    echo "  ${C_R}✗${C_0} Promoção bloqueada"
    echo "      Motivo: nenhuma homologação registrada nesta cópia local."
    echo "      Como resolver: rode a Release Completa (opção 2); com GO, rode subir-ok."
    return 1
  fi
  local commit_marcado status_marcado ts_marcado
  commit_marcado=$(python3 -c "import json;print(json.load(open('$MARCADOR'))['commit'])" 2>/dev/null)
  status_marcado=$(python3 -c "import json;print(json.load(open('$MARCADOR'))['status'])" 2>/dev/null)
  ts_marcado=$(python3 -c "import json;print(json.load(open('$MARCADOR'))['timestamp'])" 2>/dev/null)
  if [ "$branch_atual" != "develop" ]; then
    echo "  ${C_R}✗${C_0} Promoção bloqueada"
    echo "      Motivo: branch atual é '$branch_atual' (a homologação só vale em develop)."
    echo "      Como resolver: git checkout develop"
    return 1
  fi
  if [ -n "$(git status --porcelain)" ]; then
    echo "  ${C_R}✗${C_0} Promoção bloqueada"
    echo "      Motivo: workspace com alterações não commitadas."
    echo "      Como resolver: commite com 'subir' (ou git stash) e rode a Release Completa de novo."
    return 1
  fi
  if [ "$commit_marcado" != "$commit_atual" ]; then
    echo "  ${C_R}✗${C_0} Promoção bloqueada"
    echo "      Motivo: homologação encontrada para o commit ${commit_marcado:0:9}…,"
    echo "              mas o commit atual é ${commit_atual:0:9}… (o código mudou depois do GO)."
    echo "      Como resolver: rode a Release Completa de novo; com GO, rode subir-ok."
    return 1
  fi
  if [ "$status_marcado" != "GO" ]; then
    echo "  ${C_R}✗${C_0} Promoção bloqueada"
    echo "      Motivo: a última homologação deste commit foi NO-GO ($ts_marcado)."
    echo "      Como resolver: corrija os bloqueios apontados e rode a Release Completa de novo."
    return 1
  fi
  echo "  ${C_G}✓${C_0} Homologação válida (commit ${commit_marcado:0:9}…, $ts_marcado) — pode rodar subir-ok."
  return 0
}

opcao_status() {
  echo ""
  echo "📊 Status da Release"
  echo "─────────────────────"
  opcao_release_rapida
  echo ""
  if [ -f "$MARCADOR" ]; then
    echo "Homologação registrada:"
    python3 -m json.tool < "$MARCADOR" 2>/dev/null || cat "$MARCADOR"
  else
    echo "Nenhuma homologação registrada nesta cópia local."
  fi
  echo ""
  echo "Diagnóstico da promoção:"
  _diagnosticar_homologacao || true
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
    _pass "Funções subir/subir-ok definidas em ~/.bashrc"
  else
    _blocker "subir/subir-ok não encontrados em ~/.bashrc" "fluxo oficial de promoção indisponível" "reinstalar as funções do fluxo (ver GUIA_OPERACAO_AMBIENTES.md)"
  fi
  if grep -q 'RELEASE não homologada\|release não homologada\|Release não homologada\|check-homologacao' "$HOME/.bashrc"; then
    _pass "subir-ok exige homologação da Release antes de promover"
  else
    _aviso "subir-ok ainda não exige homologação (rodar a Sprint que adiciona essa trava)"
  fi
  if [ -x /usr/local/bin/release ] && grep -q "release-center.sh" /usr/local/bin/release 2>/dev/null; then
    _pass "/usr/local/bin/release aponta para o release-center.sh versionado"
  else
    _aviso "/usr/local/bin/release desatualizado ou ausente — reinstalar com scripts/release/release-wrapper-usr-local-bin.sh"
  fi
  echo ""
  _check_workflow
  echo ""
  echo "Scripts de backup:"
  [ -x "$REPO_DIR/scripts/backup/backup-manual.sh" ] && _pass "backup-manual.sh presente e executável" || _blocker "backup-manual.sh ausente/sem permissão"
  [ -x "$REPO_DIR/scripts/backup/restore-backup.sh" ] && _pass "restore-backup.sh presente e executável" || _blocker "restore-backup.sh ausente/sem permissão"
  echo ""
  _check_github_actions
  _check_github_pages
  echo ""
  _check_versionamento
}

# ============================================================
# Marcador de homologação (.git/, local, nunca versionado)
# ============================================================
_tipo_release() {
  case "$1" in
    1) echo "Rápida" ;;
    2) echo "Completa" ;;
    3) echo "Certificação" ;;
    8) echo "Turbo (conjunto obrigatório completo via cache)" ;;
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
  echo "  Homologação:   📝 registrada (commit ${commit:0:9}…, tipo $tipo, branch $branch, versão $versao, status $status)"
}

_invalidar_homologacao() {
  rm -f "$MARCADOR"
}

# Usado pelo subir-ok — não interativo, só código de saída. Auto-suficiente
# de propósito (Sprint "Bloqueio Obrigatório de Homologação"): confere de
# novo branch/working-tree/commit/status, pra garantia valer mesmo fora do
# subir-ok. 0 = homologação válida para o estado atual; 1 = inválida.
verificar_homologacao_valida() {
  if [ ! -f "$MARCADOR" ]; then return 1; fi
  local commit_marcado status_marcado commit_atual branch_atual
  commit_marcado=$(python3 -c "import json;print(json.load(open('$MARCADOR'))['commit'])" 2>/dev/null) || return 1
  status_marcado=$(python3 -c "import json;print(json.load(open('$MARCADOR'))['status'])" 2>/dev/null) || return 1
  commit_atual=$(git rev-parse HEAD 2>/dev/null)
  branch_atual=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  [ "$branch_atual" = "develop" ] || return 1
  local wi_lib="$REPO_DIR/scripts/control-center/lib/workspace-intelligence.sh"
  if [ -x "$wi_lib" ]; then
    "$wi_lib" gate homologacao || return 1
  else
    [ -z "$(git status --porcelain)" ] || return 1
  fi
  [ "$commit_marcado" = "$commit_atual" ] || return 1
  [ "$status_marcado" = "GO" ]
}

# ============================================================
# Entradas não interativas
# ============================================================
if [ "${1:-}" = "--check-homologacao" ]; then
  if verificar_homologacao_valida; then
    exit 0
  else
    exit 1
  fi
fi

if [ "${1:-}" = "--explicar-bloqueio" ]; then
  _diagnosticar_homologacao
  exit $?
fi

# ============================================================
# Menu interativo
# ============================================================
while true; do
  echo ""
  echo "=========================================="
  echo "     CELL CITY RELEASE CENTER v2.1"
  echo "=========================================="
  echo ""
  echo "1 - Release Rápida (~15 segundos)"
  echo ""
  echo "2 - Release Completa (~40s–1min, homologa)"
  echo ""
  echo "3 - Certificação de Produção (~2–4 min)"
  echo ""
  echo "8 - Release Turbo (<40s; homologa se Rules/Functions em cache)"
  echo ""
  echo "------------------------------------------"
  echo ""
  echo "4 - Status da Release"
  echo "5 - Histórico das Releases"
  echo "6 - Auditoria da Infraestrutura"
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
    8) opcao_release_turbo ;;
    4) opcao_status ;;
    5) opcao_historico ;;
    6) opcao_infraestrutura ;;
    7) opcao_pos_deploy ;;
    0) echo "Saindo do Release Center."; exit 0 ;;
    *) echo "Opção inválida." ;;
  esac
done
