-- Habilitar extensão pgcrypto para funções de hash
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Comentário: A extensão pgcrypto é necessária para as funções digest() e encode()
-- usadas na validação de employer_code com hash SHA-256