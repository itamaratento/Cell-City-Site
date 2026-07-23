# Frente 4 — Firestore (modelo de dados)

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · **Somente leitura**  
**Motivo:** além de Rules (já auditadas) — inventário coleções × Repository × naming.

---

## Inventário

| Fonte | Qtd |
|-------|----:|
| Coleções com `match` nas Rules | **70** |
| Coleções via `create*Repository` | **48** |
| Rules sem repository dedicado | **~20** (usuarios, perfis, auditoria, chat, orders/clients, lixeira, saas_eventos, …) |
| Repo órfão de Rules | **0** |

Legado EN nas Rules: **`orders`**, **`clients`** (UI migrou para `os` / fluxo atual — resíduo).

Índices JSON: predominância **`createdAt`** (10) vs **`criadoEm`** (6); campo **`nome`** em índices (2) vs dados `clientes.name` (dívida R1 FASE35 — já conhecida).

---

## Modelo sensível (OS)

Documento `os` ainda **armazena** password/pattern/lockPhoto/IMEI/CPF no Firestore (uso interno CRM). Público só via CF com whitelist + `cpfMascarado`. Modelo = dados sensíveis **no doc**; proteção = Rules get fechado + projeção server — alinhado Sprint 1a, relevante p/ Frente 17 LGPD.

---

## Dualidade de schema (resumo, sem recontar ciclos 8–9)

Timestamps e telefone EN/PT coexistentes; paginação por um único `orderByField` permanece frágil.

---

## Próxima frente

→ **Frente 5 — Cloud Functions** (delta além da Frente 1 auth).
