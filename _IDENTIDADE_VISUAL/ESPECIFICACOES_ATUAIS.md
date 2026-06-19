# 🎨 Identidade Visual Atual — Cell City Informática

> Documento de referência para reformulação da identidade visual.
> Gerado em: $(date "+%d/%m/%Y %H:%M")

---

## 1. 📁 Arquivos de Logo Existentes

### Originais (pasta `originais/`)

| Arquivo | Resolução | Formato Real | Observação |
|---------|-----------|-------------|------------|
| `logo.png` | 1254×1254 | JPEG (extensão .png) | Usado no CRM (manifest, PWA, notificações) |
| `logo-large.png` | 1254×1254 | JPEG (extensão .png) | Cópia idêntica ao logo.png |
| `logooficial.jpeg` | 1254×1254 | JPEG | Usado no site público (header, rodapé, OG tags) |
| `logo.jpeg` | 1536×1024 | JPEG | Versão paisagem |
| `logo-gold-final.jpeg` | 1536×1024 | JPEG | Variação com destaque dourado |
| `logo-white-final.jpeg` | 1536×1024 | JPEG | Variação com destaque branco |
| `favicon-crm.ico` | 1254×1254 | JPEG (extensão .ico) | Favicon do CRM (excessivamente grande) |
| `favicon-site.ico` | 1254×1254 | JPEG (extensão .ico) | Favicon do site público |
| `manifest.json` | — | JSON | Manifest PWA (referência de configuração) |

### ⚠️ Observações Importantes

- **Não existem arquivos SVG** em nenhum local do projeto
- **Não existem arquivos originais editáveis** (PSD, AI, CDR, FIG, etc.)
- Os arquivos `.png` são **na verdade JPEGs** com extensão incorreta
- Os favicons `.ico` são **JPEGs de 1254×1254** — muito maiores que o ideal (deveriam ser 16×16, 32×32, 48×48)
- `logo.png` e `logo-large.png` são o mesmo arquivo (mesmo tamanho, mesma resolução)
- Todas as imagens são de **resolução relativamente baixa** para padrões profissionais

---

## 2. 🖌️ Tipografia

### Fonte Principal: **Inter** (Google Fonts)

| Elemento | Fonte | Tamanho | Peso | Letter-Spacing |
|----------|-------|---------|------|----------------|
| Cell City Informática | Inter | 15px | 800 (ExtraBold) | -0.02em |
| Gestão Empresarial | Inter | 10px | 500 (Medium) | 0.12em |

**Família carregada:** Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif

**Pesos disponíveis:** 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold), 800 (ExtraBold), 900 (Black)

**Link de importação:**
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```

---

## 3. 🎨 Paleta de Cores

### Cores Primárias (Marca)

| Cor | Amostra | HEX | RGB | Uso |
|-----|---------|-----|-----|-----|
| Verde Principal | 🟢 | `#00C853` | `rgb(0, 200, 83)` | Cor da marca, botões, glows, indicadores |
| Verde Claro | 🟢 | `#00E676` | `rgb(0, 230, 118)` | Gradientes, hover, destaques |
| Verde Escuro | 🟢 | `#00B248` | `rgb(0, 178, 72)` | Gradientes, bordas, profundidade |

### Cores Secundárias

| Cor | Amostra | HEX | RGB | Uso |
|-----|---------|-----|-----|-----|
| Dourado | 💛 | `#FFCC00` | `rgb(255, 204, 0)` | Destaques premium |
| Dourado Escuro | 💛 | `#FFB300` | `rgb(255, 179, 0)` | Variação dourada |
| Azul | 🔵 | `#3B82F6` | `rgb(59, 130, 246)` | Ações secundárias |
| Vermelho | 🔴 | `#EF4444` | `rgb(239, 68, 68)` | Alertas críticos |
| Roxo | 🟣 | `#8B5CF6` | `rgb(139, 92, 246)` | Destaques especiais |

### Cores de Fundo (Tema Escuro)

| Cor | HEX | RGB | Uso |
|-----|-----|-----|-----|
| Base | `#0A0B0D` | `rgb(10, 11, 13)` | Fundo principal |
| Superfície | `#121418` | `rgb(18, 20, 24)` | Cards, painéis |
| Elevado | `#1A1D23` | `rgb(26, 29, 35)` | Modais, dropdowns |
| Hover | `#22262E` | `rgb(34, 38, 46)` | Hover de elementos |

