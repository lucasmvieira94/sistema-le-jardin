
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface DataInputProps {
  control: any;
  name: "data_nascimento" | "data_admissao" | "data_inicio_vigencia";
  label: string;
}

export default function DataInput({ control, name, label }: DataInputProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex-1">
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type="date" {...field} required />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
