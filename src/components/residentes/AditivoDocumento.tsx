import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FileDown, Printer, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { certificarPDF } from '@/utils/certificarPDF';
import { rodapeDocumentoHTML, type SeloAutenticidade } from '@/utils/rodapeDocumento';
import { htmlAditivo, paragrafosAditivo, type AditivoData } from '@/utils/aditivoContrato';
import EnviarParaAssinaturaButton from '@/components/assinaturas/EnviarParaAssinaturaButton';
import BaixarContratoAssinado from './BaixarContratoAssinado';

export default function AditivoDocumento({ aditivo, onClose }: { aditivo: AditivoData; onClose: () => void }) {
  const [documento, setDocumento] = useState<{ pdf: jsPDF; selo: SeloAutenticidade } | null>(null);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [envelope, setEnvelope] = useState<{ id: string; status: string } | null>(null);
  const c = aditivo.dados_documento.contrato;
  useEffect(() => {
    let cancelado = false;
    setDocumento(null); setErro('');
    (async () => {
      try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.setFont('times', 'bold').setFontSize(13);
        pdf.text('TERMO ADITIVO DE PRORROGAÇÃO', 105, 22, { align: 'center' });
        pdf.text(aditivo.numero_aditivo, 105, 30, { align: 'center' });
        pdf.setFont('times', 'normal').setFontSize(11);
        let y = 42;
        // Mantém cada linha inteira e reserva espaço para o certificado na última página.
        for (const p of paragrafosAditivo(aditivo)) {
          const linhas: string[] = pdf.splitTextToSize(p, 174);
          for (const linha of linhas) {
            if (y > 270) { pdf.addPage(); y = 22; }
            pdf.text(linha, 18, y); y += 5.8;
          }
          y += 4;
        }
        const selo = await certificarPDF(pdf, {
          tipo: aditivo.distrato_id ? 'distrato_residente' : 'contrato_residente',
          titulo: `Aditivo ${aditivo.numero_aditivo}`,
          referenciaId: aditivo.id, referenciaTabela: 'contratos_aditivos',
        }, y);
        if (!cancelado) setDocumento({ pdf, selo });
      } catch (e) { if (!cancelado) setErro(e instanceof Error ? e.message : 'Não foi possível certificar o aditivo.'); }
    })();
    return () => { cancelado = true; };
  }, [aditivo, tentativa]);

  useEffect(() => {
    let cancelado = false;
    const consultar = async () => {
      const { data, error } = await supabase.from('assinatura_envelopes').select('id,status')
        .eq('referencia_id', aditivo.id).eq('referencia_tabela', 'contratos_aditivos')
        .not('status', 'in', '(cancelado,expirado)').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!cancelado && !error) setEnvelope(data);
    };
    consultar();
    const timer = window.setInterval(consultar, 10000);
    return () => { cancelado = true; window.clearInterval(timer); };
  }, [aditivo.id]);

  // O envelope certifica o próprio conteúdo e acrescenta um único rodapé final assinado.
  const conteudoAssinatura = () => htmlAditivo(aditivo);
  const conteudo = () => conteudoAssinatura() + (documento ? rodapeDocumentoHTML(documento.selo) : '');
  const imprimir = () => {
    if (!documento) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><title>Aditivo</title><style>@page{size:A4 portrait;margin:18mm}body{font-family:'Times New Roman',serif}img{max-width:100%}</style></head><body>${conteudo()}</body></html>`);
    w.document.close(); w.focus(); window.setTimeout(() => w.print(), 700);
  };
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-4xl max-h-[95dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Aditivo {aditivo.numero_aditivo}</DialogTitle><DialogDescription>{envelope?.status === 'concluido' ? 'Assinado eletronicamente' : envelope ? 'Assinatura em andamento' : 'Prorrogação registrada'}</DialogDescription></DialogHeader>
      {erro ? <div role="alert" className="text-destructive space-y-2"><p>{erro}</p><Button variant="outline" onClick={() => setTentativa(v => v + 1)}><RefreshCw className="w-4 h-4 mr-2"/>Tentar novamente</Button></div> : !documento ? <p role="status" className="text-muted-foreground">Certificando documento…</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!documento} onClick={imprimir}><Printer className="w-4 h-4 mr-2"/>Imprimir</Button>
        <Button disabled={!documento} onClick={() => documento?.pdf.save(`Aditivo_${aditivo.numero_aditivo.replace(/[^\w-]/g, '_')}.pdf`)}><FileDown className="w-4 h-4 mr-2"/>PDF certificado</Button>
        {envelope?.status === 'concluido' ? <BaixarContratoAssinado envelopeId={envelope.id} titulo={`Aditivo ${aditivo.numero_aditivo}`}/> : !envelope ? <EnviarParaAssinaturaButton disabled={!documento} titulo={`Aditivo ${aditivo.numero_aditivo}`} tipo={aditivo.distrato_id ? 'distrato_residente' : 'contrato_residente'} referenciaId={aditivo.id} referenciaTabela="contratos_aditivos" obterConteudoHtml={conteudoAssinatura} label="Enviar para assinatura" signatarios={[{ nome: c.contratante_nome, cpf: c.contratante_cpf, email: c.contratante_email, telefone: c.contratante_telefone, papel: 'responsavel', metodo: c.contratante_email ? 'otp_email' : 'otp_sms' }]}/> : null}
      </div>
      <article className="font-serif text-sm leading-relaxed space-y-4 border-t pt-4 break-words">
        <h2 className="text-center font-bold">TERMO ADITIVO DE PRORROGAÇÃO</h2>
        {paragrafosAditivo(aditivo).map((p, i) => <p key={i} className="whitespace-pre-wrap">{p}</p>)}
        {documento && <p className="text-xs text-muted-foreground">Autenticidade: {documento.selo.id} · <a className="underline" href={documento.selo.urlVerificacao} target="_blank" rel="noreferrer">Verificar documento</a></p>}
      </article>
    </DialogContent>
  </Dialog>;
}