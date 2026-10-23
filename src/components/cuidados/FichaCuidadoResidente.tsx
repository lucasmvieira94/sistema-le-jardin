import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { semCamposProibidos, idade } from "@/utils/portalCuidados";

type Json = Record<string, any>;

const rotulo = (k: string) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const dataBR = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");
const texto = (v: unknown) => (Array.isArray(v) ? v.join(", ") : typeof v === "object" && v ? JSON.stringify(v) : String(v ?? ""));

function Campos({ dados }: { dados?: Json | null }) {
  const itens = Object.entries(dados ?? {}).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && !v.length));
  if (!itens.length) return <p className="text-sm text-muted-foreground">Nada informado.</p>;
  return (
    <dl className="space-y-2">
      {itens.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-medium text-muted-foreground">{rotulo(k)}</dt>
          <dd className="text-sm whitespace-pre-wrap">{texto(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Ficha clínica do residente — só dados de cuidado e contato de emergência. */
export default function FichaCuidadoResidente({ residenteId, onClose }: { residenteId: string | null; onClose: () => void }) {
  const [ficha, setFicha] = useState<Json | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!residenteId) return;
    setFicha(null); setErro(null);
    supabase.rpc("portal_cuidados_ficha" as any, { p_residente_id: residenteId }).then(({ data, error }) => {
      if (error) setErro("Não foi possível abrir a ficha. Entre novamente com seu código.");
      else setFicha(semCamposProibidos(data as Json));
    });
  }, [residenteId]);

  const r = ficha?.residente;
  return (
    <Sheet open={!!residenteId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{r?.nome_completo ?? "Ficha do residente"}</SheetTitle>
        </SheetHeader>
        {erro && <p className="mt-6 text-sm text-destructive">{erro}</p>}
        {!ficha && !erro && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
        {r && (
          <Tabs defaultValue="resumo" className="mt-4">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="prontuarios">Prontuários</TabsTrigger>
              <TabsTrigger value="acolhimento">Acolhimento</TabsTrigger>
              <TabsTrigger value="saude">Remédios</TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {r.quarto && <Badge variant="secondary">Quarto {r.quarto}</Badge>}
                {idade(r.data_nascimento) !== null && <Badge variant="outline">{idade(r.data_nascimento)} anos</Badge>}
                <Badge variant="outline">Prontuário {r.numero_prontuario}</Badge>
              </div>
              <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4">
                <p className="text-xs font-semibold uppercase text-destructive">Contato de emergência</p>
                <p className="mt-1 font-medium">{r.responsavel_nome || "Não informado"}</p>
                {r.responsavel_telefone && (
                  <Button asChild className="mt-3 w-full" variant="destructive">
                    <a href={`tel:${String(r.responsavel_telefone).replace(/[^\d+]/g, "")}`}><Phone className="mr-2 h-4 w-4" />Ligar {r.responsavel_telefone}</a>
                  </Button>
                )}
              </div>
              <Campos dados={{ condicoes_medicas: r.condicoes_medicas, alergias: ficha?.acolhimento?.historico_saude?.alergias, observacoes_gerais: r.observacoes_gerais }} />
            </TabsContent>

            <TabsContent value="prontuarios" className="space-y-3">
              {!ficha?.prontuarios?.length && <p className="text-sm text-muted-foreground">Sem registros.</p>}
              {ficha?.prontuarios?.map((p: Json, i: number) => (
                <div key={i} className="rounded-md border p-3">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{dataBR(p.data_registro)} {p.horario_registro?.slice(0, 5)}</span>
                    <span>{p.funcionario_nome}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{p.titulo || rotulo(p.tipo_registro ?? "")}</p>
                  {p.descricao && <p className="text-sm whitespace-pre-wrap">{p.descricao}</p>}
                  {p.observacoes && <p className="text-xs text-muted-foreground mt-1">{p.observacoes}</p>}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="acolhimento" className="space-y-5">
              {!ficha?.acolhimento ? <p className="text-sm text-muted-foreground">Ficha de acolhimento ainda não preenchida.</p> : (
                <>
                  <section><h3 className="mb-2 font-semibold">Histórico de saúde</h3><Campos dados={ficha.acolhimento.historico_saude} /></section>
                  <section><h3 className="mb-2 font-semibold">Hábitos e rotina</h3><Campos dados={ficha.acolhimento.habitos_rotina} /></section>
                </>
              )}
            </TabsContent>

            <TabsContent value="saude" className="space-y-5">
              <section>
                <h3 className="mb-2 font-semibold">Medicamentos em uso</h3>
                {!ficha?.medicamentos?.length && <p className="text-sm text-muted-foreground">Nenhuma prescrição ativa.</p>}
                {ficha?.medicamentos?.map((m: Json, i: number) => (
                  <div key={i} className="border-b py-2 text-sm">
                    <p className="font-medium">{m.nome} — {m.dosagem}</p>
                    <p className="text-muted-foreground">{[m.via, m.horarios?.join(", ")].filter(Boolean).join(" · ")}</p>
                    {m.observacoes && <p className="text-xs">{m.observacoes}</p>}
                  </div>
                ))}
              </section>
              <section>
                <h3 className="mb-2 font-semibold">Vacinas</h3>
                {!ficha?.vacinas?.length && <p className="text-sm text-muted-foreground">Nenhuma vacina registrada.</p>}
                {ficha?.vacinas?.map((v: Json, i: number) => (
                  <div key={i} className="border-b py-2 text-sm">
                    <p className="font-medium">{v.nome}{v.dose ? ` (${v.dose}ª dose)` : ""}</p>
                    <p className="text-muted-foreground">Aplicada em {dataBR(v.data)}{v.proxima ? ` · próxima ${dataBR(v.proxima)}` : ""}</p>
                  </div>
                ))}
              </section>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
