import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileHeart, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { lerPasse } from "@/utils/portalSessao";
import { hojeISO, formatarData } from "@/utils/dateUtils";
import type { RegistroDia } from "../../../supabase/functions/resumo-prontuario-dia/dados";

function ResumoDia({ residenteId, data, onOpen }: { residenteId: string; data: string; onOpen: () => void }) {
  const passe = lerPasse();
  const resumo = useQuery({
    queryKey: ["resumo-prontuario-dia", residenteId, data, passe?.expiraEm],
    queryFn: async () => {
      const atual = lerPasse();
      if (!atual) throw new Error("Entre novamente com seu código.");
      const result = await supabase.functions.invoke("resumo-prontuario-dia", { body: { residente_id: residenteId, data }, headers: { "x-portal-token": atual.token } });
      if (result.error || result.data?.error) throw new Error("Resumo de IA indisponível. O prontuário completo continua disponível.");
      return result.data as { resumo: string | null; quantidade: number };
    },
    retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: false,
  });
  return (
    <Button variant="outline" className="h-auto w-full flex-col items-stretch gap-3 p-4 text-left whitespace-normal" onClick={onOpen}>
      <span className="flex items-center gap-2 text-sm font-semibold"><FileHeart className="h-4 w-4 shrink-0 text-primary" />{formatarData(data)}{data === hojeISO() && <span className="text-xs text-muted-foreground">Hoje</span>}<ChevronRight className="ml-auto h-4 w-4 shrink-0" /></span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Sparkles className="h-3 w-3" />Resumo de IA</span>
      {resumo.isPending ? <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Analisando registros do dia…</span> : <span className="text-sm font-normal leading-relaxed break-words">{resumo.error?.message ?? resumo.data?.resumo ?? "Nenhum registro neste dia."}</span>}
    </Button>
  );
}

/** Lista diária compacta; o texto original aparece somente na consulta completa. */
export default function ProntuariosResidente({ residenteId, registros }: { residenteId: string; registros: Pick<RegistroDia, "data_registro">[] }) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const dias = [...new Set([hojeISO(), ...registros.map((r) => r.data_registro)])].sort().reverse();
  const [visiveis, setVisiveis] = useState(3);
  const detalhe = useQuery({
    queryKey: ["prontuario-dia-completo", residenteId, selecionado, lerPasse()?.expiraEm],
    enabled: !!selecionado,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("portal_cuidados_prontuario_dia", { p_residente_id: residenteId, p_data: selecionado ?? "" });
      if (error) throw new Error("Não foi possível abrir o prontuário. Verifique seu acesso.");
      return (data ?? []) as unknown as RegistroDia[];
    }, retry: false, staleTime: 0, gcTime: 0,
  });
  return <>
    {dias.slice(0, visiveis).map((data) => <ResumoDia key={data} residenteId={residenteId} data={data} onOpen={() => setSelecionado(data)} />)}
    {dias.length > visiveis && <Button variant="ghost" className="w-full" onClick={() => setVisiveis((v) => v + 3)}>Dias anteriores</Button>}
    <Dialog open={!!selecionado} onOpenChange={(open) => !open && setSelecionado(null)}>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Prontuário · {selecionado ? formatarData(selecionado) : ""}</DialogTitle><DialogDescription>Registros completos do dia</DialogDescription></DialogHeader>
        {detalhe.isPending && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
        {detalhe.error && <p className="text-sm text-destructive">{detalhe.error.message}</p>}
        {detalhe.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro neste dia.</p>}
        {detalhe.data?.map((r) => <section key={r.id} className="border-b pb-4 space-y-2 last:border-0">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{r.horario_registro?.slice(0, 5)}</span><span>{r.funcionario_nome}</span></div>
          <h3 className="text-sm font-semibold">{r.titulo || r.tipo_registro?.replace(/_/g, " ")}</h3>
          {r.descricao && <p className="text-sm whitespace-pre-wrap break-words">{r.descricao}</p>}
          {r.observacoes && <p className="text-sm whitespace-pre-wrap break-words"><span className="font-medium">Observações: </span>{r.observacoes}</p>}
          {r.justificativa_retificacao && <p className="text-sm whitespace-pre-wrap"><span className="font-medium">Retificação: </span>{r.justificativa_retificacao}</p>}
        </section>)}
      </DialogContent>
    </Dialog>
  </>;
}