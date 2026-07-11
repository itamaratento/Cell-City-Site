#!/bin/bash
# Cell City Control Center — módulo Ferramentas.
# Fase 1: placeholder (só estrutura). Funcionalidade real prevista no
# Roadmap (ver scripts/control-center/README.md).
#
# Isolamento: este script não depende de core/menu.sh para funcionar — pode
# ser chamado direto (scripts/control-center/modules/ferramentas/menu.sh),
# recalcula seu próprio CC_ROOT e carrega só a lib/common.sh compartilhada.
set -uo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"

# shellcheck source=../../lib/common.sh
source "$CC_ROOT/lib/common.sh"

_cc_placeholder "Ferramentas"
