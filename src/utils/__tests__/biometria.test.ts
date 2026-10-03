import { describe, it, expect, vi } from 'vitest';
vi.mock('face-api.js', () => ({}));
import { amostrasConsistentes, compactarDescriptor, descriptorValido } from '../biometria';

const base = Array.from({ length: 128 }, (_, i) => (i % 7) / 10);
const desloca = (d: number[], v: number) => d.map((n) => n + v);

describe('biometria', () => {
  it('valida formato do descriptor', () => {
    expect(descriptorValido(base)).toBe(true);
    expect(descriptorValido(base.slice(1))).toBe(false);
    expect(descriptorValido([...base.slice(1), NaN])).toBe(false);
  });

  it('aceita capturas parecidas e recusa rostos diferentes', () => {
    expect(amostrasConsistentes([base, desloca(base, 0.01), desloca(base, -0.01)])).toBe(true);
    // 0.1 em 128 dimensões ≈ 1.13 de distância: outra pessoa
    expect(amostrasConsistentes([base, desloca(base, 0.1), base])).toBe(false);
    expect(amostrasConsistentes([base])).toBe(false);
  });

  it('compacta para 6 casas decimais', () => {
    expect(compactarDescriptor([0.1234567891])[0]).toBe(0.123457);
  });
});
