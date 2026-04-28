import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  email: string;
  password: string;
  tenant_id: string;
  nome?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    let isServiceCall = token === supabaseServiceKey;
    let callerId: string | null = null;

    if (!isServiceCall) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerId = user.id;

      // Apenas super admins
      const { data: isSuper } = await admin.rpc("is_super_admin", {
        _user_id: user.id,
      }).catch(async () => await admin.rpc("is_super_admin"));

      if (isSuper !== true) {
        return new Response(
          JSON.stringify({ error: "Apenas super admins podem cadastrar admins de empresa" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const { email, password, tenant_id, nome }: Payload = await req.json();

    if (!email || !password || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: email, password, tenant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verifica se a empresa existe
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .select("id, nome")
      .eq("id", tenant_id)
      .maybeSingle();

    if (tenantErr || !tenant) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenta encontrar usuário existente
    let userId: string | null = null;
    const { data: existing } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const found = existing?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );

    if (found) {
      userId = found.id;
      // Atualiza senha + confirma email
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { ...(found.user_metadata || {}), nome: nome ?? found.user_metadata?.nome },
      });
      if (updErr) throw updErr;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome: nome ?? email.split("@")[0] },
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
    }

    // Insere role admin no tenant (idempotente)
    const { error: roleErr } = await admin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "admin", tenant_id },
        { onConflict: "user_id,role,tenant_id", ignoreDuplicates: true },
      );
    if (roleErr) {
      // Fallback: tenta sem onConflict (caso constraint difira)
      const { error: insErr } = await admin
        .from("user_roles")
        .insert({ user_id: userId, role: "admin", tenant_id });
      if (insErr && !insErr.message.includes("duplicate")) throw insErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        tenant_id,
        empresa: tenant.nome,
        action: found ? "atualizado" : "criado",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[criar-admin-empresa] erro:", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});