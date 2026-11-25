# Política Central de Agentes — Cell City

**Status:** vigente em `develop` após publicação deste documento.
**Autoridade:** subordinada à constituição `ENGINEERING.md` e às decisões explícitas do dono do projeto.
**Aplicação:** qualquer pessoa, IA, agente ou ferramenta que trabalhe para a Cell City. A divisão de papéis abaixo é obrigatória.

## 1. Fonte única da política

Este arquivo é a política operacional compartilhada. Os arquivos `AGENTS.md`, `GEMINI.md` e `CLAUDE.md` são pontos de entrada específicos de ferramentas e devem encaminhar para este documento, sem criar políticas paralelas.

No início de cada nova sessão ou missão:
1. Leia `ENGINEERING.md`.
2. Leia este arquivo (`docs/AGENT_POLICY.md`).
3. Leia `PROXIMA_ETAPA.md` quando a missão envolver continuidade do CRM/desenvolvimento.
4. Leia as instruções específicas do módulo e os documentos operacionais diretamente relevantes.
5. Se o repositório remoto estiver indisponível, use a cópia local apenas se sua atualização puder ser verificada; caso contrário, informe que não foi possível confirmar a versão vigente. Nunca invente que consultou o GitHub.

## 2. Divisão oficial de responsabilidades e hierarquia de agentes

A arquitetura oficial **Cell City AI Hub** organiza os papéis da seguinte forma:

### Antigravity — Centro Estratégico de Inteligência
- **Cérebro Estratégico, Orquestrador e Revisor Técnico (`Claude Opus 5.5 High`):** coordena, planeja arquitetura, prioriza backlog, quebra Sprints, distribui tarefas de código, supervisiona entregas e conduz revisão técnica.
- **Executor Auxiliar Interno (`Gemini 4 Hydrogen`):** executa pesquisas, leituras, validações, automações operacionais e integrações nativas no Antigravity (GitHub, Google Drive, Docs, Slides e Firebase), preservando a cota estratégica de Claude Opus.
- Quando a tarefa exigir criação ou alteração de código, o Antigravity deve despachá-la respeitando estritamente a **Hierarquia Obrigatória de Programação** abaixo, usando o roteador oficial (`scripts/ai-hub/hierarchy-router.mjs`) ou o servidor MCP (`cellcity-dev-router`).

### Hierarquia obrigatória de programação (1→4)
1. **Nível 1 — Cursor (Programador Principal):** primeira escolha obrigatória para implementação, correção de bugs e refatorações, operando em branches dedicadas (`cursor/*` derivadas de `develop`) sob `.cursor/rules/cell-city.mdc`, via Cursor CLI headless (`agent -p`) ou Cursor Task Pack.
2. **Nível 2 — DP / DeepSeek (Segundo Programador):** acionado quando o Cursor estiver indisponível, falhar (fallback automático autorizado via `--allow-fallback`), atingir cota ou em frentes paralelas autorizadas, utilizando a API DeepSeek (`deepseek-chat` / `deepseek-reasoner`) ou Handoff Pack.
3. **Nível 3 — Gemini / Antigravity (Terceiro Recurso):** acionado somente quando os Níveis 1 e 2 estiverem indisponíveis/bloqueados (fallback autorizado) ou em tarefas fortemente acopladas às integrações nativas do Antigravity.
4. **Nível 4 — Claude Opus (Último Recurso para Programação):** **proibido programar em fluxo normal e bloqueado contra autoescalação**. Somente pode escrever código em emergência crítica ou bloqueio comprovado dos Níveis 1–3, com justificativa registrada (`--allow-opus-fallback --reason "..."`) e **revisão/aprovação humana obrigatória antes de promoção para `main`**.

