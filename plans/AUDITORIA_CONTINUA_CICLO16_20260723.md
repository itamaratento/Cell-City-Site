# Auditoria contínua ciclo 16 — saas-planos sync OK + XSS atributo OS

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** fecha suspeita de drift PLANOS (ciclo 15) e precisa o XSS mais grave em `os.js`.

**Modo:** somente leitura

---

## 1. `saas-planos`: client × server alinhados

Features por plano (`trial` / `basico` / `profissional` / `enterprise`): **idênticas** entre `CRM/shared/saas-planos.js` e `functions/lib/saas-planos.js`.

Comentário no CF (“sincronizar manualmente”) está sendo respeitado **neste snapshot**. Risco residual = processo manual (sem teste de paridade).

**Oportunidade (auth):** teste de integridade `JSON.stringify(PLANOS.features)` client vs server.

---

## 2. XSS mais crítico em OS (além de cards)

```js
// ~L2208 os.js
onclick="startOSForClient('${client.phone||''}','${client.name||''}')"
```

e detalhe:

```js
${client.name || ''} … ${client.phone || ''} … ${client.phone2}
```

**Descoberta:** nome/telefone em **atributo onclick** sem escape — quebra de aspas + XSS clássico; **fora** do escopo do teste fase22 (que só trava cards `cl.name` / busca).

WhatsApp share / notas de retorno usam `clientName` em string JS/texto (menor risco HTML, ainda injeção em contexto WA).

---

## 3. Financeiro

Tem `escHtml`; interpolações `${nome}` / `${label}` — risco menor se origem for enum interno; não auditado linha-a-linha neste ciclo.

---

## 4. Próxima frente

- Teste de paridade PLANOS (especificação only).
- Escape/backdrop em modais.
- Inventário `onclick="...${` em todo CRM/pages.
- Continuar MODO CONTÍNUO.
