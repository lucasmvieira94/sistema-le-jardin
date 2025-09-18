import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Thermometer, MapPin, User, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CodigoFuncionarioInput from "@/components/CodigoFuncionarioInput";
import { useTemperatura } from "@/hooks/useTemperatura";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  temperatura: z.number()
    .min(0, "Temperatura deve ser maior que 0°C")
    .max(50, "Temperatura deve ser menor que 50°C"),
  periodo_dia: z.enum(["manha", "tarde", "noite", "madrugada"]),
  horario_medicao: z.string().min(1, "Horário é obrigatório"),
  nome_responsavel: z.string().min(1, "Nome do responsável é obrigatório"),
  localizacao_sala: z.string().default("Sala de Medicamentos"),
  acoes_corretivas: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface FormularioTemperaturaProps {
  onSuccess?: () => void;
}

export function FormularioTemperatura({ onSuccess }: FormularioTemperaturaProps) {
  const [funcionarioValidado, setFuncionarioValidado] = useState<{id: string, nome: string} | null>(null);
  const [showCodigoInput, setShowCodigoInput] = useState(false);
  const { adicionarRegistro } = useTemperatura();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      temperatura: 25,
      periodo_dia: "manha",
      horario_medicao: new Date().toTimeString().slice(0, 5),
      nome_responsavel: "",
      localizacao_sala: "Sala de Medicamentos",
      acoes_corretivas: "",
      observacoes: "",
    },
  });

  const temperatura = form.watch("temperatura");
  const isConformidade = temperatura >= 15 && temperatura <= 30;

  const onSubmit = async (data: FormData) => {
    try {
      await adicionarRegistro.mutateAsync({
        temperatura: data.temperatura,
        periodo_dia: data.periodo_dia,
        horario_medicao: data.horario_medicao,
        nome_responsavel: data.nome_responsavel,
        funcionario_responsavel: funcionarioValidado?.id,
        localizacao_sala: data.localizacao_sala,
        acoes_corretivas: data.acoes_corretivas,
        observacoes: data.observacoes,
      });
      
      form.reset();
      setFuncionarioValidado(null);
      onSuccess?.();
    } catch (error) {
      console.error("Erro ao salvar registro:", error);
    }
  };

  const handleFuncionarioValidado = (funcionarioId: string, nome: string) => {
    setFuncionarioValidado({ id: funcionarioId, nome });
    form.setValue("nome_responsavel", nome);
    setShowCodigoInput(false);
  };

  const getTemperaturaColor = () => {
    if (temperatura < 15) return "text-blue-600";
    if (temperatura > 30) return "text-red-600";
    return "text-green-600";
  };

  return (
    <div className="space-y-6">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Thermometer className="h-5 w-5" />
          Registro de Temperatura - Sala de Medicamentos
        </CardTitle>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Informações do Estabelecimento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Informações do Local
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="localizacao_sala"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localização da Sala</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FormLabel>Data do Registro</FormLabel>
                  <div className="flex items-center p-3 border rounded-md bg-gray-50">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="horario_medicao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário da Medição</FormLabel>
                      <FormControl>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          <Input type="time" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Responsável pelo Registro */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-4 w-4" />
                Responsável pelo Registro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!funcionarioValidado ? (
                <div className="space-y-3">
                  {!showCodigoInput ? (
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="nome_responsavel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome do Responsável</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Digite o nome do responsável" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setShowCodigoInput(true)}
                        className="w-full"
                      >
                        Ou validar com código de funcionário
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <CodigoFuncionarioInput onFuncionarioValidado={handleFuncionarioValidado} />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={() => setShowCodigoInput(false)}
                      >
                        Voltar para entrada manual
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 border rounded-md bg-green-50">
                  <span className="font-medium text-green-800">{funcionarioValidado.nome}</span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setFuncionarioValidado(null);
                      form.setValue("nome_responsavel", "");
                    }}
                  >
                    Alterar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Medição de Temperatura */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Thermometer className="h-4 w-4" />
                Medição de Temperatura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="periodo_dia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Período do Dia</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="manha">Manhã</SelectItem>
                          <SelectItem value="tarde">Tarde</SelectItem>
                          <SelectItem value="noite">Noite</SelectItem>
                          <SelectItem value="madrugada">Madrugada</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="temperatura"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temperatura (°C)</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="50"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className={cn("text-lg font-bold", getTemperaturaColor())}
                          />
                          <span className="text-muted-foreground">°C</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Indicador de Conformidade */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {isConformidade ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        DENTRO DA FAIXA
                      </Badge>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <Badge variant="destructive">
                        FORA DA FAIXA
                      </Badge>
                    </>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Faixa de conformidade ANVISA: 15°C a 30°C
                </p>
              </div>

              {/* Ações Corretivas (apenas se fora da faixa) */}
              {!isConformidade && (
                <FormField
                  control={form.control}
                  name="acoes_corretivas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-red-600">
                        Ações Corretivas (Obrigatório para não conformidades)
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Descreva as medidas tomadas (ex.: acionamento da manutenção, ajuste do ar-condicionado, transferência de medicamentos...)"
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações Adicionais</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Observações gerais sobre a medição..."
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button 
              type="submit" 
              className="flex-1"
              disabled={adicionarRegistro.isPending}
            >
              {adicionarRegistro.isPending ? "Salvando..." : "Salvar Registro"}
            </Button>
            <Button type="button" variant="outline" onClick={() => form.reset()}>
              Limpar
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}