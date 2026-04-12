
-- 1. Create missing gamification profiles
INSERT INTO gamification_profiles (funcionario_id, xp_total, moedas, streak_plantoes, ultimo_plantao_data)
VALUES 
  ('c2c787a9-7640-43b2-a1e9-f8241b0d20fc', 0, 0, 0, NULL),
  ('43098b79-23ea-4bc0-be56-581b74d638c3', 0, 0, 0, NULL),
  ('c3883510-16f6-4ce0-bc39-70673c4407b3', 0, 0, 0, NULL),
  ('ca3ec2bf-be1a-469b-a6f2-a5c4cd7545b7', 0, 0, 0, NULL),
  ('86ca3db4-250a-431c-bca1-51270903d5a7', 0, 0, 0, NULL),
  ('6f3a2a53-77af-4147-b5f8-35a3564bcfec', 0, 0, 0, NULL),
  ('51f7db63-bd22-4c73-9fa1-2bddbc9ac721', 0, 0, 0, NULL)
ON CONFLICT (funcionario_id) DO NOTHING;

-- 2. Insert retroactive plantão transactions
INSERT INTO gamification_transactions (funcionario_id, tipo, xp_delta, moedas_delta, descricao) VALUES
  ('2b025d6c-ac47-474c-8e41-7ac6332bce68', 'plantao', 1398, 1398, 'Pontuação retroativa Jan-Abr/2026 (50 plantões)'),
  ('37ba71b6-e5bc-41b3-bee3-e8bd6b962923', 'plantao', 1526, 1526, 'Pontuação retroativa Jan-Abr/2026 (54 plantões)'),
  ('ec61f5dc-b884-4632-9f37-380c922bfa2a', 'plantao', 868, 918, 'Pontuação retroativa Jan-Abr/2026 (35 plantões)'),
  ('b51eaacf-83b2-4d8d-b8ad-1792d1f7ffd6', 'plantao', 1417, 1417, 'Pontuação retroativa Jan-Abr/2026 (51 plantões)'),
  ('c2c787a9-7640-43b2-a1e9-f8241b0d20fc', 'plantao', 1410, 1410, 'Pontuação retroativa Jan-Abr/2026 (50 plantões)'),
  ('43098b79-23ea-4bc0-be56-581b74d638c3', 'plantao', 1218, 1218, 'Pontuação retroativa Jan-Abr/2026 (44 plantões)'),
  ('c3883510-16f6-4ce0-bc39-70673c4407b3', 'plantao', 898, 898, 'Pontuação retroativa Jan-Abr/2026 (34 plantões)'),
  ('ca3ec2bf-be1a-469b-a6f2-a5c4cd7545b7', 'plantao', 546, 546, 'Pontuação retroativa Jan-Abr/2026 (23 plantões)'),
  ('86ca3db4-250a-431c-bca1-51270903d5a7', 'plantao', 930, 930, 'Pontuação retroativa Jan-Abr/2026 (35 plantões)'),
  ('0655f54b-126a-4346-82bf-185e8d8ce55b', 'plantao', 688, 888, 'Pontuação retroativa Jan-Abr/2026 (45 plantões)'),
  ('6f3a2a53-77af-4147-b5f8-35a3564bcfec', 'plantao', 1410, 1410, 'Pontuação retroativa Jan-Abr/2026 (50 plantões)'),
  ('d3ccf302-6de9-402c-8649-5d9bb06f738a', 'plantao', 1006, 1156, 'Pontuação retroativa Jan-Abr/2026 (49 plantões)'),
  ('51f7db63-bd22-4c73-9fa1-2bddbc9ac721', 'plantao', 112, 112, 'Pontuação retroativa Jan-Abr/2026 (7 plantões)'),
  ('8944790f-5f8a-4490-a715-25faee4cc52a', 'plantao', 1366, 1366, 'Pontuação retroativa Jan-Abr/2026 (49 plantões)'),
  ('e50bb8e1-90e3-4b99-885f-5ca2e9b5243b', 'plantao', 1430, 1430, 'Pontuação retroativa Jan-Abr/2026 (51 plantões)');

