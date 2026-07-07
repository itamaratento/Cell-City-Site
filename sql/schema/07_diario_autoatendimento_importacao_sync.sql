-- ============================================================
-- Domínio 07: Diário, Autoatendimento/Pré-OS, Importação de Vendas,
-- Sincronização e Backup (Google Drive)
-- Fonte: COLECOES_FIRESTORE.md §15-18
-- ============================================================

CREATE TABLE diario_registros (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo         TEXT NOT NULL,
  categoria      TEXT,
  status         TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluido','arquivado')),
  favorito       BOOLEAN DEFAULT false,
  backup_drive_id   TEXT,
  backup_drive_link TEXT,
  backup_sync_em    TIMESTAMPTZ,
  data_revisao   DATE,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE diario_eventos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id      UUID NOT NULL REFERENCES diario_registros (id) ON DELETE CASCADE,
  registro_titulo  TEXT NOT NULL,          -- snapshot no momento do evento (histórico intencional, não normalizado)
  categoria        TEXT,
  tipo             TEXT NOT NULL CHECK (tipo IN ('criado','status','favorito','arquivado','restaurado','excluido')),
  descricao        TEXT,
  em               TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_diario_eventos_registro ON diario_eventos (registro_id, em DESC);

CREATE TABLE pre_os (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT,
  telefone      TEXT,
  status        TEXT NOT NULL DEFAULT 'AGUARDANDO_CONVERSAO' CHECK (status IN ('AGUARDANDO_CONVERSAO','CONVERTIDA')),
  os_id         TEXT REFERENCES os (id),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE os ADD CONSTRAINT fk_os_pre_os FOREIGN KEY (pre_os_id) REFERENCES pre_os (id);
ALTER TABLE crm_leads ADD CONSTRAINT fk_crm_leads_pre_os FOREIGN KEY (pre_os_id) REFERENCES pre_os (id);

CREATE TABLE vendas_importadas (
  id             TEXT PRIMARY KEY,             -- Firestore: `beep_<idOriginal>` — preservado como PK natural
  id_original    TEXT NOT NULL,
  cliente_phone_digits TEXT REFERENCES clientes (phone_digits),
  data_venda     DATE,
  total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  importado_de   TEXT NOT NULL DEFAULT 'beepstart',
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Sincronização e Backup (Google Drive) ----------

CREATE TABLE cc_lixeira (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo             TEXT NOT NULL,
  registro_id        TEXT NOT NULL,           -- referência lógica (o registro original pode já não existir mais em nenhuma tabela)
  titulo             TEXT NOT NULL,
  registro_snapshot  JSONB NOT NULL,          -- snapshot completo do registro excluído — JSONB é o caso de uso correto aqui: é literalmente um backup de documento, não dado consultável
  backup_drive_id    TEXT,
  backup_drive_link  TEXT,
  apelido            TEXT NOT NULL,
  excluido_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cc_lixeira_modulo ON cc_lixeira (modulo, registro_id);
CREATE INDEX idx_cc_lixeira_retencao ON cc_lixeira (excluido_em);  -- suporta a rotina de expurgo aos 30 dias (RETENCAO_DIAS)

CREATE TABLE cc_gdrive_logs (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acao      TEXT NOT NULL CHECK (acao IN ('exclusao','exclusao_definitiva','restauracao','reenvio')),
  modulo    TEXT,
  apelido   TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gdrive_credenciais (
  id            SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- documento único global ("_credenciais")
  client_id     TEXT NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE gdrive_config_modulo (
  modulo_key  TEXT PRIMARY KEY,               -- Firestore: gdrive_backup/{moduleKey}
  ultima_sync TIMESTAMPTZ
);

-- ============================================================
-- Resumo: 7 entidades Firestore (diario_registros, diario_eventos, pre_os,
-- vendas_importadas, cc_lixeira, cc_gdrive_logs, gdrive_backup) → 7 tabelas
-- SQL (gdrive_backup vira 2 tabelas — credenciais globais + config por
-- módulo — porque no Firestore já eram 2 "formas" de documento na mesma
-- coleção; nenhuma tabela-filha de array neste domínio).
-- ============================================================
