import { describe, expect, it } from 'vitest';
import { analisarSupervisao, type PainelSupervisao } from '../supervisaoCuidados';

const painel = (): PainelSupervisao => ({ dia: '2026-11-21', atualizado_em: '2026-11-22T01:00:00Z', residentes: [{ id: 'r', nome_completo: 'Maria', quarto: '1' }], rotinas: [], execucoes: [], agenda: [], prescricoes: [], administracoes: [], estoques: [], fraldas: [], ciclos: [], equipe: [], atividades: [], remocoes_pendentes: 0, vacinas_pendentes: 0, temperatura: { registros: 0, fora_conformidade: 0 } });
describe('supervisão dos cuidados', () => {
  it('ciência compartilhada tira o compromisso das pendências', () => {
    const p = painel();
    p.agenda = [{ id: 'a', residente_id: 'r', residente_nome: 'Maria', titulo: 'Consulta', horario: '10:00', observacoes: null, visto_em: '2026-11-21T12:00:00Z', visto_por_nome: 'Ana' }];
    expect(analisarSupervisao(p, '12:00').pendencias.filter(a => a.modulo === 'agenda')).toHaveLength(0);
    p.agenda[0].visto_em = null;
    expect(analisarSupervisao(p, '12:00').pendencias.find(a => a.modulo === 'agenda')?.status).toBe('atrasado');
  });
  it('recusa e emergência não quitam dose de rotina; estoque zerado mantém a pendência', () => {
    const p = painel();
    p.prescricoes = [{ id: 'p', residente_id: 'r', medicamento_id: 'm', dosagem: '1 comprimido', frequencia_tipo: 'diario', horarios: ['10:00'], data_inicio: '2026-11-21' }];
    p.administracoes = [{ residente_id: 'r', medicamento_id: 'm', horario_administracao: '10:00', status: 'recusado', tipo: 'rotina' }, { residente_id: 'r', medicamento_id: 'm', horario_administracao: '10:00', status: 'administrado', tipo: 'emergencia' }];
    expect(analisarSupervisao(p, '12:00').mapa.doses[0]).toMatchObject({ status: 'atrasado', semEstoque: true });
    p.administracoes[0].status = 'administrado';
    expect(analisarSupervisao(p, '12:00').mapa.doses[0].status).toBe('administrado');
  });
  it('prontuário de ontem não conta como registro de hoje', () => {
    const p = painel();
    p.ciclos = [{ id: 'c', residente_id: 'r', residente_nome: 'Maria', data_ciclo: '2026-11-20', status: 'em_andamento', registros: 4 }];
    expect(analisarSupervisao(p, '12:00').pendencias.filter(a => a.modulo === 'prontuario')).toHaveLength(1);
    p.ciclos[0].data_ciclo = p.dia;
    expect(analisarSupervisao(p, '12:00').pendencias.filter(a => a.modulo === 'prontuario')).toHaveLength(0);
  });
  it('orientação e rotina vencida não geram cobrança de execução', () => {
    const p = painel();
    const r = { id: 'rot', residente_id: 'r', residente_nome: 'Maria', titulo: 'Banho', tipo: 'orientacao' as const, instrucoes: null, frequencia: 'momento' as const, horarios: [], momento: 'banho', tipo_afericao: null, dias_semana: [], inicio: '2026-11-20', fim: null, encerrada_em: null, motivo_encerramento: null, criado_por_nome: null };
    p.rotinas = [r, { ...r, id: 'vencida', tipo: 'procedimento', fim: '2026-11-20' }];
    expect(analisarSupervisao(p, '12:00').rotinas).toHaveLength(0);
  });
});