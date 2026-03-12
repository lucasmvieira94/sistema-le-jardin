
INSERT INTO public.feedback_sistema (funcionario_id, funcionario_nome, facilidade_uso, processos_manuais, funcionalidades_desejadas, dificuldade_ferramentas_digitais, melhorias_sugeridas, satisfacao_registro_ponto, satisfacao_prontuario, satisfacao_controle_temperatura, satisfacao_controle_fraldas, satisfacao_escala, sugestoes, criticas, elogios, observacoes_gerais)
VALUES
-- 1. Ana Paula - muito positiva
('b51eaacf-83b2-4d8d-b8ad-1792d1f7ffd6', 'ANA PAULA SANTOS DE ALMEIDA', 'concordo_totalmente', 'Controle de visitantes ainda é feito em caderno', 'Registro de visitas dos familiares e controle de saída dos residentes', 'nenhuma', 'Melhorar a velocidade do carregamento das páginas', 'muito_satisfeito', 'muito_satisfeito', 'satisfeito', 'muito_satisfeito', 'satisfeito', 'Adicionar modo escuro para uso noturno', NULL, 'O sistema facilitou muito o registro de ponto, não preciso mais de papel!', 'Excelente sistema no geral'),

-- 2. Edicleide - positiva com ressalvas
('43098b79-23ea-4bc0-be56-581b74d638c3', 'EDICLEIDE MOTA DA SILVA', 'concordo', 'Escalas impressas e coladas na parede, controle de medicamentos em planilha Excel', 'Alerta automático quando o estoque de fraldas estiver baixo', 'pouca', 'Ter notificações no celular quando houver mudança na escala', 'satisfeito', 'satisfeito', 'muito_satisfeito', 'satisfeito', 'muito_satisfeito', 'Seria bom ter um chat entre os funcionários dentro do sistema', 'Às vezes o sistema demora para carregar no celular', 'Gosto muito do controle de temperatura, ficou muito prático', NULL),

-- 3. Marcia - neutra
('6f3a2a53-77af-4147-b5f8-35a3564bcfec', 'MARCIA MARIA DE GOES FREIRE', 'neutro', 'Relatórios de enfermagem são feitos à mão', 'Impressão de relatórios diretamente pelo sistema', 'moderada', 'Deixar as letras maiores e os botões mais fáceis de clicar', 'neutro', 'satisfeito', 'neutro', 'nao_utilizo', 'neutro', 'Gostaria de poder acessar offline quando a internet cai', 'O tamanho das letras é muito pequeno no celular', NULL, 'Tenho dificuldade com tecnologia mas estou me adaptando'),

-- 4. Anny - muito positiva
('c2c787a9-7640-43b2-a1e9-f8241b0d20fc', 'ANNY CAROLINNE SILVA SANTOS', 'concordo_totalmente', NULL, 'Dashboard com resumo do dia para cada funcionário', 'nenhuma', 'Integração com WhatsApp para receber avisos', 'muito_satisfeito', 'muito_satisfeito', 'muito_satisfeito', 'satisfeito', 'muito_satisfeito', NULL, NULL, 'Sistema excelente! Muito melhor que o anterior. Parabéns à equipe!', NULL),

-- 5. Karla - insatisfeita
('0655f54b-126a-4346-82bf-185e8d8ce55b', 'KARLA PATRICIA DA SILVA FERREIRA', 'discordo', 'Quase tudo ainda é manual: escalas, prontuários, controle de fraldas', 'Tutorial em vídeo explicando cada funcionalidade', 'muita', 'Simplificar o registro de ponto, são muitos cliques', 'insatisfeito', 'insatisfeito', 'nao_utilizo', 'nao_utilizo', 'insatisfeito', 'Precisa de um treinamento presencial para os funcionários', 'O sistema é confuso e difícil de navegar para quem não tem costume com celular', NULL, 'Preferia o método antigo de registro em papel'),

-- 6. Kamila - positiva
('86ca3db4-250a-431c-bca1-51270903d5a7', 'KAMILA SANTANA DA SILVA', 'concordo', 'Controle de medicamentos controlados ainda em livro de registro', 'Lembrete de horário de medicação dos residentes', 'pouca', 'Adicionar fotos dos residentes no prontuário para facilitar identificação', 'satisfeito', 'muito_satisfeito', 'satisfeito', 'satisfeito', 'satisfeito', 'Poder registrar intercorrências com foto', NULL, 'O prontuário eletrônico é maravilhoso, muito mais organizado que o papel', NULL),

