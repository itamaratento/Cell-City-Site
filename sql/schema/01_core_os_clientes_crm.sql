-- ============================================================
-- Cell City — Modelagem relacional (preparação, não migração)
-- Domínio 01: OS (Ordem de Serviço), Clientes, CRM Comercial
-- Dialeto: PostgreSQL 15+
-- Fonte: COLECOES_FIRESTORE.md §1-2 (2026-07-07)
-- ============================================================
-- Convenções gerais deste conjunto de arquivos:
--  • snake_case, tabelas no plural.
--  • PK sempre "id" — TEXT quando o Firestore já usa um ID legível/
--    determinístico (ex.: OS-0001, phoneDigits), UUID quando o Firestore
--    usa auto-id sem significado (mapeado 1:1 para não perder rastreabilidade
--    do dado já existente, caso a migração real venha a copiar os IDs).
--  • Campos repetidos do Firestore (arrays de string/objeto) viram tabelas-
--    filhas com FK + coluna de ordem, nunca uma coluna array/JSON, para
--    manter integridade referencial e índices reais — ver nota de tradeoff
--    em sql/00_visao_geral.md (arrays vs. JSONB).
--  • timestamps: TIMESTAMPTZ sempre (Firestore Timestamp e ISO string viram
--    o mesmo tipo — a duplicação campo-ISO/campo-Timestamp do Firestore
--    desaparece na migração).
-- ============================================================

-- gen_random_uuid() é nativo desde o PostgreSQL 13; em versões/ambientes
-- gerenciados que ainda exigem a extensão explícita, esta linha é idempotente.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE clientes (
  phone_digits      TEXT PRIMARY KEY,                 -- Firestore: doc id = phoneDigits
  nome              TEXT NOT NULL,
  telefone          TEXT NOT NULL,                    -- formatado, ex.: (62) 98160-5863
  cpf               TEXT,
  email             TEXT,
  endereco          TEXT,
  observacao        TEXT,
  origem            TEXT NOT NULL CHECK (origem IN ('crm','os','portal')),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ
);
CREATE INDEX idx_clientes_cpf ON clientes (cpf) WHERE cpf IS NOT NULL;

-- Firestore: clientes.history[] (array de IDs de OS) e clientes.crmLeads[]
-- (array de IDs de lead) desaparecem como coluna — viram FK inversa
-- (os.cliente_phone_digits, crm_leads.cliente_phone_digits), consulta por
-- JOIN em vez de array de referências soltas.

CREATE TABLE os (
  id                      TEXT PRIMARY KEY,           -- Firestore: OS-0001, OS-0002... (sequencial, mantém o padrão)
  category                TEXT NOT NULL CHECK (category IN ('celular','notebook','impressora')),
  cliente_phone_digits    TEXT REFERENCES clientes (phone_digits),
  client_name             TEXT NOT NULL,               -- snapshot do nome no momento da OS (histórico, não FK obrigatória)
  phone                    TEXT NOT NULL,
  phone_digits             TEXT NOT NULL,               -- telefone canônico (ver TECHDOC "Telefone Canônico") — igual a cliente_phone_digits na imensa maioria dos casos, mas não é FK direta: a OS preserva o valor de quando foi criada mesmo se o cliente for editado depois
  cpf                      TEXT,
  cep                      TEXT,
  endereco                 TEXT,
  numero                   TEXT,
  complemento              TEXT,
  bairro                   TEXT,
  cidade                   TEXT,
  estado                   TEXT,
  brand                    TEXT,
  model                    TEXT NOT NULL,
  imei                     TEXT,                       -- campo antigo, mantido só por histórico
  imei1                    TEXT,
  imei2                    TEXT,
  defect                   TEXT NOT NULL,
  valor                    NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_cartao             NUMERIC(12,2) NOT NULL DEFAULT 0,
  observations             TEXT,
  obs_rapida               TEXT CHECK (char_length(obs_rapida) <= 100),
  technical_observation    TEXT,
  internal_observation     TEXT,
  password                 TEXT,                       -- ver nota de segurança em sql/00_visao_geral.md — hoje em texto puro no Firestore
  lock_type                TEXT CHECK (lock_type IN ('Numerica','Padrao','Biometria','Face ID','Digital')),
  lock_photo               TEXT,                        -- URL Storage; migração real definirá se o binário some para um object storage compatível
  status                   TEXT NOT NULL CHECK (status IN (
                              'recebido','em_analise','orcamento_enviado','orcamento_aprovado',
                              'orcamento_recusado','em_reparo','testes_finais','concluido','entregue'
                            )),
  prazo_garantia_dias      INTEGER NOT NULL DEFAULT 90,
  garantia_id              TEXT,
  orc1_desc                TEXT,
  orc1_valor               NUMERIC(12,2),
  orc2_desc                TEXT,
  orc2_valor               NUMERIC(12,2),
  orcamento_resposta       TEXT CHECK (orcamento_resposta IN ('aprovado','recusado')),
  orcamento_data_resposta  DATE,
  orcamento_hora_resposta  TIME,
  orcamento_escolhido      TEXT CHECK (orcamento_escolhido IN ('1','2')),
  orcamento_obs            TEXT,
  orcamento_origem         TEXT CHECK (orcamento_origem IN ('whatsapp','portal')),
  -- relatorioTecnico (objeto único, não repetido) — achatado em colunas
  laudo_defeito_informado  TEXT,
  laudo_diagnostico        TEXT,
  laudo_solucao_aplicada   TEXT,
  laudo_observacoes        TEXT,
  laudo_status             TEXT,
  laudo_data               DATE,
  laudo_tecnico            TEXT,
  laudo_exibir_portal      BOOLEAN DEFAULT false,
  criado_em                TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  entregue_em              TIMESTAMPTZ,
  origem                   TEXT CHECK (origem IN ('presencial','portal')),
  solicitacao_id           TEXT,                        -- FK lógica para solicitacoes_diagnostico.id (tabela em 05_posvenda_agenda_portal.sql — FK cruzada, ver nota no DER mestre)
  crm_lead_id              UUID,                         -- FK lógica para crm_leads.id
  pre_os_id                UUID,                         -- FK lógica para pre_os.id (07_diario_...sql)
  os_convertido            BOOLEAN DEFAULT false,
  os_convertido_em         TIMESTAMPTZ
);
CREATE INDEX idx_os_cliente ON os (cliente_phone_digits);
CREATE INDEX idx_os_status ON os (status);
CREATE INDEX idx_os_phone_digits ON os (phone_digits);

