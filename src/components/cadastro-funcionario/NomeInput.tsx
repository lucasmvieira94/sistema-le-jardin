
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export default function NomeInput({ control }: { control: any }) {
  return (
    <FormField
      control={control}
      name="nome_completo"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Nome Completo</FormLabel>
          <FormControl>
            <Input placeholder="Nome Completo" {...field} required />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
