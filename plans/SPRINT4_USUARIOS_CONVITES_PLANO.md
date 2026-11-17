# Sprint 4 — Usuários e Convites · PLANO FASE 0 (Arquitetura e Escopo)

**Data:** 2026-07-27  
**Status:** ✅ **F0 APROVADA** (decisões de produto registradas) — **NÃO IMPLEMENTAR** até autorização explícita das fases F1+ (Rules / Cloud Functions / UI)  
**Série operacional:** S1 Fundação → S2 Cadastro → S3 Polish Wizard → **S4 Usuários/Convites**  
**Não confundir com:** Sprint 4 SaaS legada (aprovação de empresas) nem Sprint 4 RBAC Financeiro

**Baseline:** `60242ac` / `9b11e82` · ambiente estável

---

## Decisões aprovadas (F0) — fonte de verdade

| # | Decisão |
|---|--------|
| D1 | **Remover** o fluxo de criação de usuário baseado em **senha temporária** (UI + Auth secundário create-with-temp-password no módulo de usuários). |
| D2 | Adotar **convite por link único** com **token**. |
| D3 | **Não** enviar senhas por e-mail. |
| D4 | Somente usuários autorizados pelo RBAC (**Owner/Admin**) podem convidar. No modelo Cell City: kernel `admin` ou `master_admin` (gate alinhado ao módulo `usuarios-permissoes` atual). |
| D5 | Token com expiração de **7 dias**. |
| D6 | **Reenvio** gera **novo token** e **invalida** o anterior. |
| D7 | Token de **uso único**. |
| D8 | Perfil RBAC (`perfil` kernel + `perfil_operacional_id`) é aplicado **somente após** a conclusão do cadastro (aceite). |
| D9 | **Todos** os eventos de convite são registrados na **auditoria**. |

### Decisões derivadas (F0, para fechar ambiguidade sem reabrir produto)

| # | Derivação |
|---|-----------|
| D10 | **MVP de entrega do link:** o link é exibido **uma vez** na UI ao admin (copiar). Envio automático de e-mail do *link* (nunca senha) fica **fora** desta sprint salvo autorização posterior de provedor. |
| D11 | O convidado **define a própria senha** no cadastro (Auth). Nenhum caminho reintroduz senha gerada pelo sistema enviada ao usuário. |
| D12 | Aprovação SaaS (`saas-admin` → 1º admin da empresa) **não** é removida nesta sprint; é fluxo de plataforma distinto. Se ainda usar senha temp na aprovação, documentar como residual/fora do escopo S4 módulo tenant — mudança só com auth explícita. |
| D13 | Seats por plano (`saas-planos`): **fora** do escopo mínimo S4 (débito consciente). |

---

## 1. Objetivos

1. Substituir o create-com-senha-temp em `usuarios-permissoes` por **convites**.
2. Permitir que Admin/Owner convide colaboradores por **link+token** (7 dias, one-shot, reenvio invalida anterior).
3. Convidado completa cadastro (Auth + dados básicos); só então recebe `empresa_id` + papéis RBAC.
4. Garantir isolamento multiempresa e **não** regressão BL-006 (self não escala privilégio).
5. Auditar criar / reenviar / cancelar / aceitar / falhas / expiração observada.
6. UX: lista de convites, status, copiar link, reenviar, cancelar; página de aceite clara.

---

## 2. Arquitetura

```
┌─────────────────────┐     onCall (auth admin)      ┌──────────────────┐
│ usuarios-permissoes │ ───────────────────────────► │ Cloud Functions  │
│ (Admin/Owner only)  │   criar / reenviar / cancelar│ Admin SDK        │
└──────────┬──────────┘                              └────────┬─────────┘
           │ lista (tenant)                                    │
           ▼                                                   ▼
┌─────────────────────┐                              ┌──────────────────┐
│ Firestore           │◄─────────────────────────────│ convites/{id}    │
│ auditoria_usuarios_ │   writes server-side         │ (hash do token,  │
│ permissoes          │                              │  status, TTL)    │
└─────────────────────┘                              └────────┬─────────┘
                                                              │
     Link: /aceitar-convite?t=<token>                         │
┌─────────────────────┐     onCall (auth convidado)           │
│ Página aceite (MPA) │ ─────────────────────────────────────►│ aceitarConvite
│ cadastro Auth       │   token + uid; aplica RBAC só no fim  │
└─────────────────────┘                              └──────────────────┘
```

