# ETAPA 6.4 — Certificação final da Release v3.2.0

**Data:** 2026-07-21  
**Branch:** `develop` (tracking `origin/develop`)  
**Tag `v3.2.0`:** `d650464` · infra/deploy já em produção (Fase 4.3)  
**Modo:** certificação exclusivamente documental  
**Proibição desta etapa:** código · Rules · Functions · IAM · deploy · merge · tag · promoção

---

## Classificação oficial

```
🟡 HOMOLOGADA COM RESSALVAS
```

**Justificativa:** B1 e B2 resolvidos (6.2-A); B3 formalmente encerrado por
**ADR-AUTH-001 Alternativa A** (6.2-C); documentação sincronizada; critérios
oficiais da arquitetura adotada atendidos (UI = matriz; Rules = auth +
tenant/empresa + gates). Ressalvas = dívidas conscientes e limitações
documentadas (BL-011 residual, fail-open legado sem `perfil_operacional_id`,
BL-007/009/010) — **não** são defeitos da Release nem bloqueadores
incompatíveis com a ADR.

Não cabe 🔴: nenhum bloqueador permanece incompatível com a arquitetura oficial.  
Não cabe 🟢 absoluto: pendências conscientes explícitas na seção 7.

---

## 1. Resumo executivo

A Release **v3.2.0** está **homologada funcionalmente com ressalvas** sob o
modelo de autorização **Alternativa A**:

| Camada | Responsabilidade |
|--------|------------------|
| Firestore Rules | Autenticação + `temAcessoLiberado` + isolamento tenant/empresa + gates pontuais |
| Aplicação (`permissoes.js`) | Matriz RBAC operacional (visualizar/criar/editar/excluir/aprovar) |

Infraestrutura (deploy CI/WIF, Rules/Functions endurecidas, smoke DEV Etapa 5)
permanece 🟢 desde a Fase 4.3. A cadeia Etapas 6→6.3 mediu e fechou os
bloqueadores de homologação RBAC Runtime; a 6.2-C removeu o falso critério
“Rules devem espelhar a matriz”.

**Esta etapa não alterou produção, Rules, Functions nem código de produto.**

---

## 2. Premissas confirmadas

| Premissa | Status |
|----------|--------|
| ETAPA 6 executada | ✅ `evidencias/etapa6-rbac-runtime-20260721-084209/RELATORIO_ETAPA6.md` |
| ETAPA 6.1 concluída | ✅ `evidencias/etapa61-remediacao-20260721/RELATORIO_ETAPA61.md` |
| ETAPA 6.2-A concluída | ✅ `evidencias/etapa62a-remediacao-dev-20260721/RELATORIO_ETAPA62A.md` |
| ETAPA 6.2-C concluída | ✅ `evidencias/etapa62c-decisao-arquitetural-20260721/RELATORIO_ETAPA62C.md` + ADR |
| ETAPA 6.3 executada | ✅ `evidencias/etapa63-rbac-runtime-20260721/RELATORIO_ETAPA63.md` |
| ADR_AUTH_001 aprovada | ✅ `plans/ADR_AUTH_001_MODELO_AUTORIZACAO_20260721.md` (Status: ACEITO) |
| Deploy / Rules / Functions / push / tag nesta etapa | ✅ nenhum |
| Workspace produto limpo | ✅ só `CRM/git-info.json` + `health-check.json` (gerados; não são produto) |
| Pasta `evidencias/` | gitignored (artefatos locais de homologação) |

---

## 3. Cronologia das ETAPAS 6 → 6.3 (+ 6.2-C / 6.4)

| Etapa | Resultado histórico | Papel na certificação |
|-------|---------------------|------------------------|
| **6** | 🔴 REPROVADA (B1/B2/B3) | Mediu o gap Rules×matriz e gaps de seed |
| **6.1** | 🟡 Diagnóstico | Pacotes 6.2-A / 6.2-B / 6.2-C; BL-011 registrado |
| **6.2-A** | 🟢 Dados DEV | Sem permissão + Gerente operacional |
| **6.3** | 🟡 B1/B2 OK; B3 ainda aberto *na época* | Confirmou seed; reproduziu B3 (restrito create/delete `os`) |
| **6.2-C** | 🟢 Alternativa A | B3 → decisão arquitetural; BL-011 → dívida consciente |
| **6.4** | 🟡 Homologada com ressalvas | Parecer único final desta cadeia |

