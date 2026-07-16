# Cell City CRM — Design System Oficial v1.0

> Criado na Sprint **P2.4 — Padronização Total do Front-end** (2026-07-16).
> Fonte única de verdade visual do CRM. Arquivos: `CRM/shared/design-system.css`
> (tokens + componentes) e `CRM/shared/theme.js` (gestão de tema).
> Verificação: `npm run verificar-design-system`.

## 1. Como usar em uma página

```html
<head>
  <!-- SEMPRE antes do CSS da página (o CSS local mantém precedência) -->
  <link rel="stylesheet" href="../../shared/design-system.css">
  <script src="../../shared/theme.js"></script>
  <link rel="stylesheet" href="minha-pagina.css">
</head>
```

Todas as 51 páginas do CRM já estão integradas. O service worker (v18+)
pré-cacheia os dois arquivos.

## 2. Tokens (`--cc-*`)

Prefixo `--cc-` para nunca colidir com variáveis legadas de página.

| Grupo | Tokens principais |
|---|---|
| Marca | `--cc-green` `#00c853` · `--cc-green-light` · `--cc-green-dark` · `--cc-gold` · `--cc-gold-dark` |
| Funcionais | `--cc-blue` · `--cc-teal` · `--cc-purple` · `--cc-orange` · `--cc-amber` · `--cc-red` (+ variantes `-light` e `-glow`) |
| Fundo | `--cc-bg` · `--cc-bg-gradient` · `--cc-surface` · `--cc-surface-2` · `--cc-surface-3` · `--cc-glass` · `--cc-glass-2` |
| Texto | `--cc-text` · `--cc-text-2` · `--cc-text-3` · `--cc-text-muted` · `--cc-text-inverse` |
| Borda | `--cc-border` · `--cc-border-medium` · `--cc-border-strong` · `--cc-border-focus` |
| Tipografia | `--cc-font-sans` · `--cc-font-mono` · `--cc-text-xs…3xl` · `--cc-weight-*` · `--cc-leading-*` |
| Espaço | `--cc-space-1…16` (escala de 4px: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64) |
| Raio | `--cc-radius-xs/sm/md/lg/xl/pill` (6/8/12/16/20/999px) |
| Sombra | `--cc-shadow-sm/md/lg` · `--cc-glow-green` · `--cc-glow-hover` |
| Movimento | `--cc-ease` · `--cc-ease-material` · `--cc-duration-fast/base/slow` · `--cc-transition-fast/smooth` |
| Camadas | `--cc-z-dropdown/sticky/sidebar/modal-backdrop/modal/toast/tooltip` (1000…1090) |
| Breakpoints | 480 (celular) · 768 (tablet) · 1024 (notebook) · 1440 (desktop) · 1920 (ultrawide) |

**Regra:** cor/espaçamento/raio novo em página = referência a token.
Hex de marca hardcoded fora do DS é regressão (o verificador mede).

## 3. Temas

- **dark** (padrão — comportamento histórico do CRM)
- **light** — `<html data-theme="light">`
- **auto** — `<html data-theme="auto">` segue o sistema operacional

`theme.js` aplica o tema salvo (localStorage `cc_theme`) de forma síncrona
(sem flash) e expõe:

```js
CCTheme.get();        // 'dark' | 'light' | 'auto'
CCTheme.set('light'); // aplica e persiste
CCTheme.cycle();      // dark → light → auto → dark
```

Páginas que só usam tokens (nunca hex direto) ficam automaticamente
compatíveis com os três temas.

## 4. Componentes (opt-in, prefixo `.cc-`)

Nenhum componente estiliza elemento nu; adoção é gradual e por classe.

| Família | Classes |
|---|---|
| Botão | `.cc-btn` + `--primary` `--ghost` `--danger` `--sm` `--lg` `--block` |
| Formulário | `.cc-field` `.cc-label` `.cc-input` `.cc-select` `.cc-textarea` |
| Card | `.cc-card` + `--elevated` `--glass` `--interactive`; `__header` `__title` `__body` `__footer` |
| Tabela | `.cc-table-wrap` (scroll horizontal seguro) + `.cc-table` |
| Modal | `.cc-modal-backdrop` `.cc-modal` + `--sm` `--lg`; `__header` `__title` `__body` `__footer` |
| Dropdown | `.cc-dropdown` `.cc-dropdown__item` |
| Badge | `.cc-badge` + `--success` `--warning` `--danger` `--info` `--neutral` |
| Status | `.cc-status-dot` + `--online` `--warning` `--offline` |
| Alerta | `.cc-alert` + `--success` `--warning` `--danger` `--info` |
| Toast | `.cc-toast-region` `.cc-toast` + variantes |
| Tooltip | atributo `data-cc-tip="texto"` (CSS puro) |
| Loading | `.cc-skeleton` |
| Grade | `.cc-grid` + `--dense` `--wide` (auto-fill responsivo) |
| Utilitários | `.cc-container` `.cc-scroll-x` `.cc-truncate` `.cc-mono` `.cc-sr-only` `.cc-hide-mobile` `.cc-only-mobile` `.cc-divider` |

## 5. Acessibilidade e polish globais

Aplicados pelo DS em todas as páginas: scrollbar fina padronizada,
`::selection` verde-marca, anel de foco `:focus-visible`,
`prefers-reduced-motion` (desativa animações), viewport com zoom livre
(WCAG 1.4.4 — corrigido em P2.4.6).

## 6. Convenções para código novo

1. Nunca hardcodar cor de marca — usar token.
2. Espaçamentos na escala de 4px (`--cc-space-*`).
3. Novos componentes de página começam pelos `.cc-*`; classes locais só
   para o que for específico do módulo.
4. `!important` proibido em código novo (legado em redução — ver relatório).
5. Styles inline apenas para valores dinâmicos calculados em JS
   (`display:none` controlado por JS é aceito; estética inline não).
6. Antes de commitar: `npm run verificar-design-system`.

## 7. Estado de adoção (2026-07-16)

- 51/51 páginas carregam o DS (100%)
- 483/605 declarações de `:root` de página resolvem em tokens (79,8%)
- 0 hex de marca fora do DS
- Componentes `.cc-*`: disponíveis; migração das classes legadas
  (`est-*`, `fin-*`, `forn-*`, …) é gradual e por módulo
