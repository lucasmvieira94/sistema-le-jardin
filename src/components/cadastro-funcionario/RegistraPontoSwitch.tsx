import React from "react";
import { Control } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

interface RegistraPontoSwitchProps {
  control: Control<any>;
}

export default function RegistraPontoSwitch({ control }: RegistraPontoSwitchProps) {
  return (
    <FormField
      control={control}
      name="registra_ponto"
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <FormLabel className="text-base">
              Registra Ponto
            </FormLabel>
            <div className="text-sm text-muted-foreground">
              Funcionário deve registrar ponto e ter escala de trabalho
            </div>
          </div>
          <FormControl>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}