# Auditoria contínua ciclo 17 — `onclick` com interpolação

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** inventário CRM-wide do padrão XSS de atributo encontrado em OS (ciclo 16).

**Modo:** somente leitura

---

## Inventário `onclick="...${...}"` em pages

| Arquivo | Hits |
|---------|-----:|
| `os/os.js` | 3 |
| `portal-cliente/portal-avaliar.js` | 1 |
| `config/impressao.js` | 1 |
| `catalogo/public/catalogo-publico.js` | 1 |
| `analise/analise.js` | 1 |

**Total grep: 7** (+ `startOSForClient('${client…}')` em template multilinha — ciclo 16).

### Classificação de risco

| Local | `${}` | Risco |
|-------|-------|-------|
| `os.js` photos `viewPhoto('${p}')` | URL/data foto | Médio se upload livre |
| `os.js` `setClientRating(${i})` | 1–5 | Baixo |
| `portal-avaliar` stars | 1–5 | Baixo |
| `impressao` `removeGarantia(${g.id})` | id | Baixo se numérico |
| `catalogo-publico` `catTrocarFoto(${i})` | índice | Baixo |
| `analise` `selecionarAno(${a})` | ano | Baixo |
| `os.js` `startOSForClient(phone,name)` | **dados cliente** | **Alto** (ciclo 16) |

---

## Próxima frente

- `onerror=` / `javascript:` em templates.
- Paridade teste PLANOS.
- Continuar.
