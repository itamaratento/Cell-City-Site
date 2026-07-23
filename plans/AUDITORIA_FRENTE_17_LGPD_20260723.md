# Frente 17 — LGPD

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · **Somente leitura**

---

## Dados pessoais / sensíveis no modelo OS

Armazenados no Firestore (operadores autenticados): CPF, senha/padrão/foto de desbloqueio, IMEI, endereço, telefone, nome.

| Controle | Status |
|----------|--------|
| `os` `allow get: if false` (público) | ✓ Rules |
| Projeção CF `OS_CAMPOS_PUBLICOS` exclui password/pattern/lockPhoto/IMEI/CPF cru | ✓ |
| `cpfMascarado` na API pública | ✓ Fase 4.1 |
| Portal CF devolve só `name` do cliente (não CPF/e-mail) | ✓ comentário + código |
| Criptografia at-rest além do Firebase default | não evidenciada no app |
| Fluxo de exclusão/anonimização de titular (direito ao esquecimento) | **não encontrado** como módulo |
| Consentimento LGPD explícito no Portal | **não encontrado** |

## Achado

Proteção **contra vazamento público** está sólida (Sprint 1a + máscara CPF). Dados sensíveis **permanecem em claro no doc** para o CRM interno (necessidade operacional de assistência técnica). Lacuna: processos de titular (export/erase) e consentimento — fora do código atual.

---

## Próxima frente

→ **Frente 18 — RBAC (não-regressão ADR-AUTH-001)**
