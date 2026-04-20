ALTER TABLE public.configuracoes_empresa
  ADD COLUMN IF NOT EXISTS geofence_ativo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS geofence_latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS geofence_longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS geofence_raio_metros INTEGER NOT NULL DEFAULT 150;