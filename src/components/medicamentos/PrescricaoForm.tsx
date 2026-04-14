import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMedicamentos } from "@/hooks/useMedicamentos";
import { Loader2, Search, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PrescricaoFormData {
  residente_id: string;
  medicamento_id: string;
  dosagem: string;
  frequencia_tipo: string;
  frequencia_valor?: number;
  dia_semana?: number;
  intervalo_dias?: number;
  via_administracao?: string;
  prescrito_por?: string;
  data_inicio: string;
  data_fim?: string;
  observacoes?: string;
}

interface PrescricaoFormProps {
  onSuccess?: () => void;
  defaultResidenteId?: string;
}

export const PrescricaoForm = ({ onSuccess, defaultResidenteId }: PrescricaoFormProps) => {
  const { medicamentos, residentes, cadastrarPrescricao } = useMedicamentos();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchMed, setSearchMed] = useState("");
  const [horarios, setHorarios] = useState<string[]>([]);
  const [novoHorario, setNovoHorario] = useState("");

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<PrescricaoFormData>({
    defaultValues: {
      frequencia_tipo: "hora_fixa_diaria",
      data_inicio: new Date().toISOString().split("T")[0],
      residente_id: defaultResidenteId,
    }
  });

  const frequenciaTipo = watch("frequencia_tipo");

  const filteredMedicamentos = medicamentos.filter(m =>
    m.nome.toLowerCase().includes(searchMed.toLowerCase()) ||
    m.principio_ativo?.toLowerCase().includes(searchMed.toLowerCase())
  );

  const addHorario = () => {
    if (novoHorario && !horarios.includes(novoHorario)) {
      const updated = [...horarios, novoHorario].sort();
      setHorarios(updated);
      setNovoHorario("");
    }
  };

  const removeHorario = (h: string) => {
    setHorarios(horarios.filter(x => x !== h));
  };

  const diasSemana = [
    { value: 0, label: "Domingo" },
    { value: 1, label: "Segunda" },
    { value: 2, label: "Terça" },
    { value: 3, label: "Quarta" },
    { value: 4, label: "Quinta" },
    { value: 5, label: "Sexta" },
    { value: 6, label: "Sábado" },
  ];

  const viasAdministracao = [
    "oral", "sublingual", "tópica", "retal", "intramuscular",
    "intravenosa", "subcutânea", "inalatória", "nasal", "ocular", "auricular"
  ];

  const onSubmit = async (data: PrescricaoFormData) => {
    if (!data.medicamento_id || !data.residente_id) return;
    setIsSubmitting(true);
    try {
      await cadastrarPrescricao.mutateAsync({
        ...data,
        horarios: horarios.length > 0 ? horarios : undefined,
        frequencia_valor: data.frequencia_valor ? Number(data.frequencia_valor) : undefined,
        dia_semana: data.dia_semana !== undefined ? Number(data.dia_semana) : undefined,
        intervalo_dias: data.intervalo_dias ? Number(data.intervalo_dias) : undefined,
      });
      reset({ frequencia_tipo: "hora_fixa_diaria", data_inicio: new Date().toISOString().split("T")[0], residente_id: defaultResidenteId });
      setHorarios([]);
      setSearchMed("");
      onSuccess?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova Prescrição</CardTitle>
        <CardDescription>Registre a prescrição médica de um medicamento</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Residente */}
            <div className="space-y-2">
              <Label>Residente *</Label>
              <Select onValueChange={(v) => setValue("residente_id", v)} defaultValue={defaultResidenteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o residente" />
                </SelectTrigger>
                <SelectContent>
                  {residentes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Medicamento */}
            <div className="space-y-2">
              <Label>Medicamento *</Label>
              <div className="relative mb-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchMed}
                  onChange={(e) => setSearchMed(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select onValueChange={(v) => setValue("medicamento_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {filteredMedicamentos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome} {m.dosagem && `- ${m.dosagem}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Dosagem prescrita */}
            <div className="space-y-2">
              <Label>Dosagem Prescrita *</Label>
              <Input
                {...register("dosagem", { required: "Obrigatório" })}
                placeholder="Ex: 1 comp, 10ml, 2 gotas"
              />
              {errors.dosagem && <p className="text-sm text-destructive">{errors.dosagem.message}</p>}
            </div>

            {/* Via de administração */}
            <div className="space-y-2">
              <Label>Via de Administração</Label>
              <Select onValueChange={(v) => setValue("via_administracao", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {viasAdministracao.map((via) => (
                    <SelectItem key={via} value={via}>
                      {via.charAt(0).toUpperCase() + via.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Médico prescritor */}
            <div className="space-y-2">
              <Label>Médico Prescritor</Label>
              <Input {...register("prescrito_por")} placeholder="Nome do médico" />
            </div>
          </div>

          {/* Frequência */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Frequência de Uso</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Frequência *</Label>
                <Select value={frequenciaTipo} onValueChange={(v) => setValue("frequencia_tipo", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_cada_x_horas">A cada X horas</SelectItem>
                    <SelectItem value="hora_fixa_diaria">Hora fixa todos os dias</SelectItem>
                    <SelectItem value="dia_especifico">Hora X todo dia Y da semana</SelectItem>
                    <SelectItem value="intervalo_dias">De Y em Y dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {frequenciaTipo === "a_cada_x_horas" && (
                <div className="space-y-2">
                  <Label>A cada quantas horas?</Label>
                  <Input
                    type="number"
                    min="1"
                    max="24"
                    {...register("frequencia_valor")}
                    placeholder="Ex: 8"
                  />
                </div>
              )}

              {frequenciaTipo === "dia_especifico" && (
                <div className="space-y-2">
                  <Label>Dia da Semana</Label>
                  <Select onValueChange={(v) => setValue("dia_semana", Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o dia" />
                    </SelectTrigger>
                    <SelectContent>
                      {diasSemana.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {frequenciaTipo === "intervalo_dias" && (
                <div className="space-y-2">
                  <Label>Intervalo (dias)</Label>
                  <Input
                    type="number"
                    min="1"
                    {...register("intervalo_dias")}
                    placeholder="Ex: 7"
                  />
                </div>
              )}
            </div>

            {/* Horários */}
            {(frequenciaTipo === "hora_fixa_diaria" || frequenciaTipo === "dia_especifico") && (
              <div className="space-y-2">
                <Label>Horários</Label>
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={novoHorario}
                    onChange={(e) => setNovoHorario(e.target.value)}
                    className="w-36"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addHorario}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </div>
                {horarios.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {horarios.map((h) => (
                      <Badge key={h} variant="secondary" className="gap-1">
                        {h}
                        <button type="button" onClick={() => removeHorario(h)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Início *</Label>
              <Input type="date" {...register("data_inicio", { required: "Obrigatório" })} />
            </div>
            <div className="space-y-2">
              <Label>Data de Fim (opcional)</Label>
              <Input type="date" {...register("data_fim")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea {...register("observacoes")} placeholder="Orientações especiais..." rows={2} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { reset(); setHorarios([]); setSearchMed(""); }} disabled={isSubmitting}>
              Limpar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Prescrição
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
