import { describe, expect, it } from 'vitest';
import { validarProrrogacao } from '../aditivoContrato';
import { calcularStatusContrato } from '../contratoStatus';

describe('prorrogação por prazo determinado', () => {
  it('aceita novo término posterior ao anterior', () => {
    expect(validarProrrogacao('2026-12-31', '2026-12-01', '2026-11-28')).toBe(true);
  });
  it('rejeita prazo igual ou menor ao atual', () => {
    expect(validarProrrogacao('2026-12-01', '2026-12-01', '2026-11-28')).toBe(false);
    expect(validarProrrogacao('2026-11-30', '2026-12-01', '2026-11-28')).toBe(false);
  });
  it('exige data determinada válida, inclusive em contratos indeterminados', () => {
    expect(validarProrrogacao('', null, '2026-11-28')).toBe(false);
    expect(validarProrrogacao('2027-02-30', null, '2026-11-28')).toBe(false);
    expect(validarProrrogacao('2026-12-31', null, '2026-11-28')).toBe(true);
  });
  it('rejeita prorrogação que já terminou hoje', () => {
    expect(validarProrrogacao('2026-11-28', '2026-11-01', '2026-11-28')).toBe(false);
  });
  it('alertas consideram prazo prorrogado, mantendo o original', () => {
    const contrato = { id: 'c', residente_id: 'r', numero_contrato: '001', status: 'ativo', data_inicio_contrato: '2026-01-01', data_fim_contrato: '2026-11-01', prazo_prorrogado: '2026-12-31' };
    const info = calcularStatusContrato([contrato], '2026-11-28');
    expect(info.diasRestantes).toBe(33);
    expect(info.key).toBe('proximo_renovacao');
    expect(contrato.data_fim_contrato).toBe('2026-11-01');
  });
});