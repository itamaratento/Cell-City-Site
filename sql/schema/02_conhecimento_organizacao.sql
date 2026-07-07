-- ============================================================
-- Domínio 02: Central de Comandos/Informações, Central de Organização
-- Fonte: COLECOES_FIRESTORE.md §3-4
-- ============================================================

CREATE TABLE categorias_comandos (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      TEXT NOT NULL UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categorias_informacoes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      TEXT NOT NULL UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE informacoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo              TEXT NOT NULL,
  tipo                TEXT,                       -- 'comando' identifica registros pendentes de migração para `comandos`
  conteudo            TEXT,
  favorito            BOOLEAN DEFAULT false,
  categoria_id         UUID REFERENCES categorias_informacoes (id),
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  migracao            TEXT,                       -- 'comandos_v1' quando já migrado (soft-delete lógico, preservado da regra de negócio original)
  migracao_destino_id UUID,                        -- FK para comandos.id, ver ALTER abaixo
  migracao_em         TIMESTAMPTZ
);

CREATE TABLE comandos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo            TEXT NOT NULL,
  categoria_id       UUID REFERENCES categorias_comandos (id),
  favorito          BOOLEAN DEFAULT false,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  migrado_de        UUID REFERENCES informacoes (id) UNIQUE  -- rastreia a migração v1 (informacoes → comandos); UNIQUE = cada informação migra para no máximo 1 comando, mesma cardinalidade 1:1 já declarada no DER mestre
);

-- blocos: array<string> de `comandos` — tabela filha em vez de array/JSONB
-- para manter ordem+integridade; `conteudo` (compat) é gerado por concatenação
-- na aplicação, não precisa de coluna própria no modelo relacional.
CREATE TABLE comandos_blocos (
  id          BIGSERIAL PRIMARY KEY,
  comando_id  UUID NOT NULL REFERENCES comandos (id) ON DELETE CASCADE,
  ordem       INTEGER NOT NULL,
  texto       TEXT NOT NULL,
  UNIQUE (comando_id, ordem)
);

ALTER TABLE informacoes ADD CONSTRAINT fk_informacoes_migracao_destino
  FOREIGN KEY (migracao_destino_id) REFERENCES comandos (id);
-- UNIQUE: cada comando é destino de migração de no máximo 1 informação.
ALTER TABLE informacoes ADD CONSTRAINT uq_informacoes_migracao_destino UNIQUE (migracao_destino_id);

-- ============================================================
-- Central de Organização — um "documento" por seção, com lista ordenável
-- ============================================================

CREATE TABLE central_organizacao_secoes (
  id            TEXT PRIMARY KEY,              -- nome da seção, ex.: 'comandos-rapidos' (mesmo ID do Firestore)
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE central_organizacao_itens (
  id        BIGSERIAL PRIMARY KEY,
  secao_id  TEXT NOT NULL REFERENCES central_organizacao_secoes (id) ON DELETE CASCADE,
  ordem     INTEGER NOT NULL,
  conteudo  TEXT NOT NULL,
  UNIQUE (secao_id, ordem)
);

-- ============================================================
-- Resumo: 4 entidades Firestore (comandos, categorias_comandos,
-- informacoes, categorias_informacoes) + 1 (central_organizacao)
-- → 7 tabelas SQL.
-- ============================================================
