// Tipos compartilhados para o módulo de contratos de residentes

export interface ContratoData {
  id?: string;
  numero_contrato: string;
  valor_mensalidade: number;
  dia_vencimento: number;
  forma_pagamento: string;
  data_inicio_contrato: string;
  data_fim_contrato?: string | null;
  contratante_nome: string;
  contratante_cpf?: string | null;
  contratante_rg?: string | null;
  contratante_endereco?: string | null;
  contratante_cidade?: string | null;
  contratante_estado?: string | null;
  contratante_cep?: string | null;
  contratante_telefone?: string | null;
  contratante_email?: string | null;
  servicos_inclusos?: string[] | null;
  servicos_adicionais?: string | null;
  clausulas_especiais?: string | null;
  observacoes?: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface ContratoFormData {
  valor_mensalidade: string;
  dia_vencimento: string;
  forma_pagamento: string;
  data_inicio_contrato: string;
  data_fim_contrato: string;
  contratante_nome: string;
  contratante_cpf: string;
  contratante_rg: string;
  contratante_endereco: string;
  contratante_cidade: string;
  contratante_estado: string;
  contratante_cep: string;
  contratante_telefone: string;
  contratante_email: string;
  servicos_inclusos: string[];
  servicos_adicionais: string;
  clausulas_especiais: string;
  observacoes: string;
}

export interface ResidenteData {
  nome_completo: string;
  cpf?: string | null;
  data_nascimento: string;
  numero_prontuario: string;
  quarto?: string | null;
}

export interface EmpresaData {
  nome_empresa: string;
  cnpj?: string | null;
  endereco?: string | null;
}
