import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GamificacaoRequest {
  action:
    | "processar_plantao"
    | "processar_micro_tarefa"
    | "processar_penalidade"
    | "congelar_streak";
  funcionario_id: string;
  tipo?: string;
  referencia_id?: string;
  descricao?: string;
  dias_suspensao?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body: GamificacaoRequest = await req.json();
    const { action, funcionario_id, tipo, referencia_id, descricao, dias_suspensao } = body;

    if (!action || !funcionario_id) {
      return new Response(
        JSON.stringify({ error: "action e funcionario_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Garantir que o perfil existe
    const { data: profile } = await supabase
      .from("gamification_profiles")
      .select("*")
      .eq("funcionario_id", funcionario_id)
      .maybeSingle();

    if (!profile) {
      await supabase
        .from("gamification_profiles")
        .insert({ funcionario_id });
    }

    const currentProfile = profile || { xp_total: 0, moedas: 0, streak_plantoes: 0, ultimo_plantao_data: null };

    let xpDelta = 0;
    let moedasDelta = 0;
    let tipoTransacao = tipo || action;
    let desc = descricao || "";
    let novoStreak = currentProfile.streak_plantoes;
    let ultimoPlantaoData = currentProfile.ultimo_plantao_data;

    switch (action) {
      case "processar_plantao": {
        // Base: +10 XP/moedas
        const baseXp = 10;
        const baseMoedas = 10;

        // Streak progressivo: +1 por plantão consecutivo, max +20
        const streakBonus = Math.min(currentProfile.streak_plantoes, 20);
        xpDelta = baseXp + streakBonus;
        moedasDelta = baseMoedas + streakBonus;
        novoStreak = currentProfile.streak_plantoes + 1;
        ultimoPlantaoData = new Date().toISOString().split("T")[0];
        tipoTransacao = "plantao";
        desc = desc || `Plantão trabalhado (streak: ${novoStreak}, bônus: +${streakBonus})`;
        break;
      }

      case "processar_micro_tarefa": {
        if (tipo === "micro_tarefa_ponto") {
          xpDelta = 2;
          moedasDelta = 2;
          desc = desc || "Ponto eletrônico batido corretamente";
        } else if (tipo === "micro_tarefa_prontuario") {
          xpDelta = 3;
          moedasDelta = 3;
          desc = desc || "Prontuário completo no ciclo";
        }
        tipoTransacao = tipo || "micro_tarefa_ponto";
        break;
      }

      case "processar_penalidade": {
        switch (tipo) {
          case "falta_injustificada":
            xpDelta = -100;
            moedasDelta = -100;
            novoStreak = 0; // Reset streak
            desc = desc || "Falta injustificada — streak resetado";
            break;
          case "advertencia_verbal":
            xpDelta = -50;
            moedasDelta = -50;
            desc = desc || "Advertência verbal";
            break;
          case "advertencia_escrita":
            xpDelta = -150;
            moedasDelta = -150;
            desc = desc || "Advertência escrita";
            break;
          case "suspensao":
            const dias = dias_suspensao || 1;
            xpDelta = -500 * dias;
            moedasDelta = -500 * dias;
            novoStreak = 0;
            desc = desc || `Suspensão de ${dias} dia(s)`;
            break;
          default:
            return new Response(
              JSON.stringify({ error: "Tipo de penalidade inválido" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
        tipoTransacao = tipo!;
        break;
      }

      case "congelar_streak": {
        // Afastamento médico: não altera streak nem aplica penalidade
        desc = desc || "Streak congelado por afastamento médico";
        // Registra apenas uma transação informativa
        await supabase.from("gamification_transactions").insert({
          funcionario_id,
          tipo: "congelamento",
          xp_delta: 0,
          moedas_delta: 0,
          descricao: desc,
          referencia_id: referencia_id || null,
        });

        return new Response(
          JSON.stringify({ success: true, message: "Streak congelado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Registrar transação
    await supabase.from("gamification_transactions").insert({
      funcionario_id,
      tipo: tipoTransacao,
      xp_delta: xpDelta,
      moedas_delta: moedasDelta,
      descricao: desc,
      referencia_id: referencia_id || null,
    });

    // Atualizar perfil
    const novoXp = Math.max(0, currentProfile.xp_total + xpDelta);
    const novasMoedas = Math.max(0, currentProfile.moedas + moedasDelta);

    await supabase
      .from("gamification_profiles")
      .update({
        xp_total: novoXp,
        moedas: novasMoedas,
        streak_plantoes: novoStreak,
        ultimo_plantao_data: ultimoPlantaoData,
      })
      .eq("funcionario_id", funcionario_id);

    return new Response(
      JSON.stringify({
        success: true,
        xp_total: novoXp,
        moedas: novasMoedas,
        streak: novoStreak,
        xp_delta: xpDelta,
        moedas_delta: moedasDelta,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro processar-gamificacao:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
