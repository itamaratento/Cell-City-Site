#!/bin/bash
# Diagnostic Engine — Análise de causa provável
set -uo pipefail

_cc_v3_diag_causa_provavel() {
  local finding="$1"
  local analyzer
  local mensagem

  analyzer=$(echo "$finding" | jq -r '.analyzer // ""')
  mensagem=$(echo "$finding" | jq -r '.mensagem // ""')

  case "$analyzer" in
    git)
      if echo "$mensagem" | grep -q "commits.*ahead"; then
        jq -n '{causa: "Commits locais não enviados ao remoto", acao: "Executar git push para sincronizar"}'
      elif echo "$mensagem" | grep -q "modificados"; then
        jq -n '{causa: "Alterações não commitadas no workspace", acao: "Revisar e commitar ou fazer stash das alterações"}'
      elif echo "$mensagem" | grep -q "atrás do remoto"; then
        jq -n '{causa: "Branch local desatualizada em relação ao remoto", acao: "Executar git pull para atualizar"}'
      elif echo "$mensagem" | grep -q "dias"; then
        jq -n '{causa: "Inatividade no repositório", acao: "Verificar se o projeto está ativo ou se há bloqueios"}'
      else
        jq -n '{causa: "Problema não categorizado no Git", acao: "Revisar estado do repositório manualmente"}'
      fi
      ;;
    system)
      if echo "$mensagem" | grep -q "memória"; then
        jq -n '{causa: "Uso elevado de memória RAM", acao: "Verificar processos em execução, considerar aumento de memória"}'
      elif echo "$mensagem" | grep -q "disco"; then
        jq -n '{causa: "Espaço em disco insuficiente", acao: "Limpar arquivos temporários, logs antigos ou expandir armazenamento"}'
      elif echo "$mensagem" | grep -q "carga"; then
        jq -n '{causa: "CPU sobrecarregada", acao: "Verificar processos, considerar otimização ou escala"}'
      else
        jq -n '{causa: "Problema de sistema não categorizado", acao: "Revisar logs do sistema"}'
      fi
      ;;
    *)
      jq -n '{causa: "Causa não determinada automaticamente", acao: "Análise manual necessária"}'
      ;;
  esac
}
