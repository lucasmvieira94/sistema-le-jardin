import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Lista mínima de residentes ativos do portal (só nome/quarto). */
export function useResidentesPortal() {
  const [lista, setLista] = useState<{ id: string; nome_completo: string; quarto: string | null }[]>([]);
  useEffect(() => { supabase.rpc("portal_cuidados_residentes" as any).then(({ data }) => setLista(((data as any[]) ?? []).map((r) => ({ id: r.id, nome_completo: r.nome_completo, quarto: r.quarto })))); }, []);
  return lista;
}
