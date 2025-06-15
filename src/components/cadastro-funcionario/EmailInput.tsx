
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export default function EmailInput({ control }: { control: any }) {
  return (
    <FormField
      control={control}
      name="email"
      render={({ field }) => (
        <FormItem className="flex-1">
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input type="email" placeholder="email@exemplo.com" {...field} required />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