> Nota: o veredito literal de `RELATORIO_ETAPA63.md` (“ETAPA 6 AINDA NÃO
> APROVADA”) é **evidência histórica pré-6.2-C**. Após ADR-AUTH-001, os
> critérios oficiais mudam: B3 deixa de ser critério de reprovação.

---

## 4. Bloqueadores tratados

### B1 — Usuário “Sem permissão” → ☑ RESOLVIDO

| Check | Evidência |
|-------|-----------|
| Perfil criado | `perfis_operacionais/sem_permissao`, matriz toda `false` (6.2-A / 6.3) |
| Usuário criado | `cellcityrestrito@gmail.com` → `perfil_operacional_id=sem_permissao` |
| Matriz restritiva | `matriz_any_true=false` confirmado na 6.3 |

### B2 — Perfil Gerente → ☑ RESOLVIDO

| Check | Evidência |
|-------|-----------|
| Perfil operacional | `perfis_operacionais/gerente` |
| Vínculo | `cellcitygerente@gmail.com` → `perfil_operacional_id=gerente` |
| Login válido | ✅ Etapa 6.3 (browser DEV) |

### B3 — Rules × Matriz → ☑ ENCERRADO POR DECISÃO ARQUITETURAL

| Check | Evidência |
|-------|-----------|
| Comportamento reproduzido | 6 / 6.3: staff autenticado da empresa pode create/delete `os` via SDK apesar da matriz |
| ADR publicada | ADR-AUTH-001 Alternativa A |
| Decisão registrada | TECHDOC §50 · PROXIMA · BACKLOG · CERTIFICACAO_ETAPA63 §13 |
| BL-011 | 🟡 dívida técnica consciente (não bug bloqueador) |

---

## 5. Decisão arquitetural

**ADR-AUTH-001 — Alternativa A (ACEITO)**

```
Firestore Rules  =  Auth + Tenant/Empresa (+ gates pontuais)
RBAC operacional   =  Aplicação (CRM/shared/permissoes.js)
```

Orientação permanente para implementações futuras. ETAPA **6.2-B**
(rewrite Rules com matriz) **não** está aberta.

---

## 6. Consistência documental

| Artefato | Alinha a Alternativa A? |
|----------|-------------------------|
| ADR_AUTH_001 | ✅ fonte de verdade |
| TECHDOC §49 / §50 | ✅ |
| PROXIMA_ETAPA.md | ✅ |
| BACKLOG BL-011 | ✅ dívida consciente |
| CERTIFICACAO_ETAPA63 (+ §13) | ✅ adendo 6.2-C |
| RELATORIO_ETAPA62C | ✅ |
| RELATORIO_ETAPA6 / 61 / 63 | ✅ evidência histórica (vereditos pré-ADR preservados) |

**Conflitos residuais de leitura (não de decisão):** trechos históricos em
relatórios 6/6.3 ainda chamam B3 de bloqueador — corretos *na data*;
supersedidos por 6.2-C/6.4. Não há segunda decisão concorrente (B ou híbrido).

---

## 7. Matriz de conformidade (critérios oficiais pós-ADR)

| Critério | Status | Base |
|----------|--------|------|
| UI aplica a matriz RBAC | ☑ | `permissoes.js` + gates; fail-closed com perfil operacional ativo |
| Rules aplicam autenticação | ☑ | `request.auth != null` |
| Rules aplicam isolamento tenant/empresa | ☑ | `mesmaEmpresa*` / helpers |
| Gates obrigatórios ativos | ☑ | `temAcessoLiberado`, admin em usuarios/perfis, whitelist config, etc. |
| Arquitetura = ADR | ☑ | Alternativa A |

