export interface AfastamentoFormValues {
  funcionario_id: string;
  tipo_afastamento_id: string;
  tipo_periodo: "horas" | "dias";
  data_inicio: string;
  hora_inicio?: string;
  quantidade_horas?: number;
  quantidade_dias?: number;
  observacoes?: string;
}

export function criarValoresIniciaisAfastamento(): AfastamentoFormValues {
  return {
    funcionario_id: "",
    tipo_afastamento_id: "",
    tipo_periodo: "dias",
    data_inicio: "",
    hora_inicio: "",
    quantidade_horas: undefined,
    quantidade_dias: undefined,
    observacoes: "",
  };
}