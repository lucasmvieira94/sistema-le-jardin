import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { renderFolhaFuncionario, renderRodapeNumeracao } from '../folhaPontoPdfLayout';
import type { FolhaPontoData, TotaisFolhaPonto } from '@/hooks/useFolhaPonto';

const totais: TotaisFolhaPonto = {
  dias_trabalhados: 22, total_faltas: 0, total_abonos: 0,
  total_horas_trabalhadas: '176:00:00', total_horas_extras_diurnas: '04:00:00',
  total_horas_extras_noturnas: '00:00:00',
};

describe('espelho mensal A4 retrato', () => {
  it('mantém 31 dias e assinaturas em uma página', () => {
    const dados: FolhaPontoData[] = Array.from({ length: 31 }, (_, i) => ({
      funcionario_nome: 'João da Silva', funcionario_cpf: '123.456.789-00',
      funcionario_funcao: 'Cuidador', funcionario_escala_nome: '12x36',
      funcionario_escala_entrada: '08:00:00', funcionario_escala_saida: '20:00:00',
      dia: i + 1, data: `2026-10-${String(i + 1).padStart(2, '0')}`,
      entrada: '08:00:00', intervalo_inicio: '12:00:00', intervalo_fim: '13:00:00',
      saida: '20:00:00', horas_trabalhadas: '11:00:00',
      horas_extras_diurnas: '00:00:00', horas_extras_noturnas: '00:00:00',
      faltas: false, abonos: false, observacoes: 'Sem observações',
    }));
    const pdf = new jsPDF('portrait');
    const fim = renderFolhaFuncionario(pdf, dados, totais, 10, 2026, {
      nome_empresa: 'Instituição de teste', cnpj: '00.000.000/0001-00',
    });
    renderRodapeNumeracao(pdf, null);
    expect(pdf.getNumberOfPages()).toBe(1);
    expect(fim).toBeLessThan(pdf.internal.pageSize.getHeight() - 7);
    expect(pdf.internal.pageSize.getWidth()).toBeLessThan(pdf.internal.pageSize.getHeight());
  });

  it('mantém a orientação retrato ao adicionar novas páginas', () => {
    const pdf = new jsPDF('portrait');
    pdf.addPage();
    expect(pdf.internal.pageSize.getWidth()).toBeLessThan(pdf.internal.pageSize.getHeight());
  });
});