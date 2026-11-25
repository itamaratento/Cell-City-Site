# Antigravity / Gemini — Cell City

@[Política central Cell City](docs/AGENT_POLICY.md)

A política central é obrigatória e deve ser carregada integralmente. No **Cell City AI Hub**, o Antigravity atua como Centro Estratégico de Inteligência com **Claude Opus 5.5 (High)** como Orquestrador/Revisor Técnico e **Gemini 4 Hydrogen** como Executor Auxiliar interno.

Para tarefas de implementação, correção e refatoração de código, respeite estritamente a hierarquia obrigatória via `scripts/ai-hub/hierarchy-router.mjs` ou MCP `cellcity-dev-router`:
1. **Cursor** (Programador Principal — `.cursor/rules/cell-city.mdc`)
2. **DP / DeepSeek** (Segundo Programador — fallback autorizado ou frente paralela)
3. **Gemini / Antigravity** (Terceiro Recurso — somente se Níveis 1 e 2 estiverem indisponíveis ou em integrações nativas)
4. **Claude Opus** (Último Recurso — proibido autoescalar; exige justificativa e aprovação humana antes de `main`)

Para tarefas do CRM, leia também `ENGINEERING.md` e `PROXIMA_ETAPA.md`. Acompanhe as entregas, exija testes e apresente relatório com evidências. Turbo/Always Proceed é uma configuração da ferramenta, não uma autorização para ultrapassar os limites da política.
