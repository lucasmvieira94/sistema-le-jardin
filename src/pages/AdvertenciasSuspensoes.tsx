import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Filter, AlertTriangle, FileWarning, Ban, Gavel, History, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";
import AdvertenciaForm from "@/components/advertencias/AdvertenciaForm";
import HistoricoAdvertencias from "@/components/advertencias/HistoricoAdvertencias";
import ImpressaoAdvertencia, { type AdvertenciaImpressao } from "@/components/advertencias/ImpressaoAdvertencia";

type AdvertenciaRow = {
  funcionario_id: string;
  id: string;
  tipo: string;
  motivo: string;
  descricao: string;
  data_ocorrencia: string;
  dias_suspensao: number | null;
  data_inicio_suspensao: string | null;
  data_fim_suspensao: string | null;
  testemunha_1: string | null;
  testemunha_2: string | null;
  funcionario_recusou_assinar: boolean;
  observacoes: string | null;
  hash_verificacao: string | null;
  created_at: string;
  funcionarios: {
    nome_completo: string;
    funcao: string;
  };
};

const TIPO_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  advertencia_verbal: { label: "Adv. Verbal", variant: "secondary", icon: AlertTriangle },
  advertencia_escrita: { label: "Adv. Escrita", variant: "default", icon: FileWarning },
  suspensao: { label: "Suspensão", variant: "destructive", icon: Ban },
  justa_causa: { label: "Justa Causa", variant: "destructive", icon: Gavel },
};

export default function AdvertenciasSuspensoes() {
  const [registros, setRegistros] = useState<AdvertenciaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historicoFunc, setHistoricoFunc] = useState<{ id: string; nome: string } | null>(null);
  const [impressaoReg, setImpressaoReg] = useState<AdvertenciaRow | null>(null);
  const { isAdmin, loading: roleLoading } = useUserRole();

  async function fetchRegistros() {
    setLoading(true);
    const { data } = await supabase
      .from("advertencias_suspensoes")
      .select("id, funcionario_id, tipo, motivo, descricao, data_ocorrencia, dias_suspensao, data_inicio_suspensao, data_fim_suspensao, testemunha_1, testemunha_2, funcionario_recusou_assinar, observacoes, hash_verificacao, created_at, funcionarios(nome_completo, funcao)")
      .order("data_ocorrencia", { ascending: false });
      .order("data_ocorrencia", { ascending: false });
    setRegistros((data as AdvertenciaRow[] | null) || []);
    setLoading(false);
  }

  useEffect(() => { fetchRegistros(); }, []);

  const filtrados = registros.filter(r => {
    const nomeMatch = !filtroNome || r.funcionarios?.nome_completo?.toLowerCase().includes(filtroNome.toLowerCase());
    const tipoMatch = filtroTipo === "todos" || r.tipo === filtroTipo;
    return nomeMatch && tipoMatch;
  });

  // KPIs
  const total = registros.length;
  const countByType = {
    advertencia_verbal: registros.filter(r => r.tipo === "advertencia_verbal").length,
    advertencia_escrita: registros.filter(r => r.tipo === "advertencia_escrita").length,
    suspensao: registros.filter(r => r.tipo === "suspensao").length,
    justa_causa: registros.filter(r => r.tipo === "justa_causa").length,
  };

  if (roleLoading) {
    return (
      <div className="container mx-auto max-w-5xl py-10">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" /> Verificando permissões...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-5xl py-10 text-center">
        <AlertTriangle className="w-16 h-16 mx-auto text-muted-foreground" />
        <h2 className="text-2xl font-bold mt-4">Acesso Restrito</h2>
        <p className="text-muted-foreground">Apenas administradores podem acessar esta área.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Advertências e Suspensões</h2>
          <p className="text-sm text-muted-foreground">Gestão disciplinar conforme CLT</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Novo Registro</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <AdvertenciaForm
              onSuccess={() => { setDialogOpen(false); fetchRegistros(); }}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        {Object.entries(TIPO_LABELS).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={key} className="rounded-lg border p-3 text-center">
              <Icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{countByType[key as keyof typeof countByType]}</p>
              <p className="text-xs text-muted-foreground">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          value={filtroNome}
          onChange={e => setFiltroNome(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="advertencia_verbal">Advertência Verbal</SelectItem>
            <SelectItem value="advertencia_escrita">Advertência Escrita</SelectItem>
            <SelectItem value="suspensao">Suspensão</SelectItem>
            <SelectItem value="justa_causa">Justa Causa</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline">{filtrados.length} registro(s)</Badge>
      </div>

      {/* Histórico de funcionário (modal) */}
      <Dialog open={!!historicoFunc} onOpenChange={() => setHistoricoFunc(null)}>
        <DialogContent className="max-w-2xl">
          {historicoFunc && (
            <HistoricoAdvertencias funcionarioId={historicoFunc.id} funcionarioNome={historicoFunc.nome} />
          )}
        </DialogContent>
      </Dialog>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="overflow-auto rounded shadow-sm">
          <table className="min-w-full bg-card rounded">
            <thead>
              <tr className="bg-muted text-muted-foreground">
                <th className="py-2 px-3 text-left">Data</th>
                <th className="py-2 px-3 text-left">Funcionário</th>
                <th className="py-2 px-3 text-left">Tipo</th>
                <th className="py-2 px-3 text-left">Motivo</th>
                <th className="py-2 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(reg => {
                const cfg = TIPO_LABELS[reg.tipo] || TIPO_LABELS.advertencia_verbal;
                return (
                  <tr key={reg.id} className="border-b last:border-b-0">
                    <td className="py-2 px-3 text-sm">
                      {format(new Date(reg.data_ocorrencia), "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td className="py-2 px-3">
                      <div>
                        <p className="text-sm font-medium">{reg.funcionarios?.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">{reg.funcionarios?.funcao}</p>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      {reg.funcionario_recusou_assinar && (
                        <Badge variant="outline" className="ml-1 text-xs border-destructive text-destructive">Recusou</Badge>
                      )}
                    </td>
                    <td className="py-2 px-3 text-sm max-w-xs truncate">{reg.motivo}</td>
                    <td className="py-2 px-3 text-center">
                      <Button
                        size="icon"
                        variant="outline"
                        className="w-8 h-8"
                        title="Ver histórico do funcionário"
                        onClick={() => setHistoricoFunc({
                          id: reg.funcionario_id,
                          nome: reg.funcionarios?.nome_completo || "",
                        })}
                      >
                        <History className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
