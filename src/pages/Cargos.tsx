import { useEffect, useState } from "react";
import { Briefcase, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { MODULOS_PORTAL } from "@/utils/modulosCargo";

interface Cargo {
  id: string;
  nome: string;
  descricao: string | null;
  cbo: string | null;
  salario_base: number | null;
  carga_horaria_semanal: number | null;
  modulos: string[];
  ativo: boolean;
}

const VAZIO: Omit<Cargo, "id"> = {
  nome: "", descricao: "", cbo: "", salario_base: null, carga_horaria_semanal: null, modulos: [], ativo: true,
};
const GRUPOS = Array.from(new Set(MODULOS_PORTAL.map((m) => m.grupo)));

/** Cadastro de cargos e dos módulos do portal que cada cargo libera. */
export default function Cargos() {
  const { isAdmin } = useUserRole();
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [contagem, setContagem] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<(Omit<Cargo, "id"> & { id?: string }) | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const [{ data: c }, { data: f }] = await Promise.all([
      supabase.from("cargos" as any).select("*").order("nome"),
      supabase.from("funcionarios").select("cargo_id" as any).eq("ativo", true),
    ]);
    setCargos(((c as any) || []) as Cargo[]);
    const cont: Record<string, number> = {};
    ((f as any[]) || []).forEach((r) => { if (r.cargo_id) cont[r.cargo_id] = (cont[r.cargo_id] || 0) + 1; });
    setContagem(cont);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    if (!edit) return;
    if (!edit.nome.trim()) { toast.error("Informe o nome do cargo"); return; }
    setSalvando(true);
    const { id, ...dados } = edit;
    const payload = {
      ...dados,
      nome: dados.nome.trim(),
      descricao: dados.descricao?.trim() || null,
      cbo: dados.cbo?.trim() || null,
    };
    const { error } = id
      ? await supabase.from("cargos" as any).update(payload).eq("id", id)
      : await supabase.from("cargos" as any).insert(payload);
    setSalvando(false);
    if (error) {
      toast.error(error.code === "23505" ? "Já existe um cargo com esse nome" : "Erro ao salvar o cargo");
      return;
    }
    toast.success("Cargo salvo");
    setEdit(null);
    carregar();
  };

  const excluir = async (c: Cargo) => {
    if (contagem[c.id]) { toast.error("Este cargo tem funcionários. Inative-o em vez de excluir."); return; }
    if (!confirm(`Excluir o cargo "${c.nome}"?`)) return;
    const { error } = await supabase.from("cargos" as any).delete().eq("id", c.id);
    if (error) toast.error("Não foi possível excluir: há funcionários (ativos ou desligados) com este cargo. Inative-o.");
    else { toast.success("Cargo excluído"); carregar(); }
  };

  const alternarModulo = (id: string, v: boolean) =>
    edit && setEdit({ ...edit, modulos: v ? [...edit.modulos, id] : edit.modulos.filter((m) => m !== id) });

  return (
    <div className="container mx-auto max-w-5xl pt-12 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-primary flex items-center gap-2"><Briefcase className="w-8 h-8" /> Cargos e Funções</h2>
          <p className="text-muted-foreground">Defina os cargos da equipe e quais módulos do portal cada um pode acessar.</p>
        </div>
        {isAdmin && <Button onClick={() => setEdit({ ...VAZIO })}><Plus className="w-4 h-4 mr-2" /> Novo cargo</Button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cargos.map((c) => (
            <Card key={c.id} className={c.ativo ? "" : "opacity-60"}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{c.nome}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {contagem[c.id] || 0} funcionário(s) ativo(s){c.cbo ? ` · CBO ${c.cbo}` : ""}
                      {c.carga_horaria_semanal ? ` · ${c.carga_horaria_semanal}h/semana` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1 items-center">
                    {!c.ativo && <Badge variant="outline">Inativo</Badge>}
                    {isAdmin && (
                      <>
                        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEdit({ ...c })}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => excluir(c)}><Trash2 className="w-4 h-4" /></Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {c.descricao && <p className="text-sm mb-2">{c.descricao}</p>}
                <div className="flex flex-wrap gap-1">
                  {c.modulos.length === 0 && <span className="text-sm text-muted-foreground">Nenhum módulo liberado</span>}
                  {MODULOS_PORTAL.filter((m) => c.modulos.includes(m.id)).map((m) => (
                    <Badge key={m.id} variant="secondary">{m.nome}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar cargo" : "Novo cargo"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>Nome *</Label><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></div>
                <div><Label>CBO</Label><Input value={edit.cbo || ""} onChange={(e) => setEdit({ ...edit, cbo: e.target.value })} placeholder="Ex: 5162-10" /></div>
                <div><Label>Salário base sugerido (R$)</Label><Input type="number" step="0.01" value={edit.salario_base ?? ""} onChange={(e) => setEdit({ ...edit, salario_base: e.target.value ? Number(e.target.value) : null })} /></div>
                <div><Label>Carga horária semanal (h)</Label><Input type="number" value={edit.carga_horaria_semanal ?? ""} onChange={(e) => setEdit({ ...edit, carga_horaria_semanal: e.target.value ? Number(e.target.value) : null })} /></div>
              </div>
              <div><Label>Descrição / atribuições</Label><Textarea value={edit.descricao || ""} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} /></div>
              <div>
                <Label className="text-base">Módulos liberados no portal</Label>
                <div className="mt-2 grid gap-3">
                  {GRUPOS.map((g) => (
                    <div key={g}>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{g}</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {MODULOS_PORTAL.filter((m) => m.grupo === g).map((m) => (
                          <label key={m.id} className="flex items-center gap-2 text-sm">
                            <Checkbox checked={edit.modulos.includes(m.id)} onCheckedChange={(v) => alternarModulo(m.id, !!v)} />
                            {m.nome}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div><p className="text-sm font-medium">Cargo ativo</p><p className="text-xs text-muted-foreground">Cargos inativos não aparecem para novos cadastros.</p></div>
                <Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