-- Tabelas-filhas para os campos repetidos de `os` (arrays no Firestore)
CREATE TABLE os_fotos (
  id          BIGSERIAL PRIMARY KEY,
  os_id       TEXT NOT NULL REFERENCES os (id) ON DELETE CASCADE,
  ordem       INTEGER NOT NULL,
  url         TEXT NOT NULL,
  UNIQUE (os_id, ordem)
);

CREATE TABLE os_timeline (
  id          BIGSERIAL PRIMARY KEY,
  os_id       TEXT NOT NULL REFERENCES os (id) ON DELETE CASCADE,
  data_evento TIMESTAMPTZ NOT NULL,
  texto       TEXT NOT NULL
);
CREATE INDEX idx_os_timeline_os ON os_timeline (os_id, data_evento);

CREATE TABLE os_checklist_entrada (
  os_id     TEXT NOT NULL REFERENCES os (id) ON DELETE CASCADE,
  item_idx  INTEGER NOT NULL,
  PRIMARY KEY (os_id, item_idx)
);

CREATE TABLE os_checklist_saida (
  os_id     TEXT NOT NULL REFERENCES os (id) ON DELETE CASCADE,
  item_idx  INTEGER NOT NULL,
  PRIMARY KEY (os_id, item_idx)
);

CREATE TABLE os_pattern_sequence (
  os_id     TEXT NOT NULL REFERENCES os (id) ON DELETE CASCADE,
  ordem     INTEGER NOT NULL,
  valor     SMALLINT NOT NULL,
  PRIMARY KEY (os_id, ordem)
);

-- ============================================================
-- CRM Comercial
-- ============================================================

CREATE TABLE crm_leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_phone_digits TEXT REFERENCES clientes (phone_digits), -- resolvido a partir de crm_leads.telefone na migração real
  nome              TEXT NOT NULL,
  telefone          TEXT NOT NULL,
  aparelho          TEXT,
  servico           TEXT,
  valor             NUMERIC(12,2),
  obs               TEXT,
  status            TEXT NOT NULL CHECK (status IN (
                       'novo_contato','orcamento_enviado','aguardando_resposta',
                       'negociacao','fechado','pre_os','perdido'
                     )),
  lock_type         TEXT,
  senha             TEXT,
  motivo_perda      TEXT CHECK (motivo_perda IN (
                       'achou_caro','fara_depois','sem_dinheiro','concorrente',
                       'sem_resposta','desistiu','outro'
                     )),
  pre_os_id         UUID,                                -- FK lógica para pre_os.id
  os_convertido     BOOLEAN DEFAULT false,
  os_convertido_em  TIMESTAMPTZ,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE crm_leads_pattern_sequence (
  lead_id   UUID NOT NULL REFERENCES crm_leads (id) ON DELETE CASCADE,
  ordem     INTEGER NOT NULL,
  valor     SMALLINT NOT NULL,
  PRIMARY KEY (lead_id, ordem)
);
-- FK adicionada depois que os/pre_os existem (evita ciclo de criação):
ALTER TABLE os ADD CONSTRAINT fk_os_crm_lead FOREIGN KEY (crm_lead_id) REFERENCES crm_leads (id);
-- UNIQUE: cada lead converte em no máximo 1 OS (Firestore: crm_leads.osConvertido
-- é booleano, um evento único) — sem isso, a cardinalidade 1:1 documentada no
-- DER mestre (§"convertida de") não seria realmente aplicada pelo schema.
ALTER TABLE os ADD CONSTRAINT uq_os_crm_lead UNIQUE (crm_lead_id);

CREATE TABLE chips_cadastros (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operadora       TEXT NOT NULL,
  nome            TEXT NOT NULL,
  cpf             TEXT NOT NULL,
  estado_cpf      TEXT,
  data_nascimento DATE,
  telefone        TEXT,
  status          TEXT NOT NULL CHECK (status IN (
                     'novo_cadastro','dados_coletados','aguardando_ativacao','ativado',
                     'erro_cadastro','cliente_nao_retornou','finalizado'
                   )),
  numero_gerado   TEXT,
  obs             TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE chips_historico (
  id          BIGSERIAL PRIMARY KEY,
  chip_id     UUID NOT NULL REFERENCES chips_cadastros (id) ON DELETE CASCADE,
  acao        TEXT NOT NULL,
  data_evento TIMESTAMPTZ NOT NULL
);

CREATE TABLE contas_numeros (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      TEXT NOT NULL,
  numero    TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Resumo deste domínio: 5 entidades Firestore (clientes, os, crm_leads,
-- chips_cadastros, contas_numeros) → 10 tabelas SQL (5 principais + 5
-- filhas para arrays: os_fotos, os_timeline, os_checklist_entrada,
-- os_checklist_saida, os_pattern_sequence, crm_leads_pattern_sequence,
-- chips_historico — 7 filhas, não 5, ver contagem exata no relatório final).
-- ============================================================
