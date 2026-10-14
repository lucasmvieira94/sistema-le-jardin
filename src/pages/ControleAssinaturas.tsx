/**
 * Controle de assinaturas: o gestor acompanha, por colaborador, quais documentos
 * (advertências, folhas de ponto, contracheques e comunicados) foram assinados,
 * recusados ou continuam pendentes — e quais estão atrasados.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Loader2, Search } from "lucide-react";
import { formatarTimestampDataHora } from "@/utils/formatTimestamp";
import { ROTULO_TIPO, type TipoDocumentoInterno } from "@/utils/documentosInternos";
import {
  FiltrosAssinatura, LinhaAssinatura, estaAtrasado, filtrarAssinaturas,
  pendenciasPorColaborador, resumirAssinaturas, venceEmBreve,
} from "@/utils/controleAssinaturas";

function Situacao({ l }: { l: LinhaAssinatura }) {
  if (l.status === "assinado") return <Badge>Assinado</Badge>;
  if (l.status === "recusado") return <Badge variant="destructive">Recusado</Badge>;
  if (estaAtrasado(l)) return <Badge variant="destructive">Atrasado</Badge>;
  return venceEmBreve(l) ? <Badge variant="outline">Vence em breve</Badge> : <Badge variant="secondary">Pendente</Badge>;
}

export default function ControleAssinaturas() {
  const [f, setF] = useState<FiltrosAssinatura>({ busca: "", tipo: "todos", situacao: "todas" });

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["painel-assinaturas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("painel_assinaturas_documentos");
      if (error) throw error;
      return (data ?? []) as LinhaAssinatura[];
    },
  });

  const resumo = useMemo(() => resumirAssinaturas(data), [data]);
  const pendencias = useMemo(() => pendenciasPorColaborador(data).slice(0, 8), [data]);
  const linhas = useMemo(() => filtrarAssinaturas(data, f).sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, 500), [data, f]);

  const cartoes = [
    { rotulo: "Assinados", valor: resumo.assinados, extra: `${resumo.percentual}% do total`, sit: "assinado" },
    { rotulo: "Pendentes", valor: resumo.pendentes, extra: "aguardando o colaborador", sit: "pendente" },
    { rotulo: "Atrasados", valor: resumo.atrasados, extra: "pendentes após o prazo", sit: "atrasado" },
    { rotulo: "Recusados", valor: resumo.recusados, extra: "com discordância registrada", sit: "recusado" },
  ] as const;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Controle de assinaturas</h1>
          <p className="text-sm text-muted-foreground">Acompanhe se os colaboradores estão assinando os documentos enviados a eles.</p>
        </div>
      </div>

      {error && <Card className="p-4 text-sm text-destructive">{(error as Error).message}</Card>}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {cartoes.map((c) => (
          <button key={c.rotulo} onClick={() => setF({ ...f, situacao: f.situacao === c.sit ? "todas" : c.sit })}
            className={`text-left rounded-lg border p-4 transition-colors hover:bg-muted ${f.situacao === c.sit ? "border-primary bg-muted" : "border-border"}`}>
            <p className="text-sm text-muted-foreground">{c.rotulo}</p>
            <p className="text-3xl font-semibold">{c.valor}</p>
            <p className="text-xs text-muted-foreground">{c.extra}</p>
          </button>
        ))}
      </div>

      {pendencias.length > 0 && (
        <Card className="p-4">
          <p className="font-medium mb-2 text-sm">Colaboradores com pendências</p>
          <div className="flex flex-wrap gap-2">
            {pendencias.map((p) => (
              <button key={p.funcionario_id} onClick={() => setF({ ...f, busca: p.nome })}
                className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted">
                {p.nome} · {p.pendentes} pendente(s){p.atrasados ? ` · ${p.atrasados} atrasado(s)` : ""}{p.recusados ? ` · ${p.recusados} recusa(s)` : ""}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 grid gap-3 md:grid-cols-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar colaborador ou documento" value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} />
        </div>
        <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(ROTULO_TIPO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={f.situacao} onValueChange={(v) => setF({ ...f, situacao: v as FiltrosAssinatura["situacao"] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as situações</SelectItem><SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="atrasado">Atrasados</SelectItem><SelectItem value="assinado">Assinados</SelectItem>
            <SelectItem value="recusado">Recusados</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : linhas.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhum documento encontrado com esses filtros.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b border-border">
              <th className="p-3">Colaborador</th><th className="p-3">Documento</th><th className="p-3">Enviado em</th><th className="p-3">Prazo</th>
              <th className="p-3">Situação</th><th className="p-3">Assinado/recusado em</th>
            </tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={`${l.funcionario_id}-${l.tipo_documento}-${l.referencia_id}`} className="border-b border-border align-top">
                  <td className="p-3"><div className="font-medium">{l.funcionario_nome}</div><div className="text-xs text-muted-foreground">{l.funcao ?? ""}</div></td>
                  <td className="p-3"><div>{l.titulo}</div><div className="text-xs text-muted-foreground">{ROTULO_TIPO[l.tipo_documento as TipoDocumentoInterno] ?? l.tipo_documento}</div></td>
                  <td className="p-3 whitespace-nowrap">{formatarTimestampDataHora(l.criado_em)}</td>
                  <td className="p-3 whitespace-nowrap">{l.prazo_em ? formatarTimestampDataHora(l.prazo_em) : "—"}</td>
                  <td className="p-3"><Situacao l={l} />{l.motivo_recusa && <div className="text-xs mt-1 max-w-[240px]">{l.motivo_recusa}</div>}</td>
                  <td className="p-3 whitespace-nowrap">{l.assinado_em ? formatarTimestampDataHora(l.assinado_em) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
