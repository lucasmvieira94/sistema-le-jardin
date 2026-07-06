import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - worker URL resolvido pelo Vite
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configura worker do pdfjs
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = PdfWorker;

export interface FuncionarioMatch {
  id: string;
  nome: string;
  nomeNormalizado: string;
}

export interface PaginaProcessada {
  paginaIndex: number; // 0-based
  funcionarioId: string | null;
  funcionarioNome: string | null;
  textoPreview: string;
}

export interface HoleriteAgrupado {
  funcionarioId: string;
  funcionarioNome: string;
  paginas: number[]; // índices 0-based no PDF original
  pdfBytes: Uint8Array;
}

export interface ResultadoProcessamento {
  holerites: HoleriteAgrupado[];
  paginasOrfas: PaginaProcessada[];
  totalPaginas: number;
}

/**
 * Normaliza texto para comparação: minúsculo, sem acentos, espaços colapsados.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai texto de cada página do PDF via pdfjs-dist.
 */
async function extrairTextoPorPagina(arquivo: File): Promise<string[]> {
  const buffer = await arquivo.arrayBuffer();
  const doc = await (pdfjsLib as any).getDocument({ data: buffer }).promise;
  const paginas: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const texto = content.items.map((it: any) => it.str).join(' ');
    paginas.push(texto);
  }
  return paginas;
}

/**
 * Para cada página, identifica o funcionário cujo nome completo aparece no texto.
 * Empate: prefere o nome mais longo (mais específico).
 */
function identificarPaginas(
  textos: string[],
  funcionarios: FuncionarioMatch[]
): PaginaProcessada[] {
  // Ordena por nome mais longo primeiro (matching mais específico)
  const ordenados = [...funcionarios].sort(
    (a, b) => b.nomeNormalizado.length - a.nomeNormalizado.length
  );

  return textos.map((texto, idx) => {
    const norm = normalizar(texto);
    const match = ordenados.find((f) => f.nomeNormalizado && norm.includes(f.nomeNormalizado));
    return {
      paginaIndex: idx,
      funcionarioId: match?.id ?? null,
      funcionarioNome: match?.nome ?? null,
      textoPreview: texto.slice(0, 240),
    };
  });
}

/**
 * Agrupa páginas consecutivas do mesmo funcionário em um único holerite.
 */
async function agruparEExtrairPDFs(
  arquivo: File,
  paginas: PaginaProcessada[]
): Promise<HoleriteAgrupado[]> {
  const buffer = await arquivo.arrayBuffer();
  const src = await PDFDocument.load(buffer);

  // Agrupa páginas consecutivas por funcionário
  const grupos: { funcionarioId: string; funcionarioNome: string; paginas: number[] }[] = [];
  for (const p of paginas) {
    if (!p.funcionarioId) continue;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.funcionarioId === p.funcionarioId) {
      ultimo.paginas.push(p.paginaIndex);
    } else {
      grupos.push({
        funcionarioId: p.funcionarioId,
        funcionarioNome: p.funcionarioNome!,
        paginas: [p.paginaIndex],
      });
    }
  }

  // Se o mesmo funcionário aparecer em grupos separados (páginas não consecutivas),
  // consolida em um único holerite (a ordem das páginas é preservada).
  const consolidados = new Map<string, { funcionarioNome: string; paginas: number[] }>();
  for (const g of grupos) {
    const atual = consolidados.get(g.funcionarioId);
    if (atual) {
      atual.paginas.push(...g.paginas);
    } else {
      consolidados.set(g.funcionarioId, { funcionarioNome: g.funcionarioNome, paginas: [...g.paginas] });
    }
  }

  const resultado: HoleriteAgrupado[] = [];
  for (const [funcionarioId, info] of consolidados) {
    const novo = await PDFDocument.create();
    const copiadas = await novo.copyPages(src, info.paginas);
    copiadas.forEach((p) => novo.addPage(p));
    const bytes = await novo.save();
    resultado.push({
      funcionarioId,
      funcionarioNome: info.funcionarioNome,
      paginas: info.paginas,
      pdfBytes: bytes,
    });
  }
  return resultado;
}

/**
 * Processa o PDF consolidado e retorna holerites separados + páginas órfãs.
 */
export async function processarPDFContracheques(
  arquivo: File,
  funcionarios: FuncionarioMatch[]
): Promise<ResultadoProcessamento> {
  const textos = await extrairTextoPorPagina(arquivo);
  const paginas = identificarPaginas(textos, funcionarios);
  const holerites = await agruparEExtrairPDFs(arquivo, paginas);
  const paginasOrfas = paginas.filter((p) => !p.funcionarioId);
  return {
    holerites,
    paginasOrfas,
    totalPaginas: textos.length,
  };
}
