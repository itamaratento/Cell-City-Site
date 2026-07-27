# Sprint 4 — Usuários e Convites · PLANO TÉCNICO (somente levantamento)

**Data:** 2026-07-27  
**Status:** 📋 PLANEJAMENTO — **NÃO IMPLEMENTAR** até autorização explícita  
**Série operacional:** S1 Fundação → S2 Cadastro → S3 Polish Wizard → **S4 Usuários/Convites**  
**Não confundir com:** Sprint 4 SaaS legada (aprovação de empresas, 2026-07-16) nem Sprint 4 RBAC Financeiro (§7.4)

**Baseline:** `9b11e82` (BL-007 fechado) · CI verde · ambiente estável

---

## 1. Objetivos (produto)

| Objetivo | Descrição |
|----------|-----------|
| Gerenciamento de usuários | Evoluir o fluxo já existente em `usuarios-permissoes` (criar/editar/ativar/desativar/excluir) |
| Convites | Novo fluxo: admin convida por e-mail sem exibir senha temporária na tela (ou coexistir com create atual) |
| Aceite de convite | Página/rota pública autenticada que consome token e provisiona vínculo |
| Associação usuário → empresa | Garantir `empresa_id` correto no aceite (Rules congelam `empresa_id` no self-update — ver riscos) |
| Papéis (RBAC) | `perfil` kernel + `perfil_operacional_id` / matriz `perfis_operacionais` |
| Permissões | Continuar via `shared/permissoes.js` (ADR-AUTH-001 Alternativa A) |
| Recuperação de convites | Listar pendentes/expirados; invalidar; recriar |
| Expiração | TTL configurável (ex.: 72h) no documento do convite |
| Reenvio | Novo token ou extensão de validade + (futuro) e-mail |
| Auditoria | Eventos de ciclo de vida do convite + reuso de `auditoria_usuarios_permissoes` / `saas-auditoria` |
| UX | Lista de convites, status, CTA reenviar/cancelar; aceite com feedback claro |

### Decisões de produto (bloqueiam implementação — dono decide)

1. **Substituir** create com senha temp **ou coexistir** com convite?
2. Convites só **admin da empresa** ou também `master_admin` cross-tenant?
3. Provedor de e-mail (Firebase Extension / SendGrid / manual “copie o link” na v1)?
4. Limite de assentos por plano (`saas-planos`) — enforcer na Sprint 4 ou fase posterior?
5. Aceite por usuário **já autenticado** vs criação Auth no redeem via Admin SDK?

---

## 2. Levantamento — o que já existe

### 2.1 Arquivos / módulos

| Path | Papel atual |
|------|-------------|
| `CRM/pages/usuarios-permissoes/usuarios-permissoes.js` | CRUD usuários, perfis, políticas senha, audit; CF `excluirUsuarioAdmin` |
| `CRM/pages/usuarios-permissoes/firebase-secondary.js` | Auth secundário: create / redefinir / reset e-mail |
| `CRM/pages/usuarios-permissoes/index.html` + `.css` | UI tabs |
| `CRM/pages/saas-admin/saas-admin.js` | Aprovação cria 1º admin da empresa (Auth + `usuarios`) |
| `CRM/pages/saas-admin/firebase-secondary.js` | Auth secundário (só create) |
| `CRM/shared/permissoes.js` | Matriz operacional fail-closed |
| `CRM/shared/saas-auditoria.js` | `logAcao` / `logEvento` |
| `CRM/shared/tenant-query.js` | `tData`, filtros tenant |
| `CRM/scripts/kernel.js` | Auto-cria `usuarios/{uid}` `perfil:'pendente'` + `cellcity-master` no 1º login |
| `functions/admin.js` → `excluirUsuarioAdmin` | Delete Auth+Firestore com guards |
| `functions/saas.js` | Onboarding empresa **sem** usuário até aprovação |
| `CRM/firestore.rules` `match /usuarios/{uid}` | BL-006: self não escala `perfil`/`empresa_id`/`status` |