**Fora do critério oficial (proposital):** Rules **não** precisam espelhar a
matriz `perfis_operacionais`.

---

## 8. Evidências utilizadas

1. `evidencias/etapa6-rbac-runtime-20260721-084209/RELATORIO_ETAPA6.md`
2. `evidencias/etapa61-remediacao-20260721/RELATORIO_ETAPA61.md`
3. `evidencias/etapa62a-remediacao-dev-20260721/RELATORIO_ETAPA62A.md`
4. `evidencias/etapa62c-decisao-arquitetural-20260721/RELATORIO_ETAPA62C.md`
5. `evidencias/etapa63-rbac-runtime-20260721/RELATORIO_ETAPA63.md`
6. `plans/ADR_AUTH_001_MODELO_AUTORIZACAO_20260721.md`
7. `plans/CERTIFICACAO_ETAPA63_HOMOLOGACAO_FUNCIONAL_20260721.md`
8. `PROXIMA_ETAPA.md` · `CRM/TECHDOC.md` §49–§50 · `plans/BACKLOG.md` (BL-011)
9. Leitura pontual de `CRM/firestore.rules` e `CRM/shared/permissoes.js` (conformidade)

Smoke DEV (Etapa 5) e Fase 4.3 permanecem como base de infra (fora do
escopo re-executado nesta 6.4).

---

## 9. Pendências remanescentes (não são defeitos da v3.2.0)

| Item | Natureza |
|------|----------|
| **BL-011** | Dívida consciente — residual SDK vs UI |
| Legado sem `perfil_operacional_id` | Fail-open de matriz na UI (compatibilidade) — migrar gradualmente |
| Validação visual completa “Sem permissão” | Browser flaky na 6.3; dados/Firestore OK |
| **BL-007** nodejs22 | Prazo 2026-10-30; CF |
| **BL-009** Storage/Blaze | Decisão administrativa |
| **BL-010** ruleset GitHub backup | Ação manual do dono |

---

## 10. Riscos residuais (aceitados sob Alternativa A)

- Staff autenticado da mesma empresa com cliente adulterado pode operar além
  da matriz via SDK — mitigado por contas controladas, `perfil!=pendente`,
  tenant e gates admin.
- Contas legadas sem perfil operacional: UI fail-open de matriz.
- Evolução B/híbrido (6.2-B) só com autorização explícita de Rules.

---

## 11. Recomendação técnica

1. Tratar a **v3.2.0** como **homologada com ressalvas** sob ADR-AUTH-001.  
2. Não abrir 6.2-B sem necessidade de negócio e autorização de Rules.  
3. Migrar gradualmente usuários legados para `perfil_operacional_id`.  
4. Seguir com BL-007 / BL-009 / BL-010 em processos próprios.  
5. Qualquer promoção/deploy adicional = processo separado com autorização
   do proprietário.

---

## 12. Checklist final

- [x] ETAPA 6 concluída (executada; veredito histórico 🔴; critérios reclassificados)
- [x] ETAPA 6.1 concluída
- [x] ETAPA 6.2-A concluída
- [x] ETAPA 6.2-C concluída
- [x] ETAPA 6.3 concluída (executada; supersedida em critério pela 6.2-C)
- [x] ADR publicada
- [x] TECHDOC atualizado (§51 ponteiro desta certificação)
- [x] PROXIMA_ETAPA atualizado
- [x] BACKLOG atualizado (BL-011 já 🟡)
- [x] Certificação emitida (este documento)

---

## 13. Encerramento

```
🟢 ETAPA 6.4 CONCLUÍDA
CLASSIFICAÇÃO RELEASE v3.2.0: 🟡 HOMOLOGADA COM RESSALVAS
ARQUITETURA: ADR-AUTH-001 Alternativa A
```

**Nenhuma ação de deploy, merge, tag, alteração de Rules, Cloud Functions,
IAM ou produção foi executada ou autorizada por este documento.**
