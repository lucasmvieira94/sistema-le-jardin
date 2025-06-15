
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export default function FuncaoInput({ control }: { control: any }) {
  return (
    <FormField
      control={control}
      name="funcao"
      render={({ field }) => (
        <FormItem className="flex-1">
          <FormLabel>Função</FormLabel>
          <FormControl>
            <Input placeholder="Cargo/Função" {...field} required />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
