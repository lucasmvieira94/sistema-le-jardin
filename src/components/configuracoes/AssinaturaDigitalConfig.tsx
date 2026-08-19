/**
 * Configuração da rubrica institucional usada nas assinaturas eletrônicas.
 * A rubrica pode ser desenhada no canvas (dedo/mouse) ou enviada como imagem,
 * e é armazenada em base64 na tabela `configuracoes_empresa`.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, PenLine, Upload, Eraser, Save } from 'lucide-react';
import { toast } from 'sonner';

export function AssinaturaDigitalConfig() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const desenhando = useRef(false);

  const [configId, setConfigId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [cpf, setCpf] = useState('');
  const [base64, setBase64] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('configuracoes_empresa')
        .select('id, assinatura_empresa_nome, assinatura_empresa_cargo, assinatura_empresa_cpf, assinatura_empresa_base64')
        .limit(1)
        .maybeSingle();
      if (data) {
        setConfigId(data.id);
        setNome(data.assinatura_empresa_nome ?? '');
        setCargo(data.assinatura_empresa_cargo ?? '');
        setCpf(data.assinatura_empresa_cpf ?? '');
        setBase64(data.assinatura_empresa_base64 ?? null);
      }
      setCarregando(false);
    })();
  }, []);

  /** Converte coordenadas do ponteiro para o sistema interno do canvas. */
  const ponto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  const iniciar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = ponto(e);
    desenhando.current = true;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!desenhando.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = ponto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const parar = () => { desenhando.current = false; };

  const limpar = () => {
    const c = canvasRef.current;
    if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setBase64(null);
  };

  const capturarDesenho = () => {
    const c = canvasRef.current!;
    setBase64(c.toDataURL('image/png'));
    toast.success('Rubrica capturada. Clique em salvar para confirmar.');
  };

  const enviarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Use uma imagem PNG, JPG ou WebP');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('Imagem muito grande (máx. 1MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setBase64(String(reader.result));
    reader.readAsDataURL(file);
  };

  const salvar = async () => {
    if (!nome.trim()) return toast.error('Informe o nome do responsável pela assinatura');
    if (!base64) return toast.error('Capture ou envie a rubrica');
    setSalvando(true);
    try {
      const payload = {
        assinatura_empresa_nome: nome.trim(),
        assinatura_empresa_cargo: cargo.trim() || null,
        assinatura_empresa_cpf: cpf.trim() || null,
        assinatura_empresa_base64: base64,
      };
      const { error } = configId
        ? await supabase.from('configuracoes_empresa').update(payload).eq('id', configId)
        : await supabase.from('configuracoes_empresa').insert(payload as any);
      if (error) throw error;
      toast.success('Rubrica institucional salva');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar rubrica');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PenLine className="w-5 h-5 text-primary" /> Assinatura digital da empresa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Esta rubrica é aplicada automaticamente nos documentos enviados para assinatura eletrônica,
          junto ao hash SHA-256 e ao QR Code de verificação pública.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Nome do responsável</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Cargo</Label>
            <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Diretor" />
          </div>
          <div>
            <Label>CPF</Label>
            <Input value={cpf} onChange={(e) => setCpf(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Desenhe a rubrica</Label>
          <canvas
            ref={canvasRef}
            width={600}
            height={200}
            className="w-full h-40 border border-dashed rounded-md bg-background touch-none"
            onPointerDown={iniciar}
            onPointerMove={mover}
            onPointerUp={parar}
            onPointerLeave={parar}
          />
          <div className="flex flex-wrap gap-2 mt-2">
            <Button type="button" size="sm" variant="outline" onClick={capturarDesenho}>
              <PenLine className="w-4 h-4 mr-1" /> Usar desenho
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={limpar}>
              <Eraser className="w-4 h-4 mr-1" /> Limpar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" /> Enviar imagem
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={enviarArquivo} />
          </div>
        </div>

        {base64 && (
          <div className="border rounded-md p-3">
            <p className="text-xs text-muted-foreground mb-2">Pré-visualização da rubrica</p>
            <img src={base64} alt="Rubrica da empresa" className="max-h-24" />
          </div>
        )}

        <Button onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar rubrica
        </Button>
      </CardContent>
    </Card>
  );
}

export default AssinaturaDigitalConfig;