**Princípios:**

- Client **nunca** grava `perfil` / `perfil_operacional_id` / `empresa_id` / `status` privilegiado no aceite (BL-006).
- Redeem e mutações de status do convite: **somente** Cloud Functions (Admin SDK).
- Token em claro só na URL / clipboard do admin; no Firestore armazenar **hash** (ex. SHA-256) + `token_prefix` curto para suporte.
- ADR-AUTH-001 mantido: Rules = auth + tenant; matriz operacional continua em `permissoes.js`.

---

## 3. Fluxo completo

### 3.1 Criar convite (Admin/Owner)

1. Admin abre `usuarios-permissoes` → Convites → Novo.
2. Informa e-mail + `perfil_operacional_id` alvo (+ nome opcional).
3. Client chama CF `criarConvite`.
4. CF valida caller (`admin`/`master_admin`, mesma `empresa_id` salvo master).
5. CF gera token CSPRNG; grava `convites/{id}` com hash, `status: pendente`, `expira_em = now+7d`.
6. CF audita `convite_criado`.
7. CF devolve `{ conviteId, link, expiraEm }` — UI mostra link **uma vez** + botão copiar.
8. **Removido:** `criarContaSecundaria` + modal de senha temp neste fluxo.

### 3.2 Reenviar

1. Admin aciona Reenviar no convite `pendente` (não expirado ou mesmo expirado — product: permitir reenvio de expirado gerando novo token).
2. CF `reenviarConvite`: marca anterior `status: substituido` (ou `cancelado` com motivo `substituido`); cria novo doc **ou** rotaciona hash no mesmo id (preferência: **novo doc** + `substitui_convite_id` para auditoria clara).
3. Audita `convite_reenviado` (referencia antigo + novo).
4. Devolve novo link uma vez.

### 3.3 Cancelar

1. CF `cancelarConvite` → `status: cancelado`; audita `convite_cancelado`.

### 3.4 Aceite / cadastro

1. Convidado abre link com `t=<token>`.
2. Página valida via CF `consultarConvitePublico` (só metadados: e-mail mascarado, empresa nome fantasia, validade — **sem** dados sensíveis) **ou** valida só no `aceitarConvite`.
3. Se sem Auth: formulário nome + senha (≥ política) → `createUserWithEmailAndPassword` **na própria sessão do convidado** (e-mail deve bater com o convite).
4. Se Auth existente com mesmo e-mail: login e seguir.
5. Com sessão, chama `aceitarConvite({ token })`.
6. CF: hash token → localiza convite `pendente` → checa TTL → checa e-mail Auth == e-mail convite → aplica `usuarios/{uid}` (`empresa_id`, `perfil`, `perfil_operacional_id`, `status: ativo`) → marca convite `aceito` → audita `convite_aceito`.
7. Se Kernel já criou doc `pendente`+`cellcity-master`, CF **atualiza** com Admin SDK (único caminho seguro).
8. Só após passo 6 o RBAC efetivo libera módulos (`temAcessoLiberado` + matriz).

### 3.5 Expiração

- Leitura/listagem: client ou CF trata `expira_em < now` como expirado (UI).
- Aceite após TTL: CF rejeita; opcional job/lazy mark `expirado` + audit `convite_expirado_observado`.

---

## 4. Modelo de dados

### Convite (lógico)

| Campo | Tipo | Notas |
|-------|------|-------|
| `empresa_id` | string | Tenant |
| `email` | string | Normalizado lower-case |
| `email_normalizado` | string | Idempotente para queries |
| `token_hash` | string | SHA-256 (hex) do token |
| `token_prefix` | string | 6–8 chars para suporte (não secreto sozinho) |
| `status` | string | `pendente` \| `aceito` \| `expirado` \| `cancelado` \| `substituido` |
| `perfil_operacional_id` | string | Aplicado **só** no aceite |
| `perfil_kernel` | string | Derivado (`kernelPerfilPara`) no aceite |
| `criado_por` | uid | Admin |
| `criado_em` | timestamp | |
| `expira_em` | timestamp | criado + 7 dias |
| `aceito_em` | timestamp? | |
| `aceito_por_uid` | uid? | |
| `substitui_convite_id` | id? | No novo, após reenvio |
| `substituido_por_id` | id? | No antigo |
| `motivo_cancelamento` | string? | |

