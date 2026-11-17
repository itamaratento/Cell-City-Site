# Auditoria contínua ciclo 13 — design-system OK + fragmentação de toast IDs

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** UX/design após XSS OS; inventário de toasts e adoção do design-system (frente citada no ciclo 12).

**Modo:** somente leitura

---

## 1. Design system: adoção HTML completa

**46/46** `CRM/pages/**/*.html` referenciam `design-system.css`.

Redefinição de CSS vars do DS em pages: praticamente só `usuarios-permissoes.css` (`--danger`).

**Descoberta positiva:** a fragmentação visual **não** vem de páginas fora do DS — vem de **skins locais** (toast/modal) empilhadas em cima do DS.

---

## 2. Toast: **19 IDs distintos**

| Padrão | Exemplos |
|--------|----------|
| genérico `#toast` | caixa, OS, pós-venda, clientes, contas, central-org (6) |
| prefixo módulo | `fin-toast`, `est-toast`, `cmd-toast`, `info-toast`, `alr-toast`, `camp-toast`, `dia-toast`, `forn-toast`, `ch-toast`, `cr-toast`, `up-toast`, `ag-toast`, … |
| CRM | `crm-toast`, `ent-toast` |
| portal técnico | `pt-toast`, `sw-toast`, `cb-toast`, `cp-toast` |

**Descoberta:** unificar `showToast()` sem padronizar o **seletor** (`#toast` vs `#fin-toast` vs `#crm-toast`) exige adapter por página ou data-attribute único (`[data-toast]`). É o bloqueio real da refatoração do ciclo 2 — não só CSS class names.

---

## 3. Top backlog implícito (só leitura → auth futura)

Ordenado por impacto evidenciado neste modo contínuo:

1. **Cota:** `.list()`/getDocs sem teto (OS boot, central-alertas, financeiro, portal_eventos tracking).
2. **Produto:** alerta “não retirados” ignora `status===pronto` (legado) enquanto contagem/UI label cobrem.
3. **Adoção:** `listarPaginado` / `PAGINACAO` / API PT = 0 pages.
4. **XSS:** `innerHTML` sem esc em trechos de `os.js`.
5. **Docs:** `MASTER_ROADMAP` stale vs `PROXIMA_ETAPA`.
6. **UX:** 19 toast IDs + 0 `aria-live`.
7. **Schema:** `createdAt`/`criadoEm` dual write.

---

## 4. Próxima frente

- Modais: quantos padrões (`openModal` vs inline).
- `data-toast` / helpers já existentes?
- Testes de integridade que já cubram limit/cota.
- Comparar `injectTenantFilter` em Cloud Functions vs client.
