import React from "react";
import { Control, useWatch } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface ValeTransporteSwitchProps {
  control: Control<any>;
}

export default function ValeTransporteSwitch({ control }: ValeTransporteSwitchProps) {
  const recebe = useWatch({ control, name: "recebe_vale_transporte" });

  return (
    <div className="space-y-3">
      <FormField
        control={control}
        name="recebe_vale_transporte"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Recebe Vale-Transporte</FormLabel>
              <div className="text-sm text-muted-foreground">
                Funcionário tem direito ao vale-transporte por dia trabalhado
              </div>
            </div>
            <FormControl>
              <Switch checked={!!field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
      {recebe && (
        <FormField
          control={control}
          name="valor_diaria_vale_transporte"
          render={({ field }) => (
            <FormItem className="rounded-lg border p-4">
              <FormLabel>Valor da diária de VT (R$)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex.: 9,00"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground mt-1">
                Opcional. Usado para calcular o valor total no relatório mensal.
              </p>
            </FormItem>
          )}
        />
      )}
    </div>
  );
}