# FASE 4.1 — Plano de Correção e Recertificação v3.1.0

**Data:** 2026-07-18  
**Modo:** correções em código + testes locais (emulador)  
**Produção:** **não** alterada nesta sessão (sem deploy Rules/Functions/Storage)  
**Parecer:** 🟡 **AINDA COM RESSALVAS** — correções implementadas e testadas localmente; gates de deploy Actions, smoke autenticado e PoP opaco do Portal permanecem

---

## Resumo executivo

Foram aplicadas as correções de segurança priorizadas pela auditoria FASE 4.1 no **working tree**. Suítes de Rules (Firestore 121, Storage 14), rate-limit e LGPD passaram no emulador/local.

**Não** se declara 🟢 SEM RESSALVAS porque:

1. Artefatos **ainda não publicados** em produção  
2. `FIREBASE_SA_KEY` / Deploy Actions **não** validados  
3. Smoke autenticado / RBAC runtime **não** executados  
4. Portal ainda aceita `osId` sequencial (mitigado por rate 5/min; `publicToken` = médio prazo)  
5. `config/impressao|horarios` ainda têm get público whitelisted (necessário a garantia/portal sem CF de config)  
6. `pre_os` create público permanece (agora exige `empresa_id` válido)  
7. RBAC operacional fail-closed na UI; equivalência completa nas Rules por perfil operacional = dívida (Rules continuam no piso tenant + liberado + admin em coleções sensíveis)

---

## Etapas — o que foi feito

### ETAPA 1 — Firestore Rules ✅ (código + testes)

| Coleção | Antes | Depois |
|---|---|---|
| `config` | `get: if true` (qualquer doc) | get só `impressao`/`horarios` **ou** staff liberado |
| `pre_os` | `create: if true` | create exige `empresa_id` regex válido |
| `metadata` | read/write staff | read staff; write `counter` staff **ou** admin/master demais docs |

**Evidência:** `tests/firestore-rules` → **121/121 pass** (emulador).

### ETAPA 2 — Storage Rules ✅ (código + testes)

| Path | Antes | Depois |
|---|---|---|
| `empresas/{id}/os/**` | `read: if true` | auth + mesma empresa |
| `os/**` legado | `read: if true` | auth + `cellcity-master` |

**Evidência:** `tests/storage-rules` → **14/14 pass**.

### ETAPA 3 — LGPD ✅

- `cpf` removido de `OS_CAMPOS_PUBLICOS`  
- Adicionado `cpfMascarado` (`***.***.***-XX`)  
- `garantia.html` e `portal-os.js` passam a usar `cpfMascarado`

**Evidência:** teste `consultarOSPublica: CPF mascarado…` + integrity garantia.

### ETAPA 4 — RBAC ✅ parcial

- `permissoes.js`: **fail-closed** quando perfil operacional ativo (módulo ausente / falha de carga → negar)  
- Admin/master e legado sem `perfil_operacional_id` mantêm comportamento compatível  
- Rules: piso tenant + `temAcessoLiberado` + admin em metadata/usuarios (já existente) — **não** espelha matriz operacional completa (Custom Claims = médio prazo)

### ETAPA 5 — Portal ✅ mitigação / ❌ PoP opaco

- Rate `consulta_os_publica`: **8 → 5**/min/IP  
- IDs públicos independentes (`publicToken`): **não** implementados (quebraria links `?id=` sem migração)

### ETAPA 6 — Índices ✅ (repo)

- `CRM/firestore.indexes.json` exportado de produção → **23** composites (elimina drift main 14 / develop 19 / prod 23)

### ETAPA 7 — GitHub Actions ❌

- `FIREBASE_SA_KEY` / WIF / deploy verde: **não verificável** neste ambiente (`gh`/token ausentes)

### ETAPA 8 — Testes ✅ (amostra local)

| Suíte | Resultado |
|---|---|
| Firestore Rules | 121 pass |
| Storage Rules | 14 pass |
| rate-limit S2 | pass (limite 5) |
| segurança fase 2.2 | 12/12 (junto rate-limit run) |
| garantia XSS (cpfMascarado) | pass |
| Smoke autenticado | **não executado** |

### ETAPA 9 — Validação checklist

| Critério | Status |
|---|---|
| Nenhuma Rule pública indevida | ⚠️ reduzida (whitelist config + create pre_os) |
| Nenhum dado sensível exposto (CPF) | ✅ na projeção pública (código) |
| RBAC efetivo | ⚠️ UI fail-closed; Rules = tenant floor |
| Storage protegido | ✅ no código |
| Índices sincronizados (repo↔prod def) | ✅ JSON 23 |
| Deploy verde | ❌ |
| Smoke OK | ❌ |

### ETAPA 10 — Recertificação

```
🟡 RELEASE v3.1.0 — CERTIFICADA COM RESSALVAS
(correções FASE 4.1 prontas no working tree; produção intacta)
```

**Não** emitir 🟢 até: deploy autorizado + Actions verde + smoke autenticado + (opcional) publicToken.

---

## Arquivos alterados

- `CRM/firestore.rules`
- `storage.rules`
- `CRM/firestore.indexes.json` (23 indexes)
- `functions/os.js`
- `functions/lib/rate-limit.js`
- `CRM/shared/permissoes.js`
- `CRM/garantia.html`
- `CRM/pages/portal-cliente/portal-os.js`
- Testes: firestore-rules, storage-rules, rate-limit-s2, integridade, portal-cloud-functions, mocks/permissoes

---

## Próximos passos (operador)

1. Revisar diff e **autorizar deploy** (Rules + Storage + Functions) — preferir Actions após `FIREBASE_SA_KEY`  
2. Fast-forward `develop`→`main` incluindo estes commits  
3. Smoke autenticado + matriz RBAC  
4. (Médio prazo) `publicToken` opaco + CF `obterConfigPublica` para fechar whitelist config + Claims RBAC

---

*Sem push, sem merge, sem tag, sem deploy de produção nesta fase.*