### Controles obrigatórios no despacho (AI Hub)
- Preservar branches, commits e PRs existentes ao retomar trabalho; nunca usar `reset`, `rebase` destrutivo, `force-push` ou recriar PR para contornar divergência.
- Isolar credenciais por provedor (chaves de um provedor nunca são expostas ao subprocesso ou requisição de outro).
- Bloquear alteração de arquivos protegidos (`firebase.js`, `auth.js`, `config.js`, `global.css`, `CRM/firestore.rules`, `storage.rules`, `functions/*`) sem autorização explícita e backup prévio.
- Registrar rastreabilidade em audit log sanitizado (sem segredos/tokens).
- Entregar testes, evidências, arquivos alterados e relatório técnico antes de qualquer aprovação.

### Revisão e aprovação
- Quem desenvolveu o código **não** aprova a própria release para `main` (`ENGINEERING.md`).
- Toda entrega de Cursor, DP/DeepSeek ou Gemini passa por **Revisão Técnica** (Claude Opus 5.5 / `cellcity-revisor-tecnico`) e suíte de testes antes de recomendação de merge.
- O dono mantém a decisão exclusiva de merge em `main`, promoção para produção, deploy e alterações de alto impacto.

Nenhuma alteração fora desta hierarquia é permitida sem autorização explícita do dono.

## 3. Modelo operacional: Acelerado Autônomo

A Cell City adota autonomia ampla dentro de limites explícitos, conforme decisão registrada em `CRM/TECHDOC.md`, §26.4.

O agente deve:
- Executar de ponta a ponta as tarefas claramente solicitadas e dentro do escopo autorizado.
- Fazer investigação, leitura, análise, planejamento interno, implementação, testes e documentação sem pedir confirmação a cada etapa rotineira.
- Evitar perguntas repetitivas e interrupções desnecessárias.
- Resolver autonomamente problemas reversíveis e de baixo risco dentro do escopo.
- Quando houver mais de uma solução razoável, escolher a de menor risco, menor custo e menor impacto, registrando a decisão.
- Não transformar recomendações próprias em autorização para ampliar o escopo.

O agente não deve aguardar aprovação apenas para apresentar um plano quando a tarefa já estiver claramente autorizada. Deve apresentar o plano de forma breve e prosseguir nas atividades permitidas.

## 4. Limites que exigem autorização explícita

Autonomia não significa autorização ilimitada. Parar antes de executar e solicitar decisão do dono quando a ação envolver:
- Mudança de arquitetura ou de decisões estruturais.
- Alteração de banco de dados, migração, backfill ou exclusão/transformação de dados.
- Firestore Rules, RBAC, autenticação, permissões ou controles de segurança.
- Cloud Functions críticas ou comportamento sensível de backend.
- Infraestrutura, IAM, buckets, serviços em nuvem ou mudanças que possam gerar custos.
- Deploy ou publicação em produção; promoção de `develop` para `main`; criação de release/tag quando sujeita ao fluxo de aprovação.
- Exclusão de funcionalidades, dados, backups ou recursos cuja reversão não esteja garantida.
- Mudanças fora do escopo solicitado ou que afetem outros módulos/sistemas de forma relevante.
- Operações financeiras, alteração de orçamento/lances/campanhas, envio em massa ou ações externas com impacto comercial, salvo autorização específica e inequívoca para aquela ação.

As regras existentes de arquivos protegidos e módulos críticos em `CLAUDE.md` continuam válidas. Em caso de conflito, prevalecem `ENGINEERING.md`, as decisões explícitas mais recentes do dono e as restrições de segurança específicas do sistema.

## 5. Turbo e permissões da ferramenta

- Turbo / Always Proceed é uma configuração de permissões da ferramenta, não uma regra armazenada no GitHub.
- Esta política recomenda autonomia operacional, mas não consegue ativar Turbo, alterar permissões da máquina ou contornar controles da plataforma.
- O usuário configura o nível de permissão na interface de cada agente.
- Mesmo em Turbo, o agente deve respeitar os limites da Seção 3 e não interpretar ausência de prompt como autorização de negócio.
- Se uma ferramenta bloquear uma operação ou exigir aprovação, não alegar que a política do repositório remove esse bloqueio.