-- 7. Miriam - neutra/negativa
('d3ccf302-6de9-402c-8649-5d9bb06f738a', 'MIRIAM CONCEIÇÃO ARAUJO', 'discordo', 'Registro de entrada e saída de visitantes, controle de pertences dos residentes', 'Controle de pertences e roupas dos residentes', 'moderada', 'Ter uma versão mais simples do sistema para quem tem dificuldade', 'neutro', 'neutro', 'insatisfeito', 'neutro', 'nao_utilizo', 'Criar um modo simplificado com menos opções na tela', 'O sistema tem muitas opções e me confundo', NULL, 'Preciso de ajuda das colegas para usar o sistema'),

-- 8. Amandha - muito positiva
('37ba71b6-e5bc-41b3-bee3-e8bd6b962923', 'AMANDHA KRYSCIA DOS SANTOS', 'concordo_totalmente', NULL, 'Relatório automático de não conformidades', 'nenhuma', 'Mais gráficos e relatórios visuais para a gestão', 'muito_satisfeito', 'muito_satisfeito', 'muito_satisfeito', 'muito_satisfeito', 'muito_satisfeito', 'Exportação de dados em PDF para reuniões', NULL, 'O melhor sistema que já utilizei! Interface linda e funcional', 'Recomendo para todas as ILPIs'),

-- 9. Juciara - positiva com sugestões
('ca3ec2bf-be1a-469b-a6f2-a5c4cd7545b7', 'JUCIARA VIEIRA DOS SANTOS', 'concordo', 'Cardápio dos residentes ainda é impresso semanalmente', 'Módulo de nutrição e cardápio dos residentes', 'pouca', 'Integração do cardápio com as necessidades dietéticas dos residentes', 'satisfeito', 'satisfeito', 'satisfeito', 'muito_satisfeito', 'satisfeito', 'Adicionar controle de dietas especiais', 'Falta um módulo de nutrição', 'O controle de fraldas ajudou muito na organização do estoque', 'O sistema poderia ter um módulo de alimentação'),

-- 10. Graciela - negativa
('6b3238b8-f29a-4261-a231-d06b7d68f519', 'GRACIELA DA CONCEIÇÃO LIMA', 'discordo_totalmente', 'Tudo é manual na minha rotina, não consigo usar o sistema', 'Nenhuma, prefiro papel', 'muita', 'Treinamento intensivo antes de obrigar o uso', 'insatisfeito', 'nao_utilizo', 'nao_utilizo', 'nao_utilizo', 'nao_utilizo', NULL, 'Não tive treinamento adequado e me sinto perdida', NULL, 'Gostaria de ter mais paciência para aprender mas a rotina é muito corrida'),

-- 11. Ana Maria - neutra/positiva
('ec61f5dc-b884-4632-9f37-380c922bfa2a', 'ANA MARIA DOS SANTOS CATANDUBAS', 'concordo', 'Comunicação entre turnos ainda é por caderno de ocorrências', 'Livro de ocorrências digital para passagem de plantão', 'pouca', 'Melhorar a passagem de plantão digital', 'satisfeito', 'neutro', 'satisfeito', 'satisfeito', 'neutro', 'Ter um mural de avisos dentro do sistema', NULL, 'Registro de ponto pelo celular é muito prático', NULL),

-- 12. Adriana - positiva
('2b025d6c-ac47-474c-8e41-7ac6332bce68', 'ADRIANA CONCEIÇÃO SANTOS', 'concordo', 'Agendamento de consultas médicas dos residentes', 'Agenda de consultas e exames dos residentes', 'nenhuma', 'Adicionar agenda médica dos residentes', 'muito_satisfeito', 'satisfeito', 'satisfeito', 'neutro', 'muito_satisfeito', 'Módulo de agendamento de consultas e exames', NULL, 'A escala ficou muito mais organizada no sistema', 'Sistema muito bom, só falta a parte de agenda médica');
