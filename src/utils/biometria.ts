/**
 * Regras puras do cadastro/validação facial (sem câmera e sem banco) — testáveis.
 * Os limites espelham os do servidor (autocadastrar_biometria_funcionario e
 * assinar_documento_interno), que é quem decide de fato.
 */
import { distanciaEuclidiana } from '@/lib/faceApi';

export const AMOSTRAS_AUTOCADASTRO = 3;
/** Distância máxima entre capturas do autocadastro para serem da mesma pessoa. */
export const LIMITE_CONSISTENCIA = 0.5;

export const ORIENTACOES_CAPTURA = [
  'Olhe direto para a câmera',
  'Vire o rosto levemente para a esquerda',
  'Vire o rosto levemente para a direita',
] as const;

/** Descriptor válido do face-api: 128 números finitos. */
export function descriptorValido(d: unknown): d is number[] {
  return Array.isArray(d) && d.length === 128 && d.every((n) => typeof n === 'number' && Number.isFinite(n));
}

/** Verifica se todas as capturas são parecidas entre si (mesma pessoa). */
export function amostrasConsistentes(amostras: number[][], limite = LIMITE_CONSISTENCIA): boolean {
  if (amostras.length < 2 || !amostras.every(descriptorValido)) return false;
  for (let i = 0; i < amostras.length; i++) {
    for (let j = i + 1; j < amostras.length; j++) {
      if (distanciaEuclidiana(amostras[i], amostras[j]) > limite) return false;
    }
  }
  return true;
}

/** Arredonda para reduzir o tamanho enviado sem perder precisão útil. */
export function compactarDescriptor(d: number[]): number[] {
  return d.map((n) => Math.round(n * 1e6) / 1e6);
}
