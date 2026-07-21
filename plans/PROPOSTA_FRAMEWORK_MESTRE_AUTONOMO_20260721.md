# Proposta — Framework Mestre Autônomo de Execução Contínua

**Data:** 2026-07-21
**Status:** 🔵 **PROPOSTA — NÃO ADOTADA COMO OFICIAL**
**Origem:** texto recebido do dono (via sessão Cursor/"ChatGPT" concorrente) nesta mesma sessão de encerramento da v3.2.0.

---

## Por que este documento não é normativo (ainda)

`ENGINEERING.md` já existe no repositório e se autodeclara **"Constituição
do Projeto"** — tem seu próprio fluxo oficial, processo de qualidade,
papéis de Sprint (Estratégia/Revisão Técnica/Desenvolvimento) e princípios
sobre uso de IA. `CLAUDE.md` reforça isso: *"considere o documento
ENGINEERING.md... como a autoridade máxima do projeto"*.

O texto proposto (14 capítulos: ciclo padrão de 13 etapas, diagnóstico,
inventário, planejamento, testes, auditoria, homologação, certificação,
encerramento, reabertura, espera controlada) cobre território que se
sobrepõe parcialmente ao que `ENGINEERING.md` já define, com nomes e
estrutura diferentes. Adotar os dois como autoridade simultânea criaria
exatamente o problema que ambos os textos dizem evitar: duas fontes de
verdade descrevendo o mesmo processo de formas distintas.

**Decisão registrada nesta sessão:** não adotar agora. Guardar o texto
aqui como referência/proposta. Se o dono decidir seguir com ele, o passo
recomendado é reconciliar — decidir o que entra em `ENGINEERING.md` (e
o que esse arquivo já cobre de forma equivalente) em vez de manter dois
documentos de governança concorrentes.

---

## Texto da proposta (preservado na íntegra)

> Versão: 1.0 · Tipo: Framework Operacional Permanente · Escopo: todos os
> ciclos após a Release v3.2.0 · Estado: Ativo (proposto) · Modo: Autônomo

**Capítulo 01 — Princípios operacionais:** evidências acima de opiniões;
implementações pequenas e verificáveis; toda decisão técnica com
justificativa documentada; nenhuma alteração crítica sem rollback; todo
risco identificado antes da implementação; todo resultado verificável;
nenhuma hipótese registrada como fato; código e documentação sincronizados;
backlogs distintos não se misturam; encerramento só após validação.

**Capítulo 02 — Ciclo padrão (13 etapas):** Abertura → Diagnóstico →
Inventário → Planejamento → Aprovação → Implementação → Testes →
Auditoria → Documentação → Homologação → Certificação → Encerramento →
Espera Controlada.

**Capítulos 03-19:** detalham cada etapa (o que registrar na abertura;
perguntas do diagnóstico; o que mapear no inventário; o que produzir no
planejamento; princípios de implementação — uma alteração por vez,
commits pequenos; categorias de teste — unitário/integração/regressão/
smoke/RBAC/tenant/auth/permissões/performance/UX/segurança/logs;
auditoria planejado×executado; regras de documentação — só atualizar
com mudança real, evitar múltiplos documentos sobre o mesmo fato;
governança — registrar decisões/ADRs; matriz de risco
CRÍTICO/ALTO/MÉDIO/BAIXO com causa/impacto/mitigação/responsável/
condição de encerramento; checklist de segurança pré-encerramento;
critérios mínimos de homologação; conteúdo do parecer de certificação;
conteúdo do registro de encerramento; critérios de reabertura de um
ciclo encerrado; regras da "Espera Controlada" — permitido consultar/
auditar/planejar/revisar, proibido implementar/deployar/mergear/alterar
arquitetura/promover release; critérios de qualidade de fechamento de
ciclo).

**Capítulo 20 — Declaração final:** este framework passa a ser a
referência operacional para os próximos ciclos; início de qualquer
trabalho continua condicionado à seleção explícita de backlog e
autorização correspondente.

---

## Nota lateral (não avaliada a fundo)

A sessão concorrente (Cursor) também gerou, em paralelo,
`plans/SCRIPT_MESTRE_AUTONOMO_ABERTURA_CICLO.md` — um documento parecido
mas com texto diferente do proposto aqui, tratando do mesmo tema
(abertura de ciclo pós-v3.2.0). Esse arquivo estava, no momento desta
sessão, ainda não commitado e continha uma referência a
`plans/TERMO_ENCERRAMENTO_GOVERNANCA_V320_20260721.md` — arquivo
descartado nesta mesma sessão por ser duplicata sem fato novo de
`plans/GOVERNANCA_BASELINE_V320_20260721.md`. Não foi revisado/corrigido
aqui; se for adotado, precisa desse ajuste.
