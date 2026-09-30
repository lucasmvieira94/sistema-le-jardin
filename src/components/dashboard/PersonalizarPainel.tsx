/** Diálogo para mostrar/ocultar e reordenar os quadros do painel. */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowDown, ArrowUp, LayoutGrid } from "lucide-react";
import { aplicarPreferencias, GRUPOS, QUADROS, type PreferenciasPainel } from "./registroQuadros";

export default function PersonalizarPainel({ pref, onSalvar }: { pref: PreferenciasPainel; onSalvar: (p: PreferenciasPainel) => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const [ordem, setOrdem] = useState<string[]>([]);
  const [ocultos, setOcultos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setOrdem(aplicarPreferencias({ ordem: pref.ordem, ocultos: [] }).map((q) => q.id));
    setOcultos(pref.ocultos);
  }, [aberto, pref]);

  const mover = (i: number, d: -1 | 1) => {
    const n = [...ordem];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    setOrdem(n);
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><LayoutGrid className="w-4 h-4 mr-2" />Personalizar painel</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Personalizar painel</DialogTitle></DialogHeader>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {ordem.map((id, i) => {
            const q = QUADROS.find((x) => x.id === id)!;
            const visivel = !ocultos.includes(id);
            return (
              <div key={id} className="flex items-center gap-2 border rounded-md p-2">
                <div className="flex flex-col">
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => mover(i, -1)} aria-label="Subir"><ArrowUp className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => mover(i, 1)} aria-label="Descer"><ArrowDown className="w-3 h-3" /></Button>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{q.titulo}</p>
                  <p className="text-xs text-muted-foreground">{GRUPOS[q.grupo]}</p>
                </div>
                <Switch checked={visivel} onCheckedChange={(v) =>
                  setOcultos(v ? ocultos.filter((x) => x !== id) : [...ocultos, id])} aria-label={`Mostrar ${q.titulo}`} />
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setOrdem(QUADROS.map((q) => q.id)); setOcultos([]); }}>Restaurar padrão</Button>
          <Button disabled={salvando} onClick={async () => {
            setSalvando(true);
            try { await onSalvar({ ordem, ocultos }); setAberto(false); } finally { setSalvando(false); }
          }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
