---
description: Encaminha tarefas de programação seguindo a hierarquia oficial Cell City AI Hub (1. Cursor -> 2. DP/DeepSeek -> 3. Gemini -> 4. Claude Opus último recurso) e acompanha a entrega até a revisão técnica.
---

# Delegar programação (Hierarquia Cell City AI Hub — Cursor → DP/DeepSeek → Gemini → Claude Opus)

Use este fluxo quando a solicitação exigir criar ou alterar código.

1. Leia `ENGINEERING.md`, `docs/AGENT_POLICY.md` e `PROXIMA_ETAPA.md` (quando aplicável).
2. Confirme objetivo, critérios de aceite, arquivos/áreas autorizados (máximo 1 módulo por vez, sem tocar arquivos protegidos sem autorização explícita), restrições Firebase e testes esperados.
3. Despache a tarefa pelo roteador oficial (`scripts/ai-hub/hierarchy-router.mjs`) ou MCP `cellcity-dev-router`, respeitando estritamente a hierarquia:
   - **Nível 1 — Cursor (Principal):** `--tier cursor` (ou `--tier auto`), branch `cursor/<slug>` derivada de `develop`.
   - **Nível 2 — DP/DeepSeek (Segundo Programador):** acionado quando o Cursor estiver indisponível, falhar com `--allow-fallback` ou em frente paralela autorizada (`--tier deepseek`).
   - **Nível 3 — Gemini/Antigravity (Terceiro Recurso):** apenas quando Níveis 1 e 2 estiverem indisponíveis (`--allow-fallback`) ou em automação nativa.
   - **Nível 4 — Claude Opus (Último Recurso):** bloqueado contra autoescalação; somente em emergência comprovada com `--allow-opus-fallback --reason "<justificativa>"` e aprovação humana obrigatória antes de `main`.
4. Se já houver branch ou PR para a tarefa, retome a mesma. Preserve commits e histórico; nunca use `reset`, `rebase` destrutivo, `force-push` ou recrie PR para contornar divergência.
5. Acompanhe a execução até obter branch/PR, commits, arquivos alterados, testes (`auditar-arquitetura`, `validar-infra-app-config`, `testar-central-modulos`) e relatório técnico.
6. Submeta o diff e as evidências à **Revisão Técnica** (`cellcity-revisor-tecnico` / Claude Opus 5.5). Se houver defeitos, devolva apontamentos objetivos ao programador para correção.
7. Não faça merge automático, promoção para `main`, deploy ou alteração de produção sem autorização explícita do dono.
8. Informe o resultado ao dono no formato de relatório obrigatório em 10 pontos (`docs/AGENT_POLICY.md` §7).
