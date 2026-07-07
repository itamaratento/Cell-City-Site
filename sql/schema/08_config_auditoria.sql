-- ============================================================
-- Domínio 08: Configurações do Sistema, Auditoria e Logs
-- Fonte: COLECOES_FIRESTORE.md §19-20
-- ============================================================
-- `config` no Firestore é uma coleção "genérica demais" por design (7+
-- documentos de propósitos distintos, cada um com seu próprio formato —
-- já registrado como débito técnico em plans/PLANO_DIRETOR_PROXIMA_FASE
-- _20260704.md item "Coleção config genérica demais"). Em vez de replicar
-- essa mistura numa única tabela EAV, cada documento conhecido de `config`
-- vira sua própria tabela tipada (mesma lógica já aplicada a `gdrive_backup`
-- no domínio 07) — ganha tipagem e constraint real; documentos futuros
-- ainda não mapeados entram por uma tabela de fallback genérica.
-- ============================================================

CREATE TABLE config_impressao (
  id       SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  loja     JSONB NOT NULL,           -- {nome, endereco, telefone...} — objeto de exibição de recibo, sem consulta própria; JSONB aceitável (ver sql/00_visao_geral.md, caso "vitrine de exibição")
  logo     TEXT,
  garantias JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE config_pin (
  id            SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pin_hash      TEXT NOT NULL,       -- migração real deve gravar hash, nunca o PIN em texto puro (ver débito técnico já registrado no projeto)
  updated_at    TIMESTAMPTZ
);

CREATE TABLE config_migracao_comandos_v1 (
  id            SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  concluida     BOOLEAN NOT NULL DEFAULT false,
  executada_em  TIMESTAMPTZ,
  migrados      INTEGER DEFAULT 0,
  ignorados     INTEGER DEFAULT 0,
  erros         INTEGER DEFAULT 0,
  log           JSONB                -- relatório de execução, só leitura de auditoria — JSONB apropriado
);

CREATE TABLE config_pre_os_counter (
  id      SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ultimo  BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE config_generico (
  -- Fallback para documentos de `config` ainda não mapeados individualmente
  -- na migração real — cada um deveria virar sua própria tabela tipada
  -- assim que sua estrutura for revisada; não é destino final, é rede de
  -- segurança para não perder dado desconhecido durante a migração.
  chave     TEXT PRIMARY KEY,
  valor     JSONB NOT NULL,
  migrado_para_tabela TEXT            -- preenchido quando alguém tipar esse documento — vira NULL só enquanto pendente
);

CREATE TABLE metadata (
  id     SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- Firestore: doc id = 'counter'
  value  BIGINT NOT NULL DEFAULT 0
);

-- ---------- Auditoria e Logs ----------

CREATE TABLE auditoria_usuarios_permissoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acao        TEXT NOT NULL,
  admin_uid   UUID NOT NULL REFERENCES usuarios (id),
  admin_nome  TEXT NOT NULL,
  alvo_uid    UUID REFERENCES usuarios (id),
  alvo_nome   TEXT,
  detalhes    JSONB,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Regra de negócio original (`allow update, delete: if false` no Firestore)
-- vira, no SQL, um trigger que bloqueia UPDATE/DELETE nesta tabela —
-- ver sql/02_migracao_estrategia.md "Regras de negócio que viram trigger".
CREATE INDEX idx_auditoria_usuarios_permissoes_admin ON auditoria_usuarios_permissoes (admin_uid, criado_em DESC);

CREATE TABLE auditoria_saas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   TEXT NOT NULL REFERENCES empresas (id),
  usuario_id   UUID REFERENCES usuarios (id),
  detalhes     JSONB,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notificacoes_saas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        TEXT NOT NULL CHECK (tipo = 'licenca_vencida'),
  empresa_id  TEXT NOT NULL REFERENCES empresas (id),
  detalhes    JSONB,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE backup_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo       TEXT NOT NULL,
  slot       TEXT NOT NULL,
  data_iso   TIMESTAMPTZ NOT NULL,
  detalhes   JSONB
);

-- ============================================================
-- Legado com repository preparado, sem consumidor de código hoje (ver
-- COLECOES_FIRESTORE.md §21.1) — mantidas só para paridade 1:1 com a
-- Camada Repository. Campos não documentados (zero escrita ativa a
-- auditar); estrutura mínima, a expandir se algum dia ganharem consumidor.
-- ============================================================
CREATE TABLE historico_diario (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_ref  DATE
);
CREATE TABLE historico_semanal (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_ref    DATE
);
CREATE TABLE historico_mensal (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_ref   DATE
);
CREATE TABLE resumo_live (
  id  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1)
);

-- ============================================================
-- Resumo: `config` (1 coleção Firestore, propósito misto) → 5 tabelas
-- tipadas + 1 fallback genérico. `metadata`, `auditoria_usuarios_permissoes`,
-- `auditoria_saas`, `notificacoes_saas`, `backup_logs` → 1:1. 4 legadas
-- (`historico_diario`, `historico_semanal`, `historico_mensal`, `resumo_live`).
-- Total do domínio: 5 entidades Firestore ativas + 4 legadas → 14 tabelas SQL.
-- ============================================================
