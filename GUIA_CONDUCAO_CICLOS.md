# GUIA_CONDUCAO_CICLOS.md — Guia Metodológico de Condução de Ciclos de Engenharia

**Versão:** 1.0 (recebida como "Edição 4.0" do texto de origem) · **Data de adoção:** 2026-07-21

> Este é um **guia metodológico subordinado**, não um documento
> normativo de autoridade. Quando houver conflito de interpretação,
> prevalecem [`ENGINEERING.md`](ENGINEERING.md) (papéis de engenharia e
> processo) e [`CLAUDE.md`](CLAUDE.md) (regras permanentes de
> desenvolvimento) — ver [`PADROES_DOCUMENTACAO.md`](PADROES_DOCUMENTACAO.md)
> para os princípios de organização documental que regem este arquivo.
>
> Só se aplica na prática quando já existe: backlog definido, objetivo
> conhecido, escopo delimitado, critérios de aceite e **autorização
> formal do dono**. Sem isso, é só referência metodológica — não inicia
> ciclo, não altera código, não faz deploy.

**Origem:** proposto pelo dono (via sessão Cursor/"ChatGPT" concorrente)
em 2026-07-21, como uma versão revisada de uma proposta anterior de
"Framework Mestre Autônomo" que havia sido registrada como **não
adotada** (`plans/PROPOSTA_FRAMEWORK_MESTRE_AUTONOMO_20260721.md`) por
competir com `ENGINEERING.md`. Esta versão corrige isso: subordina-se
explicitamente aos documentos normativos e não define papéis nem
autoridade — só a sequência de fases de execução de um trabalho já
autorizado, algo que `CLAUDE.md` §3 ("Planejamento obrigatório")
reconhece que ainda não detalha para os papéis de Desenvolvimento/
Estratégia.

---

## Premissa

Todo ciclo nasce de uma necessidade identificada (defeito, melhoria,
refatoração, requisito funcional/não-funcional, adequação arquitetural
ou atividade documental). Entender o problema vem antes de propor
solução.

## Princípios

Uma informação deve ter uma fonte principal; decisões relevantes são
registradas; documentação acompanha a evolução do projeto; escopo
permanece explícito; riscos são conhecidos; conclusões se sustentam em
evidências.

## As 7 fases

1. **Identificação** — qual a necessidade, quem é afetado, impacto
   esperado, limitações e dependências conhecidas.
2. **Preparação** — organizar referências, documentação relacionada,
   riscos iniciais e restrições antes de começar a executar.
3. **Planejamento** — objetivo, escopo, entregas, critérios de aceite,
   estratégia de verificação, artefatos previstos.
4. **Execução** — alterações pequenas e compreensíveis, revisão
   contínua, coerência com o planejado, decisões significativas
   registradas; preservar compatibilidade, reduzir acoplamento,
   eliminar redundâncias, manter padronização.
5. **Verificação** — estratégia compatível com a natureza do trabalho
   (funcional, integração, regressão, desempenho, segurança, revisão
   documental).
6. **Consolidação** — reunir entregas, referências, pendências e
   recomendações ao final; cada entrega permanece independente das
   próximas.
7. **Encerramento** — depois, o projeto volta ao estado de espera até
   nova iniciativa autorizada.

## Controle de escopo

Registrar sempre quatro categorias distintas: escopo aprovado, escopo
realizado, escopo remanescente, escopo futuro. Essa distinção é o que
torna o encerramento de um ciclo claro em vez de ambíguo.

## Auditoria e qualidade

Comparar planejado × executado periodicamente, registrando diferenças e
justificativas. Ao final, perguntar: o objetivo foi alcançado? o escopo
permaneceu consistente? a documentação representa o trabalho real? há
pendências conhecidas?

## Documentação e lições aprendidas

Documentação deve explicar contexto, registrar decisões, indicar
referências, preservar histórico e **evitar duplicação** — quando uma
informação já tem fonte principal, referenciá-la em vez de copiá-la
(ver `PADROES_DOCUMENTACAO.md`). Registrar, quando útil, práticas
bem-sucedidas, dificuldades e oportunidades de melhoria.

---

*Guia metodológico — não substitui `ENGINEERING.md`/`CLAUDE.md`. Ajustes
puramente editoriais não exigem nova versão; mudança real de método,
sim.*
