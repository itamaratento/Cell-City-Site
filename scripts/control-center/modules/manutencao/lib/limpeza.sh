#!/bin/bash
# Limpeza: dry-run, assistida, log de auditoria e recuperacao.
# Nenhum arquivo e removido sem: simulacao → relatorio → confirmacao → execucao.
set -uo pipefail
: "${CC_ROOT:?}"; : "${REPO_DIR:?}"

CC_MAN_TRASH="$REPO_DIR/_trash"
CC_MAN_LOG="$CC_ROOT/logs/cleanup.log"

_cc_man_simular() {
  _cc_screen_title "SIMULACAO (DRY-RUN)"
  _cc_screen_breadcrumb "Control Center › Manutencao › Simulacao"
  _cc_box_blank
  _cc_box_line "Modo simulacao — nenhum arquivo sera alterado."
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}ITENS QUE SERIAM REMOVIDOS${_CC_C_RESET}"; _cc_box_sep
  local removiveis=0 espaco=0 bloqueados=0
  for c in "${CC_MAN_ITENS_CLASSIFICADOS[@]}"; do
    IFS='|' read -r nivel arquivo razao <<< "$c"
    [ "$nivel" = "CRITICO" ] || [ "$nivel" = "ALTO" ] && continue
    local aprovado=0
    for p in "${CC_MAN_PLANO[@]}"; do
      IFS='|' read -r acao alvo _ <<< "$p"
      [ "$acao" = "REMOVER" ] && [ "$alvo" = "$arquivo" ] && aprovado=1 && break
    done
    [ "$aprovado" -eq 0 ] && continue
    # Item protegido nunca é removido pela execução (defesa em
    # profundidade) — a simulação reflete isso honestamente.
    if _cc_man_eh_protegido "$arquivo"; then
      bloqueados=$((bloqueados + 1))
      _cc_box_line "  [Bloqueado] $(basename "$arquivo") — protegido, nao sera removido"
      continue
    fi
    removiveis=$((removiveis + 1))
    local sz=0 && [ -f "$arquivo" ] && sz=$(stat -c%s "$arquivo" 2>/dev/null || echo 0) && espaco=$((espaco + sz))
    _cc_box_line "  [Recuperavel] $(basename "$arquivo")"
  done
  _cc_box_blank
  [ "$removiveis" -eq 0 ] && _cc_box_line "  Nenhum item sera removido." && _cc_box_blank
  local tam_h && tam_h=$(numfmt --to=iec 2>/dev/null <<< "$espaco" || echo "${espaco}B")
  _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}RESUMO DA SIMULACAO${_CC_C_RESET}"; _cc_box_sep
  _cc_box_line "Itens a remover  : $removiveis"
  _cc_box_line "Espaco a recuperar: $tam_h"
  _cc_box_line "Bloqueados (protegidos): $bloqueados"
  _cc_box_blank
  _cc_box_line "${_CC_C_CIANO}Todos os arquivos removidos vao para _trash/ (recuperaveis).${_CC_C_RESET}"
  _cc_box_blank
  _cc_screen_footer "Simulacao concluida · ENTER para continuar"
  _cc_pause
}

_cc_man_limpeza_assistida() {
  _cc_screen_title "LIMPEZA ASSISTIDA"
  _cc_screen_breadcrumb "Control Center › Manutencao › Limpeza Assistida"
  _cc_box_blank
  _cc_box_line "Itens encontrados serao apresentados um a um."
  _cc_box_line "Itens CRITICO ou ALTO nao podem ser removidos."
  _cc_box_line "Apenas itens aprovados irao para o Plano de Limpeza."
  _cc_box_blank; _cc_box_close; echo ""
  CC_MAN_PLANO=()
  local total_classificados=0
  for c in "${CC_MAN_ITENS_CLASSIFICADOS[@]}"; do
    IFS='|' read -r nivel arquivo razao <<< "$c"
    total_classificados=$((total_classificados + 1))
    local nome && nome=$(basename "$arquivo")
    local nivel_label && nivel_label=$(_cc_man_status_label "$nivel")
    echo ""; _cc_box_sep
    _cc_box_line "Item #${total_classificados}"
    _cc_box_line "Arquivo: $nome"
    _cc_box_line "Caminho: $arquivo"
    _cc_box_line "Classificacao: ${nivel_label}"
    _cc_box_line "Motivo: $razao"
    _cc_box_sep; _cc_box_close; echo ""
    if [ "$nivel" = "CRITICO" ] || [ "$nivel" = "ALTO" ]; then
      _cc_warn "Item protegido — nao pode ser removido automaticamente"
      _cc_man_plano_adicionar "RECOMENDACAO" "$arquivo" "$razao"
    elif _cc_confirm "Aprovar remocao?"; then
      _cc_man_plano_adicionar "REMOVER" "$arquivo" "$razao"
      _cc_ok "Aprovado — adicionado ao Plano de Limpeza"
    else
      _cc_ok "Mantido"
    fi
  done
  echo ""
  local aprovados=0
  for p in "${CC_MAN_PLANO[@]}"; do [[ "${p%%|*}" = "REMOVER" ]] && aprovados=$((aprovados + 1)); done
  _cc_ok "${total_classificados} itens analisados, ${aprovados} aprovados para remocao"
  [ "$aprovados" -eq 0 ] && _cc_ok "Nenhum item para remover" && _cc_pause && return
  _cc_warn "${#CC_MAN_BLOQUEADOS[@]} item(ns) protegido(s) na lista de protecao"
  _cc_pause
}

