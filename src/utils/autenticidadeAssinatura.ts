import { supabase } from '@/integrations/supabase/client';

/** Resolve o código persistido, nunca inventa um número a partir do hash. */
export async function obterAutenticidadeAssinatura(input: {
  origem: 'interno' | 'envelope';
  referencia_id: string;
  hash: string;
  hash_assinatura?: string;
}) {
  const { data, error } = await supabase.functions.invoke('verificar-documento', {
    body: { action: 'obter_codigo', ...input },
  });
  if (error || !data?.codigo_verificador) {
    throw new Error('Não foi possível obter a autenticidade da assinatura. Tente baixar novamente.');
  }
  const hash = String(input.hash).trim().toUpperCase();
  const codigo = String(data.codigo_verificador);
  return {
    codigo_verificador: codigo,
    hash_documento: hash,
    url_verificacao: `https://senexcare.app/verificar-documento?id=${encodeURIComponent(codigo)}&hash=${encodeURIComponent(hash)}`,
  };
}