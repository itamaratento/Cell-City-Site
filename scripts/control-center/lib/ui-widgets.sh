#!/bin/bash
# Cell City Control Center — componentes de interação (Fase 1.2, "UX do
# Terminal"): confirmação sim/não e barra de progresso. Reutilizáveis por
# qualquer módulo futuro — nenhum módulo desta Fase ainda chama isto, só a
# suíte de testes (prova que o componente funciona antes de ter um
# consumidor real — mesmo padrão do Plugin Loader na Fase 1.1).

# Confirmação sim/não fora da caixa (mesmo padrão já usado em ~/.bashrc,
# ex.: subir-ok). Retorna 0 (sim) / 1 (não, inclusive Enter vazio).
_cc_confirm() {
  local pergunta="$1" resp
  read -rp "${pergunta} (s/N) " resp
  [[ "$resp" =~ ^[sS]$ ]]
}

# Barra de progresso textual determinística — sem animação (nada roda em
# paralelo pra animar ainda). $1 atual, $2 total, $3 largura (padrão 30).
# `seq 1 0` não gera itens; sem a guarda de contagem > 0, o printf ainda
# roda uma vez e imprime o caractere literal do formato mesmo sem args
# (armadilha real, verificada manualmente antes de escrever isto).
_cc_bar() {
  local atual="$1" total="$2" largura="${3:-30}" preenchido vazio pct
  [ "$total" -le 0 ] && total=1
  pct=$(( atual * 100 / total ))
  [ "$pct" -gt 100 ] && pct=100
  [ "$pct" -lt 0 ] && pct=0
  preenchido=$(( pct * largura / 100 ))
  vazio=$(( largura - preenchido ))
  printf '['
  [ "$preenchido" -gt 0 ] && printf '%0.s█' $(seq 1 "$preenchido")
  [ "$vazio" -gt 0 ] && printf '%0.s-' $(seq 1 "$vazio")
  printf '] %d%%\n' "$pct"
}
