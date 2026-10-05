import { jsPDF } from 'jspdf';
import { FolhaPontoData, TotaisFolhaPonto } from '@/hooks/useFolhaPonto';
import { supabase } from '@/integrations/supabase/client';
import { renderFolhaFuncionario, renderRodapeNumeracao } from './folhaPontoPdfLayout';

interface DadosEmpresa {
  nome_empresa: string;
  cnpj?: string;
  endereco?: string;
}

async function buscarDadosEmpresa(): Promise<DadosEmpresa | null> {
  try {
    const { data } = await supabase
      .from('configuracoes_empresa')
      .select('nome_empresa, cnpj, endereco')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return data as any;
  } catch {
    return null;
  }
}

/**
 * Gera o PDF individual da folha de ponto de um funcionário e devolve os bytes.
 * Layout equivalente ao usado no relatório consolidado (paisagem, mesma tabela).
 */
export async function gerarFolhaPontoIndividualPDFBytes(
  dados: FolhaPontoData[],
  totais: TotaisFolhaPonto,
  mes: number,
  ano: number,
  dadosEmpresaPre?: DadosEmpresa | null
): Promise<Uint8Array> {
  const doc = new jsPDF('portrait');
  const dadosEmpresa = dadosEmpresaPre ?? (await buscarDadosEmpresa());

  renderFolhaFuncionario(doc, dados, totais, mes, ano, dadosEmpresa);
  renderRodapeNumeracao(doc, dadosEmpresa);

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

/**
 * Publica a folha de ponto individual no bucket e cria/atualiza o registro
 * na tabela `folhas_ponto` para o funcionário acessar via portal.
 */
export async function publicarFolhaPontoFuncionario(params: {
  tenantId: string;
  funcionarioId: string;
  mes: number;
  ano: number;
  dados: FolhaPontoData[];
  totais: TotaisFolhaPonto;
  enviadoPor?: string | null;
  dadosEmpresa?: DadosEmpresa | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { tenantId, funcionarioId, mes, ano, dados, totais, enviadoPor, dadosEmpresa } = params;
  if (!dados.length) return { ok: false, error: 'sem dados' };

  try {
    const bytes = await gerarFolhaPontoIndividualPDFBytes(dados, totais, mes, ano, dadosEmpresa);
    // Caminho versionado: evita que o colaborador veja um PDF antigo em cache.
    const competencia = `${ano}-${String(mes).padStart(2, '0')}`;
    const path = `${tenantId}/${funcionarioId}/${competencia}-${Date.now()}.pdf`;

    // Folha anterior da mesma competência (será substituída).
    const { data: anterior } = await supabase
      .from('folhas_ponto')
      .select('path')
      .eq('tenant_id', tenantId)
      .eq('funcionario_id', funcionarioId)
      .eq('mes', mes)
      .eq('ano', ano)
      .maybeSingle();

    const { error: upErr } = await supabase.storage
      .from('folhas-ponto')
      .upload(path, new Blob([bytes as any], { type: 'application/pdf' }), {
        upsert: true,
        contentType: 'application/pdf',
      });
    if (upErr) return { ok: false, error: upErr.message };

    // Sobrescreve o registro e zera a confirmação: a nova versão precisa de nova ciência.
    const { error: dbErr } = await supabase.from('folhas_ponto').upsert(
      {
        tenant_id: tenantId,
        funcionario_id: funcionarioId,
        mes,
        ano,
        path,
        paginas: 1,
        tamanho_bytes: bytes.byteLength,
        enviado_por: enviadoPor ?? null,
        created_at: new Date().toISOString(),
        confirmado: null,
        confirmado_at: null,
        motivo_discordancia: null,
        primeira_abertura_at: null,
      } as any,
      { onConflict: 'tenant_id,funcionario_id,mes,ano' }
    );
    if (dbErr) return { ok: false, error: dbErr.message };

    // Remove o arquivo antigo para manter só a versão mais atual.
    const pathAntigo = (anterior as any)?.path as string | undefined;
    if (pathAntigo && pathAntigo !== path) {
      await supabase.storage.from('folhas-ponto').remove([pathAntigo]);
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'erro desconhecido' };
  }
}