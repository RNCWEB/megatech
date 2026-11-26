-- RNCWEB
CREATE TABLE IF NOT EXISTS produto_fotos (
  id TEXT PRIMARY KEY,
  jpeg TEXT NOT NULL CHECK(length(jpeg)<=400000)
);
