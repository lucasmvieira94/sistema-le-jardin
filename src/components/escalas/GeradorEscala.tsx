import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Clock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import JornadaTrabalhoSelect from "./JornadaTrabalhoSelect";

const formSchema = z.object({
  jornadaTrabalho: z.string().min(1, "Selecione uma jornada de trabalho"),
  dataInicio: z.date({
    required_error: "Selecione uma data de início",
  }),
});

type FormData = z.infer<typeof formSchema>;

interface EscalaDay {
  data: string;
  status: 'trabalho' | 'folga';
  horas: number;
  fim_de_semana: boolean;
  dia_util: boolean;
}

export default function GeradorEscala() {
  const [escala, setEscala] = useState<EscalaDay[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jornadaTrabalho: "",
      dataInicio: undefined,
    },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      // Converter a data para o formato YYYY-MM-DD para o backend
      const dataInicioFormatted = format(data.dataInicio, 'yyyy-MM-dd');
      
      const { data: escalaData, error } = await supabase.functions.invoke('gerar-escala', {
        body: {
          jornadaValue: data.jornadaTrabalho,
          dataInicio: dataInicioFormatted
        }
      });

      if (error) throw error;

      setEscala(escalaData);
      toast({
        title: "Escala gerada com sucesso!",
        description: "A escala do mês foi gerada baseada na jornada selecionada.",
      });
    } catch (error) {
      console.error('Erro ao gerar escala:', error);
      toast({
        title: "Erro ao gerar escala",
        description: "Não foi possível gerar a escala. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDayName = (date: string) => {
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return dayNames[new Date(date).getDay()];
  };

  const formatDate = (date: string) => {
    return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
  };

  const getTotalHours = () => {
    return escala.reduce((total, day) => total + day.horas, 0);
  };

  const getWorkDays = () => {
    return escala.filter(day => day.status === 'trabalho').length;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Gerador de Escala de Trabalho
          </CardTitle>
          <CardDescription>
            Selecione a jornada de trabalho e a data de início para gerar a escala do mês
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <JornadaTrabalhoSelect 
                  control={form.control} 
                  errors={form.formState.errors} 
                />
                
                <FormField
                  control={form.control}
                  name="dataInicio"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data de Início</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy", { locale: ptBR })
                              ) : (
                                <span>Selecione uma data</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date("1900-01-01") || date > new Date("2100-12-31")
                            }
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <Button type="submit" disabled={loading} className="w-full md:w-auto">
                {loading ? "Gerando..." : "Gerar Escala"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {escala.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Escala Gerada
            </CardTitle>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {getWorkDays()} dias de trabalho
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {getTotalHours()}h total
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
              {escala.map((day, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border text-center space-y-1 ${
                    day.status === 'trabalho'
                      ? 'bg-primary/10 border-primary/20 text-primary'
                      : 'bg-muted border-muted-foreground/20'
                  }`}
                >
                  <div className="text-xs font-medium text-muted-foreground">
                    {getDayName(day.data)}
                  </div>
                  <div className="text-sm font-medium">
                    {formatDate(day.data)}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${
                    day.status === 'trabalho'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted-foreground/20'
                  }`}>
                    {day.status === 'trabalho' ? `${day.horas}h` : 'Folga'}
                  </div>
                  {day.fim_de_semana && (
                    <div className="text-xs text-orange-600">
                      Fim de semana
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}