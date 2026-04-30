// Definição centralizada dos campos da Ficha de Acolhimento
// Permite reuso entre formulário público e visualização admin

export interface CampoFicha {
  key: string;
  label: string;
  tipo: "text" | "textarea" | "select";
  opcoes?: string[];
  placeholder?: string;
}

export const CAMPOS_HISTORICO_SAUDE: CampoFicha[] = [
  { key: "doencas_previas", label: "Doenças prévias / diagnósticos", tipo: "textarea", placeholder: "Ex.: hipertensão, diabetes tipo 2, Alzheimer..." },
  { key: "alergias", label: "Alergias (medicamentos, alimentos, outros)", tipo: "textarea", placeholder: "Liste todas as alergias conhecidas" },
  { key: "cirurgias", label: "Cirurgias realizadas", tipo: "textarea", placeholder: "Procedimento e ano (aproximado)" },
  { key: "medicacoes_uso", label: "Medicações em uso contínuo", tipo: "textarea", placeholder: "Nome do medicamento, dose e horários" },
  { key: "plano_saude", label: "Plano de saúde / convênio", tipo: "text", placeholder: "Operadora e número da carteirinha" },
  { key: "medico_referencia", label: "Médico(a) de referência", tipo: "text", placeholder: "Nome, especialidade e telefone" },
  { key: "hospital_preferencia", label: "Hospital de preferência em emergências", tipo: "text" },
  { key: "vacinas_recentes", label: "Vacinas recentes (últimos 12 meses)", tipo: "textarea", placeholder: "Ex.: Influenza 04/2025, COVID 10/2024..." },
];

export const CAMPOS_HABITOS_ROTINA: CampoFicha[] = [
  { key: "alimentacao", label: "Hábitos alimentares", tipo: "textarea", placeholder: "Preferências, número de refeições, dieta especial" },
  { key: "restricoes_alimentares", label: "Restrições alimentares", tipo: "textarea", placeholder: "Alimentos que não pode ou não gosta de consumir" },
  { key: "sono", label: "Padrão de sono", tipo: "textarea", placeholder: "Horário de dormir e acordar, sono fragmentado, uso de medicação para dormir" },
  { key: "higiene", label: "Higiene pessoal", tipo: "textarea", placeholder: "Banho (frequência/horário preferido), uso de fralda, autonomia" },
  { key: "mobilidade", label: "Mobilidade e dependência (AGDI)", tipo: "select", opcoes: ["Independente", "Semi-dependente (Grau I)", "Dependente (Grau II)", "Totalmente dependente (Grau III)"] },
  { key: "uso_dispositivos", label: "Uso de dispositivos auxiliares", tipo: "textarea", placeholder: "Bengala, andador, cadeira de rodas, óculos, prótese auditiva, dentária..." },
  { key: "lazer", label: "Atividades de lazer e interesses", tipo: "textarea", placeholder: "Hobbies, programas de TV, leituras, música preferida, jogos" },
  { key: "religiao", label: "Religião / espiritualidade", tipo: "text", placeholder: "Religião e práticas relevantes" },
  { key: "comportamento", label: "Comportamento e personalidade", tipo: "textarea", placeholder: "Temperamento, gatilhos de irritação, formas de acolhimento" },
  { key: "rotina_familia", label: "Rotina com a família", tipo: "textarea", placeholder: "Visitas, ligações, datas importantes" },
  { key: "observacoes_cuidados", label: "Observações importantes para os cuidadores", tipo: "textarea", placeholder: "Tudo que a equipe deve saber para um bom acolhimento" },
];

export const TERMO_LGPD = `TERMO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS – LGPD (Lei 13.709/2018)

Ao preencher esta Ficha de Acolhimento, você (responsável legal/familiar) declara estar ciente e autoriza o tratamento dos dados pessoais e dados pessoais sensíveis (informações de saúde, hábitos e rotina) do(a) idoso(a) sob seus cuidados, para as seguintes finalidades:

1. Garantir o acolhimento humanizado, seguro e personalizado do residente na instituição;
2. Permitir a elaboração do plano individual de cuidados, dieta, prescrição médica e atividades;
3. Compartilhar informações estritamente necessárias com a equipe técnica multiprofissional (médico, enfermagem, nutrição, fisioterapia, cuidadores);
4. Cumprir obrigações legais, sanitárias e regulamentares aplicáveis a Instituições de Longa Permanência (ILPI).

Os dados serão armazenados de forma segura, com acesso restrito a profissionais autorizados, e mantidos apenas pelo período necessário ao cumprimento das finalidades acima ou conforme exigido por lei. Você poderá, a qualquer momento, solicitar acesso, correção, atualização ou exclusão dos dados, bem como revogar este consentimento, mediante solicitação formal à instituição.

Ao marcar a opção abaixo e enviar a ficha, você confirma que leu, compreendeu e concorda integralmente com os termos acima.`;