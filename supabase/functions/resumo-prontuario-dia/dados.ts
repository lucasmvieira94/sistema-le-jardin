export interface RegistroDia {
  id: string;
  data_registro: string;
  horario_registro: string;
  tipo_registro: string;
  titulo: string | null;
  descricao: string | null;
  observacoes: string | null;
  funcionario_nome?: string | null;
  retifica_registro_id?: string | null;
  justificativa_retificacao?: string | null;
}

/** Só o dia solicitado entra na análise; identidades ficam fora do prompt. */
export function dadosParaResumo(registros: RegistroDia[], data: string) {
  return registros.filter((r) => r.data_registro === data).map((r) => ({
    id: r.id, horario: r.horario_registro, tipo: r.tipo_registro, titulo: r.titulo,
    descricao: r.descricao, observacoes: r.observacoes,
    retifica_registro_id: r.retifica_registro_id,
    justificativa_retificacao: r.justificativa_retificacao,
  }));
}