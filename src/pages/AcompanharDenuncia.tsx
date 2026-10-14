/** Acompanhamento da denúncia por protocolo + senha (comunicação bilateral anônima). */
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIAS, CONCLUSOES, SITUACOES, normalizarProtocolo, PROTOCOLO_RE, type Categoria, type Situacao } from "@/utils/canalDenuncias";
import { arquivoSemMetadados, blobParaBase64 } from "@/utils/limparMetadados";
import { SeletorAnexosDenuncia } from "@/components/denuncias/SeletorAnexosDenuncia";
import { formatarData } from "@/utils/dateUtils";

type Consulta = {
  protocolo: string; situacao: Situacao; conclusao: keyof typeof CONCLUSOES | null; categoria: Categoria;
  criado_em: string; prazo_resposta: string;
  mensagens: { autor: string; texto: string; em: string }[];
  anexos: { nome: string; em: string; por: string }[];
};
const dataHora = (s: string) => new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default function AcompanharDenuncia() {
  const [protocolo, setProtocolo] = useState("");
  const [senha, setSenha] = useState("");
  const [dados, setDados] = useState<Consulta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [msg, setMsg] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);

  const chamar = async (extra: Record<string, unknown>) => {
    setCarregando(true);
    try {
      const { data, error } = await supabase.functions.invoke("denuncia-publica", { body: { protocolo, senha, ...extra } });
      if (error || data?.error) {
        let m = data?.error;
        try { m = m || (await (error as { context?: Response })?.context?.json())?.error; } catch { /* ignore */ }
        throw new Error(m || "Não foi possível consultar");
      }
      setDados(data);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally { setCarregando(false); }
  };

  const responder = async () => {
    if (!msg.trim()) return;
    const anexos = [];
    for (const a of arquivos) { const l = await arquivoSemMetadados(a); anexos.push({ nome: l.nome, mime: l.mime, base64: await blobParaBase64(l.blob) }); }
    if (await chamar({ action: "responder", mensagem: msg, anexos })) { setMsg(""); setArquivos([]); toast.success("Mensagem enviada ao comitê"); }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center space-y-1">
          <ShieldCheck className="w-10 h-10 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Acompanhar denúncia</h1>
          <Link to="/denuncia" className="text-sm text-primary underline">Fazer nova denúncia</Link>
        </div>
        {!dados ? (
          <Card><CardContent className="pt-6 space-y-3">
            <div><Label>Protocolo</Label><Input value={protocolo} onChange={(e) => setProtocolo(normalizarProtocolo(e.target.value))} placeholder="A5-B98-X2Q" className="font-mono" /></div>
            <div><Label>Senha</Label><Input type="password" value={senha} maxLength={40} onChange={(e) => setSenha(e.target.value.trim())} /></div>
            <Button className="w-full" disabled={carregando || !PROTOCOLO_RE.test(protocolo) || senha.length < 6} onClick={() => chamar({ action: "consultar" })}>
              {carregando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Consultar
            </Button>
            <p className="text-xs text-muted-foreground">Após 5 tentativas erradas, o acesso fica bloqueado por 30 minutos.</p>
          </CardContent></Card>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle className="flex items-center justify-between gap-2 text-lg"><span className="font-mono">{dados.protocolo}</span><Badge>{SITUACOES[dados.situacao]}</Badge></CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><b>Tipo:</b> {CATEGORIAS[dados.categoria]}</p>
                <p><b>Registrada em:</b> {dataHora(dados.criado_em)}</p>
                <p><b>Prazo de retorno:</b> {formatarData(dados.prazo_resposta)}</p>
                {dados.conclusao && <p><b>Conclusão:</b> {CONCLUSOES[dados.conclusao]}</p>}
                {dados.anexos.length > 0 && <p className="flex items-center gap-1"><Paperclip className="w-3 h-3" />{dados.anexos.length} anexo(s) enviado(s)</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Conversa com o comitê</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {dados.mensagens.length === 0 && <p className="text-sm text-muted-foreground">Ainda não há mensagens.</p>}
                {dados.mensagens.map((m, i) => (
                  <div key={i} className={`rounded-lg p-3 text-sm ${m.autor === "comite" ? "bg-primary/10" : "bg-muted ml-8"}`}>
                    <p className="text-xs text-muted-foreground mb-1">{m.autor === "comite" ? "Comitê de apuração" : "Você"} · {dataHora(m.em)}</p>
                    <p className="whitespace-pre-wrap">{m.texto}</p>
                  </div>
                ))}
                {dados.situacao !== "arquivada" && (
                  <div className="space-y-2 pt-2 border-t">
                    <Textarea rows={3} maxLength={4000} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Responder ou acrescentar informações" />
                    <SeletorAnexosDenuncia arquivos={arquivos} onChange={setArquivos} max={3} />
                    <Button onClick={responder} disabled={carregando || !msg.trim()}>{carregando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Enviar</Button>
                  </div>
                )}
              </CardContent>
            </Card>
            <Button variant="outline" className="w-full" onClick={() => { setDados(null); setSenha(""); }}>Sair</Button>
          </>
        )}
      </div>
    </div>
  );
}
