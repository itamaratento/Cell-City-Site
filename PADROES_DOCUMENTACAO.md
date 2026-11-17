# PADROES_DOCUMENTACAO.md — Padrões de Governança Documental

**Versão:** 1.0 · **Data de adoção:** 2026-07-21

> Este documento trata de **como os documentos do projeto se relacionam
> entre si** — não de arquitetura, papéis de engenharia ou processo de
> desenvolvimento. Essas continuam sendo responsabilidade de
> [`ENGINEERING.md`](ENGINEERING.md) (Constituição do Projeto) e
> [`CLAUDE.md`](CLAUDE.md) (regras permanentes de desenvolvimento). Este
> arquivo complementa os dois, não os substitui e não define estrutura
> de governança nova.

**Origem:** proposto pelo dono durante o encerramento da homologação da
Release v3.2.0 (2026-07-21), como reação direta a uma sequência de
documentos de "encerramento" que se repetiram sem fato novo — ver
`plans/GOVERNANCA_BASELINE_V320_20260721.md` e a decisão de descartar
`TERMO_ENCERRAMENTO_GOVERNANCA_V320_...md` por duplicidade.

---

## Princípios

A documentação do projeto deve buscar clareza, consistência,
rastreabilidade, simplicidade e manutenção sustentável. Sempre que
existir uma informação normativa, ela deve ter **uma fonte principal**
claramente identificada.

## Papéis dos documentos

Cada documento tem um propósito específico: governança, arquitetura,
decisão (ADR), backlog, planejamento, homologação, certificação,
operação ou histórico. **Dois documentos não devem assumir
simultaneamente a mesma função.**

## Fonte principal e referências

Quando uma informação é normativa, define-se um documento principal; os
demais **referenciam ou resumem, nunca duplicam integralmente**. Quando
um documento depende de outro, ele referencia — não copia. Isso reduz o
risco de divergência quando um dos dois for atualizado e o outro não.

## Antes de criar um novo documento

Verificar, nesta ordem:

1. A informação já existe em algum documento?
2. Existe um documento equivalente (mesmo papel, mesmo escopo)?
3. O novo documento acrescenta **fato novo** verificável?

Se a resposta a (3) for não, **atualizar o documento existente em vez
de criar outro**. Isso vale especialmente para relatórios de
encerramento/certificação: um novo relatório só se justifica com fato
novo, não com reformatação ou reafirmação do que já foi dito.

## Evolução vs. edição

Uma nova versão documental (novo arquivo, nova seção numerada) se
justifica quando há mudança técnica, decisão arquitetural, mudança de
processo, descoberta relevante ou atualização normativa. Mudanças
puramente editoriais podem ser registradas por edição direta, sem
inflar a estrutura documental com um arquivo novo.

## Histórico

Manter histórico suficiente para entender contexto, motivação, evolução
e impacto — mas **evitar reconstruir a história por meio de documentos
repetidos**. Preferir seções demarcadas ("Adendo", "Histórico") dentro
de um documento existente a um novo arquivo que conta a mesma história
de novo.

## ADR, Backlog, Certificação, Homologação, Governança

- **ADR:** toda decisão que altera arquitetura vai para uma ADR própria,
  com impactos e alternativas consideradas registrados.
- **Backlog:** cada item tem identificador, descrição, objetivo, estado,
  dependências e critérios de aceite. Documentos de governança não
  substituem o backlog.
- **Certificação:** representa uma fotografia do estado avaliado num
  momento. Fato novo relevante gera **atualização ou adendo
  identificado**, não reescrita do documento original.
- **Homologação:** registra escopo avaliado, resultado, ressalvas e
  conclusão — não assume papel de documentação arquitetural ou backlog.
- **Governança:** descreve papéis, responsabilidades, fluxos, critérios
  e regras do processo — não duplica conteúdo técnico detalhado que já
  vive em documento especializado.

## Auditoria e manutenção documental

Em auditorias, verificar: documentos duplicados, referências quebradas,
conteúdo obsoleto, inconsistências e conflitos entre fontes — e
priorizar correções que reduzam ambiguidade. Manutenção periódica deve
reduzir redundâncias, consolidar informação, remover referências
obsoletas e preservar o histórico relevante.

## Checklist antes de publicar um documento novo

- [ ] Acrescenta informação relevante (fato novo)?
- [ ] Tem finalidade clara e não sobreposta a um documento existente?
- [ ] Evita duplicação (referencia em vez de copiar)?
- [ ] Referencia corretamente as fontes de que depende?
- [ ] Facilita, em vez de dificultar, uma auditoria futura?

Se qualquer resposta for "não", reconsiderar antes de criar o arquivo.

---

*Este documento é ele próprio sujeito às regras acima: mudanças
editoriais são feitas por edição direta; uma nova versão (v2.0) só se
justifica por mudança real de princípio, não por reafirmação.*
