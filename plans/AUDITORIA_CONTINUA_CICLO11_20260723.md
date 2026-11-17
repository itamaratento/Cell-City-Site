# Auditoria contínua ciclo 11 — legado `pronto`, pós-venda alinhada, docs drift

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** fecha frentes abertas no ciclo 10 (status OS, tenant suspeitos, pós-venda) e confronta **MASTER_ROADMAP** com **PROXIMA_ETAPA**.

**Modo:** somente leitura

---

## 1. Status `pronto` — contexto ampliado

- Máquina de estados atual em `os.js`: chave canônica **`concluido`** (sem `pronto` na lista de status UI).
- `plans/MELHORIAS_OS.md` documenta `STATUS_LEGACY['pronto'] → 'concluido'` (plano de melhoria; verificar se o mapa ainda existe no código em runtime).
- Alertas ainda **comentam** o dual `concluido|pronto` na contagem, mas o alerta “não retirados” filtra só `concluido` (ciclo 10).

**Implicação:** se docs legacy ainda existem no Firestore sem migração, o alerta falha; se todos já foram regravados como `concluido`, o comentário está **stale** e a contagem dual é dead code defensivo.

---

## 2. Pós-venda 5/15/30 — alinhado

Dashboard e Central usam a **mesma** janela:

- prazos `{5,15,30}`
- `proxPrazo` 5→15→30→999
- vencido se `dias > prazo + 2`
- set `osId_prazo` via `posvenda_contatos` (ignora `ativo === false`)

Diferença: dashboard faz `getDocs` dedicados; Central reusa `OS.list()` + `PosvendaContatos.list()` — **mesma regra, custo diferente**.

---

## 3. Suspeitos tenant — falsos positivos

| Arquivo | Veredito |
|---------|----------|
| `chat.js` | `injectTenantFilter` + `limit(200)` — OK |
| `compras.js` | `injectTenantFilter` + `limit(500/200)` — OK (e **bom padrão** a espelhar) |

Heurística “janela 400 chars” do ciclo 10 errou porque o `getDocs(q)` separa a construção de `q`.

---

## 4. Drift documental: MASTER_ROADMAP vs PROXIMA_ETAPA

| Doc | Atualização declarada | Conteúdo problemático |
|-----|----------------------|------------------------|
| `PROXIMA_ETAPA.md` | 2026-07-21 | ESPERA CONTROLADA, v3.2.0, baseline `b663a13` — **fonte operacional** |
| `MASTER_ROADMAP.md` | header **2026-07-08** | Ainda descreve Fase 2 “em andamento”, Sprint 5 OS “aguardando aprovação formal”, trechos internos contradizem (Sprint 3 “ainda aguardando” vs “aprovado 08/07”) |

**Descoberta:** MASTER_ROADMAP **não é a verdade do estado atual**; quem seguir só ele reabre Fase 2/RBAC já certificada na linha v3.2.0. Risco de onboarding de IA/humano.

(Sem editar docs oficiais — só registrar; auth necessária para alinhar.)

---

## 5. Próxima frente

- Grep runtime `STATUS_LEGACY` em `os.js`.
- `compras.js` como referência positiva de `limit`+tenant vs financeiro.
- Dead code: comentários/contagens `pronto` se STATUS_LEGACY normaliza na leitura.
- Amostrar `innerHTML` + dados de cliente em `toggleOSEdit` (192L).
