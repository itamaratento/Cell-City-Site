# 📋 BACKLOG — Cell City Gestão Operacional

> Itens aprovados pelo usuário para sprint futura, ainda **sem autorização de implementação**.
> Cada item só sai daqui via processo formal (Planejamento → Aprovação → Implementação isolada → Backup → Homologação → TECHDOC → Encerramento).

---

## BL-001 — Indicador permanente de usuário + perfil na barra superior

**Origem:** solicitação do usuário em 2026-07-02, durante a homologação do RBAC Sprint 2 (CRM + Agenda).
**Prioridade sugerida:** alta para UX/homologação, não bloqueante para o Sprint 2.
**Sugestão de janela:** junto ou logo após um dos próximos sprints da Fase 2 (é transversal e ajuda a homologar os Sprints 3-5).

### O que o usuário pediu

Exibir permanentemente na barra superior (próximo à data/hora ou em outro local de destaque) o usuário autenticado e o perfil ativo, ex.:

- 👤 Itamar | Administrador
- 👤 Caixa 01 | Caixa
- 👤 Financeiro 01 | Financeiro
- 👤 Técnico 01 | Técnico

**Motivação declarada:** hoje o sistema não informa em nenhum lugar quem está logado nem com qual perfil — dificulta a homologação do RBAC, aumenta o risco de operar com o perfil errado e torna a auditoria menos clara.

**Complemento do usuário (2026-07-02):** exibir **os dois perfis quando existirem**, não só um:

- **Usuário:** Itamar
- **Perfil RBAC:** Administrador
- *(Opcional)* **Perfil legado:** Administrador

Motivo: durante a migração pode haver divergência entre o perfil legado (kernel) e o perfil do RBAC novo — exibir só um deles dificulta o diagnóstico de problemas de permissão. Isso resolve a "decisão de produto pendente" registrada abaixo: a resposta é **ambos** (o RBAC em destaque; o legado ao menos acessível, ex. em tooltip/hover ou linha secundária, a definir no planejamento visual).

### Levantamento preliminar (feito em 2026-07-02, só leitura)

- **Duas superfícies a cobrir:**
  1. **Dashboard** — tem topbar própria com data/hora (`clock-display`/`date-text` em `CRM/pages/dashboard/`); a brand bar compartilhada NÃO é injetada lá.
  2. **Demais páginas** — `CRM/shared/brand-header.js` injeta a barra superior (`#crm-brand-bar`, layout logo | título central | botões à direita) em todas as páginas exceto o Dashboard. É o ponto natural para o indicador nas páginas internas.
- **Dados já disponíveis sem nenhuma leitura extra:** `kernel.js` já exporta `getNome()` e `getPerfil()` (perfil legado do kernel: master_admin/admin/gerente/tecnico/atendente).
- **Dado que exige leitura extra:** o **perfil operacional** (RBAC novo — Administrador/Caixa/Financeiro/Técnico etc.) não está no `ctx` do kernel. Precisa de `usuarios/{uid}.perfil_operacional_id` → `perfis_operacionais/{id}.nome`. `shared/permissoes.js` já lê esses documentos ao carregar a matriz, mas hoje não guarda/expõe o **nome** do perfil — uma extensão pequena (ex.: `getPerfilOperacionalNome()`) resolveria sem leitura de rede adicional.
- **Decisão de produto — RESOLVIDA pelo usuário em 2026-07-02:** exibir **ambos os perfis** (RBAC em destaque + legado quando existir divergência ou sempre, a definir no planejamento visual). Fallback para usuário não migrado (sem `perfil_operacional_id`): exibir só o legado.
- **Componentes tocados (estimativa):** `CRM/shared/brand-header.js` (+ possivelmente `CRM/shared/permissoes.js` para expor o nome do perfil, e a topbar do Dashboard). Atenção: brand-header é compartilhado por quase todas as páginas — mudança de risco médio, exige homologação visual ampla.

### Regras para quando for implementado

- Processo formal completo (planejamento → aprovação → backup → homologação → TECHDOC).
- Não alterar `kernel.js`/`firebase.js` — consumir só API pública existente.
- Fail-open visual: falha ao obter o perfil nunca pode quebrar a barra — exibir só o nome, ou nada.

---

*Novos itens de backlog devem ser adicionados abaixo, com numeração sequencial BL-XXX.*
