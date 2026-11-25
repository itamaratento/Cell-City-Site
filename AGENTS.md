# Instruções comuns dos agentes — Cell City

@[Política central Cell City](docs/AGENT_POLICY.md)

Esta política central é obrigatória e deve ser carregada integralmente. Ela define a arquitetura **Cell City AI Hub**:
- **Antigravity — Centro Estratégico:** **Claude Opus 5.5 (High)** atua como Cérebro Estratégico, Orquestrador e Revisor Técnico; **Gemini 4 Hydrogen** atua como Executor Auxiliar interno.
- **Hierarquia obrigatória de programação:** `1. Cursor (Principal) → 2. DP/DeepSeek (Segundo) → 3. Gemini/Antigravity (Terceiro) → 4. Claude Opus (Último recurso, bloqueado contra autoescalação e sujeito a revisão humana antes de main)`.
- **Governança:** o dono mantém aprovação exclusiva de merge em `main`, promoções, deploys e ações de alto impacto.

Para continuidade do CRM, consulte também `ENGINEERING.md`, `CLAUDE.md` e `PROXIMA_ETAPA.md` antes de qualquer tarefa de desenvolvimento. Em caso de comando `CC` ou `CONTINUAR`, ler `PROXIMA_ETAPA.md`, reportar status e aguardar aprovação sem alterar arquivos.

Despache tarefas de código via `scripts/ai-hub/hierarchy-router.mjs` ou MCP `cellcity-dev-router` (`.agents/mcp_config.json`), preservando branches/PRs existentes, arquivos protegidos e eficiência Firebase.

As regras deste arquivo são sempre ativas no workspace e complementam `docs/AGENT_POLICY.md` sem criar políticas paralelas.
