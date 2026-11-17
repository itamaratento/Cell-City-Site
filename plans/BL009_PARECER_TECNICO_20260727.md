# BL-009 — Parecer técnico: Firebase Storage + plano Blaze

**Data:** 2026-07-27  
**Status:** ⛔ Sem implementação — somente parecer (aguarda decisão de custo do dono)  
**Origem:** Fase 4.3 (2026-07-19); prep em `plans/FILA_B_PREPARACAO_20260721.md` §14

---

## Situação factual

| Item | Estado |
|------|--------|
| Bucket Firebase Storage (PROD/DEV) | **Ausente** (API retorna 0 buckets) |
| `storage.rules` no repo | ✅ Existe e endurecida (path `empresas/{empresaId}/…`) |
| Deploy CI (`deploy-firebase.yml`) | **Pula** storage se não houver bucket (guard consciente) |
| Consumidores de código | `CRM/pages/os/os-photo-storage.js`, `central-informacoes/informacoes.js`, exports em `firebase.js` |

Sem bucket, upload de fotos de OS e arquivos de Central de Informações **não funcionam de verdade** (chamadas Storage falham ou não têm destino).

---

## Necessidade do Blaze

Desde out/2024, **criar bucket novo** no Firebase Storage exige projeto no plano **Blaze** (pay-as-you-go). Spark não permite provisionar o recurso.

Blaze ≠ “conta sem teto automático de alerta”: o dono pode (e deve) configurar **orçamentos/alertas** no Google Cloud Billing. O custo típico de Storage para volume pequeno de fotos de OS é baixo, mas **não é zero** e escala com GB armazenados + egress.

---

## Impacto financeiro (ordem de grandeza — não cotação)

| Fator | Nota |
|-------|------|
| Storage GB/mês | Fotos OS comprimidas: centavos a poucos dólares/mês em operação local pequena |
| Operações Class A/B | Uploads/downloads frequentes aumentam custo marginal |
| Blaze mínimo | Não há mensalidade fixa do Blaze; paga-se pelo uso dos produtos (Functions já estão em Blaze no DEV; PROD conforme projeto) |
| Risco | Sem budget alert, pico de abuso/upload pode surpreender |

**Recomendação financeira:** se autorizar, criar budget alert (ex. limiar baixo) **no mesmo dia** da ativação.

---

## Benefícios

1. Fotos de OS passam a persistir de forma suportada (hoje feature incompleta).
2. Central de Informações com upload real.
3. `storage.rules` e testes `tests/storage-rules/` passam a ter alvo real.
4. Pipeline de deploy deixa de pular storage — rules aplicadas automaticamente.

---

## Riscos

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| Custo Blaze sem alerta | Médio | Budget + alertas GCP |
| CORS incompleto (`cors.json` sem bare domain) | Baixo–médio | Incluir domínio sem `www` no checklist |
| Path legado vs canônico multiempresa | Baixo | Rules já separam; validar smoke |
| Ativar só PROD ou só DEV | Médio | Preferir DEV primeiro, depois PROD |
| Confundir “Blaze” com “abrir tudo” | — | Storage rules já exigem auth + empresa |

---

## Parecer

**Não bloquear** Sprint 4 (usuários/convites).  
**Bloquear** expectativa de “fotos de OS 100% em produção” até decisão Blaze + criação do bucket.

**Recomendação técnica:** autorizar Blaze **quando** fotos/informações forem prioridade de negócio; ordem sugerida: decisão → bucket DEV → smoke → bucket PROD → validar deploy storage no próximo `main`.

**Não executar** criação de bucket nesta sessão.