### Token

- Entropia: ≥ 32 bytes CSPRNG, encoding URL-safe.
- Nunca logar token completo; nunca retornar token em listagens.

### Eventos de auditoria (mínimo)

`convite_criado` · `convite_reenviado` · `convite_cancelado` · `convite_aceito` · `convite_aceite_falhou` · `convite_expirado_observado`

Coleção: `auditoria_usuarios_permissoes` (já existente; mesmo padrão do módulo).

---

## 5. Coleções Firestore

| Coleção | Uso S4 |
|---------|--------|
| **`convites/{conviteId}`** | **Nova** — ciclo de vida do convite |
| `usuarios/{uid}` | Atualizado no aceite (Admin SDK) |
| `perfis_operacionais/{id}` | Leitura do perfil alvo (já existe) |
| `auditoria_usuarios_permissoes/{id}` | Eventos (já existe) |
| `empresas/{id}` | Nome fantasia no aceite (leitura CF) |

**Não criar** índice de e-mail global tipo SaaS salvo necessidade futura de unicidade cross-tenant.

---

## 6. Cloud Functions necessárias

| Função | Auth | Responsabilidade |
|--------|------|------------------|
| `criarConvite` | Admin/Owner tenant | Cria doc + hash; retorna link; audita |
| `reenviarConvite` | Admin/Owner | Invalida anterior; novo token; audita |
| `cancelarConvite` | Admin/Owner | Cancela; audita |
| `aceitarConvite` | Usuário autenticado (convidado) | Valida token one-shot/TTL/e-mail; provisiona RBAC; audita |
| `consultarConviteMeta` (opcional) | Público autenticado ou unauth limitado | Metadados seguros para UI pré-cadastro |

Reuso de padrão: `excluirUsuarioAdmin` (`functions/admin.js`) — mesma região Gen2, validação perfil, tenant.

**Remover/desativar no client (fase UI):** caminho `criarContaSecundaria` + senha temp em `usuarios-permissoes.js` (D1).  
`firebase-secondary.js` do módulo pode permanecer se ainda usado para **reset de senha** do admin sobre usuários existentes — auditar call sites antes de apagar o arquivo.

---

## 7. Alterações de Firestore Rules

**Autorização obrigatória antes de editar `CRM/firestore.rules`.**

### Novo bloco (intenção)

```
match /convites/{id} {
  allow read: if autenticado &&
    (isMasterAdmin() || (admin && mesmaEmpresa(resource.data.empresa_id)));
  allow create, update, delete: if false; // só Admin SDK (CF)
}
```

Listagem tenant: preferir queries CF **ou** read liberado a admin da empresa com `empresa_id` no doc + `limit` (cota).

### `usuarios/{uid}`

- **Não** relaxar BL-006.
- Aceite **não** depende de update client do invitee nos campos privilegiados.

### Testes emulador obrigatórios antes de deploy DEV

- Admin A lê convites da empresa A; B negado.
- Client não create/update/delete `convites`.
- Regressão BL-006 self-update.

---

## 8. Alterações de índices

Provável em `CRM/firestore.indexes.json`:

| Coleção | Campos | Uso |
|---------|--------|-----|
| `convites` | `empresa_id` ASC, `status` ASC, `criado_em` DESC | Lista admin |
| `convites` | `empresa_id` ASC, `email_normalizado` ASC, `status` ASC | Evitar duplicata pendente mesmo e-mail |
| `convites` | `token_hash` ASC | Lookup CF no aceite (se query; alternativa: docId derivado) |

**Alternativa de lookup:** docId = prefix estável + não usar query por hash (CF `collectionGroup` ou campo indexado). Preferir **query por `token_hash`** com índice single-field (auto) se igualdade simples.

Deploy de índices: processo normal; aguardar `READY` antes de homologar queries compostas.

---

## 9. Componentes reutilizáveis

| Componente | Reuso |
|------------|-------|
| `usuarios-permissoes` UI shell / tabs | Nova aba Convites |
| `shared/permissoes.js` | Gate quem convida + matriz pós-aceite |
| `kernelPerfilPara()` | Mapear operacional → kernel no aceite (CF espelha lógica ou shared validado) |
| Auditoria do módulo | Novos tipos de ação |
| `tData` / tenant filters | Listagens admin |
| Padrão CF Gen2 `onCall` | Novas functions |
| Página MPA estilo onboarding | Aceite (acessibilidade S3 como referência UX) |
| `PAGINACAO.LIMITE_LISTA_PADRAO` | Lista de convites com `limit` |

