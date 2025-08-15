-- Inserir alguns residentes de exemplo
INSERT INTO public.residentes (
  nome_completo, 
  data_nascimento, 
  cpf, 
  numero_prontuario, 
  quarto, 
  responsavel_nome, 
  responsavel_telefone,
  condicoes_medicas,
  observacoes_gerais
) VALUES 
(
  'Maria Silva Santos', 
  '1940-03-15', 
  '123.456.789-01', 
  'PRONT001', 
  '101', 
  'João Santos Silva',
  '(11) 99999-1111',
  'Hipertensão arterial, diabetes tipo 2',
  'Paciente colaborativa, necessita auxílio para locomoção'
),
(
  'José Oliveira Lima', 
  '1935-07-22', 
  '987.654.321-02', 
  'PRONT002', 
  '102', 
  'Ana Oliveira',
  '(11) 99999-2222',
  'Alzheimer inicial, osteoporose',
  'Necessita supervisão constante, medicação controlada'
),
(
  'Antônia Costa Pereira', 
  '1950-11-08', 
  '456.789.123-03', 
  'PRONT003', 
  '201', 
  'Carlos Pereira',
  '(11) 99999-3333',
  'Artrite reumatóide, depressão',
  'Participa de atividades em grupo, gosta de música'
),
(
  'Francisco Santos Rocha', 
  '1938-12-03', 
  '789.123.456-04', 
  'PRONT004', 
  '202', 
  'Mariana Rocha',
  '(11) 99999-4444',
  'Parkinson, dificuldade de deglutição',
  'Dieta pastosa, fisioterapia diária'
);