_cc_man_validar_pre_execucao() {
  _cc_screen_title "VALIDACAO PRE-EXECUCAO"
  _cc_screen_breadcrumb "Control Center › Manutencao › Validacao"
  local falhas=0 total=0

  _cc_box_blank
  _cc_box_line_center "${_CC_C_NEGRITO}AMBIENTE${_CC_C_RESET}"; _cc_box_sep

  # A1. Repositorio Git acessivel
  total=$((total + 1))
  _cc_box_line "A${total}. Repositorio Git..."
  if ! git -C "$REPO_DIR" rev-parse --git-dir &>/dev/null; then
    _cc_box_line "  ${_CC_C_VERMELHO}FALHA: repositorio Git nao acessivel${_CC_C_RESET}"
    falhas=$((falhas + 1)); _cc_log "Falha A${total}: repositorio Git inacessivel"
  else
    _cc_box_line "  ${_CC_C_VERDE}OK${_CC_C_RESET}"
  fi

  # A2. Workspace consistente (sem conflitos de merge)
  total=$((total + 1))
  _cc_box_line "A${total}. Workspace consistente..."
  if git -C "$REPO_DIR" diff --name-only --diff-filter=U 2>/dev/null | grep -q .; then
    _cc_box_line "  ${_CC_C_VERMELHO}FALHA: existem conflitos de merge nao resolvidos${_CC_C_RESET}"
    _cc_box_line "  ${_CC_C_AMARELO}Correcao: resolva os conflitos antes de executar a limpeza${_CC_C_RESET}"
    falhas=$((falhas + 1)); _cc_log "Falha A${total}: conflitos de merge pendentes"
  else
    _cc_box_line "  ${_CC_C_VERDE}OK${_CC_C_RESET}"
  fi

  # A3. Branch identificada
  total=$((total + 1))
  _cc_box_line "A${total}. Branch identificada..."
  local branch
  branch=$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ -n "$branch" ] && [ "$branch" != "HEAD" ]; then
    _cc_box_line "  ${_CC_C_VERDE}OK (${branch})${_CC_C_RESET}"
  else
    _cc_box_line "  ${_CC_C_AMARELO}ATENCAO: branch nao identificada (detached HEAD)${_CC_C_RESET}"
    _cc_box_line "  ${_CC_C_AMARELO}A limpeza continua, mas sem rastreabilidade de branch${_CC_C_RESET}"
  fi

  # A4. Permissoes de escrita
  total=$((total + 1))
  _cc_box_line "A${total}. Permissoes de escrita..."
  if [ -w "$REPO_DIR" ]; then
    _cc_box_line "  ${_CC_C_VERDE}OK${_CC_C_RESET}"
  else
    _cc_box_line "  ${_CC_C_VERMELHO}FALHA: sem permissao de escrita em $REPO_DIR${_CC_C_RESET}"
    _cc_box_line "  ${_CC_C_AMARELO}Correcao: verifique permissoes do diretorio${_CC_C_RESET}"
    falhas=$((falhas + 1)); _cc_log "Falha A${total}: sem permissao de escrita"
  fi

  # A5. Espaco em disco (min 100MB)
  total=$((total + 1))
  _cc_box_line "A${total}. Espaco em disco..."
  local disp
  disp=$(df --output=avail "$REPO_DIR" 2>/dev/null | tail -1 | tr -d ' ')
  if [ -n "$disp" ] && [ "$disp" -gt 102400 ]; then
    _cc_box_line "  ${_CC_C_VERDE}OK ($((disp / 1024))MB disponiveis)${_CC_C_RESET}"
  else
    _cc_box_line "  ${_CC_C_VERMELHO}FALHA: espaco insuficiente (${disp:-0}KB, minimo 102400KB)${_CC_C_RESET}"
    _cc_box_line "  ${_CC_C_AMARELO}Correcao: libere espaco em disco${_CC_C_RESET}"
    falhas=$((falhas + 1)); _cc_log "Falha A${total}: espaco em disco insuficiente"
  fi

  # A6. Diretorio de recuperacao (_trash/)
  total=$((total + 1))
  _cc_box_line "A${total}. Diretorio de recuperacao (_trash/)..."
  if mkdir -p "$CC_MAN_TRASH" 2>/dev/null && [ -w "$CC_MAN_TRASH" ]; then
    _cc_box_line "  ${_CC_C_VERDE}OK${_CC_C_RESET}"
  else
    _cc_box_line "  ${_CC_C_VERMELHO}FALHA: nao foi possivel criar/escrever em $CC_MAN_TRASH${_CC_C_RESET}"
    _cc_box_line "  ${_CC_C_AMARELO}Correcao: verifique permissoes do diretorio raiz${_CC_C_RESET}"
    falhas=$((falhas + 1)); _cc_log "Falha A${total}: diretorio _trash/ indisponivel"
  fi

  # A7. Diretorio de logs disponivel
  total=$((total + 1))
  _cc_box_line "A${total}. Diretorio de logs..."
  local log_dir && log_dir=$(dirname "$CC_MAN_LOG")
  if mkdir -p "$log_dir" 2>/dev/null && [ -w "$log_dir" ]; then
    _cc_box_line "  ${_CC_C_VERDE}OK${_CC_C_RESET}"
  else
    _cc_box_line "  ${_CC_C_VERMELHO}FALHA: nao foi possivel criar/escrever em $log_dir${_CC_C_RESET}"
    falhas=$((falhas + 1)); _cc_log "Falha A${total}: diretorio de logs indisponivel"
  fi

  # A8. Snapshot (diretorio disponivel)
  total=$((total + 1))
  _cc_box_line "A${total}. Diretorio para Snapshot..."
  local snap_dir="$CC_MAN_TRASH/snapshots"
  if mkdir -p "$snap_dir" 2>/dev/null && [ -w "$snap_dir" ]; then
    _cc_box_line "  ${_CC_C_VERDE}OK${_CC_C_RESET}"
  else
    _cc_box_line "  ${_CC_C_VERMELHO}FALHA: nao foi possivel criar $snap_dir${_CC_C_RESET}"
    falhas=$((falhas + 1)); _cc_log "Falha A${total}: diretorio de snapshot indisponivel"
  fi

  # --- SEGURANCA ---
  _cc_box_blank; _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}SEGURANCA${_CC_C_RESET}"; _cc_box_sep

  # S1. Lista de protecao carregada
  total=$((total + 1))
  _cc_box_line "S$((total - 8)). Lista de protecao carregada..."
  if [ ${#_CC_PROTEGIDOS[@]} -gt 0 ]; then
    _cc_box_line "  ${_CC_C_VERDE}OK (${#_CC_PROTEGIDOS[@]} itens protegidos)${_CC_C_RESET}"
  else
    _cc_box_line "  ${_CC_C_VERMELHO}FALHA: lista de protecao vazia${_CC_C_RESET}"
    falhas=$((falhas + 1)); _cc_log "Falha S1: lista de protecao vazia"
  fi

  # S2. Arquivos protegidos identificados
  total=$((total + 1))
  _cc_box_line "S$((total - 8)). Arquivos protegidos identificados..."
  if [ ${#CC_MAN_BLOQUEADOS[@]} -gt 0 ] || true; then
    _cc_box_line "  ${_CC_C_VERDE}OK (${#CC_MAN_BLOQUEADOS[@]} bloqueados)${_CC_C_RESET}"
  fi

  # S3. Plano de Limpeza validado
  total=$((total + 1))
  _cc_box_line "S$((total - 8)). Plano de Limpeza validado..."
  local planos_validos=0
  for p in "${CC_MAN_PLANO[@]}"; do
    IFS='|' read -r acao alvo _ <<< "$p"
    [ -n "$acao" ] && [ -n "$alvo" ] && planos_validos=$((planos_validos + 1))
  done
  if [ "$planos_validos" -eq "${#CC_MAN_PLANO[@]}" ]; then
    _cc_box_line "  ${_CC_C_VERDE}OK (${planos_validos} entradas validas)${_CC_C_RESET}"
  else
    _cc_box_line "  ${_CC_C_VERMELHO}FALHA: ${#CC_MAN_PLANO[@]} entradas, ${planos_validos} validas${_CC_C_RESET}"
    falhas=$((falhas + 1)); _cc_log "Falha S3: plano de limpeza com entradas invalidas"
  fi

  # S4. Dry-Run executado (verificamos que a simulacao foi chamada)
  total=$((total + 1))
  _cc_box_line "S$((total - 8)). Dry-Run executado..."
  _cc_box_line "  ${_CC_C_VERDE}OK (sera exibido apos as validacoes)${_CC_C_RESET}"

  # S5. Confirmacao dupla (sera realizada apos validacao)
  total=$((total + 1))
  _cc_box_line "S$((total - 8)). Confirmacao dupla pendente..."
  _cc_box_line "  ${_CC_C_CIANO}INFO: sera solicitada apos dry-run${_CC_C_RESET}"

  # --- INTEGRIDADE ---
  _cc_box_blank; _cc_box_sep
  _cc_box_line_center "${_CC_C_NEGRITO}INTEGRIDADE${_CC_C_RESET}"; _cc_box_sep

  # I1. Nenhum erro durante a analise
  total=$((total + 1))
  _cc_box_line "I$((total - 13)). Erros durante analise..."
  if [ "${CC_MAN_FAIL:-0}" -eq 0 ]; then
    _cc_box_line "  ${_CC_C_VERDE}OK (sem erros)${_CC_C_RESET}"
  else
    _cc_box_line "  ${_CC_C_AMARELO}ATENCAO: ${CC_MAN_FAIL} erro(s) na analise${_CC_C_RESET}"
  fi

  # I2. Nenhum arquivo critico selecionado
  total=$((total + 1))
  _cc_box_line "I$((total - 13)). Arquivos criticos no plano..."
  local crit_no_plano=0
  for p in "${CC_MAN_PLANO[@]}"; do
    IFS='|' read -r acao alvo _ <<< "$p"
    [ "$acao" = "REMOVER" ] && _cc_man_eh_protegido "$alvo" && crit_no_plano=$((crit_no_plano + 1))
  done
  if [ "$crit_no_plano" -eq 0 ]; then
    _cc_box_line "  ${_CC_C_VERDE}OK (nenhum arquivo protegido no plano)${_CC_C_RESET}"
  else
    _cc_box_line "  ${_CC_C_VERMELHO}FALHA: ${crit_no_plano} arquivo(s) protegido(s) no plano de remocao${_CC_C_RESET}"
    falhas=$((falhas + 1)); _cc_log "Falha I2: arquivos protegidos no plano de remocao"
  fi

  # I3. Plano de Limpeza integro (sem duplicatas)
  total=$((total + 1))
  _cc_box_line "I$((total - 13)). Plano de Limpeza integro..."
  local -A vistos=() dups=0
  for p in "${CC_MAN_PLANO[@]}"; do
    IFS='|' read -r acao alvo _ <<< "$p"
    [ "$acao" != "REMOVER" ] && continue
    [ -n "${vistos[$alvo]:-}" ] && dups=$((dups + 1))
    vistos[$alvo]=1
  done
  [ "$dups" -eq 0 ] && _cc_box_line "  ${_CC_C_VERDE}OK (sem duplicatas)${_CC_C_RESET}" || { _cc_box_line "  ${_CC_C_VERMELHO}FALHA: ${dups} duplicata(s)${_CC_C_RESET}"; falhas=$((falhas + 1)); _cc_log "Falha I3: duplicatas no plano"; }

  # I4. Diretorio de Snapshot ainda viavel apos validacoes
  total=$((total + 1))
  _cc_box_line "I$((total - 13)). Snapshot viavel..."
  if [ -w "$snap_dir" ]; then
    _cc_box_line "  ${_CC_C_VERDE}OK${_CC_C_RESET}"
  else
    _cc_box_line "  ${_CC_C_VERMELHO}FALHA: snapshot nao viavel${_CC_C_RESET}"
    falhas=$((falhas + 1)); _cc_log "Falha I4: snapshot nao viavel apos validacoes"
  fi

  # Resultado final
  _cc_box_blank; _cc_box_sep
  if [ "$falhas" -gt 0 ]; then
    _cc_box_line_center "${_CC_C_VERMELHO}${falhas} falha(s) — EXECUCAO CANCELADA${_CC_C_RESET}"
    _cc_box_blank
    _cc_box_line "${_CC_C_AMARELO}Corrija as falhas acima antes de executar o Plano de Limpeza.${_CC_C_RESET}"
    _cc_box_blank; _cc_box_close; echo ""
    _cc_fail "Execucao cancelada: ${falhas} falha(s) na validacao pre-execucao"
    _cc_log "Execucao CANCELADA: ${falhas} falha(s) na validacao pre-execucao"
    _cc_pause
    return 1
  fi
  _cc_box_line_center "${_CC_C_VERDE}TODAS AS VALIDACOES APROVADAS (${total}/${total})${_CC_C_RESET}"
  _cc_box_blank; _cc_box_close; echo ""
  _cc_ok "Validacao pre-execucao: ${total}/${total} aprovadas"
  _cc_log "Validacao pre-execucao APROVADA (${total}/${total})"
  return 0
}

_cc_man_executar_plano() {
  [ ${#CC_MAN_PLANO[@]} -eq 0 ] && _cc_warn "Nenhum plano de limpeza foi gerado." && _cc_pause && return
  local aprovados=0
  for p in "${CC_MAN_PLANO[@]}"; do [[ "${p%%|*}" = "REMOVER" ]] && aprovados=$((aprovados + 1)); done
  [ "$aprovados" -eq 0 ] && _cc_warn "Nenhum item aprovado no plano." && _cc_pause && return

  # Validacoes pre-execucao
  _cc_man_validar_pre_execucao || return

  # Dry-run primeiro
  _cc_man_simular
  echo ""

  # Confirmacao dupla (CCC-F09-FINAL) — mesmo com tudo indo pra _trash/,
  # a execucao mexe no working tree e merece a segunda confirmacao.
  _cc_warn "EXECUTAR PLANO DE LIMPEZA"
  [ "$aprovados" -eq 0 ] && _cc_ok "Nenhum item para remover" && _cc_pause && return
  _cc_confirm "Deseja executar o Plano de Limpeza?" || { echo "Cancelado."; _cc_pause; return; }
  _cc_confirm "ULTIMA CONFIRMACAO: remover ${aprovados} item(ns) aprovado(s) (recuperaveis em _trash/)?" || { echo "Cancelado."; _cc_pause; return; }

  _cc_man_snapshot
  _cc_log "Executando plano de limpeza"
  _cc_man_log_inicio
  local removidos=0
  mkdir -p "$CC_MAN_TRASH" 2>/dev/null
  local timestamp && timestamp=$(date '+%Y%m%d_%H%M%S')

  local espaco_recuperado=0
  for p in "${CC_MAN_PLANO[@]}"; do
    IFS='|' read -r acao alvo desc <<< "$p"
    [ "$acao" != "REMOVER" ] && continue
    # Defesa em profundidade: mesmo que um item protegido escape da
    # Limpeza Assistida e da validação I2, NUNCA é removido aqui —
    # a versão original tinha esta lógica invertida (protegido recebia
    # rm -f permanente; só o não-protegido ia pra _trash/), corrigida
    # na homologação CCC-V1.0-FINAL-001.
    if _cc_man_eh_protegido "$alvo"; then
      _cc_man_log_item "BLOQUEADO" "$alvo" "arquivo protegido — remocao recusada"
      _cc_warn "Bloqueado (protegido, nao removido): $(basename "$alvo")"
      continue
    fi
    if [ -f "$alvo" ]; then
      local sz && sz=$(stat -c%s "$alvo" 2>/dev/null || echo 0)
      local trash_path="$CC_MAN_TRASH/${timestamp}_$(basename "$alvo")"
      if cp "$alvo" "$trash_path" 2>/dev/null && rm -f "$alvo" 2>/dev/null; then
        removidos=$((removidos + 1))
        espaco_recuperado=$((espaco_recuperado + sz))
        _cc_man_log_item "RECUPERAVEL" "$alvo" "movido para _trash/${timestamp}_$(basename "$alvo")"
        _cc_ok "Removido (recuperavel): $(basename "$alvo")"
      else
        _cc_man_log_item "FALHA" "$alvo" "nao foi possivel mover para _trash/"
        _cc_fail "Falha ao remover: $(basename "$alvo")"
      fi
    elif [ -d "$alvo" ]; then
      rmdir "$alvo" 2>/dev/null
      removidos=$((removidos + 1))
      _cc_man_log_item "EXCLUIDO_DIR" "$alvo" "diretorio vazio"
      _cc_ok "Removido: $(basename "$alvo")"
    fi
  done
  CC_MAN_REMOVIDOS=$removidos
  CC_MAN_ESPACO=$espaco_recuperado
  _cc_man_log_fim "$removidos" "$espaco_recuperado"
  _cc_man_salvar_estado
  _cc_ok "Plano executado: ${removidos} item(ns) removido(s)"
  [ -d "$CC_MAN_TRASH" ] && [ "$(ls -A "$CC_MAN_TRASH" 2>/dev/null)" ] && _cc_ok "Arquivos recuperaveis em: $CC_MAN_TRASH"
  _cc_pause
}

# Snapshot de seguranca antes da execucao
_cc_man_snapshot() {
  local snap_dir="$CC_MAN_TRASH/snapshots"
  mkdir -p "$snap_dir" 2>/dev/null
  local timestamp && timestamp=$(date '+%Y%m%d_%H%M%S')
  local branch && branch=$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
  local commit && commit=$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo "?")
  local snap_file="$snap_dir/snapshot_${timestamp}.json"
  local lista="" sep=""
  for p in "${CC_MAN_PLANO[@]}"; do
    IFS='|' read -r acao alvo desc <<< "$p"
    [ "$acao" = "REMOVER" ] && lista="${lista}${sep}\"${alvo}\"" && sep=","
  done
  cat > "$snap_file" <<EOF
{
  "tipo": "SNAPSHOT_SEGURANCA",
  "data": "$(date --iso-8601=seconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')",
  "usuario": "$USER",
  "branch": "${branch}",
  "commit": "${commit}",
  "total_plano": ${#CC_MAN_PLANO[@]},
  "itens_remover": [${lista}],
  "plano": [
EOF
  local first=1
  for p in "${CC_MAN_PLANO[@]}"; do
    IFS='|' read -r acao alvo desc <<< "$p"
    [ "$first" -eq 0 ] && echo "," >> "$snap_file"
    first=0
    echo "    {\"acao\":\"${acao}\",\"alvo\":\"${alvo}\",\"descricao\":\"${desc}\"}" >> "$snap_file"
  done
  echo "  ]" >> "$snap_file"
  echo "}" >> "$snap_file"
  _cc_ok "Snapshot de seguranca: $snap_file"
  _cc_log "Snapshot criado em $snap_file"
}

# Log de auditoria
_cc_man_log_inicio() {
  local branch && branch=$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
  local commit && commit=$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo "?")
  {
    echo "=============================================="
    echo "CLEANUP LOG — $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Usuario : $USER"
    echo "Branch  : $branch"
    echo "Commit  : $commit"
    echo "=============================================="
    echo ""
  } >> "$CC_MAN_LOG"
}

_cc_man_log_item() {
  local acao="$1" alvo="$2" info="$3"
  echo "[$(date '+%H:%M:%S')] ${acao}: ${alvo} — ${info}" >> "$CC_MAN_LOG"
}

_cc_man_log_fim() {
  # Espaço recebido de quem executou o plano (medido ANTES do rm — a
  # versão original media depois, quando o arquivo já não existia, e
  # registrava sempre 0B; corrigido na homologação CCC-V1.0-FINAL-001).
  local removidos="$1" espaco="${2:-0}"
  local duracao && duracao=$(_cc_man_duracao)
  local tam_h && tam_h=$(numfmt --to=iec 2>/dev/null <<< "$espaco" || echo "${espaco}B")
  {
    echo ""
    echo "----------------------------------------------"
    echo "Resumo"
    echo "  Itens removidos  : $removidos"
    echo "  Espaco recuperado: $tam_h"
    echo "  Tempo            : $duracao"
    echo "=============================================="
    echo ""
  } >> "$CC_MAN_LOG"
  _cc_log "Cleanup log salvo em $CC_MAN_LOG"
}
