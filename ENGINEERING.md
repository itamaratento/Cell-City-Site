# CELL CITY CRM
## ENGINEERING.md — Constituição do Projeto

**Versão:** 1.1

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

## Estratégia das IAs

### ChatGPT — CTO / Arquiteto-Chefe

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

Não desenvolve código. Não revisa releases. Seu trabalho é fazer toda a equipe produzir mais.

### Claude — Revisor Técnico Principal

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

### DeepSeek — Engenheiro de Desenvolvimento

Responsável por:

- Desenvolvimento
- Bugs
- Refatorações
- Performance
- Código morto
- Cobertura de testes
- Documentação técnica
- Commits na `develop`

Nunca promove para `main`.

## Fluxo oficial

```
ChatGPT
  ↓ define estratégia
Claude OU DeepSeek
  ↓ implementa Sprint
Commit em develop
  ↓
Claude
  ↓ revisão técnica + testes
develop → main
  ↓
Tag
  ↓
Release
```

## Utilização das IAs

Quando Claude estiver disponível: Claude é a IA principal.

Quando Claude atingir limite: DeepSeek assume o desenvolvimento.

Quando Claude retornar: revisa todo o trabalho realizado pelo DeepSeek.

**Somente Claude aprova releases.**

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