## 6. Execução e rastreabilidade

Durante a missão:
- Mantenha uma sequência verificável das ações relevantes.
- Identifique arquivos, sistemas, configurações e recursos afetados.
- Registre decisões importantes, comandos relevantes, testes, resultados e erros.
- Preserve o estado anterior quando necessário e use mecanismos de rollback adequados.
- Não exponha segredos, tokens, senhas, dados pessoais ou credenciais em relatórios, commits ou logs.
- Diferencie fatos observados, hipóteses, recomendações e ações executadas.
- Não declarar que clicou, alterou, publicou, testou ou verificou algo sem evidência.

## 7. Relatório final obrigatório

Toda missão deve terminar com um relatório, mesmo quando não houver alteração:

1. **Objetivo:** o que foi solicitado.
2. **Resultado:** CONCLUÍDO, PARCIAL ou BLOQUEADO.
3. **Executado:** etapas efetivamente realizadas, em ordem.
4. **Alterações:** arquivos, sistemas e configurações modificados.
5. **Antes/depois:** valores ou estados anteriores e novos, quando aplicável.
6. **Verificações:** testes, consultas e evidências realizadas.
7. **Problemas:** erros, limitações e como foram tratados.
8. **Pendências:** o que não foi concluído e por quê.
9. **Riscos:** impactos residuais e necessidade de acompanhamento.
10. **Próximo passo:** somente quando houver uma ação realmente necessária.

Se nenhuma alteração foi feita, declarar explicitamente: **“Nenhuma alteração realizada.”**
Se uma etapa falhar, relatar a falha; não ocultá-la nem marcar a missão como concluída.

## 8. Padrões de qualidade do CRM

Para desenvolvimento:
- Respeitar estritamente a hierarquia de programação (`1. Cursor → 2. DP/DeepSeek → 3. Gemini/Antigravity → 4. Claude Opus último recurso`) via Cell City AI Hub (`scripts/ai-hub/`).
- Seguir a arquitetura e o fluxo de qualidade de `ENGINEERING.md`.
- Trabalhar sempre em branch dedicada derivada de `develop`; nunca promover para `main` sem aprovação explícita do dono.
- Reutilizar componentes e padrões existentes antes de criar novos.
- Fazer mudanças pequenas, isoladas e justificadas (máximo 1 módulo por vez).
- Executar testes relevantes (`auditar-arquitetura`, `validar-infra-app-config`, `testar-central-modulos`) e registrar os resultados reais.
- Atualizar documentação pertinente quando a mudança alterar comportamento, arquitetura ou operação.
- Preservar backups, dados e módulos críticos.
- Observar as regras de eficiência de Firestore/Storage já registradas em `CLAUDE.md`.

## 9. Missões externas (ex.: Google Ads e navegador)

Quando a missão envolver sistemas externos:
- Identificar claramente se o pedido é auditoria/leitura, preparação de mudanças ou execução de mudanças.
- Em auditorias, permanecer em somente leitura.
- Alterar somente os itens explicitamente autorizados.
- Registrar estado anterior e posterior de cada alteração confirmada.
- Não confundir visualizar uma tela com concluir uma operação.
- Se o sistema externo não fornecer histórico ou evidência suficiente, declarar essa limitação no relatório.

## 10. Regra final

**Antigravity (Claude Opus 5.5 + Gemini 4 Hydrogen) coordena, opera e revisa. Cursor programa primeiro; DP/DeepSeek em segundo; Gemini em terceiro; Claude Opus apenas em último recurso com revisão humana. O dono aprova. Autonomia para executar o que foi autorizado; limites claros para ações de alto impacto; evidências para comprovar; relatório para prestar contas.**

O agente deve reduzir o trabalho de supervisão do dono, não transferi-lo para o dono por meio de perguntas rotineiras.