### Cores de Texto

| Cor | HEX | RGB | Uso |
|-----|-----|-----|-----|
| Primário | `#F5F7FA` | `rgb(245, 247, 250)` | Texto principal |
| Secundário | `#A1A8B3` | `rgb(161, 168, 179)` | Subtítulos, metadados |
| Terciário | `#6B7280` | `rgb(107, 114, 128)` | Placeholders, textos auxiliares |
| Silenciado | `#4B5563` | `rgb(75, 85, 99)` | Textos muito secundários |

### Cores de Borda

| Cor | HEX | Uso |
|-----|-----|-----|
| Sutil | `rgba(255,255,255,0.06)` | Bordas padrão |
| Média | `rgba(255,255,255,0.10)` | Bordas de destaque |
| Forte | `rgba(255,255,255,0.16)` | Bordas de containers ativos |

---

## 4. 🎯 Glows e Sombras da Marca

### Glow Verde (padrão)
```css
box-shadow: 0 0 0 1px rgba(0, 200, 83, 0.25), 0 4px 20px rgba(0, 200, 83, 0.15);
```

### Glow Hover
```css
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08);
```

### Drop Shadow do Título
```css
filter: drop-shadow(0 0 6px rgba(0, 200, 83, 0.25));
```

### Gradiente do Título (CSS)
```css
background: linear-gradient(135deg, #00e676 0%, #00c853 60%, #00b248 100%);
-webkit-background-clip: text;
background-clip: text;
-webkit-text-fill-color: transparent;
```

---

## 5. 🧩 Estrutura da Marca no Sistema

```
┌──────────────────────────────────────┐
│  Cell City Informática                │  ← Título principal (Inter 800, 15px)
│  ───────────────────────────────────  │  ← Divisor gradiente verde
│  GESTÃO EMPRESARIAL                   │  ← Subtítulo (Inter 500, 10px, uppercase)
└──────────────────────────────────────┘
```

O logo atual é **100% baseado em texto + CSS**. Não existem elementos gráficos como ícones, símbolos ou shapes. A identidade visual é construída exclusivamente através de:

- **Tipografia** (Inter)
- **Gradientes** (verde linear 135°)
- **Glows e sombras** verdes
- **Bordas** com cantos arredondados (10px)
- **Tema escuro** com destaque verde

---

## 6. 📐 Layout e Dimensões

### Brand Header (logo clicável no topo)

| Propriedade | Valor |
|-------------|-------|
| Padding | 5px 16px |
| Border-radius | 10px |
| Background | `linear-gradient(135deg, rgba(0,200,83,0.08), rgba(0,200,83,0.02))` |
| Border | 1px solid `rgba(0,200,83,0.2)` |
| Hover | translada -1px, borda mais clara |
| Active | scale(0.98) |

---

## 7. 📱 Aplicações da Marca

| Onde | O quê | Arquivo |
|------|-------|---------|
| **CRM** (todas as páginas) | Header com logo texto | `brand-header.js` |
| **Dashboard** | Header + logo | `dashboard/index.html` |
| **Site público** | Logo imagem | `logooficial.jpeg` |
| **PWA Manifest** | Ícone 192×192 / 512×512 | `logo.png` |
| **Apple Touch Icon** | Ícone iOS | `logo.png` |
| **Notificações** | Ícone push | `logo.png` |
| **Service Worker** | Badge notificação | `logo.png` |
| **Site catálogo** | Favicon | `favicon.ico` |

---

## 8. 💡 Recomendações para a Nova Identidade

1. **Criar um símbolo/ícone** para acompanhar o texto (ex: um chip, circuito, escudo, ou inicial "CC" estilizada)
2. **Gerar SVG** para escalabilidade perfeita
3. **Criar variações**:
   - Logo horizontal (texto + ícone)
   - Logo quadrada (ícone isolado)
   - Favicon 32×32, 64×64, 512×512
4. **Manter a essência verde** (#00C853 como cor principal)
5. **Modernizar a tipografia** — Inter já é excelente, pode-se explorar variações de peso
6. **Criar asset editável** (formato Figma ou Illustrator)

---

📅 Documento gerado automaticamente em $(date "+%d/%m/%Y %H:%M")
