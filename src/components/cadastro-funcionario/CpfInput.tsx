
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export default function CpfInput({ control }: { control: any }) {
  return (
    <FormField
      control={control}
      name="cpf"
      render={({ field }) => (
        <FormItem className="flex-1">
          <FormLabel>CPF</FormLabel>
          <FormControl>
            <Input placeholder="999.999.999-99" maxLength={14} minLength={11} {...field} required />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
