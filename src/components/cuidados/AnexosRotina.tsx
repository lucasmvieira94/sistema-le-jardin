import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FileText, Image as ImageIcon, Loader2, Paperclip, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { abrirAnexo, validarAnexo, type AnexoRotina } from "@/utils/anexosRotina";

/** Botões "Tirar foto" (câmera do aparelho) e "Anexar arquivo" (foto ou PDF) + lista do que será enviado. */
export function SeletorAnexos({ arquivos, onChange }: { arquivos: File[]; onChange: (f: File[]) => void }) {
  const { toast } = useToast();
  const camera = useRef<HTMLInputElement>(null); const arquivo = useRef<HTMLInputElement>(null);
  const adicionar = (lista: FileList | null) => {
    const novos: File[] = [];
    for (const f of Array.from(lista ?? [])) { const erro = validarAnexo(f); if (erro) toast({ title: f.name, description: erro, variant: "destructive" }); else novos.push(f); }
    if (novos.length) onChange([...arquivos, ...novos].slice(0, 5));
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => camera.current?.click()}><Camera className="mr-1 h-4 w-4" />Tirar foto</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => arquivo.current?.click()}><Paperclip className="mr-1 h-4 w-4" />Anexar imagem ou PDF</Button>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
        <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
      </div>
      {arquivos.map((f, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
          {f.type === "application/pdf" ? <FileText className="h-4 w-4 text-primary" /> : <ImageIcon className="h-4 w-4 text-primary" />}
          <span className="min-w-0 flex-1 truncate">{f.name}</span>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange(arquivos.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
        </div>
      ))}
    </div>
  );
}

/** Documentos já anexados à rotina: abrir para consulta e, se preciso, remover com motivo. */
export function ListaAnexos({ rotinaId, podeRemover = false, recarregar = 0 }: { rotinaId: string; podeRemover?: boolean; recarregar?: number }) {
  const { toast } = useToast();
  const [lista, setLista] = useState<AnexoRotina[]>([]);
  const [aberto, setAberto] = useState<{ a: AnexoRotina; url: string } | null>(null);
  const [carregando, setCarregando] = useState<string | null>(null);
  const [remover, setRemover] = useState<AnexoRotina | null>(null); const [motivo, setMotivo] = useState("");
  const carregar = useCallback(() => { supabase.rpc("portal_rotina_anexos" as any, { _rotina_id: rotinaId }).then(({ data }) => setLista((data as AnexoRotina[]) ?? [])); }, [rotinaId]);
  useEffect(() => { carregar(); }, [carregar, recarregar]);
  useEffect(() => () => { if (aberto) URL.revokeObjectURL(aberto.url); }, [aberto]);

  const ver = async (a: AnexoRotina) => {
    setCarregando(a.id);
    try { setAberto({ a, url: await abrirAnexo(a.id) }); } catch (e) { toast({ title: "Não foi possível abrir", description: (e as Error).message, variant: "destructive" }); }
    setCarregando(null);
  };
  const confirmarRemocao = async () => {
    const { error } = await supabase.rpc("portal_rotina_anexo_remover" as any, { _anexo_id: remover!.id, _motivo: motivo });
    if (error) return toast({ title: "Não foi possível remover", description: error.message, variant: "destructive" });
    setRemover(null); setMotivo(""); carregar();
  };
  if (!lista.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {lista.map((a) => (
        <div key={a.id} className="flex items-center">
          <Button type="button" size="sm" variant="secondary" onClick={() => ver(a)} disabled={carregando === a.id}>
            {carregando === a.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : a.tipo_mime === "application/pdf" ? <FileText className="mr-1 h-3.5 w-3.5" /> : <ImageIcon className="mr-1 h-3.5 w-3.5" />}
            <span className="max-w-40 truncate">{a.nome_arquivo}</span>
          </Button>
          {podeRemover && <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRemover(a)} aria-label="Remover anexo"><Trash2 className="h-3.5 w-3.5" /></Button>}
        </div>
      ))}
      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-h-[95vh] max-w-3xl">
          <DialogHeader><DialogTitle className="truncate pr-6">{aberto?.a.nome_arquivo}</DialogTitle></DialogHeader>
          {aberto && (aberto.a.tipo_mime === "application/pdf"
            ? <iframe src={aberto.url} title={aberto.a.nome_arquivo} className="h-[75vh] w-full rounded border" />
            : <img src={aberto.url} alt={aberto.a.nome_arquivo} className="max-h-[75vh] w-full rounded object-contain" />)}
          {aberto && <Button asChild variant="outline"><a href={aberto.url} download={aberto.a.nome_arquivo} target="_blank" rel="noreferrer">Abrir em tela cheia</a></Button>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!remover} onOpenChange={(o) => !o && setRemover(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remover anexo</DialogTitle></DialogHeader>
          <Textarea placeholder="Motivo (obrigatório)" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <DialogFooter><Button variant="destructive" disabled={motivo.trim().length < 3} onClick={confirmarRemocao}>Remover</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
