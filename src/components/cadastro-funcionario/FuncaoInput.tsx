import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { MODULOS_PORTAL } from "@/utils/modulosCargo";

export interface CargoOpcao { id: string; nome: string; modulos: string[]; ativo: boolean }

/**
 * Seleção do cargo + personalização de módulos do funcionário.
 * Campos do formulário: `cargo_id`, `personalizar_modulos`, `modulos_desejados`.
 */
export default function FuncaoInput({ control, watch, setValue }: { control: any; watch: any; setValue: any }) {
  const [cargos, setCargos] = useState<CargoOpcao[]>([]);
  const cargoId = watch("cargo_id");
  const personalizar = watch("personalizar_modulos");
  const desejados: string[] = watch("modulos_desejados") || [];

  useEffect(() => {
    supabase.from("cargos" as any).select("id,nome,modulos,ativo").order("nome").then(({ data }) => {
      setCargos(((data as any) || []) as CargoOpcao[]);
    });
  }, []);

  const cargo = cargos.find((c) => c.id === cargoId);
  const visiveis = cargos.filter((c) => c.ativo || c.id === cargoId);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <FormField
        control={control}
        name="cargo_id"
        rules={{ required: "Selecione o cargo" }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cargo / Função</FormLabel>
            <Select
              value={field.value || ""}
              onValueChange={(v) => {
                field.onChange(v);
                const c = cargos.find((x) => x.id === v);
                if (c && !personalizar) setValue("modulos_desejados", c.modulos);
              }}
            >
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {visiveis.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}{!c.ativo ? " (inativo)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Não encontrou o cargo? <Link to="/cargos" className="underline">Gerenciar cargos</Link>
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

      {cargo && (
        <>
          <div className="flex flex-wrap gap-1">
            {(personalizar ? desejados : cargo.modulos).length === 0 && (
              <span className="text-sm text-muted-foreground">Nenhum módulo liberado.</span>
            )}
            {MODULOS_PORTAL.filter((m) => (personalizar ? desejados : cargo.modulos).includes(m.id)).map((m) => (
              <Badge key={m.id} variant="secondary">{m.nome}</Badge>
            ))}
          </div>
          <FormField
            control={control}
            name="personalizar_modulos"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-4">
                <div>
                  <FormLabel>Personalizar acessos deste funcionário</FormLabel>
                  <p className="text-xs text-muted-foreground">Libera ou bloqueia módulos só para esta pessoa, sem alterar o cargo.</p>
                </div>
                <FormControl>
                  <Switch
                    checked={!!field.value}
                    onCheckedChange={(v) => {
                      field.onChange(v);
                      if (!v) setValue("modulos_desejados", cargo.modulos);
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          {personalizar && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MODULOS_PORTAL.map((m) => {
                const marcado = desejados.includes(m.id);
                const doCargo = cargo.modulos.includes(m.id);
                return (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={marcado}
                      onCheckedChange={(v) =>
                        setValue("modulos_desejados", v ? [...desejados, m.id] : desejados.filter((x) => x !== m.id))
                      }
                    />
                    {m.nome}
                    {marcado !== doCargo && <span className="text-xs text-primary">(exceção)</span>}
                  </label>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
