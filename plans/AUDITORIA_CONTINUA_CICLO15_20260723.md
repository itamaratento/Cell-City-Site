# Auditoria contínua ciclo 15 — XSS residual vs suíte fase22 + phone dual

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** o teste `seguranca-fase22` (12/12 PASS) trava pontos específicos; confrontar com interpolações cruas restantes em `os.js`.

**Modo:** somente leitura

---

## 1. Suíte fase22: verde, escopo estreito

`tests/integrity/seguranca-fase22.test.mjs` — **12/12 OK** (Node v22).

Garante, entre outros:
- `escHtml` unitário
- CSPRNG senhas / sem PIN `1056`
- `dashboard-ui` modal alertas com `escHtml(os.clientName|phone)`
- `os.js` **cards** `escHtml(cl.name|phone)`
- catálogo público + Rules `cellcity-master`

---

## 2. Lacuna: interpolações cruas ainda em `os.js`

Além dos cards protegidos, ainda há (amostra):

| Padrão | Risco |
|--------|--------|
| `${os.clientName}` (várias) | XSS se nome malicioso em OS |
| `${client.name \|\| ''}` / `${client.phone}` | formulário/detalhe cliente |
| `${client.phone2 ? …}` | segundo telefone |

Misturadas com trechos já corretos (`${escHtml(os.clientName)}`).

**Descoberta:** a regressão fase22 **não impede** reintrodução/permanência de XSS em outros templates do mesmo arquivo. Cobertura = pontos históricos do commit 4080ec2, não inventário completo de `innerHTML`.

**Plano (auth):** estender fase22 com grep negativo `\$\{os\.clientName\}` / `\$\{client\.name` sem `escHtml` adjacente — ou migrar todos para esc.

---

## 3. Phone: client ≠ server (duplicação deliberada?)

| Camada | API |
|--------|-----|
| `CRM/shared/phone-utils.js` | `normalizePhoneDigits`, `maskPhone`, `canonicalizePhone`, `legacyPhoneVariants` |
| `functions/lib/phone.js` | `normalizePhoneDigitsServer`, `maskPhoneServer`, `validarPhoneDigitsServer` |

Nomes espelhados com sufixo Server — padrão comum para não importar ESM browser no CF. **Risco:** drift de regra de normalização (11 vs 13 dígitos, etc.) se um lado mudar só.

`saas-planos` client vs `functions/lib/saas-planos.js`: similaridade prefixo baixa (~0.02) — **não** são o mesmo arquivo copiado; verificar se PLANOS batem por chave (próximo microciclo).

---

## 4. Próxima frente

- Diff estrutural PLANOS client × server.
- Escape key / backdrop em modais (ciclo 14).
- `git-info.json` / health-check noise vs artefatos de auditoria.
- Continuar inventário XSS em `financeiro.js` / `crm.js` (top innerHTML).
