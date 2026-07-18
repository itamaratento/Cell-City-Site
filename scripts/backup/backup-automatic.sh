#!/bin/bash
# Backup automático semanal — Cell City.
# Executado pelo GitHub Actions (.github/workflows/backup-weekly.yml), aos domingos.
# Idempotente: se o backup da semana ISO atual já foi concluído com sucesso, encerra sem ação.
# Em falha, não avança o contador de sequência — a próxima verificação tenta novamente o mesmo slot.
#
# Variáveis de ambiente:
#   SOURCE_REPO_URL  URL (https, leitura pública) do repositório principal. Default: Cell-City-Site.
#   BACKUP_REPO_SSH  URL SSH do repositório de backup (push via deploy key). Default: Cell-City-Backup.
#   WEEK_OVERRIDE    Uso exclusivo de testes: força a "semana" usada na checagem de
#                    idempotência/rotação, no lugar de "date -u +%G-W%V". Nunca definida
#                    pelo workflow real de produção.
set -uo pipefail

SOURCE_REPO_URL="${SOURCE_REPO_URL:-https://github.com/itamaratento/Cell-City-Site.git}"
BACKUP_REPO_SSH="${BACKUP_REPO_SSH:-git@github.com:itamaratento/Cell-City-Backup.git}"
SLOTS=(auto-slot-A auto-slot-B auto-slot-C)

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "== Backup automático semanal — Cell City =="
week_key="${WEEK_OVERRIDE:-$(date -u +%G-W%V)}"
echo "Semana ISO atual (UTC): $week_key"

echo "-- Buscando manifesto (branch backup-meta) --"
if ! git clone --quiet --branch backup-meta --single-branch "$BACKUP_REPO_SSH" "$WORKDIR/meta"; then
  echo "❌ Não foi possível acessar o repositório de backup (branch backup-meta)."
  exit 1
fi
MANIFEST="$WORKDIR/meta/manifest/automatic.json"

last_week=$(python3 -c "import json;d=json.load(open('$MANIFEST'));h=d['history'];print(h[-1]['week'] if h else '')")
last_result=$(python3 -c "import json;d=json.load(open('$MANIFEST'));h=d['history'];print(h[-1]['result'] if h else '')")

if [ "$last_week" = "$week_key" ] && [ "$last_result" = "sucesso" ]; then
  echo "✅ Backup da semana $week_key já foi concluído com sucesso anteriormente. Encerrando sem novas ações."
  exit 0
fi
echo "-- Backup ainda não concluído para $week_key (ou última tentativa falhou). Prosseguindo. --"

echo "-- Clonando espelho completo do repositório principal (todas as branches e tags) --"
if ! git clone --quiet --mirror "$SOURCE_REPO_URL" "$WORKDIR/source-mirror.git"; then
  echo "❌ Falha ao clonar o repositório principal."
  exit 1
fi
cd "$WORKDIR/source-mirror.git" || exit 1

main_commit=$(git rev-parse refs/heads/main)
develop_commit=$(git rev-parse refs/heads/develop)
author=$(git log -1 --pretty=format:'%an <%ae>' refs/heads/develop)
echo "main:    $main_commit"
echo "develop: $develop_commit"

status="sucesso"
fail_reason=""

if ! git push --quiet "$BACKUP_REPO_SSH" refs/heads/main:refs/heads/main refs/heads/develop:refs/heads/develop; then
  status="falha"; fail_reason="push de branches (main/develop) falhou"
fi

if [ "$status" = "sucesso" ] && ! git push --quiet "$BACKUP_REPO_SSH" --tags; then
  status="falha"; fail_reason="push de tags falhou"
fi

last_seq=$(python3 -c "import json;d=json.load(open('$MANIFEST'));print(d['last_seq'] or 0)")
next_seq=$((last_seq + 1))
slot_index=$(( (next_seq - 1) % 3 ))
slot="${SLOTS[$slot_index]}"

if [ "$status" = "sucesso" ]; then
  # D05 (Fase 3.9, 2026-07-18): slots eram TAGS anotadas, mas a criação de
  # tags pela deploy key passou a ser recusada no repo de backup a partir de
  # 2026-07-12 (todas as 8 execuções da semana W28 falharam em
  # "push da tag de slot", enquanto os pushes de branches da MESMA execução
  # tiveram sucesso — proteção de tags adicionada entre 07-05 e 07-12).
  # Slots agora são BRANCHES (refs/heads/<slot>); os metadados que viviam na
  # anotação da tag já estão integralmente no manifest/automatic.json.
  # O slot anterior nunca é removido antes do novo push ter sucesso:
  # em falha, a branch remota permanece na versão anterior.
  if ! git push --quiet --force "$BACKUP_REPO_SSH" "$develop_commit:refs/heads/$slot"; then
    status="falha"; fail_reason="push da branch de slot ($slot) falhou"
  fi
fi

echo "-- Atualizando manifesto (backup-meta) --"
cd "$WORKDIR/meta" || exit 1
python3 - "$MANIFEST" "$week_key" "$next_seq" "$slot" "$status" "$develop_commit" "$main_commit" "$author" "$fail_reason" <<'PYEOF'
import json, sys, datetime
manifest_path, week, seq, slot, status, dev_commit, main_commit, author, fail_reason = sys.argv[1:10]
d = json.load(open(manifest_path))
now_utc = datetime.datetime.now(datetime.timezone.utc)
entry = {
    "seq": int(seq),
    "week": week,
    "slot": slot,
    "date": now_utc.strftime("%Y-%m-%d"),
    "time_utc": now_utc.strftime("%H:%M:%S"),
    "branch": "develop",
    "commit_develop": dev_commit,
    "commit_main": main_commit,
    "author": author,
    "result": "sucesso" if status == "sucesso" else "falha",
    "fail_reason": fail_reason,
}
if status == "sucesso":
    d["last_seq"] = int(seq)
d["history"].append(entry)
d["history"] = d["history"][-30:]
json.dump(d, open(manifest_path, "w"), indent=2, ensure_ascii=False)
PYEOF

git add manifest/automatic.json
git -c user.email="backup-bot@cellcity.local" -c user.name="Cell City Backup Bot" commit --quiet -m "backup-meta: registro semana $week_key ($status, slot=$slot, seq=$next_seq)"
git push --quiet "$BACKUP_REPO_SSH" backup-meta

echo ""
echo "======================================="
echo "Resultado: $status"
echo "Semana: $week_key   Slot: $slot   Seq: $next_seq"
echo "develop @ $develop_commit"
echo "main    @ $main_commit"
[ -n "$fail_reason" ] && echo "Motivo da falha: $fail_reason"
echo "======================================="

if [ "$status" != "sucesso" ]; then
  exit 1
fi
exit 0
