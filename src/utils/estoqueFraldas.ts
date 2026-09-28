import { supabase } from "@/integrations/supabase/client";

/** Dados de entrada de fraldas no estoque. */
export interface EntradaEstoqueFralda {
  tenant_id: string;
  residente_id: string | null;
  tipo_fralda: string;
  marca?: string | null;
  tamanho: string;
  quantidade: number;
  observacoes?: string | null;
  quantidade_minima?: number | null;
}

export interface ResultadoEntradaEstoque {
  id: string;
  quantidade_atual: number;
  /** true quando a quantidade foi somada a um registro já existente. */
  somado: boolean;
}

/** Chave que identifica um item de estoque único (mesma regra do banco). */
export const chaveEstoqueFralda = (e: {
  residente_id?: string | null;
  tipo_fralda: string;
  marca?: string | null;
  tamanho: string;
}) => [e.residente_id ?? "", e.tipo_fralda, (e.marca ?? "").trim().toUpperCase(), e.tamanho].join("|");

/**
 * Adiciona fraldas ao estoque: soma ao registro ativo do mesmo
 * residente/tipo/marca/tamanho ou cria um novo, evitando duplicidade.
 */
export async function adicionarEstoqueFralda(
  entrada: EntradaEstoqueFralda,
): Promise<ResultadoEntradaEstoque> {
  if (!Number.isInteger(entrada.quantidade) || entrada.quantidade <= 0) {
    throw new Error("Informe uma quantidade válida");
  }
  const { data, error } = await (supabase.rpc as any)("adicionar_estoque_fralda", {
    p_tenant_id: entrada.tenant_id,
    p_residente_id: entrada.residente_id,
    p_tipo_fralda: entrada.tipo_fralda,
    p_marca: entrada.marca ?? null,
    p_tamanho: entrada.tamanho,
    p_quantidade: entrada.quantidade,
    p_observacoes: entrada.observacoes ?? null,
    p_quantidade_minima: entrada.quantidade_minima ?? null,
  });
  if (error) throw error;
  return data as ResultadoEntradaEstoque;
}

export const mensagemEntradaEstoque = (r: ResultadoEntradaEstoque, qtd: number) =>
  r.somado
    ? `Adicionadas ${qtd} unidades ao estoque existente (total: ${r.quantidade_atual}).`
    : "Estoque de fralda cadastrado com sucesso!";
