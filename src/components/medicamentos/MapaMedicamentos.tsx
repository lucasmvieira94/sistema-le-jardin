import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useMedicamentos } from "@/hooks/useMedicamentos";
import { PrescricaoForm } from "./PrescricaoForm";
import { Plus, Search, User, Clock, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";

const frequenciaLabel = (tipo: string, valor?: number, diaSemana?: number, intervaloDias?: number) => {
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  switch (tipo) {
    case "a_cada_x_horas": return `A cada ${valor}h`;
    case "hora_fixa_diaria": return "Diário (horários fixos)";
    case "dia_especifico": return `Toda ${diasSemana[diaSemana || 0]}`;
    case "intervalo_dias": return `A cada ${intervaloDias} dia${(intervaloDias || 0) > 1 ? 's' : ''}`;
    default: return tipo;
  }
};

export const MapaMedicamentos = () => {
  const { prescricoes, isLoadingPrescricoes } = useMedicamentos();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Agrupar por residente
  const porResidente = prescricoes.reduce((acc, p) => {
    const nome = p.residente?.nome || "Sem residente";
    const id = p.residente_id;
    if (!acc[id]) acc[id] = { nome, prescricoes: [] };
    acc[id].prescricoes.push(p);
    return acc;
  }, {} as Record<string, { nome: string; prescricoes: typeof prescricoes }>);

  const filtered = Object.entries(porResidente).filter(([_, data]) =>
    data.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    data.prescricoes.some(p => p.medicamento?.nome.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoadingPrescricoes) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar residente ou medicamento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Prescrição</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogTitle className="sr-only">Nova Prescrição</DialogTitle>
            <DialogDescription className="sr-only">Formulário para cadastrar nova prescrição médica</DialogDescription>
            <PrescricaoForm onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma prescrição cadastrada</p>
            <p className="text-sm">Cadastre prescrições para visualizar o mapa de medicamentos</p>
          </CardContent>
        </Card>
      ) : (
        filtered.map(([residenteId, data]) => (
          <Card key={residenteId}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{data.nome}</CardTitle>
                <Badge variant="secondary">{data.prescricoes.length} prescrição{data.prescricoes.length !== 1 ? 'ões' : ''}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.prescricoes.map((p) => (
                  <div key={p.id} className="border rounded-lg p-3 bg-muted/30">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{p.medicamento?.nome}</div>
                        <div className="text-sm text-muted-foreground">{p.dosagem} — {p.via_administracao || "Via não especificada"}</div>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {frequenciaLabel(p.frequencia_tipo, p.frequencia_valor, p.dia_semana, p.intervalo_dias)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      {p.horarios && p.horarios.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {p.horarios.join(", ")}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Início: {format(new Date(p.data_inicio + "T12:00:00"), "dd/MM/yyyy")}
                        {p.data_fim && ` — Fim: ${format(new Date(p.data_fim + "T12:00:00"), "dd/MM/yyyy")}`}
                      </div>
                      {p.prescrito_por && <span>Dr(a). {p.prescrito_por}</span>}
                    </div>
                    {p.observacoes && <p className="text-xs text-muted-foreground mt-1 italic">{p.observacoes}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
