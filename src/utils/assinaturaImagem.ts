export const ASSINATURA_LARGURA = 900;
export const ASSINATURA_ALTURA = 300;

export type LimitesAssinatura = {
  esquerda: number;
  topo: number;
  direita: number;
  base: number;
};

export type EncaixeAssinatura = {
  x: number;
  y: number;
  largura: number;
  altura: number;
};

type FundoRgb = { r: number; g: number; b: number };

/** Estima a cor do papel pelas quatro extremidades da imagem. */
export function estimarFundo(
  pixels: Uint8ClampedArray,
  largura: number,
  altura: number,
): FundoRgb {
  const amostras: FundoRgb[] = [];
  const faixaX = Math.max(1, Math.floor(largura * 0.06));
  const faixaY = Math.max(1, Math.floor(altura * 0.06));

  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      const naBorda = (x < faixaX || x >= largura - faixaX)
        && (y < faixaY || y >= altura - faixaY);
      if (!naBorda) continue;
      const indice = (y * largura + x) * 4;
      if (pixels[indice + 3] < 128) continue;
      amostras.push({ r: pixels[indice], g: pixels[indice + 1], b: pixels[indice + 2] });
    }
  }

  if (amostras.length === 0) return { r: 255, g: 255, b: 255 };
  const total = amostras.reduce(
    (soma, cor) => ({ r: soma.r + cor.r, g: soma.g + cor.g, b: soma.b + cor.b }),
    { r: 0, g: 0, b: 0 },
  );
  return {
    r: total.r / amostras.length,
    g: total.g / amostras.length,
    b: total.b / amostras.length,
  };
}

/**
 * Remove fundos claros e sombras do papel, preservando a cor original do traço.
 * Retorna a quantidade de pixels reconhecidos como assinatura.
 */
export function removerFundoAssinatura(
  pixels: Uint8ClampedArray,
  largura: number,
  altura: number,
): number {
  const fundo = estimarFundo(pixels, largura, altura);
  let pixelsDoTraco = 0;

  for (let indice = 0; indice < pixels.length; indice += 4) {
    const alphaOriginal = pixels[indice + 3] / 255;
    if (alphaOriginal === 0) continue;

    const dr = pixels[indice] - fundo.r;
    const dg = pixels[indice + 1] - fundo.g;
    const db = pixels[indice + 2] - fundo.b;
    const distancia = Math.sqrt(dr * dr + dg * dg + db * db);
    const alphaTratado = Math.max(0, Math.min(1, (distancia - 14) / 68)) * alphaOriginal;

    pixels[indice + 3] = Math.round(alphaTratado * 255);
    if (alphaTratado >= 0.12) pixelsDoTraco += 1;
  }

  return pixelsDoTraco;
}

export function encontrarLimitesAssinatura(
  pixels: Uint8ClampedArray,
  largura: number,
  altura: number,
  alphaMinimo = 30,
): LimitesAssinatura | null {
  let esquerda = largura;
  let topo = altura;
  let direita = -1;
  let base = -1;

  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      if (pixels[(y * largura + x) * 4 + 3] < alphaMinimo) continue;
      esquerda = Math.min(esquerda, x);
      topo = Math.min(topo, y);
      direita = Math.max(direita, x);
      base = Math.max(base, y);
    }
  }

  return direita < esquerda ? null : { esquerda, topo, direita, base };
}

/** Calcula o encaixe centralizado, com margem e sem distorcer a assinatura. */
export function calcularEncaixeAssinatura(
  larguraOriginal: number,
  alturaOriginal: number,
  larguraDestino = ASSINATURA_LARGURA,
  alturaDestino = ASSINATURA_ALTURA,
  margem = 24,
): EncaixeAssinatura {
  const larguraUtil = Math.max(1, larguraDestino - margem * 2);
  const alturaUtil = Math.max(1, alturaDestino - margem * 2);
  const escala = Math.min(larguraUtil / larguraOriginal, alturaUtil / alturaOriginal, 3);
  const largura = Math.max(1, Math.round(larguraOriginal * escala));
  const altura = Math.max(1, Math.round(alturaOriginal * escala));
  return {
    x: Math.round((larguraDestino - largura) / 2),
    y: Math.round((alturaDestino - altura) / 2),
    largura,
    altura,
  };
}

function carregarImagem(origem: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.onload = () => resolve(imagem);
    imagem.onerror = () => reject(new Error('Não foi possível ler a imagem da assinatura.'));
    imagem.src = origem;
  });
}

/** Gera um PNG transparente, recortado e proporcional, pronto para documentos. */
export async function tratarImagemAssinatura(origem: string): Promise<string> {
  const imagem = await carregarImagem(origem);
  const maiorDimensao = 1800;
  const escalaLeitura = Math.min(1, maiorDimensao / Math.max(imagem.naturalWidth, imagem.naturalHeight));
  const largura = Math.max(1, Math.round(imagem.naturalWidth * escalaLeitura));
  const altura = Math.max(1, Math.round(imagem.naturalHeight * escalaLeitura));
  const leitura = document.createElement('canvas');
  leitura.width = largura;
  leitura.height = altura;
  const contextoLeitura = leitura.getContext('2d', { willReadFrequently: true });
  if (!contextoLeitura) throw new Error('Não foi possível preparar a assinatura.');
  contextoLeitura.drawImage(imagem, 0, 0, largura, altura);

  const dados = contextoLeitura.getImageData(0, 0, largura, altura);
  const pixelsDoTraco = removerFundoAssinatura(dados.data, largura, altura);
  const minimoLegivel = Math.max(12, Math.round(largura * altura * 0.00008));
  if (pixelsDoTraco < minimoLegivel) {
    throw new Error('Nenhuma assinatura legível foi encontrada. Use uma imagem com traços mais nítidos.');
  }
  contextoLeitura.putImageData(dados, 0, 0);

  const limites = encontrarLimitesAssinatura(dados.data, largura, altura);
  if (!limites) throw new Error('Nenhuma assinatura legível foi encontrada na imagem.');

  const larguraRecorte = limites.direita - limites.esquerda + 1;
  const alturaRecorte = limites.base - limites.topo + 1;
  const encaixe = calcularEncaixeAssinatura(larguraRecorte, alturaRecorte);

  const saida = document.createElement('canvas');
  saida.width = ASSINATURA_LARGURA;
  saida.height = ASSINATURA_ALTURA;
  const contextoSaida = saida.getContext('2d');
  if (!contextoSaida) throw new Error('Não foi possível finalizar a assinatura.');
  contextoSaida.imageSmoothingEnabled = true;
  contextoSaida.imageSmoothingQuality = 'high';
  contextoSaida.drawImage(
    leitura,
    limites.esquerda,
    limites.topo,
    larguraRecorte,
    alturaRecorte,
    encaixe.x,
    encaixe.y,
    encaixe.largura,
    encaixe.altura,
  );

  return saida.toDataURL('image/png');
}