import { supabase } from '@/integrations/supabase/client';

/** Obtém a mesma via privada que foi anexada ao e-mail, sem reconstruir o documento. */
export async function prepararViaFinal(envelopeId: string, titulo: string, token?: string) {
  const { data, error } = await supabase.functions.invoke(token ? 'assinatura-publica' : 'assinatura-envelope', {
    body: token ? { action: 'baixar_final', token } : { action: 'baixar_final', envelope_id: envelopeId },
  });
  if (error) {
    const contexto = 'context' in error ? error.context : null;
    const detalhe = contexto instanceof Response ? await contexto.json().catch(() => null) : null;
    throw new Error(detalhe?.error ?? error.message);
  }
  if (!(data instanceof Blob) || !data.size || data.type !== 'application/pdf') throw new Error(data?.error ?? 'O serviço não retornou um PDF válido.');
  const filename = `${titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 90) || 'documento'}_assinado.pdf`;
  return { blob: data, filename };
}

/** Chamado diretamente pelo botão, mantendo o gesto necessário para Safari/iOS. */
export async function salvarViaFinal(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}