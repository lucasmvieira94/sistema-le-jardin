import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { addDays, format } from "date-fns";

interface VacinaCatalogo {
  id: string;
  nome: string;
  intervalo_dias: number | null;
  doses_recomendadas: number;
  periodicidade: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  residenteId: string;
  residenteNome: string;
  funcionarioId?: string;
  catalogo: VacinaCatalogo[];
  vacinaPreSelecionada?: VacinaCatalogo | null;
  onSuccess: () => void;
}

export function RegistroVacinaDialog({
  open,
  onOpenChange,
  residenteId,
  residenteNome,
  funcionarioId,
  catalogo,
  vacinaPreSelecionada,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [vacinaId, setVacinaId] = useState<string>("");
  const [nomeVacinaLivre, setNomeVacinaLivre] = useState("");
  const [dataAplicacao, setDataAplicacao] = useState(format(new Date(), "yyyy-MM-dd"));
  const [numeroDose, setNumeroDose] = useState("1");
  const [lote, setLote] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [localCorpo, setLocalCorpo] = useState("");
  const [via, setVia] = useState("intramuscular");
  const [profissional, setProfissional] = useState("");
  const [localAplicacao, setLocalAplicacao] = useState("");
  const [reacoes, setReacoes] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [proximaDose, setProximaDose] = useState("");

  useEffect(() => {
    if (open) {
      // Reset
      setVacinaId(vacinaPreSelecionada?.id || "");
      setNomeVacinaLivre("");
      setDataAplicacao(format(new Date(), "yyyy-MM-dd"));
      setNumeroDose("1");
      setLote("");
      setFabricante("");
      setLocalCorpo("");
      setVia("intramuscular");
      setProfissional("");
      setLocalAplicacao("");
      setReacoes("");
      setObservacoes("");
      setProximaDose("");
    }
  }, [open, vacinaPreSelecionada]);

  // Auto-calcular próxima dose com base no catálogo
  useEffect(() => {
    if (vacinaId && dataAplicacao) {
      const vac = catalogo.find((c) => c.id === vacinaId);
      if (vac?.intervalo_dias) {
        const proxima = addDays(new Date(dataAplicacao + "T00:00:00"), vac.intervalo_dias);
        setProximaDose(format(proxima, "yyyy-MM-dd"));
      } else {
        setProximaDose("");
      }
    }
  }, [vacinaId, dataAplicacao, catalogo]);

  const vacinaSelecionada = catalogo.find((c) => c.id === vacinaId);
  const nomeFinal = vacinaSelecionada?.nome || nomeVacinaLivre;

  const handleSalvar = async () => {
    if (!nomeFinal.trim()) {
      toast({
        title: "Selecione uma vacina",
        description: "Escolha do catálogo ou informe o nome.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from("vacinas_residentes").insert({
      residente_id: residenteId,
      vacina_id: vacinaId || null,
      nome_vacina: nomeFinal,
      data_aplicacao: dataAplicacao,
      numero_dose: parseInt(numeroDose) || 1,
      lote: lote || null,
      fabricante: fabricante || null,
      local_aplicacao_corpo: localCorpo || null,
      via_administracao: via || null,
      profissional_aplicador: profissional || null,
      local_aplicacao: localAplicacao || null,
      reacoes_adversas: reacoes || null,
      observacoes: observacoes || null,
      proxima_dose_prevista: proximaDose || null,
      registrado_por_funcionario_id: funcionarioId || null,
      registrado_por_user_id: userData.user?.id || null,
    });

    setSaving(false);

    if (error) {
      toast({ title: "Erro ao registrar", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Vacina registrada com sucesso!" });
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Vacina — {residenteNome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Vacina */}
          <div className="space-y-2">
            <Label>Vacina *</Label>
            <Select value={vacinaId} onValueChange={setVacinaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione do catálogo (ou informe abaixo)" />
              </SelectTrigger>
              <SelectContent>
                {catalogo.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!vacinaId && (
              <Input
                placeholder="Nome da vacina (se não estiver no catálogo)"
                value={nomeVacinaLivre}
                onChange={(e) => setNomeVacinaLivre(e.target.value)}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data da aplicação *</Label>
              <Input type="date" value={dataAplicacao} onChange={(e) => setDataAplicacao(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nº da dose</Label>
              <Input type="number" min="1" value={numeroDose} onChange={(e) => setNumeroDose(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Lote</Label>
              <Input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Ex: ABC123" />
            </div>
            <div className="space-y-2">
              <Label>Fabricante</Label>
              <Input value={fabricante} onChange={(e) => setFabricante(e.target.value)} placeholder="Ex: Butantan" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Via de administração</Label>
              <Select value={via} onValueChange={setVia}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="intramuscular">Intramuscular</SelectItem>
                  <SelectItem value="subcutanea">Subcutânea</SelectItem>
                  <SelectItem value="oral">Oral</SelectItem>
                  <SelectItem value="intradermica">Intradérmica</SelectItem>
                  <SelectItem value="nasal">Nasal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Local de aplicação (corpo)</Label>
              <Input
                value={localCorpo}
                onChange={(e) => setLocalCorpo(e.target.value)}
                placeholder="Ex: Deltoide direito"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Profissional aplicador</Label>
              <Input
                value={profissional}
                onChange={(e) => setProfissional(e.target.value)}
                placeholder="Nome do enfermeiro(a)"
              />
            </div>
            <div className="space-y-2">
              <Label>Local da aplicação</Label>
              <Input
                value={localAplicacao}
                onChange={(e) => setLocalAplicacao(e.target.value)}
                placeholder="Ex: UBS Centro / Clínica"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Próxima dose prevista (opcional)</Label>
            <Input type="date" value={proximaDose} onChange={(e) => setProximaDose(e.target.value)} />
            {vacinaSelecionada?.intervalo_dias && (
              <p className="text-xs text-muted-foreground">
                Sugestão automática conforme catálogo ({vacinaSelecionada.intervalo_dias} dias).
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Reações adversas</Label>
            <Textarea
              value={reacoes}
              onChange={(e) => setReacoes(e.target.value)}
              rows={2}
              placeholder="Descreva eventos adversos pós-vacinação (se houver)"
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={saving}>
            {saving ? "Salvando..." : "Registrar Vacina"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
