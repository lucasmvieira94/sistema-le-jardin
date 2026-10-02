/**
 * Regras puras da Central de Documentos do colaborador.
 *
 * Mantidas sem acesso ao banco para poderem ser testadas isoladamente.
 * A assinatura por biometria facial é uma assinatura eletrônica avançada
 * (Lei 14.063/2020, art. 4º, II; MP 2.200-2/2001, art. 10, §2º).
 */

export type TipoDocumentoInterno = 'advertencia' | 'folha_ponto' | 'contracheque' | 'comunicado';
export type StatusDocumentoInterno = 'pendente' | 'assinado' | 'recusado';

export interface DocumentoFuncionario {
  tipo_documento: TipoDocumentoInterno;
  referencia_id: string;
  titulo: string;
  subtitulo: string | null;
  conteudo_html: string | null;
  arquivo_path: string | null;
  hash_referencia: string | null;
  criado_em: string;
  status: StatusDocumentoInterno;
  assinado_em: string | null;
  motivo_recusa: string | null;
  hash_assinatura: string | null;
  hash_documento: string | null;
}

export const ROTULO_TIPO: Record<TipoDocumentoInterno, string> = {
  advertencia: 'Advertência / Suspensão',
  folha_ponto: 'Folha de ponto',
  contracheque: 'Contracheque',
  comunicado: 'Comunicado / Regimento',
};

/** Texto do termo que o colaborador aceita ao assinar — muda conforme o tipo. */
export function textoTermo(tipo: TipoDocumentoInterno): string {
  switch (tipo) {
    case 'advertencia':
      return 'Declaro que recebi e tomei ciência desta medida disciplinar. A assinatura indica ciência, não concordância.';
    case 'folha_ponto':
      return 'Declaro que conferi esta folha de ponto e concordo com os horários registrados.';
    case 'contracheque':
      return 'Declaro que recebi este recibo de pagamento com a discriminação das verbas e descontos.';
    default:
      return 'Declaro que li, compreendi e estou ciente do conteúdo deste documento.';
  }
}

/** Rótulo do botão de recusa — na folha de ponto é discordância. */
export function rotuloRecusa(tipo: TipoDocumentoInterno): string {
  return tipo === 'folha_ponto' ? 'Discordo dos registros' : 'Recusar assinatura';
}

/** Motivo mínimo de 5 caracteres (mesma regra do servidor). */
export function validarMotivoRecusa(motivo: string): string | null {
  return motivo.trim().length >= 5 ? null : 'Informe o motivo com pelo menos 5 caracteres.';
}

/** Conteúdo canônico de documentos em texto, usado para calcular o hash. */
export function conteudoCanonico(doc: Pick<DocumentoFuncionario, 'titulo' | 'conteudo_html'>): string {
  return `${doc.titulo.trim()}\n${(doc.conteudo_html ?? '').trim()}`;
}

/** SHA-256 em hexadecimal (Web Crypto, disponível no navegador e no Node 18+). */
export async function sha256Hex(dados: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = typeof dados === 'string' ? new TextEncoder().encode(dados) : dados;
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ResumoDocumentos {
  pendentes: number;
  assinados: number;
  recusados: number;
  total: number;
}

export function resumirDocumentos(docs: DocumentoFuncionario[]): ResumoDocumentos {
  return docs.reduce<ResumoDocumentos>(
    (acc, d) => {
      acc.total += 1;
      if (d.status === 'pendente') acc.pendentes += 1;
      else if (d.status === 'assinado') acc.assinados += 1;
      else acc.recusados += 1;
      return acc;
    },
    { pendentes: 0, assinados: 0, recusados: 0, total: 0 },
  );
}

export type FiltroDocumentos = 'pendentes' | 'concluidos' | 'todos';

/** Filtra e ordena: pendentes primeiro, depois do mais recente ao mais antigo. */
export function filtrarDocumentos(docs: DocumentoFuncionario[], filtro: FiltroDocumentos): DocumentoFuncionario[] {
  const lista = docs.filter((d) =>
    filtro === 'todos' ? true : filtro === 'pendentes' ? d.status === 'pendente' : d.status !== 'pendente',
  );
  return [...lista].sort((a, b) => {
    const pa = a.status === 'pendente' ? 0 : 1;
    const pb = b.status === 'pendente' ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return b.criado_em.localeCompare(a.criado_em);
  });
}
