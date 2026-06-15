/**
 * Wrapper para face-api.js.
 * Carrega modelos do CDN sob demanda (apenas uma vez por sessão)
 * e oferece utilidades de captura de descriptor e comparação.
 *
 * Os "descriptors" são vetores numéricos de 128 dimensões — não são fotos.
 * Distância Euclidiana < threshold (~0.5) indica match.
 */
import * as faceapi from 'face-api.js';

const MODELS_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

let loadingPromise: Promise<void> | null = null;

/** Carrega os 3 modelos necessários (TinyFaceDetector + Landmarks + Recognition). Idempotente. */
export async function carregarModelos(): Promise<void> {
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ]);
  })();
  return loadingPromise;
}

/** Extrai o descriptor da face dominante (maior bounding box) num <video> ou <canvas>. */
export async function extrairDescriptor(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<number[] | null> {
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const result = await faceapi
    .detectSingleFace(input, opts)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!result) return null;
  return Array.from(result.descriptor);
}

/** Distância Euclidiana entre dois descriptors. */
export function distanciaEuclidiana(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

/** Calcula a média de N descriptors (usado no enrollment com múltiplas amostras). */
export function mediaDescriptors(amostras: number[][]): number[] {
  if (!amostras.length) return [];
  const len = amostras[0].length;
  const avg = new Array(len).fill(0);
  for (const d of amostras) for (let i = 0; i < len; i++) avg[i] += d[i];
  return avg.map((v) => v / amostras.length);
}

/** Threshold padrão de match. Valores < 0.5 indicam alta confiança; 0.55 equilibra falsos negativos. */
export const BIOMETRIA_THRESHOLD = 0.55;