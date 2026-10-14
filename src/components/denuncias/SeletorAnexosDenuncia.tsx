import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { ANEXO_MAX_BYTES, ANEXO_MIMES } from "@/utils/canalDenuncias";

/** Seleção de anexos (PDF, imagem, áudio) com limites; metadados são removidos no envio. */
export function SeletorAnexosDenuncia({ arquivos, onChange, max }: { arquivos: File[]; onChange: (f: File[]) => void; max: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const adicionar = (lista: FileList | null) => {
    const novos = Array.from(lista ?? []).filter((f) => {
      if (!ANEXO_MIMES.includes(f.type)) { toast.error(`${f.name}: formato não aceito`); return false; }
      if (f.size > ANEXO_MAX_BYTES) { toast.error(`${f.name}: maior que 10 MB`); return false; }
      return true;
    });
    onChange([...arquivos, ...novos].slice(0, max));
    if (ref.current) ref.current.value = "";
  };
  return (
    <div className="space-y-2">
      <input ref={ref} type="file" multiple hidden accept={ANEXO_MIMES.join(",")} onChange={(e) => adicionar(e.target.files)} />
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={arquivos.length >= max}>
        <Paperclip className="w-4 h-4 mr-2" /> Anexar arquivo ({arquivos.length}/{max})
      </Button>
      {arquivos.map((f, i) => (
        <div key={i} className="flex items-center justify-between text-sm rounded-md border px-3 py-1.5">
          <span className="truncate">{f.name}</span>
          <button type="button" aria-label="Remover anexo" onClick={() => onChange(arquivos.filter((_, j) => j !== i))}><X className="w-4 h-4" /></button>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">PDF, imagens ou áudios, até 10 MB cada. Removemos automaticamente autor, localização e outros dados ocultos dos arquivos. Em áudios, lembre que a voz pode identificar quem fala.</p>
    </div>
  );
}
