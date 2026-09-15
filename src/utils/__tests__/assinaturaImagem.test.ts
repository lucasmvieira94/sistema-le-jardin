import { describe, expect, it } from 'vitest';
import {
  calcularEncaixeAssinatura,
  encontrarLimitesAssinatura,
  estimarFundo,
  removerFundoAssinatura,
} from '../assinaturaImagem';

function imagemBranca(largura: number, altura: number) {
  const pixels = new Uint8ClampedArray(largura * altura * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 250;
    pixels[i + 1] = 250;
    pixels[i + 2] = 250;
    pixels[i + 3] = 255;
  }
  return pixels;
}

describe('tratamento da imagem da assinatura', () => {
  it('estima a cor do fundo pelas extremidades', () => {
    expect(estimarFundo(imagemBranca(4, 4), 4, 4)).toEqual({ r: 250, g: 250, b: 250 });
  });

  it('remove o papel claro e preserva o traço escuro', () => {
    const pixels = imagemBranca(5, 5);
    const centro = (2 * 5 + 2) * 4;
    pixels[centro] = 20;
    pixels[centro + 1] = 20;
    pixels[centro + 2] = 20;

    expect(removerFundoAssinatura(pixels, 5, 5)).toBe(1);
    expect(pixels[3]).toBe(0);
    expect(pixels[centro + 3]).toBeGreaterThan(240);
  });

  it('encontra apenas os limites reais dos traços', () => {
    const pixels = new Uint8ClampedArray(8 * 6 * 4);
    pixels[(2 * 8 + 1) * 4 + 3] = 255;
    pixels[(4 * 8 + 6) * 4 + 3] = 255;

    expect(encontrarLimitesAssinatura(pixels, 8, 6)).toEqual({
      esquerda: 1,
      topo: 2,
      direita: 6,
      base: 4,
    });
  });

  it('redimensiona proporcionalmente, centraliza e respeita as margens', () => {
    expect(calcularEncaixeAssinatura(1200, 200)).toEqual({
      x: 24,
      y: 79,
      largura: 852,
      altura: 142,
    });
  });

  it('rejeita imagem sem traços', () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    expect(encontrarLimitesAssinatura(pixels, 4, 4)).toBeNull();
  });
});