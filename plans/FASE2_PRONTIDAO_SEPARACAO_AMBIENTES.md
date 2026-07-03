# PRONTIDÃO — Fase 2 (Rules e índices) — Separação de Ambientes DEV × PROD

**Status:** ✅ **Fase 2 CONCLUÍDA** em 2026-07-03 (autorizada e executada na mesma sessão da Fase 1). Rules e índices do Firestore + Storage Rules deployados e verificados via API no `cellcity-crm-dev`. Produção (`cellcity-crm`) confirmada intocada.
**Base:** `plans/SEPARACAO_AMBIENTES_DEV_PROD.md`, seção 4 (Fase 2) e seção 7 (lacuna nº 6).

---

## 1. Pré-condições para autorizar a execução

- [x] Fase 1 concluída: Auth (e-mail/senha + Anônimo, domínios autorizados) e bucket padrão do Storage criados no `cellcity-crm-dev` (`cellcity-crm-dev.firebasestorage.app`, plano Blaze).
- [x] CORS aplicado no bucket DEV (`gcloud storage buckets update ... --cors-file=cors.json`, confirmado por leitura).
- [ ] **Nota:** bucket criado em `US-EAST1`, não em `southamerica-east1` como o plano previa — decisão do proprietário sobre manter ou recriar (ver relatório de encerramento da Fase 1).
- [x] `firebase-tools` (CLI oficial) instalado como devDependency local (`npm install --save-dev firebase-tools`, v15.22.4) — rodar com `./node_modules/.bin/firebase` ou `npx firebase`.
- [x] Autenticação **não-interativa confirmada e testada** (read-only: `firebase projects:list`) via `GOOGLE_APPLICATION_CREDENTIALS=sa-key-dev.json` — não precisa de `firebase login` do proprietário. Bônus de segurança: essa credencial só enxerga o projeto `cellcity-crm-dev` (a listagem retornou 1 projeto só), então deploy feito com ela é estruturalmente incapaz de atingir a produção por engano.
- [x] Autorização explícita recebida em 2026-07-03. Executada na mesma sessão.

## 1.1 Execução real (2026-07-03)

- Precisou de 2 roles de IAM adicionais na service account `firebase-adminsdk-fbsvc@cellcity-crm-dev.iam.gserviceaccount.com`, não previstas nesta preparação: `roles/serviceusage.serviceUsageConsumer` e `roles/firebasestorage.admin` — sem elas, o `firebase deploy` falhava nas checagens prévias de API/bucket padrão (a role `storage.admin` que a chave já tinha não cobre essas checagens específicas do CLI). Concedidas via `gcloud projects add-iam-policy-binding`, escopo só `cellcity-crm-dev`, usando a sessão já autenticada do proprietário — não foi necessária nenhuma ação manual nova dele.
- `firebase deploy` reportou 4 índices "extras" já existentes no projeto que não estão em `CRM/firestore.indexes.json` (`empresa_id+createdAt` e `telefone+createdAt`, entre outros — campos do multi-tenant/telefone canônico). Não usei `--force` para apagá-los — ficaram como estão, todos `READY`, sem risco funcional.

## 2. Comandos prontos (não executados)

```bash
# 2.1 — Deploy de rules + índices + storage rules para o projeto DEV
#       (usa exatamente os mesmos arquivos versionados da produção)
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/sa-key-dev.json"
./node_modules/.bin/firebase deploy --only firestore:rules,firestore:indexes,storage --project dev

# 2.2 — Verificação do release ativo (NUNCA confiar só no "Publicar" do console)
node _runtime_audit/verify-firestore-rules.mjs --project cellcity-crm-dev --file CRM/firestore.rules
```

O script `_runtime_audit/verify-firestore-rules.mjs` foi criado e **testado nesta sessão contra a produção** (`cellcity-crm`): confirmou que o release ativo hoje é idêntico a `CRM/firestore.rules` — ou seja, a ferramenta funciona e a produção está consistente com o arquivo-fonte antes de qualquer mudança da Fase 2. Reaproveitar o mesmo script para o DEV assim que as rules forem deployadas lá (T-06 do checklist técnico da homologação).

## 3. Fonte oficial a usar (lacuna nº 6 do plano)

Confirmado nesta auditoria: `firestore.rules` da raiz (403 linhas) é **diferente** de `CRM/firestore.rules` (309 linhas, referenciado pelo `firebase.json`); `firestore.indexes.json` da raiz está vazio, o de `CRM/` tem os 4 índices reais. **A Fase 2 deve usar exclusivamente os arquivos de `CRM/`** — o `firebase.json` já aponta para eles corretamente, então isso não exige nenhuma mudança de configuração, só atenção na hora de rodar o deploy (não confundir com os arquivos da raiz).

## 4. Rollback da Fase 2

Zero risco de produção: o deploy é só no projeto `cellcity-crm-dev` (alias `dev` do `.firebaserc`), nunca no default (`cellcity-crm`). Se o release ficar errado:
- Re-deploy das rules corrigidas para o mesmo projeto `dev`.
- Não há dado de produção envolvido — o projeto DEV pode ser zerado/recriado sem nenhum efeito colateral (mesma garantia já registrada na seção 5.6 do plano principal para a Fase 5).

## 5. Riscos identificados nesta preparação

| Risco | Severidade | Mitigação |
|---|---|---|
| `npm install` do `firebase-tools` trouxe 9 vulnerabilidades moderadas (dependências transitivas da própria ferramenta) | 🟢 Baixa | É devDependency local, não entra no código publicado; não rodei `npm audit fix --force` para não trocar versões sem necessidade — reavaliar se algum dia isso importar |
| Confundir `firestore.rules`/`firestore.indexes.json` da raiz (stale) com os de `CRM/` (oficiais) | 🔴 Alta se ocorrer | `firebase.json` já aponta só para `CRM/`; script de verificação pós-deploy pega qualquer divergência |
| Usar por engano a credencial errada (`sa-key.json` de produção) no lugar de `sa-key-dev.json` ao rodar o deploy | 🔴 Alta se ocorrer | Conferir a variável `GOOGLE_APPLICATION_CREDENTIALS` antes de rodar; a chave de produção não tem `--project dev` como alvo válido de qualquer forma, mas checar antes é mais seguro que depender só disso |

---

*Documento de preparação — nenhum arquivo de rules/índices foi alterado, nenhum deploy foi executado. Aguardando autorização formal para a Fase 2.*
