import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefone, nome, codigo } = await req.json();
    
    console.log("Recebido pedido de envio de SMS:", { telefone, nome, codigo: "***" });
    
    if (!telefone || !codigo) {
      console.error("Campos obrigatórios faltando:", { telefone: !!telefone, codigo: !!codigo });
      return new Response(
        JSON.stringify({ error: "telefone e codigo são obrigatórios" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error("Configurações do Twilio faltando:", {
        accountSid: !!TWILIO_ACCOUNT_SID,
        authToken: !!TWILIO_AUTH_TOKEN,
        phoneNumber: !!TWILIO_PHONE_NUMBER
      });
      return new Response(
        JSON.stringify({ error: "Configurações do Twilio não encontradas." }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Montar mensagem SMS
    const mensagem = `Olá${nome ? `, ${nome}` : ''}! Seu código de registro de ponto é: ${codigo}. Não compartilhe este código.`;

    console.log("Enviando SMS para:", telefone);

    // Enviar SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const authHeader = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    
    const formData = new URLSearchParams();
    formData.append("To", telefone);
    formData.append("From", TWILIO_PHONE_NUMBER);
    formData.append("Body", mensagem);

    const resp = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const responseData = await resp.json();
    
    if (!resp.ok) {
      console.error("Erro ao enviar SMS via Twilio:", responseData);
      throw new Error(`Falha ao enviar SMS: ${responseData.message || JSON.stringify(responseData)}`);
    }

    console.log("SMS enviado com sucesso! SID:", responseData.sid);

    return new Response(
      JSON.stringify({ status: "ok", sid: responseData.sid }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Erro na função enviar-codigo:", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
