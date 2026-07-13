# CELL CITY CRM
## ENGINEERING.md — Constituição do Projeto

**Versão:** 1.2 — revisão de 2026-07-12: papéis de engenharia tornados
vendor-neutros (nenhum papel é mais vinculado ao nome de um modelo de
IA específico); processo de qualidade e separação de responsabilidades
preservados sem alteração. Motivo e histórico completos em
`plans/CCC-V2.0-ARCH-001_ARQUITETURA_OFICIAL.md` §17.

## Objetivo

Este documento define como todo desenvolvimento do Cell City CRM deve ser conduzido. Nenhuma IA deve iniciar qualquer trabalho sem seguir estas regras.

## Filosofia

O objetivo do projeto NÃO é criar funcionalidades. O objetivo é construir um CRM:

- simples
- rápido
- seguro
- produtivo
- fácil de manter
- estável

## Pilares

Toda alteração deve melhorar pelo menos um destes pilares:

1. Qualidade
2. Produtividade
3. Funcionalidade
4. Estabilidade
5. Segurança
6. Performance

Se não melhorar nenhum deles: **não implementar**.

## Arquitetura

Preservar:

- Kernel
- Repository Layer
- Firebase
- Firestore
- Cloud Functions
- ES Modules
- MPA

Alterações estruturais somente com autorização.

## Papéis de Engenharia

Os papéis abaixo são **funções da Sprint, não cargos permanentes de uma
IA específica** (ver "Princípios sobre uso de IA" mais abaixo). Qualquer
IA designada por quem responde pelo projeto pode exercer qualquer
papel, numa Sprint qualquer, desde que siga integralmente esta
constituição.

### Papel de Estratégia

Responsável por:

- Arquitetura
- Estratégia
- Roadmap
- Priorização
- Gestão do fluxo
- Distribuição das tarefas
- Identificação de gargalos
- Redução de retrabalho
- Melhoria contínua do processo

Quem exerce este papel numa Sprint não desenvolve código nem revisa
releases nessa mesma Sprint — sua função é fazer toda a equipe produzir
mais.

### Papel de Revisão Técnica

Responsável por:

- Revisão técnica
- Segurança
- Arquitetura
- Performance
- Regressões
- RBAC
- Firestore Rules (auditoria)
- Cloud Functions (auditoria)
- Testes
- Aprovação de releases
- `develop` → `main`
- Tags
- Relatório final

### Papel de Desenvolvimento

Responsável por:

- Desenvolvimento
- Bugs
- Refatorações
- Performance
- Código morto
- Cobertura de testes
- Documentação técnica
- Commits na `develop`

Quem exerce este papel numa Sprint nunca promove para `main` nessa
mesma Sprint — o que garante o gate de qualidade é a separação entre
quem desenvolve e quem aprova, não o nome de quem executa (ver
"Processo de Qualidade" abaixo).

## Fluxo oficial

```
Papel de Estratégia
  ↓ define estratégia/escopo da Sprint
Papel de Desenvolvimento
  ↓ implementa Sprint
Commit em develop
  ↓
Papel de Revisão Técnica
  ↓ revisão técnica + testes
develop → main
  ↓
Tag
  ↓
Release
```

## Processo de Qualidade

O fluxo abaixo é **obrigatório** em toda Sprint, independentemente de
qual IA (ou pessoa) exerce cada papel:

```
Desenvolvimento
  ↓
Revisão Técnica
  ↓
Testes
  ↓
Homologação
  ↓
Aprovação
  ↓
Produção
```

A ferramenta/IA utilizada em cada etapa não faz parte da arquitetura
nem da governança permanente do projeto. O que é permanente é a
sequência de etapas e a exigência de que quem desenvolveu a entrega não
seja também quem a aprova.

## Designação das IAs por Sprint

A IA (ou IAs) que exerce cada papel é escolhida por quem responde pelo
projeto, Sprint a Sprint — não é uma atribuição fixa.

Quando a IA designada para o papel de Revisão Técnica estiver
disponível, ela conduz a revisão da Sprint. Se ficar indisponível ou
atingir limite de uso, quem responde pelo projeto pode designar outra
IA para assumir o desenvolvimento; quando a IA original retornar, ela
revisa o trabalho realizado nesse intervalo.

**Somente quem estiver exercendo o papel de Revisão Técnica na Sprint
aprova releases dessa Sprint** — exclusividade do papel dentro do
processo de qualidade, não exclusividade de uma ferramenta específica.

## Princípios sobre uso de IA

- Nenhuma IA possui autoridade permanente.
- Nenhuma IA possui exclusividade operacional fora do papel que estiver
  exercendo numa Sprint específica.
- Nenhuma IA pode recusar uma atividade alegando que ela pertence a
  outra IA.
- A escolha da IA é uma decisão operacional de cada Sprint, feita por
  quem responde pelo projeto.
- A substituição de uma IA por outra não exige alteração desta
  documentação.
- A qualidade do processo é garantida pelos critérios de validação da
  seção "Processo de Qualidade", não pelo nome da ferramenta utilizada.

## Sprint

Toda Sprint deve conter:

- Problema
- Causa
- Correção
- Testes
- Commit
- Como validar

## Proibido

- Criar funcionalidades sem necessidade.
- Criar módulos apenas para aumentar o sistema.
- Alterar arquitetura sem motivo técnico.
- Criar complexidade.
- Duplicar trabalho entre IAs.

## Regra de ouro

Antes de qualquer alteração perguntar: esta mudança melhora Qualidade? Produção? Funcionalidade? Estabilidade? Segurança?

Se NÃO: cancelar a Sprint.

## Missão do projeto

Construir o melhor CRM possível para assistência técnica, com o menor número de bugs, a maior produtividade, e a melhor qualidade possível, utilizando cada IA naquilo em que ela entrega mais valor.

## Regra final

Nenhuma IA trabalha para mostrar serviço. Toda IA trabalha para gerar resultado real para a Cell City.
