# FASE 4.2 — Relatório de execução autorizada (commit/push/WIF)

**Data:** 2026-07-18  
**Parecer:** 🟡 **CERTIFICADA COM RESSALVAS** (deploy em `main`/produção ainda pendente)

---

## Commit

| Campo | Valor |
|-------|-------|
| Hash completo | `76335582650bf4c3e5652c5a9957b3add05c6a1f` |
| Hash curto | `7633558` |
| Mensagem | `fix(security): FASE 4.1/4.2 — Rules, Storage, LGPD, RBAC fail-closed` |
| Arquivos | **25** (+1879 / −111) |

### Arquivos alterados (resumo)

**Código:** `CRM/firestore.rules`, `storage.rules`, `functions/os.js`, `functions/lib/rate-limit.js`, `CRM/shared/permissoes.js`, `CRM/garantia.html`, `CRM/pages/portal-cliente/portal-os.js`  

**Testes:** firestore-rules, storage-rules, portal-cloud-functions, rate-limit-s2, integridade, mocks/permissoes  

**Docs:** CHANGELOG, PROXIMA_ETAPA, 9 plans de certificação/execução FASE 4.x  

**Resumo:** fecha leituras públicas indevidas; CPF → `cpfMascarado`; RBAC fail-closed; rate OS 5/min.

---

## Push `origin/develop`

| Campo | Valor |
|-------|-------|
| Range | `f445973..7633558` |
| Hash enviado | `7633558` |
| Branch sync | `develop` = `origin/develop` (após push) |
| Tip atual | `7b4cabb` (commit seguinte no remoto: ajuste Control Center `if true` 3→1) — **inclui** `7633558` como ancestral |

### GitHub Actions (`develop`)

| Run | SHA | Resultado |
|-----|-----|-----------|
| Testes `29653662064` | `7633558` | ❌ failure (Control Center contagem `if true`) |
| Pages `29653662072` | `7633558` | ✅ success |
| Deploy Firebase | `7633558` | skipped (gate main-only — correto) |
| Testes `29653898175` | `7b4cabb` | ✅ success (fix do contador) |
| Pages `29653898171` | `7b4cabb` | ✅ success |

---

## WIF (`wif-conceder-papeis.sh`)

| Resultado | ✅ **EXIT 0** |
|-----------|----------------|

### Papéis concedidos à SA `github-deploy@cellcity-crm.iam.gserviceaccount.com`

1. `roles/firebase.admin`  
2. `roles/cloudfunctions.admin`  
3. `roles/iam.serviceAccountUser`  
4. `roles/serviceusage.serviceUsageConsumer`  
5. `roles/iam.workloadIdentityUser` no principalSet  
   `…/workloadIdentityPools/github/attribute.repository/itamaratento/Cell-City-Site`

Validação pós-script: 4 roles no projeto + binding `workloadIdentityUser` na SA — **OK**.

---

## Deploy via pipeline / produção

| Item | Status |
|------|--------|
| Fast-forward + push `main` | ❌ **Bloqueado pelo Auto-review** (destino protegido); card de aprovação falhou duas vezes |
| Deploy Firebase Actions em produção | ❌ não disparado (exige push/`workflow_dispatch` na `main`) |
| Rules/Storage CONTENT_MATCH local↔prod | ❌ **False** (correções ainda não publicadas) |
| Smoke autenticado | ❌ sem credencial admin |

**Para concluir o deploy:** autorizar explicitamente (ou aprovar no card)  
`git checkout main && git merge --ff-only origin/develop && git push origin main`  
(isso dispara o workflow Deploy Firebase com WIF já configurado).

---

## Critério de encerramento

```
🟡 RELEASE v3.1.0 — CERTIFICADA COM RESSALVAS
```

Ainda faltam evidências de: deploy produção + pipeline deploy verde + smoke autenticado.

---

*Commit e push develop + WIF concluídos com evidência. Deploy main pendente de autorização operacional no ambiente.*
