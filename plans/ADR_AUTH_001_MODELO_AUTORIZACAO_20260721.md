# ADR — Modelo de autorização CELL CITY CRM

**ID:** ADR-AUTH-001  
**Etapa:** 6.2-C  
**Data:** 2026-07-21  
**Release:** v3.2.0  
**Status:** **ACEITO**  
**Escopo desta etapa:** documentação apenas (sem Rules, Functions, IAM, deploy, merge, tag)

---

## 1. Decisão oficial

```
☑ ALTERNATIVA A

Firestore Rules  =  Autenticação + Tenant/Empresa (+ gates pontuais)
RBAC operacional (matriz)  =  Camada da aplicação (UI / módulos)
```

**Interpretação do pedido “ETAPA 6.2-C”:** formaliza o pacote de remediação
6.2-C da ETAPA 6.1 (= aceite do modelo já em produção), correspondente à
**Alternativa A** deste script — **não** ao “híbrido” rotulado como
Alternativa C na tabela comparativa abaixo.

---

## 2. Arquitetura atual (confirmada)

```
Cliente autenticado
        │
        ▼
┌───────────────────────────┐
│ Firestore Rules           │
│ • request.auth            │
│ • temAcessoLiberado()     │  (perfil != pendente)
│ • mesmaEmpresa* / tenant  │
│ • gates pontuais          │  (admin em usuarios/perfis,
│                           │   config whitelist, OS get fechado,
│                           │   auditoria imutável, etc.)
└───────────┬───────────────┘
            │ permite ops de dados da empresa
            ▼
┌───────────────────────────┐
│ Aplicação (CRM)           │
│ permissoes.js + gates UI  │
│ matriz perfis_operacionais│
│ visualizar/criar/editar/  │
│ excluir/aprovar           │
└───────────────────────────┘
```

Fonte de verdade UI: `CRM/shared/permissoes.js` (controla **exibição/ação**).  
Barreira de dados: `CRM/firestore.rules` (auth + não-pendente + tenant).

---

## 3. Avaliação das alternativas

| Critério | A — Rules=Tenant/Auth · RBAC=App | B — Rules=RBAC completo | C — Híbrido |
|----------|----------------------------------|-------------------------|-------------|
| Segurança | Adequada a staff autenticado/controlado; residual se cliente for adulterado | Defesa em profundidade | Intermediária |
| Performance / custo Firestore | Melhor (menos `get` em Rules) | Pior (lê perfil+matriz por op) | Médio |
| Manutenção | Simples; matriz só no app | Alta (duplicar matriz em Rules) | Média (definir “crítico”) |
| Escalabilidade SaaS | Boa (tenant já nas Rules) | Risco de ruleset enorme | Boa se bem delimitado |
| Complexidade | Baixa | Alta | Média |
| DX / homologação | Critérios UI+tenant | Suíte Rules×perfil obrigatória | Critérios mistos |
| Compatibilidade atual | **Já é o modelo** | Exigiria rewrite (BL-011/6.2-B) | Exigiria inventário “crítico” |
| Impacto Rules | Nenhum agora | Grande (autorização CLAUDE §1) | Médio |

---

## 4. Justificativa

1. O produto é CRM **interno / staff autenticado**, multiempresa por `empresa_id`, não marketplace aberto.  
2. O código e o TECHDOC já descrevem a matriz como UI e as Rules como barreira auth+tenant (`permissoes.js` linhas 7–8).  
3. A ETAPA 6 mediu B3 pela primeira vez; **não é regressão v3.2.0** — é o modelo desde a Fase 2.  
4. Adotar B agora implica projeto de Rules (BL-011), risco alto de regressão e autorização explícita — fora do escopo desta etapa.  
5. Híbrido (Alternativa C da tabela) fica como **evolução opcional futura**, não como padrão vigente.

---

## 5. Consequências oficiais

### B3 / BL-011

| Antes | Depois |
|-------|--------|
| Tratado como bug bloqueador da ETAPA 6 | **Decisão arquitetural documentada** |
| “Rules devem espelhar matriz” | **Não** é critério de aceite da ETAPA 6 |

BL-011 passa a: **dívida consciente / evolução opcional** (se no futuro o dono autorizar Alternativa B ou híbrido).

### Critérios da ETAPA 6 (reclassificação)

A ETAPA 6 / 6.3 considera-se **aprovável** quando:

1. ✅ Smoke DEV (ETAPA 5)  
2. ✅ Dados de homologação (6.2-A): Sem permissão + Gerente vinculado  
3. ✅ Login dos 6 perfis no DEV com `projectId=cellcity-crm-dev`  
4. ✅ UI respeita matriz (fail-closed com perfil operacional ativo)  
5. ✅ Rules: auth + tenant + `temAcessoLiberado` (probes de list sem empresa negam; isolamento ok)  
6. ❌ **Não exigir** que create/delete de `os` etc. sejam negados só pela matriz nas Rules  

Residual aceito: cliente adulterado com token válido de staff da empresa pode chamar o SDK além do que a UI mostra — mitigado por contas controladas, sem `pendente`, tenant, e gates admin nas coleções sensíveis.

### O que esta etapa **não** faz

- Não altera `firestore.rules`, Functions, IAM, código de produto.  
- Não inicia ETAPA 6.2-B.  
- Não faz deploy/merge/tag.

---

## 6. Riscos aceitos

| Risco | Mitigação vigente |
|-------|-------------------|
| Bypass de UI via SDK | Staff controlado; `perfil!=pendente`; tenant; Rules admin em usuarios/perfis |
| Legado sem `perfil_operacional_id` (fail-open UI) | Dívida documentada; Gerente já migrado (6.2-A); migrar restantes gradualmente |
| Confusão em homologação futura | Este ADR + TECHDOC §50 + critérios ETAPA 6 acima |

---

## 7. Plano de implementação

**Nenhum** nesta etapa.

Se no futuro o dono escolher B ou híbrido: abrir ETAPA 6.2-B / inventário híbrido sob autorização de Rules.

---

## 8. Checklist

- [x] Arquitetura atual documentada  
- [x] Alternativas avaliadas  
- [x] Decisão registrada (**A**)  
- [x] Critério oficial ETAPA 6 definido  
- [x] Documentação a sincronizar (TECHDOC, PROXIMA_ETAPA, BACKLOG BL-011)  

---

## 9. Encerramento

```
🟢 ETAPA 6.2-C CONCLUÍDA
DECISÃO: ALTERNATIVA A
B3 = DECISÃO ARQUITETURAL (não bug)
```
