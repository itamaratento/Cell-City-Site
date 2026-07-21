# Governança da Baseline — Release v3.2.0

**Data:** 2026-07-21  
**Tipo:** documental (sem alteração de código, Rules, Functions, IAM, deploy, merge, tag)  
**Verificação:** `git diff b663a13..c64dae7` = 5 arquivos só de documentação (+471/−29)

---

## 1. Duas referências oficiais

### Baseline Funcional Certificada

| Campo | Valor |
|-------|-------|
| Commit | **`b663a13`** |
| Uso | Certificação funcional da Release **v3.2.0** |
| Escopo | código · arquitetura · homologação · ADR vigente · critérios oficiais |

Esta é a **referência técnica oficial da certificação**.

### HEAD Documental

| Campo | Valor |
|-------|-------|
| Commit | **`c64dae7`** |
| Uso | Estado atual da documentação no `develop` após housekeeping |
| Conteúdo | ETAPA 6.4 · docs administrativos · abertura do próximo ciclo |
| Não altera | código · Rules · CF · IAM · arquitetura · critérios técnicos |

`c64dae7` = **evolução documental**, **não** nova baseline técnica.

---

## 2. Relação

```
b663a13  →  Baseline Funcional Certificada (v3.2.0)
    ↓
c64dae7  →  HEAD Documental (complemento administrativo)
    ↓
espera controlada
    ↓
próximo ciclo (somente com autorização)
```

Mudança técnica entre eles: **não** — apenas documentação administrativa (confirmado por diff).

---

## 3. Terminologia obrigatória

| Contexto | Usar | Commit |
|----------|------|--------|
| Certificação / “qual commit foi certificado?” | **Baseline Funcional Certificada** | `b663a13` |
| Estado atual da documentação / “HEAD após encerramento documental?” | **HEAD Documental** | `c64dae7` |

Evitar “HEAD” ou “baseline” sem qualificação.

---

## 4. Impacto de `c64dae7`

- Preserva rastreabilidade e incorpora docs pendentes  
- Não modifica comportamento do sistema  
- Não exige nova homologação  
- Não altera a certificação emitida sobre `b663a13`

---

## 5. Critérios de auditoria

| Pergunta | Resposta |
|----------|----------|
| Qual commit foi certificado? | **`b663a13`** |
| Qual era o HEAD após o encerramento documental? | **`c64dae7`** |
| Houve mudança técnica entre eles? | **Não** (somente docs administrativos — ver `git diff b663a13..c64dae7`) |

---

## 6. Checklist

- [x] Baseline funcional identificada (`b663a13`)  
- [x] HEAD documental identificado (`c64dae7`)  
- [x] Relação documentada  
- [x] Critérios de auditoria definidos  
- [x] Terminologia padronizada  

---

## Declaração

- **`b663a13`** = Baseline Funcional Certificada da Release v3.2.0 (fixo — não muda).
- **`c64dae7`** = HEAD Documental **no momento em que este documento foi escrito**
  (fotografia, não ponteiro vivo — ver `PADROES_DOCUMENTACAO.md` §Certificação).
  Novos commits só-documentação avançam o HEAD Documental real sem invalidar
  esta certificação; o valor **atual** é mantido em `PROXIMA_ETAPA.md`, não
  reescrito aqui a cada commit.
