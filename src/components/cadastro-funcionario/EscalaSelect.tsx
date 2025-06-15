
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectTrigger, SelectItem, SelectContent, SelectLabel, SelectValue } from "@/components/ui/select";

type Escala = {
  id: number;
  nome: string;
  entrada: string;
  saida: string;
};

export default function EscalaSelect({
  control,
  escalas,
}: {
  control: any;
  escalas: Escala[];
}) {
  return (
    <FormField
      control={control}
      name="escala_id"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Escala</FormLabel>
          <Select
            onValueChange={field.onChange}
            value={field.value}
            defaultValue={field.value}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma escala" />
            </SelectTrigger>
            <SelectContent>
              <SelectLabel>Escalas disponíveis</SelectLabel>
              {escalas.map((escala) => (
                <SelectItem key={escala.id} value={String(escala.id)}>
                  {escala.nome} ({escala.entrada} às {escala.saida})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
