import { formatarDataExtenso } from './dateUtils';
import type { ContratoData } from '@/components/residentes/types';

export interface AditivoData {
  id: string;
  contrato_id: string;
  distrato_id: string | null;
  numero_aditivo: string;
  data_anterior: string | null;
  nova_data: string;
  condicoes: string;
  created_at: string;
  dados_documento: {
    contrato: ContratoData;
    distrato?: { numero_distrato: string } | null;
    residente: { nome_completo: string; cpf?: string | null; numero_prontuario: string };
    data_emissao: string;
  };
}

/** Datas ISO são comparadas como datas civis, sem deslocamento de fuso. */
export function validarProrrogacao(nova: string, anterior: string | null, hoje: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nova)) return false;
  const data = new Date(`${nova}T12:00:00`);
  if (Number.isNaN(data.getTime()) || data.getFullYear() !== Number(nova.slice(0, 4)) || data.getMonth() + 1 !== Number(nova.slice(5, 7)) || data.getDate() !== Number(nova.slice(8))) return false;
  return nova > hoje && (!anterior || nova > anterior);
}

export function paragrafosAditivo(a: AditivoData): string[] {
  const { contrato: c, residente: r, distrato: d, data_emissao } = a.dados_documento;
  const origem = a.distrato_id ? `Distrato nº ${d?.numero_distrato ?? ''}, vinculado ao Contrato nº ${c.numero_contrato}` : `Contrato de Prestação de Serviços nº ${c.numero_contrato}`;
  return [
    'CONTRATADA: LE JARDIN RESIDENCIAL SÊNIOR LTDA ME, CNPJ 48.897.411/0001-58, com sede na Rua Promotor Arquibaldo Mendonça, 660, Bairro Suíssa, Aracaju/SE, representada pela sócia Rosângela Moraes Sobral.',
    `CONTRATANTE: ${c.contratante_nome}${c.contratante_cpf ? `, CPF ${c.contratante_cpf}` : ''}${c.contratante_rg ? `, RG ${c.contratante_rg}` : ''}${c.contratante_endereco ? `, endereço: ${c.contratante_endereco}, ${c.contratante_cidade ?? ''}/${c.contratante_estado ?? ''}` : ''}.`,
    `RESIDENTE: ${r.nome_completo}${r.cpf ? `, CPF ${r.cpf}` : ''}, prontuário nº ${r.numero_prontuario}.`,
    `As partes ajustam, de comum acordo, o presente aditivo ao ${origem}, exclusivamente quanto ao prazo de vigência e às condições expressamente descritas abaixo.`,
    `CLÁUSULA PRIMEIRA — PRORROGAÇÃO: ${a.data_anterior ? `O término anteriormente previsto para ${formatarDataExtenso(a.data_anterior)} fica prorrogado` : 'As partes estabelecem prazo determinado'} até ${formatarDataExtenso(a.nova_data)}${a.distrato_id ? ', passando esta a ser a nova data efetiva de encerramento da prestação de serviços' : ''}.`,
    `CLÁUSULA SEGUNDA — CONDIÇÕES: ${a.condicoes || 'Não há condições adicionais.'}`,
    'CLÁUSULA TERCEIRA — RATIFICAÇÃO: Permanecem inalteradas as demais cláusulas e obrigações do instrumento de origem, inclusive as financeiras, salvo condição expressamente pactuada neste aditivo. A prorrogação não declara quitação nem gera cobrança ou baixa automática de valores.',
    `Aracaju/SE, ${formatarDataExtenso(data_emissao)}.`,
  ];
}

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
export function htmlAditivo(a: AditivoData): string {
  return `<div style="font-family:'Times New Roman',serif;font-size:11pt;line-height:1.5"><h2 style="text-align:center">TERMO ADITIVO DE PRORROGAÇÃO<br/>${escape(a.numero_aditivo)}</h2>${paragrafosAditivo(a).map(p => `<p style="text-align:justify;white-space:pre-wrap">${escape(p)}</p>`).join('')}</div>`;
}