**Não reutilizar** para convites: create Auth secundário com senha temp (D1/D3).

---

## 10. Estratégia de testes

| Camada | Casos |
|--------|-------|
| Unit | Hash token; TTL 7d; status machine; e-mail normalize |
| Rules | Isolamento tenant; deny client write convites; BL-006 intacto |
| Functions | criar/reenviar (invalida anterior)/cancelar/aceitar; expire; reuse token; e-mail mismatch; non-admin denied |
| UI rbac | Aba só admin; remoção UI senha temp; copiar link |
| Smoke DEV | Criar → copiar link → cadastro → login módulo |
| Regressão | `excluirUsuarioAdmin`; saas-admin approve; kernel pendente |

CI: incluir novos testes em `tests.yml` quando existirem.

---

## 11. Critérios de aceite

1. Não existe UI de “criar usuário + senha temporária” em `usuarios-permissoes`.
2. Admin/Owner cria convite e recebe link único; senha nunca aparece nem é e-mailada.
3. Token expira em 7 dias; aceite após expire falha com mensagem clara.
4. Reenvio invalida token anterior; só o novo funciona.
5. Token one-shot: segundo aceite falha.
6. Antes do aceite concluído, convidado **não** tem RBAC operacional da empresa destino.
7. Após aceite: `usuarios/{uid}` com `empresa_id`, `perfil`, `perfil_operacional_id`, `status: ativo` corretos.
8. Todos os eventos D9 presentes na auditoria.
9. Isolamento tenant + zero regressão BL-006.
10. Rules/CF/índices/testes verdes; CI develop verde.
11. Sem promoção `main` sem Revisão Técnica.

---

## 12. Backlog por fases

| Fase | Nome | Escopo | Auth especial |
|------|------|--------|---------------|
| **F0** | Arquitetura e escopo | Este documento | ✅ Concluída (decisões) |
| **F1** | Rules + índices + testes emulador | `convites` rules; indexes; suíte Rules | **Firestore Rules** |
| **F2** | Cloud Functions | criar/reenviar/cancelar/aceitar (+ meta opcional); auditoria server | **Cloud Functions** |
| **F3** | UI admin | Aba Convites; remover senha temp; list/limit | Módulo usuarios-permissoes |
| **F4** | Página aceite | MPA cadastro + chamada aceitar; UX erros | Página nova |
| **F5** | Homologação + docs | Smoke DEV; TECHDOC fechamento; PROXIMA | — |

**Ordem:** F0 ✅ → F1 → F2 → F3 → F4 → F5. Não implementar F3 antes de F1/F2.

### Checklist para autorizar implementação (próximo passo)

- [ ] Dono autoriza **F1** (alterar Firestore Rules + índices)
- [ ] Dono autoriza **F2** (novas Cloud Functions)
- [ ] Confirmar D12 (saas-admin senha temp permanece residual)
- [ ] Confirmar D10 (MVP sem e-mail automático do link)

---

## Fora de escopo (S4)

- E-mail transacional automático (salvo auth futura)  
- BL-009 / BL-010 / BL-011 Alternativa B  
- Seats por plano  
- Redesign completo do módulo  
- Alterar Kernel/Login/firebase.js protegidos sem auth extra  
- Remover fluxo saas-admin de 1º admin (D12)  

---

## Riscos residuais (pós-F0)

| Risco | Mitigação |
|-------|-----------|
| Token vazado no clipboard/histórico | TTL 7d + one-shot + HTTPS |
| Órfão Auth se aceite falhar após createUser | CF idempotente; doc pendente; runbook limpeza |
| Conflito Kernel `pendente`+`cellcity-master` | Aceite só Admin SDK update |
| Admin cola link em canal inseguro | UX aviso; D10 |
| Lógica `kernelPerfilPara` divergente client/CF | Extrair contrato único ou test parity |

---

**Veredito F0:** escopo e arquitetura prontos para gate de implementação (**F1+**), mediante autorização explícita de Rules e Cloud Functions.
