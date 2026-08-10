import { describe, it, expect } from 'vitest';
import { deveForcarAtualizacaoDiaria, getDiaAtualSaoPaulo } from '../useVersionCheck';

describe('atualização diária do PWA', () => {
  it('não força no primeiro acesso (sem marcação anterior)', () => {
    expect(deveForcarAtualizacaoDiaria(null, '2026-08-10')).toBe(false);
  });

  it('não força no mesmo dia', () => {
    expect(deveForcarAtualizacaoDiaria('2026-08-10', '2026-08-10')).toBe(false);
  });

  it('força quando o dia mudou', () => {
    expect(deveForcarAtualizacaoDiaria('2026-08-09', '2026-08-10')).toBe(true);
  });

  it('usa o fuso de Brasília (UTC-3)', () => {
    // 2026-08-11T02:00:00Z => 10/08 23h em Brasília
    expect(getDiaAtualSaoPaulo(new Date('2026-08-11T02:00:00Z'))).toBe('2026-08-10');
  });
});
