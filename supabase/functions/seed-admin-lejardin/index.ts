import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const EMAIL = "lejardinresidencial.senior@gmail.com";
  const PASSWORD = "jardin@2026";
  const TENANT_ID = "e33e7b6a-477b-4d20-866c-2020c93287cd";

  try {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list?.users?.find((u) => u.email?.toLowerCase() === EMAIL);

    let userId: string;
    let action: "criado" | "atualizado";
    if (found) {
      userId = found.id;
      action = "atualizado";
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: PASSWORD,
        email_confirm: true,
      });
      if (error) throw error;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { nome: "Le Jardin Residencial Senior" },
      });
      if (error) throw error;
      userId = data.user!.id;
      action = "criado";
    }

    const { error: roleErr } = await admin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "admin", tenant_id: TENANT_ID },
        { onConflict: "user_id,role,tenant_id", ignoreDuplicates: true },
      );
    if (roleErr) {
      const { error: insErr } = await admin
        .from("user_roles")
        .insert({ user_id: userId, role: "admin", tenant_id: TENANT_ID });
      if (insErr && !insErr.message.toLowerCase().includes("duplicate")) throw insErr;
    }

    return new Response(
      JSON.stringify({ success: true, action, user_id: userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[seed-admin-lejardin]", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});