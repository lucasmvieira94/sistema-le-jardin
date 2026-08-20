/**
 * Página pública de assinatura eletrônica (/assinar/:token).
 *
 * Fluxo: abrir documento -> ler e aceitar os termos -> confirmar autoria
 * (código OTP por e-mail/WhatsApp ou biometria facial) -> assinar.
 * Todas as etapas são registradas com IP, dispositivo, data/hora e
 * geolocalização (quando autorizada) para fins probatórios.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, ShieldCheck, FileSignature, CheckCircle2, XCircle, AlertTriangle, ScanFace } from 'lucide-react';
import ValidacaoBiometricaDialog from '@/components/biometria/ValidacaoBiometricaDialog';
import { gerarPdfDocumentoAssinado, type SignatarioPdf } from '@/utils/documentoAssinadoPDF';
import { FileDown } from 'lucide-react';

interface Dados {
  envelope: {
    id: string; titulo: string; tipo: string; conteudo_html: string;
    hash_documento: string; status: string; mensagem: string | null; expira_em: string;
  };
  signatario: {
    id: string; nome: string; papel: string; metodo: string; status: string;
    assinado_em: string | null; motivo_recusa: string | null; funcionario_id: string | null;
    email_mascarado: string | null; telefone_mascarado: string | null;
  };
  expirado: boolean;
  cancelado: boolean;
  signatarios?: SignatarioPdf[];
}

async function chamar(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('assinatura-publica', { body: payload });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

export default function AssinaturaPublica() {
  const { token } = useParams<{ token: string }>();
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [aceite, setAceite] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [otpEnviado, setOtpEnviado] = useState(false);
  const [enviandoOtp, setEnviandoOtp] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const [biometriaOk, setBiometriaOk] = useState(false);
  const [biometriaAberta, setBiometriaAberta] = useState(false);
  const [recusaAberta, setRecusaAberta] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [geo, setGeo] = useState<{ latitude: number; longitude: number; precisao?: number } | null>(null);
  const [concluido, setConcluido] = useState<{ hash: string; em: string } | null>(null);
  const [copiaEnviada, setCopiaEnviada] = useState(false);
  const [baixando, setBaixando] = useState(false);

  const carregar = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    try {
      setDados(await chamar({ action: 'obter', token }));
      setErro(null);
    } catch (e: any) {
      setErro(e.message || 'Não foi possível carregar o documento');
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => { carregar(); }, [carregar]);

  // Geolocalização é opcional — reforça a evidência de autoria quando permitida
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({
        latitude: Number(pos.coords.latitude.toFixed(6)),
        longitude: Number(pos.coords.longitude.toFixed(6)),
        precisao: Math.round(pos.coords.accuracy),
      }),
      () => undefined,
      { timeout: 8000 },
    );
  }, []);

  const solicitarOtp = async () => {
    setEnviandoOtp(true);
    try {
      const r = await chamar({ action: 'solicitar_otp', token });
      setOtpEnviado(true);
      toast.success(`Código enviado por ${r.canal === 'whatsapp' ? 'WhatsApp' : 'e-mail'}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEnviandoOtp(false);
    }
  };

  const assinar = async () => {
    setAssinando(true);
    try {
      const r = await chamar({
        action: 'assinar', token, codigo: codigo.trim(),
        aceite_termos: aceite, biometria_validada: biometriaOk,
        geolocalizacao: geo,
      });
      setConcluido({ hash: r.hash_assinatura, em: r.assinado_em });
      setCopiaEnviada(!!r.copia_enviada);
      toast.success('Documento assinado com sucesso');
      carregar();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAssinando(false);
    }
  };

  const recusar = async () => {
    try {
      await chamar({ action: 'recusar', token, motivo: motivoRecusa.trim() });
      setRecusaAberta(false);
      toast.success('Recusa registrada');
      carregar();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  /** Baixa a via completa (documento + assinaturas e evidências). */
  const baixarAssinado = async () => {
    if (!dados) return;
    setBaixando(true);
    try {
      await gerarPdfDocumentoAssinado({
        titulo: dados.envelope.titulo,
        tipo: dados.envelope.tipo,
        conteudo_html: dados.envelope.conteudo_html,
        hash_documento: dados.envelope.hash_documento,
        signatarios: dados.signatarios ?? [],
      });
    } catch (e: any) {
      toast.error(e.message ?? 'Falha ao gerar o PDF');
    } finally {
      setBaixando(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <XCircle className="w-12 h-12 mx-auto text-destructive" />
            <p className="font-medium">{erro || 'Documento indisponível'}</p>
            <p className="text-sm text-muted-foreground">Solicite um novo link ao responsável pelo envio.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { envelope, signatario } = dados;
  const jaAssinou = signatario.status === 'assinado';
  const recusou = signatario.status === 'recusado';
  const indisponivel = dados.expirado || dados.cancelado;
  const usaBiometria = signatario.metodo === 'biometria_facial';
  const podeAssinar = aceite && (usaBiometria ? biometriaOk : codigo.trim().length === 6);

  return (
    <div className="min-h-screen bg-muted py-6 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <FileSignature className="w-5 h-5" /> {envelope.titulo}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Signatário: <strong>{signatario.nome}</strong> ({signatario.papel})
                </p>
              </div>
              <Badge variant={jaAssinou ? 'default' : recusou ? 'destructive' : 'secondary'}>
                {jaAssinou ? 'Assinado' : recusou ? 'Recusado' : indisponivel ? 'Indisponível' : 'Pendente'}
              </Badge>
            </div>
            {envelope.mensagem && (
              <p className="text-sm bg-accent/40 rounded-md p-3 mt-2">{envelope.mensagem}</p>
            )}
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none border rounded-md p-4 bg-background max-h-[55vh] overflow-y-auto"
              // Conteúdo gerado pelo próprio sistema (documento emitido pela instituição)
              dangerouslySetInnerHTML={{ __html: envelope.conteudo_html }}
            />
            <p className="text-[11px] text-muted-foreground mt-3 break-all">
              Hash SHA-256 do documento: {envelope.hash_documento}
            </p>
          </CardContent>
        </Card>

        {jaAssinou || concluido ? (
          <Card className="border-primary">
            <CardContent className="pt-6 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 mx-auto text-primary" />
              <p className="font-semibold">Assinatura registrada com sucesso</p>
              <p className="text-sm text-muted-foreground">
                Assinado em{' '}
                {new Date(concluido?.em || signatario.assinado_em!).toLocaleString('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                })}{' '}
                (UTC-3)
              </p>
              <p className="text-[11px] text-muted-foreground break-all">
                Hash da assinatura: {concluido?.hash ?? '—'}
              </p>
              <Button onClick={baixarAssinado} disabled={baixando} className="mt-2">
                {baixando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                Baixar documento assinado (PDF)
              </Button>
              {copiaEnviada && (
                <p className="text-xs text-muted-foreground">
                  Uma cópia do documento assinado também foi enviada para o seu e-mail.
                </p>
              )}
            </CardContent>
          </Card>
        ) : recusou ? (
          <Card className="border-destructive">
            <CardContent className="pt-6 text-center space-y-2">
              <XCircle className="w-10 h-10 mx-auto text-destructive" />
              <p className="font-semibold">Assinatura recusada</p>
              <p className="text-sm text-muted-foreground">{signatario.motivo_recusa}</p>
            </CardContent>
          </Card>
        ) : indisponivel ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-2">
              <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
              <p className="font-medium">
                {dados.cancelado ? 'Este documento foi cancelado pelo emissor.' : 'Este link expirou.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" /> Confirmação de autoria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2">
                <Checkbox id="aceite" checked={aceite} onCheckedChange={(v) => setAceite(!!v)} />
                <label htmlFor="aceite" className="text-sm leading-snug cursor-pointer">
                  Declaro que li o documento acima, concordo integralmente com seu conteúdo e reconheço
                  a validade jurídica desta assinatura eletrônica, nos termos do art. 10, §2º da MP
                  2.200-2/2001 e da Lei 14.063/2020.
                </label>
              </div>

              <Separator />

              {usaBiometria ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Sua identidade será confirmada por reconhecimento facial.
                  </p>
                  <Button
                    variant={biometriaOk ? 'secondary' : 'default'}
                    onClick={() => setBiometriaAberta(true)}
                    disabled={biometriaOk || !signatario.funcionario_id}
                    className="w-full"
                  >
                    <ScanFace className="w-4 h-4 mr-2" />
                    {biometriaOk ? 'Identidade confirmada' : 'Validar reconhecimento facial'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Enviaremos um código de 6 dígitos para{' '}
                    <strong>
                      {signatario.metodo === 'otp_sms'
                        ? signatario.telefone_mascarado
                        : signatario.email_mascarado}
                    </strong>
                    .
                  </p>
                  <div className="flex gap-2">
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                      className="tracking-[0.4em] text-center text-lg"
                    />
                    <Button variant="outline" onClick={solicitarOtp} disabled={enviandoOtp}>
                      {enviandoOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : otpEnviado ? 'Reenviar' : 'Enviar código'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button className="flex-1" onClick={assinar} disabled={!podeAssinar || assinando}>
                  {assinando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSignature className="w-4 h-4 mr-2" />}
                  Assinar documento
                </Button>
                <Button variant="outline" onClick={() => setRecusaAberta(true)}>
                  Recusar
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Ao assinar, registramos data e hora, endereço IP, dispositivo
                {geo ? ', geolocalização aproximada' : ''} e o hash de integridade do documento,
                em conformidade com a LGPD (Lei 13.709/2018).
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {signatario.funcionario_id && (
        <ValidacaoBiometricaDialog
          open={biometriaAberta}
          onOpenChange={setBiometriaAberta}
          funcionarioId={signatario.funcionario_id}
          funcionarioNome={signatario.nome}
          contexto="login_portal"
          onValidado={() => { setBiometriaOk(true); setBiometriaAberta(false); }}
        />
      )}

      <Dialog open={recusaAberta} onOpenChange={setRecusaAberta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar assinatura</DialogTitle>
            <DialogDescription>
              Informe o motivo da recusa. Ele ficará registrado na trilha de auditoria do documento.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={motivoRecusa}
            onChange={(e) => setMotivoRecusa(e.target.value)}
            placeholder="Descreva o motivo (mínimo 5 caracteres)"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecusaAberta(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={recusar} disabled={motivoRecusa.trim().length < 5}>
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
