import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMedicamentos } from "@/hooks/useMedicamentos";
import { Loader2, Search } from "lucide-react";

interface EntradaEstoqueFormData {
  medicamento_id: string;
  residente_id?: string;
  tipo_estoque: string;
  lote?: string;
  data_validade?: string;
  quantidade: number;
  observacoes?: string;
}

interface EntradaEstoqueFormProps {
  onSuccess?: () => void;
  defaultTipoEstoque?: string;
  defaultResidenteId?: string;
}

export const EntradaEstoqueForm = ({ onSuccess, defaultTipoEstoque = "residente", defaultResidenteId }: EntradaEstoqueFormProps) => {
  const { medicamentos, residentes, adicionarEstoque } = useMedicamentos();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchMed, setSearchMed] = useState("");

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<EntradaEstoqueFormData>({
    defaultValues: {
      tipo_estoque: defaultTipoEstoque,
      residente_id: defaultResidenteId,
    }
  });

  const tipoEstoque = watch("tipo_estoque");

  const filteredMedicamentos = medicamentos.filter(m =>
    m.nome.toLowerCase().includes(searchMed.toLowerCase()) ||
    m.principio_ativo?.toLowerCase().includes(searchMed.toLowerCase())
  );

  const onSubmit = async (data: EntradaEstoqueFormData) => {
    if (!data.medicamento_id) {
      return;
    }
    setIsSubmitting(true);
    try {
      await adicionarEstoque.mutateAsync({
        medicamento_id: data.medicamento_id,
        residente_id: data.tipo_estoque === "residente" ? data.residente_id : undefined,
        tipo_estoque: data.tipo_estoque,
        lote: data.lote,
        data_validade: data.data_validade,
        quantidade: Number(data.quantidade),
        observacoes: data.observacoes,
      });
      reset({ tipo_estoque: defaultTipoEstoque, residente_id: defaultResidenteId });
      setSearchMed("");
      onSuccess?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrada de Estoque</CardTitle>
        <CardDescription>Registre a entrada de medicamentos no estoque</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Tipo de Estoque */}
          <div className="space-y-2">
            <Label>Tipo de Estoque *</Label>
            <Select
              value={tipoEstoque}
              onValueChange={(value) => setValue("tipo_estoque", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="residente">Residente (Individual)</SelectItem>
                <SelectItem value="urgencia">Urgência (Institucional)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Residente (se tipo = residente) */}
          {tipoEstoque === "residente" && (
            <div className="space-y-2">
              <Label>Residente *</Label>
              <Select onValueChange={(value) => setValue("residente_id", value)} defaultValue={defaultResidenteId}>
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
          )}

          {/* Busca de Medicamento */}
          <div className="space-y-2">
            <Label>Medicamento *</Label>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar no catálogo..."
                value={searchMed}
                onChange={(e) => setSearchMed(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select onValueChange={(value) => setValue("medicamento_id", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o medicamento" />
              </SelectTrigger>
              <SelectContent>
                {filteredMedicamentos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome} {m.dosagem && `- ${m.dosagem}`} {m.forma_farmaceutica && `(${m.forma_farmaceutica})`}
                  </SelectItem>
                ))}
                {filteredMedicamentos.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhum medicamento encontrado. Cadastre primeiro no catálogo.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Quantidade *</Label>
              <Input
                type="number"
                min="1"
                {...register("quantidade", { required: "Obrigatório", min: { value: 1, message: "Mínimo 1" } })}
                placeholder="0"
              />
              {errors.quantidade && <p className="text-sm text-destructive">{errors.quantidade.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Lote</Label>
              <Input {...register("lote")} placeholder="Nº do lote" />
            </div>

            <div className="space-y-2">
              <Label>Validade</Label>
              <Input type="date" {...register("data_validade")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea {...register("observacoes")} placeholder="Informações adicionais..." rows={2} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { reset(); setSearchMed(""); }} disabled={isSubmitting}>
              Limpar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar Entrada
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
