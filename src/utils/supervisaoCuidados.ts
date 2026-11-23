import { montarMapaDia, saldoPorResidente, type PrescricaoMapa, type AdministracaoMapa } from './mapaMedicamentos';
import { ocorrenciasDoDia, type RotinaCuidado, type ExecucaoRotina } from './rotinasCuidados';

export interface AtividadeSupervisao {
  categoria: string; detalhe: string; momento: string; funcionario_nome: string | null;
  residente_nome: string | null; residente_id: string | null;
}
export interface PainelSupervisao {
  dia: string; atualizado_em: string;
  residentes: { id: string; nome_completo: string; quarto: string | null }[];
  rotinas: RotinaCuidado[]; execucoes: ExecucaoRotina[];
  agenda: { id: string; residente_id: string; residente_nome: string; titulo: string; horario: string | null; observacoes: string | null; visto_em: string | null; visto_por_nome: string | null }[];
  prescricoes: PrescricaoMapa[];
  administracoes: (AdministracaoMapa & { status: string })[];
  estoques: { id: string; residente_id: string | null; medicamento_id: string; quantidade_atual: number; quantidade_minima: number | null; data_validade: string | null; lote: string | null; tipo_estoque: string; nome: string; residente_nome: string | null }[];
  fraldas: { id: string; residente_nome: string | null; tipo_fralda: string; tamanho: string; quantidade_atual: number; quantidade_minima: number; consumo_medio_diario: number | null }[];
  ciclos: { id: string; residente_id: string; residente_nome: string; data_ciclo: string; status: string; registros: number }[];
  equipe: { id: string; nome_completo: string; total: number; ultima_atividade: string }[];
  atividades: AtividadeSupervisao[];
  remocoes_pendentes: number; vacinas_pendentes: number;
  temperatura: { registros: number; fora_conformidade: number };
}
export interface PendenciaSupervisao {
  id: string; residente_id: string; residente: string; titulo: string; horario: string;
  modulo: 'rotinas' | 'medicamentos' | 'agenda' | 'prontuario'; status: string;
}

/** Reutiliza as regras do portal: registro de emergência/recusa não quita dose prevista. */
export function analisarSupervisao(p: PainelSupervisao, hora: string) {
  const [h, m] = hora.split(':').map(Number);
  const rotinas = ocorrenciasDoDia(p.rotinas, p.execucoes, p.dia, h * 60 + m);
  const mapa = montarMapaDia(p.prescricoes, p.administracoes.filter(a => a.status === 'administrado'), p.dia, hora, saldoPorResidente(p.estoques));
  const pendencias: PendenciaSupervisao[] = [
    ...rotinas.filter(o => o.status !== 'feito').map(o => ({ id: `r-${o.rotina.id}-${o.data}-${o.chave}`, residente_id: o.rotina.residente_id, residente: o.rotina.residente_nome, titulo: o.rotina.titulo, horario: o.rotulo, modulo: 'rotinas' as const, status: o.status })),
    ...mapa.doses.filter(o => o.status !== 'administrado').map(o => ({ id: `m-${o.chave}`, residente_id: o.prescricao.residente_id, residente: o.prescricao.residente?.nome_completo ?? '', titulo: `${o.prescricao.medicamento?.nome ?? 'Medicamento'} · ${o.prescricao.dosagem}`, horario: o.horario, modulo: 'medicamentos' as const, status: o.semEstoque ? 'sem estoque' : o.status })),
    ...p.agenda.filter(a => !a.visto_em).map(a => ({ id: `a-${a.id}`, residente_id: a.residente_id, residente: a.residente_nome, titulo: a.titulo, horario: a.horario?.slice(0, 5) ?? 'Hoje', modulo: 'agenda' as const, status: a.horario && a.horario.slice(0, 5) < hora ? 'atrasado' : 'não visto' })),
    ...p.residentes.filter(r => !p.ciclos.some(c => c.residente_id === r.id && c.data_ciclo === p.dia && c.registros > 0)).map(r => ({ id: `p-${r.id}`, residente_id: r.id, residente: r.nome_completo, titulo: 'Sem registro de prontuário hoje', horario: 'Hoje', modulo: 'prontuario' as const, status: 'sem registro' })),
  ];
  const prioridade = (s: string) => s === 'atrasado' || s === 'sem estoque' ? 0 : s === 'agora' ? 1 : 2;
  pendencias.sort((a, b) => prioridade(a.status) - prioridade(b.status) || a.horario.localeCompare(b.horario));
  const medBaixos = p.estoques.filter(e => e.quantidade_atual <= (e.quantidade_minima ?? 10) || (e.data_validade && e.data_validade <= p.dia));
  const fraldasBaixas = p.fraldas.filter(e => e.quantidade_atual <= e.quantidade_minima || e.quantidade_atual / (e.consumo_medio_diario || 4) <= 3);
  const insights = [
    { numero: rotinas.filter(o => o.status === 'atrasado').length, titulo: 'Rotinas atrasadas', acao: 'Confira as instruções e alinhe a execução com a equipe.', modulo: 'rotinas' },
    { numero: mapa.doses.filter(o => o.status === 'atrasado').length, titulo: 'Doses sem registro no horário', acao: 'Confira o mapa e a prescrição; não duplique uma dose sem verificar.', modulo: 'medicamentos' },
    { numero: mapa.doses.filter(o => o.semEstoque && o.status !== 'administrado').length, titulo: 'Doses previstas sem estoque', acao: 'Providencie reposição e consulte o profissional responsável.', modulo: 'medicamentos' },
    { numero: mapa.semHorario.length, titulo: 'Medicamentos sem horário', acao: 'Confira a configuração do mapa com o profissional responsável.', modulo: 'medicamentos' },
    { numero: p.agenda.filter(a => !a.visto_em).length, titulo: 'Compromissos sem ciência', acao: 'Alinhe o compromisso com a cuidadora do plantão.', modulo: 'agenda' },
    { numero: pendencias.filter(a => a.modulo === 'prontuario').length, titulo: 'Residentes sem registro hoje', acao: 'Confira com a equipe e registre somente cuidados efetivamente realizados.', modulo: 'prontuario' },
    { numero: p.remocoes_pendentes, titulo: 'Remoções aguardando gestor', acao: 'Solicite a revisão ao gestor; os itens permanecem temporariamente retirados.', modulo: 'residentes' },
    { numero: p.temperatura.fora_conformidade, titulo: 'Temperatura fora de conformidade', acao: 'Confira os registros e as ações corretivas da conservação.', modulo: 'temperatura' },
    { numero: p.vacinas_pendentes, titulo: 'Próximas doses a conferir', acao: 'Revise datas e aplicações já registradas com o profissional responsável.', modulo: 'vacinas' },
  ].filter(i => i.numero > 0);
  return { rotinas, mapa, pendencias, insights, medBaixos, fraldasBaixas };
}