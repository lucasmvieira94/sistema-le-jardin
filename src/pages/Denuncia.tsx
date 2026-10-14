/**
 * Canal de Denúncias — formulário público (sem login), anônimo por padrão.
 * Não usa sessão, cookies ou rastreadores; o envio passa pela função `denuncia-publica`.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, Copy, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIAS, formularioDenunciaSchema, ANEXO_MAX_QTD } from "@/utils/canalDenuncias";
import { arquivoSemMetadados, blobParaBase64 } from "@/utils/limparMetadados";
import { SeletorAnexosDenuncia } from "@/components/denuncias/SeletorAnexosDenuncia";
import { formatarData } from "@/utils/dateUtils";

export default function Denuncia() {
  const [anonima, setAnonima] = useState(true);
  const [f, setF] = useState({ nome: "", contato: "", categoria: "", quando: "", local: "", envolvidos: "", testemunhas: "", relato: "", ainda: "" });
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ protocolo: string; senha: string; prazo_resposta: string } | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = formularioDenunciaSchema.safeParse({
      anonima, nome: f.nome || undefined, contato: f.contato || undefined, categoria: f.categoria || undefined,
      quando: f.quando, local: f.local, envolvidos: f.envolvidos, testemunhas: f.testemunhas, relato: f.relato,
      ainda_ocorre: f.ainda === "" ? undefined : f.ainda === "sim",
    });
    if (!v.success) { toast.error(v.error.errors[0].message); return; }
    setEnviando(true);
    try {
      const anexos = [];
      for (const a of arquivos) {
        const limpo = await arquivoSemMetadados(a);
        anexos.push({ nome: limpo.nome, mime: limpo.mime, base64: await blobParaBase64(limpo.blob) });
      }
      const d = v.data;
      const { data, error } = await supabase.functions.invoke("denuncia-publica", {
        body: {
          action: "enviar", anonima: d.anonima,
          identificacao: d.anonima ? undefined : { nome: d.nome, contato: d.contato },
          categoria: d.categoria, quando: d.quando, local: d.local, envolvidos: d.envolvidos,
          testemunhas: d.testemunhas, relato: d.relato, ainda_ocorre: d.ainda_ocorre, anexos,
        },
      });
      if (error || !data?.protocolo) throw new Error(data?.error || "Falha no envio");
      setResultado(data);
      window.scrollTo(0, 0);
    } catch {
      toast.error("Não foi possível enviar agora. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  const copiar = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copiado"); };

  if (resultado) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <ShieldCheck className="w-12 h-12 mx-auto text-primary" />
            <CardTitle>Denúncia recebida</CardTitle>
            <CardDescription>Guarde agora o protocolo e a senha. Eles não serão mostrados novamente e não há como recuperá-los.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[["Protocolo", resultado.protocolo], ["Senha", resultado.senha]].map(([r, v]) => (
              <div key={r} className="flex items-center justify-between rounded-lg border p-3">
                <div><p className="text-xs text-muted-foreground">{r}</p><p className="font-mono text-xl font-bold tracking-wider">{v}</p></div>
                <Button variant="ghost" size="icon" aria-label={`Copiar ${r}`} onClick={() => copiar(v)}><Copy className="w-4 h-4" /></Button>
              </div>
            ))}
            <p className="text-sm text-muted-foreground">O comitê de apuração tem até {formatarData(resultado.prazo_resposta)} para dar um retorno. Acompanhe e responda perguntas usando o protocolo e a senha.</p>
            <Button asChild className="w-full"><Link to="/denuncia/acompanhar">Acompanhar denúncia</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center space-y-2">
          <ShieldCheck className="w-10 h-10 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Canal de Denúncias</h1>
          <p className="text-muted-foreground">Relate assédio moral, assédio sexual, discriminação ou outras situações que afetem a saúde mental no trabalho (NR-01).</p>
          <Link to="/denuncia/acompanhar" className="text-sm text-primary underline">Já fez uma denúncia? Acompanhe aqui</Link>
        </div>
        <Alert><Lock className="h-4 w-4" /><AlertDescription>Não registramos seu endereço de internet, aparelho ou navegador. O relato é guardado de forma criptografada e só o comitê de apuração tem acesso.</AlertDescription></Alert>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={enviar} className="space-y-5">
              <div className="space-y-2">
                <Label>Identificação</Label>
                <RadioGroup value={anonima ? "anonima" : "identificada"} onValueChange={(v) => setAnonima(v === "anonima")}>
                  <div className="flex items-center gap-2"><RadioGroupItem value="anonima" id="an" /><Label htmlFor="an" className="font-normal">Desejo reportar anonimamente</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="identificada" id="id" /><Label htmlFor="id" className="font-normal">Desejo me identificar</Label></div>
                </RadioGroup>
              </div>
              {!anonima && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><Label>Nome</Label><Input maxLength={120} value={f.nome} onChange={(e) => set("nome")(e.target.value)} /></div>
                  <div><Label>Contato (opcional)</Label><Input maxLength={160} value={f.contato} onChange={(e) => set("contato")(e.target.value)} placeholder="Telefone ou e-mail" /></div>
                </div>
              )}
              <div><Label>Tipo de situação *</Label>
                <Select value={f.categoria} onValueChange={set("categoria")}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORIAS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label>Quando aconteceu</Label><Input maxLength={120} value={f.quando} onChange={(e) => set("quando")(e.target.value)} placeholder="Data ou período aproximado" /></div>
                <div><Label>Local / setor</Label><Input maxLength={200} value={f.local} onChange={(e) => set("local")(e.target.value)} /></div>
              </div>
              <div><Label>Pessoas envolvidas</Label><Textarea maxLength={1000} rows={2} value={f.envolvidos} onChange={(e) => set("envolvidos")(e.target.value)} /></div>
              <div><Label>Testemunhas</Label><Textarea maxLength={1000} rows={2} value={f.testemunhas} onChange={(e) => set("testemunhas")(e.target.value)} /></div>
              <div><Label>Relato *</Label><Textarea maxLength={8000} rows={7} value={f.relato} onChange={(e) => set("relato")(e.target.value)} placeholder="Descreva o que aconteceu, com o máximo de detalhes que se sentir à vontade para informar." />
                <p className="text-xs text-muted-foreground text-right">{f.relato.length}/8000</p></div>
              <div className="space-y-2"><Label>A situação ainda acontece?</Label>
                <RadioGroup value={f.ainda} onValueChange={set("ainda")} className="flex gap-4">
                  <div className="flex items-center gap-2"><RadioGroupItem value="sim" id="s" /><Label htmlFor="s" className="font-normal">Sim</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="n" /><Label htmlFor="n" className="font-normal">Não</Label></div>
                </RadioGroup>
              </div>
              <div className="space-y-2"><Label>Provas (opcional)</Label><SeletorAnexosDenuncia arquivos={arquivos} onChange={setArquivos} max={ANEXO_MAX_QTD} /></div>
              <Button type="submit" className="w-full" disabled={enviando}>{enviando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando com segurança…</> : "Enviar denúncia"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
