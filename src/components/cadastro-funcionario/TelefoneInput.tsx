import React from "react";
import { Control } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Phone } from "lucide-react";

interface TelefoneInputProps {
  control: Control<any>;
}

// Formatar telefone brasileiro
function formatarTelefone(value: string): string {
  const numeros = value.replace(/\D/g, '');
  
  if (numeros.length <= 2) {
    return `(${numeros}`;
  }
  if (numeros.length <= 7) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  }
  if (numeros.length <= 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  }
  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
}

export default function TelefoneInput({ control }: TelefoneInputProps) {
  return (
    <FormField
      control={control}
      name="telefone"
      render={({ field }) => (
        <FormItem className="flex-1">
          <FormLabel>Telefone (WhatsApp)</FormLabel>
          <FormControl>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="(99) 99999-9999"
                {...field}
                value={field.value || ''}
                onChange={(e) => {
                  const formatted = formatarTelefone(e.target.value);
                  field.onChange(formatted);
                }}
                className="pl-10"
                maxLength={15}
              />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
