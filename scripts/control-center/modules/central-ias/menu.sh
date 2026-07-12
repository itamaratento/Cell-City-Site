#!/bin/bash
# Cell City Control Center — módulo Central de IAs (Fase 10 —
# CCC-F10-001). Interface do usuário: submenu e navegação. Nenhuma regra
# de negócio — toda a leitura do Registro de Fases/IAs mora em engine.sh
# e lib/ (ver README.md, "Arquitetura de serviços").
#
# Escopo desta Fase: somente leitura sobre o próprio Control Center e o
# repositório Git — não executa nenhum modelo de IA, não altera arquivo/
# commit/módulo alheio (ver CCC-F10-001, "Segurança"). As únicas escritas
# do módulo são o seu próprio config/local.json (Configurações) e
# relatórios em _reports/ai-center/ (Exportações) — mesmo princípio já
# usado em modules/banco-dados.
set -uo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"
REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"

# shellcheck source=../../lib/common.sh
source "$CC_ROOT/lib/common.sh"
# shellcheck source=./engine.sh
source "$MODULE_DIR/engine.sh"

_cc_run_submenu "Central de IAs" "Control Center › Central de IAs" \
  "1|Dashboard das IAs|_cc_cia_dashboard" \
  "2|IAs Cadastradas|_cc_cia_agentes" \
  "3|Especialidades|_cc_cia_especialidades" \
  "4|Responsabilidades|_cc_cia_responsabilidades" \
  "5|Fluxo de Desenvolvimento|_cc_cia_workflow" \
  "6|Distribuição de Tarefas|_cc_cia_tarefas" \
  "7|Histórico|_cc_cia_historico" \
  "8|Auditorias|_cc_cia_auditorias" \
  "9|Documentação|_cc_cia_documentacao" \
  "10|Estatísticas|_cc_cia_estatisticas" \
  "11|Configurações|_cc_cia_configuracoes"
