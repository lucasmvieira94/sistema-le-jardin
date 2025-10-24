import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useFraldas } from "@/hooks/useFraldas";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface ConfiguracoesAlertasFraldasProps {
  onSuccess: () => void;
}

export const ConfiguracoesAlertasFraldas = ({
  onSuccess,
}: ConfiguracoesAlertasFraldasProps) => {
  const { configuracoes, salvarConfiguracoes } = useFraldas();
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      dias_alerta_critico: configuracoes?.dias_alerta_critico || 3,
      dias_alerta_aviso: configuracoes?.dias_alerta_aviso || 7,
      dias_alerta_atencao: configuracoes?.dias_alerta_atencao || 15,
      notificar_email: configuracoes?.notificar_email ?? true,
      notificar_dashboard: configuracoes?.notificar_dashboard ?? true,
    },
  });

  const notificarEmail = watch("notificar_email");
  const notificarDashboard = watch("notificar_dashboard");

  const onSubmit = async (data: any) => {
    await salvarConfiguracoes.mutateAsync(data);
    onSuccess();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Configurações de Alertas</DialogTitle>
        <DialogDescription>
          Configure quando você deseja receber alertas sobre o estoque de fraldas
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dias_alerta_critico">
              Alerta Crítico (dias restantes)
            </Label>
            <Input
              id="dias_alerta_critico"
              type="number"
              min="1"
              {...register("dias_alerta_critico", {
                required: true,
                valueAsNumber: true,
              })}
            />
            <p className="text-sm text-muted-foreground">
              Estoque suficiente apenas para este número de dias ou menos será marcado
              como crítico
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dias_alerta_aviso">Alerta de Aviso (dias restantes)</Label>
            <Input
              id="dias_alerta_aviso"
              type="number"
              min="1"
              {...register("dias_alerta_aviso", {
                required: true,
                valueAsNumber: true,
              })}
            />
            <p className="text-sm text-muted-foreground">
              Estoque suficiente apenas para este número de dias ou menos será marcado
              como aviso
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dias_alerta_atencao">
              Alerta de Atenção (dias restantes)
            </Label>
            <Input
              id="dias_alerta_atencao"
              type="number"
              min="1"
              {...register("dias_alerta_atencao", {
                required: true,
                valueAsNumber: true,
              })}
            />
            <p className="text-sm text-muted-foreground">
              Estoque suficiente apenas para este número de dias ou menos será marcado
              como atenção
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h4 className="font-medium">Notificações</h4>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notificar_email">Notificar por E-mail</Label>
              <p className="text-sm text-muted-foreground">
                Receber alertas por e-mail quando o estoque estiver baixo
              </p>
            </div>
            <Switch
              id="notificar_email"
              checked={notificarEmail}
              onCheckedChange={(checked) => setValue("notificar_email", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notificar_dashboard">Exibir no Dashboard</Label>
              <p className="text-sm text-muted-foreground">
                Mostrar alertas de estoque baixo no painel principal
              </p>
            </div>
            <Switch
              id="notificar_dashboard"
              checked={notificarDashboard}
              onCheckedChange={(checked) => setValue("notificar_dashboard", checked)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onSuccess}>
            Cancelar
          </Button>
          <Button type="submit">Salvar Configurações</Button>
        </div>
      </form>
    </>
  );
};
