---
description: Encaminha tarefas de programação ao DP/DeepSeek e acompanha a entrega.
---

# Delegar programação ao DP

Use este fluxo quando a solicitação exigir criar ou alterar código.

1. Leia `ENGINEERING.md`, `docs/AGENT_POLICY.md` e `PROXIMA_ETAPA.md` (quando aplicável).
2. Confirme objetivo, critérios de aceite, arquivos/áreas autorizados, restrições e testes esperados.
3. Encaminhe a tarefa ao Programador DP/DeepSeek pelo fluxo oficial já existente. Não crie um segundo programador nem substitua a automação atual.
4. Se já houver branch ou PR para a tarefa, retome a mesma. Preserve commits e histórico; nunca use reset, rebase, force-push ou recrie PR para contornar divergência.
5. Acompanhe o DP até obter branch/PR, commits, arquivos alterados, testes e relatório.
6. Revise o diff e as evidências. Se houver defeitos, devolva apontamentos objetivos ao DP para correção.
7. Não faça merge, promoção para `main`, deploy ou alteração de produção sem autorização explícita do dono.
8. Informe o resultado ao dono com status, links, alterações, testes, problemas e pendências.

Se o canal/ferramenta do DP estiver indisponível, informe o bloqueio. Não programe no lugar dele sem autorização explícita.