### 2.2 Inexistente (gaps vs fluxo típico de convite)

- Coleção `convites` (ou equivalente) e Rules
- Token seguro + expiração + reenvio
- Página de aceite
- Cloud Function Admin SDK para redeem (obrigatória pela Rules — invitee **não** pode setar `empresa_id`/`perfil` sozinho)
- Envio de e-mail de convite
- Testes de convite (Rules/CF/UI)
- Enforcement de seats por plano

### 2.3 Reutilizável / compartilhável

- Padrão Auth secundário (create isolado)
- `gerarSenhaTemp` CSPRNG (se ainda houver caminho senha temp)
- `registrarAuditoria` / `logAcao`
- `tData` + isolamento tenant
- Gate `excluirUsuarioAdmin` como modelo de autorização CF
- Kernel `pendente` + `temAcessoLiberado()` como default-deny até provisionar
- Harness `tests/rbac/` + `tests/firestore-rules/`

### 2.4 Dependências

| Tipo | Item |
|------|------|
| Crítico | Autorização explícita para **Firestore Rules** e **Cloud Functions** (CLAUDE.md / ENGINEERING) |
| Crítico | Decisões de produto §1 |
| Segurança | Modelo BL-006 — aceite **somente** via CF Admin SDK |
| Opcional | Provedor de e-mail (ou MVP “copie o link”) |
| Opcional | BL-009 (fotos) — **não** bloqueia S4 |
| Docs | ADR-AUTH-001: Rules ≠ matriz; convites não devem assumir enforcement de matriz nas Rules |

---

## 3. Riscos e impactos

| ID | Risco | Impacto | Mitigação planejada |
|----|-------|---------|---------------------|
| R1 | Invitee escreve `perfil`/`empresa_id` no client | Escalada (classe BL-006) | Redeem **só** CF Admin SDK |
| R2 | Token adivinhável / reuse após expire | Conta indevida | Token CSPRNG, one-shot, TTL, status |
| R3 | Auth criado e Firestore falha | Órfão Auth | Transação CF / cleanup; mesmo risco do secondary atual |
| R4 | Conflito com auto-provision Kernel `pendente`+`cellcity-master` | Empresa errada | CF atualiza doc existente com cuidado; testes Rules |
| R5 | E-mail sem provedor | UX incompleta | MVP link manual; e-mail em fase posterior |
| R6 | Escopo Rules/CF sem auth | Violação processo | Gate formal antes de código |
| R7 | Tocar `usuarios-permissoes` + Rules + CF juntos | Muitos módulos | Um módulo por vez; CF/Rules em fase própria |
| R8 | Numeração S4 legada vs nova | Confusão docs | Prefixo “série operacional” neste plano |

**Impacto em produção se mal feito:** alto (Auth + privilégios). Por isso S4 **não** deve começar sem plano aprovado + autorização Rules/CF.

---

## 4. Backlog proposto (épicos → itens)

### Épico A — Modelo de dados e segurança
- A1. Spec documento `convites/{id}` (campos, status, TTL, empresa_id, email, perfil alvo, created_by)
- A2. Spec Rules (create/read admin tenant; update/redeem só CF; delete soft)
- A3. Threat model (token, escalate, cross-tenant)
- A4. Testes emulador Rules **antes** de deploy

### Épico B — Cloud Functions
- B1. `convidarUsuario` (ou nome alinhado ao projeto) — cria convite + opcional e-mail
- B2. `aceitarConvite` — valida token, cria/liga Auth, grava `usuarios`, marca consumido
- B3. `reenviarConvite` / `cancelarConvite`
- B4. Auditoria server-side
- B5. Testes `tests/functions/`

