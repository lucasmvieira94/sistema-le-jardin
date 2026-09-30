/** Preferências do painel (ordem e quadros ocultos) salvas por usuário. */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "./useAuthSession";
import type { PreferenciasPainel } from "@/components/dashboard/registroQuadros";

export function usePreferenciasPainel() {
  const { user } = useAuthSession();
  const [pref, setPref] = useState<PreferenciasPainel>({ ordem: [], ocultos: [] });
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (supabase as any).from("dashboard_preferencias").select("ordem, ocultos").eq("user_id", user.id).maybeSingle()
      .then(({ data }: any) => {
        if (data) setPref({ ordem: data.ordem || [], ocultos: data.ocultos || [] });
        setCarregado(true);
      });
  }, [user?.id]);

  const salvar = useCallback(async (nova: PreferenciasPainel) => {
    setPref(nova);
    if (!user?.id) return;
    const { error } = await (supabase as any).from("dashboard_preferencias")
      .upsert({ user_id: user.id, ordem: nova.ordem, ocultos: nova.ocultos }, { onConflict: "user_id" });
    if (error) throw error;
  }, [user?.id]);

  return { pref, carregado, salvar };
}
