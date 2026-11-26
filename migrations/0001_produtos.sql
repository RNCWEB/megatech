-- RNCWEB
CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL CHECK(length(trim(nome)) BETWEEN 1 AND 150),
  descricao TEXT NOT NULL DEFAULT '' CHECK(length(descricao) <= 2000),
  categoria TEXT NOT NULL DEFAULT '' CHECK(length(categoria) <= 100),
  preco_centavos INTEGER NOT NULL CHECK(typeof(preco_centavos) = 'integer' AND preco_centavos >= 0),
  preco_promocional_centavos INTEGER CHECK(preco_promocional_centavos IS NULL OR (typeof(preco_promocional_centavos) = 'integer' AND preco_promocional_centavos >= 0 AND preco_promocional_centavos < preco_centavos)),
  estoque INTEGER NOT NULL DEFAULT 0 CHECK(typeof(estoque) = 'integer' AND estoque >= 0),
  imagem_url TEXT NOT NULL DEFAULT '' CHECK(length(imagem_url) <= 2048),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0, 1)),
  destaque INTEGER NOT NULL DEFAULT 0 CHECK(destaque IN (0, 1)),
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_produtos_catalogo ON produtos(ativo, destaque DESC, id DESC);
