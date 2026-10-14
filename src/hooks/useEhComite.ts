import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "./useAuthSession";

/** Indica se o usuário integra o comitê do Canal de Denúncias (papel compliance). */
export function useEhComite(): boolean {
  const { user } = useAuthSession();
  const { data } = useQuery({
    queryKey: ["eh-comite", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("denuncia-comite", { body: { action: "sou_comite" } });
      return !!data?.comite;
    },
  });
  return data === true;
}
