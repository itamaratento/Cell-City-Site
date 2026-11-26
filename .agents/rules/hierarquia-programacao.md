---
trigger: always_on
description: "Hierarquia obrigatória de programação da Cell City: 1. Cursor, 2. DP/DeepSeek, 3. Gemini/Antigravity, 4. Claude Opus (último recurso)."
---
# Regra Permanente — Hierarquia Obrigatória de Programação (Cell City)

Antes de iniciar qualquer tarefa que envolva escrever ou alterar código:

1. **Verificar o nível responsável:**
   - **Nível 1 — Cursor (Programador Principal):** sempre a primeira escolha para implementação, correção de bugs e refatorações. Despachar via ferramenta MCP `cellcity_dispatch_task` (`tier: "cursor"`) ou gerar Cursor Task Pack para branch `cursor/<slug>`.
   - **Nível 2 — DP/DeepSeek (Segundo Programador):** acionar quando Cursor estiver indisponível, sem cota ou em frentes paralelas (scripts, testes, refatoração localizada) via `tier: "deepseek"`.
   - **Nível 3 — Gemini/Antigravity (Terceiro Recurso):** acionar somente se Cursor e DeepSeek estiverem indisponíveis ou para tarefas fortemente acopladas às integrações nativas do Antigravity (Drive/Docs/GitHub). Usar executor auxiliar Gemini 4 Hydrogen.
   - **Nível 4 — Claude Opus (Último Recurso):** proibido programar em fluxo normal. Reservado para coordenação estratégica, planejamento, distribuição, supervisão e revisão técnica. Só pode escrever código em emergência/bloqueio dos Níveis 1–3, com registro explícito do motivo.

2. **Separação obrigatória de papéis (`ENGINEERING.md`):**
   - Quem escreve o código **não** aprova a própria release para `main`.
   - Toda entrega de Cursor, DeepSeek ou Gemini passa por **Revisão Técnica** (Claude Opus 5.5) + suíte de testes antes de promoção.
   - Se Claude Opus atuar excepcionalmente no Nível 4, exigir validação humana explícita antes de merge em `main`.
