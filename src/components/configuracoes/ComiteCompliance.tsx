/** Designação do comitê do Canal de Denúncias (até 2 pessoas). O administrador não lê as denúncias. */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Membro = { user_id: string; email: string };

export function ComiteCompliance() {
  const [equipe, setEquipe] = useState<Membro[]>([]);
  const [email, setEmail] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const chamar = async (body: Record<string, unknown>) => {
    setOcupado(true);
    try {
      const { data, error } = await supabase.functions.invoke("denuncia-comite", { body });
      let m = data?.error;
      if (error && !m) { try { m = (await (error as { context?: Response }).context?.json())?.error; } catch { /* ignore */ } }
      if (error || m) throw new Error(m || "Falha");
      setEquipe(data.equipe ?? []);
      return true;
    } catch (e) { toast.error((e as Error).message); return false; }
    finally { setOcupado(false); }
  };
  useEffect(() => { chamar({ action: "equipe_listar" }); }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5" />Comitê do Canal de Denúncias</CardTitle>
        <CardDescription>Até 2 pessoas podem ler e apurar as denúncias de assédio (NR-01). Administradores apenas designam; não têm acesso ao conteúdo. Link público: {window.location.origin}/denuncia</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {equipe.map((m) => (
          <div key={m.user_id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
            <span>{m.email}</span>
            <Button variant="ghost" size="icon" aria-label="Remover do comitê" disabled={ocupado} onClick={() => chamar({ action: "equipe_remover", user_id: m.user_id })}><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
        {equipe.length < 2 && (
          <div className="flex gap-2">
            <Input type="email" placeholder="E-mail de acesso ao sistema" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} />
            <Button disabled={ocupado || !email.includes("@")} onClick={async () => { if (await chamar({ action: "equipe_adicionar", email })) { setEmail(""); toast.success("Pessoa designada ao comitê"); } }}>Designar</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