-- 3. Insert penalty transactions (using correct enum values)
INSERT INTO gamification_transactions (funcionario_id, tipo, xp_delta, moedas_delta, descricao) VALUES
  ('d3ccf302-6de9-402c-8649-5d9bb06f738a', 'advertencia_escrita', -50, 0, 'Penalidade retroativa: 1 advertência escrita'),
  ('ec61f5dc-b884-4632-9f37-380c922bfa2a', 'advertencia_escrita', -50, 0, 'Penalidade retroativa: 1 advertência escrita'),
  ('0655f54b-126a-4346-82bf-185e8d8ce55b', 'falta_injustificada', -200, 0, 'Penalidade retroativa: 2 faltas injustificadas'),
  ('d3ccf302-6de9-402c-8649-5d9bb06f738a', 'falta_injustificada', -100, 0, 'Penalidade retroativa: 1 falta injustificada');

-- 4. Update all profiles with final totals
UPDATE gamification_profiles SET xp_total = 1410, moedas = 1410, streak_plantoes = 20, ultimo_plantao_data = '2026-04-11' WHERE funcionario_id = '2b025d6c-ac47-474c-8e41-7ac6332bce68';
UPDATE gamification_profiles SET xp_total = 1538, moedas = 1538, streak_plantoes = 20, ultimo_plantao_data = '2026-04-11' WHERE funcionario_id = '37ba71b6-e5bc-41b3-bee3-e8bd6b962923';
UPDATE gamification_profiles SET xp_total = 880, moedas = 930, streak_plantoes = 20, ultimo_plantao_data = '2026-04-11' WHERE funcionario_id = 'ec61f5dc-b884-4632-9f37-380c922bfa2a';
UPDATE gamification_profiles SET xp_total = 1442, moedas = 1442, streak_plantoes = 20, ultimo_plantao_data = '2026-04-11' WHERE funcionario_id = 'b51eaacf-83b2-4d8d-b8ad-1792d1f7ffd6';
UPDATE gamification_profiles SET xp_total = 1410, moedas = 1410, streak_plantoes = 20, ultimo_plantao_data = '2026-04-11' WHERE funcionario_id = 'c2c787a9-7640-43b2-a1e9-f8241b0d20fc';
UPDATE gamification_profiles SET xp_total = 1218, moedas = 1218, streak_plantoes = 20, ultimo_plantao_data = '2026-04-11' WHERE funcionario_id = '43098b79-23ea-4bc0-be56-581b74d638c3';
UPDATE gamification_profiles SET xp_total = 898, moedas = 898, streak_plantoes = 20, ultimo_plantao_data = '2026-04-11' WHERE funcionario_id = 'c3883510-16f6-4ce0-bc39-70673c4407b3';
UPDATE gamification_profiles SET xp_total = 546, moedas = 546, streak_plantoes = 20, ultimo_plantao_data = '2026-04-11' WHERE funcionario_id = 'ca3ec2bf-be1a-469b-a6f2-a5c4cd7545b7';
UPDATE gamification_profiles SET xp_total = 930, moedas = 930, streak_plantoes = 20, ultimo_plantao_data = '2026-04-11' WHERE funcionario_id = '86ca3db4-250a-431c-bca1-51270903d5a7';
UPDATE gamification_profiles SET xp_total = 700, moedas = 900, streak_plantoes = 15, ultimo_plantao_data = '2026-04-11' WHERE funcionario_id = '0655f54b-126a-4346-82bf-185e8d8ce55b';
UPDATE gamification_profiles SET xp_total = 1410, moedas = 1410, streak_plantoes = 20, ultimo_plantao_data = '2026-04-11' WHERE funcionario_id = '6f3a2a53-77af-4147-b5f8-35a3564bcfec';
UPDATE gamification_profiles SET xp_total = 1018, moedas = 1168, streak_plantoes = 20, ultimo_plantao_data = '2026-04-11' WHERE funcionario_id = 'd3ccf302-6de9-402c-8649-5d9bb06f738a';
UPDATE gamification_profiles SET xp_total = 112, moedas = 112, streak_plantoes = 7, ultimo_plantao_data = '2026-04-11' WHERE funcionario_id = '51f7db63-bd22-4c73-9fa1-2bddbc9ac721';
UPDATE gamification_profiles SET xp_total = 1378, moedas = 1378, streak_plantoes = 20, ultimo_plantao_data = '2026-04-11' WHERE funcionario_id = '8944790f-5f8a-4490-a715-25faee4cc52a';
UPDATE gamification_profiles SET xp_total = 1442, moedas = 1442, streak_plantoes = 20, ultimo_plantao_data = '2026-04-11' WHERE funcionario_id = 'e50bb8e1-90e3-4b99-885f-5ca2e9b5243b';