### Épico C — UI admin (um módulo)
- C1. Aba/seção Convites em `usuarios-permissoes` (lista, criar, reenviar, cancelar)
- C2. Manter create senha-temp atrás de flag **ou** deprecar conforme decisão produto
- C3. Testes jsdom `tests/rbac/`

### Épico D — UX aceite
- D1. Página mínima de aceite (MPA)
- D2. Estados: válido / expirado / já usado / erro
- D3. Teste estático + smoke manual DEV

### Épico E — Fechamento
- E1. TECHDOC § + PROXIMA
- E2. CI verde; sem promoção `main` nesta sprint (salvo autorização Revisão Técnica)

---

## 5. Fases e milestones

| Fase | Milestone | Critério de saída | Autorização especial |
|------|-----------|-------------------|----------------------|
| **F0** | Decisões produto §1 | Documento de decisão assinado pelo dono | — |
| **F1** | Spec + Rules draft + testes emulador | Suíte Rules nova verde em CI/local | Rules (só após auth) |
| **F2** | CF convite/aceite/reenvio | Testes functions verdes; smoke DEV | Cloud Functions |
| **F3** | UI admin convites | rbac/jsdom verdes; zero regressão CRUD usuário | Módulo usuarios-permissoes |
| **F4** | Página aceite + homologação DEV | Fluxo ponta a ponta DEV | — |
| **F5** | Docs + encerramento | Relatório S4; PROXIMA atualizado | — |

Ordem rígida: **F0 → F1 → F2 → F3 → F4 → F5**. Não pular F1/F2.

---

## 6. Critérios de aceite (Sprint completa)

1. Admin da empresa cria convite para e-mail válido com perfil operacional definido.
2. Convite expira após TTL; aceite após expire falha de forma clara.
3. Reenvio invalida token anterior **ou** estende de forma auditada (escolher um e documentar).
4. Aceite bem-sucedido: Auth + `usuarios/{uid}` com `empresa_id` e papéis corretos; `pendente` resolvido.
5. Invitee **não** consegue via client SDK alterar `perfil` / `empresa_id` / `status` (regressão BL-006 = 0).
6. Auditoria registra criar / reenviar / cancelar / aceitar / falha.
7. Isolamento tenant: admin A não convida para empresa B.
8. Testes: Rules + CF + UI mínimos verdes; CI develop verde.
9. Sem alteração de Kernel/Repository/Login salvo autorização extra explícita.
10. Sem promoção automática a `main`.

---

## 7. Estratégia de testes

| Camada | O quê | Onde |
|--------|-------|------|
| Unit/static | Validações token/TTL/status | `tests/` novo ou onboarding-like |
| Rules | create/read tenant; deny invitee escalate; redeem path | `tests/firestore-rules/` |
| Functions | happy path + expire + reuse + last-admin N/A + cross-tenant | `tests/functions/` (+ emulador) |
| UI | Aba convites; gate admin | `tests/rbac/` |
| Smoke DEV | Criar → (link) → aceitar → login módulo | Manual / script |
| Regressão | saas-admin approve; excluirUsuarioAdmin; BL-006 cases | suítes existentes |

---

## 8. Fora de escopo (deliberado nesta Sprint 4)

- BL-009 Storage/Blaze · BL-010 deploy key  
- Alternativa B Rules×matriz (BL-011 / ADR)  
- Redesign completo de `usuarios-permissoes`  
- Portal do Cliente / WhatsApp  
- Billing / CNPJ  
- Promoção `develop → main` sem Revisão Técnica  

---

## 9. Readiness

| Critério | Status |
|----------|--------|
| Baseline estável (S1–S3 + BL-007) | ✅ |
| Módulo usuários maduro para estender | ✅ |
| Gap convite mapeado | ✅ |
| Decisões produto | ⏳ dono |
| Auth Rules/CF para implementar | ⏳ dono |
| Pronto para **codar** | ❌ até F0 + autorização |

**Veredito readiness:** pronto para **aprovação de escopo e F0**; **não** pronto para implementação imediata.
