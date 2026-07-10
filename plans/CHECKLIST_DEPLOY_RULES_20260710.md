# Checklist — Deploy das Firestore Rules da release v2026.07.10

> **Origem:** revisão técnica 2026-07-10 (TECHDOC §30.1). As rules foram
> corrigidas **no repositório** (`CRM/firestore.rules` = `firestore.rules`,
> cópias idênticas) mas **não deployadas** — deploy de rules é manual
> (REST/console), fora do fluxo do GitHub Pages.

## O que mudou nas rules

| Coleção | Regra | Módulo que depende |
|---|---|---|
| `chat_mensagens` | read/create com `temAcessoLiberado()`; update/delete negados | Chat (DESATIVADO §31 — rule fica para reativação) |
| `compras_pedidos` | read/write com `temAcessoLiberado()` | Compras + botão "estoque baixo→compras" do Fornecedor |
| `financeiro_fechamentos` | read/write com `temAcessoLiberado()` | Financeiro — Fechamento Mensal |
| `fornecedores_cadastro` | read/write com `temAcessoLiberado()` | Fornecedor — aba Cadastro |
| `crm_templates` | leitura apertada: `auth != null` → `temAcessoLiberado()` | CRM Comercial — templates WhatsApp |

Projetos-alvo: **DEV `cellcity-crm-dev`** e **PROD `cellcity-crm`**
(`CRM/shared/env-config.js`). Fonte de verdade: `CRM/firestore.rules`
em `main` (`git show main:CRM/firestore.rules`).

## Checklist

□ Backup do ruleset ativo dos 2 projetos (GET releases via
  `firebaserules.googleapis.com` — guardar o `rulesetName` atual p/ rollback)
□ Deploy DEV (`cellcity-crm-dev`)
□ Verificar release ativo do DEV **via API** (nunca só o console —
  já houve "Publicar" confirmado sem atualizar o release)
□ Validar no DEV, logado com usuário aprovado (padrão cellcity<perfil>@gmail.com):
  □ Compras: criar/listar pedido (grava `compras_pedidos`)
  □ Financeiro: executar Fechamento Mensal (grava `financeiro_fechamentos`)
  □ Fornecedores: CRUD na aba Cadastro (grava `fornecedores_cadastro`)
  □ CRM Comercial: templates continuam carregando (leitura `crm_templates`)
  □ Chat: acesso direto à URL mostra "Módulo desativado." (sem erro de permissão)
  □ Contra-prova: conta `pendente` NÃO lê nenhuma das coleções acima
□ Deploy PROD (`cellcity-crm`)
□ Verificar release ativo do PROD via API
□ Repetir as validações acima no PROD
□ Registrar versão/ruleset em TECHDOC §30.1 e marcar esta pendência
  como concluída em PROXIMA_ETAPA.md
