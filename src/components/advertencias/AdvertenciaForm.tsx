import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

type Funcionario = {
  id: string;
  nome_completo: string;
  funcao: string;
};

// Motivos conforme CLT
const MOTIVOS_CLT = [
  "Ato de improbidade (Art. 482, a)",
  "Incontinência de conduta ou mau procedimento (Art. 482, b)",
  "Negociação habitual (Art. 482, c)",
  "Condenação criminal (Art. 482, d)",
  "Desídia no desempenho das funções (Art. 482, e)",
  "Embriaguez habitual ou em serviço (Art. 482, f)",
  "Violação de segredo da empresa (Art. 482, g)",
  "Indisciplina ou insubordinação (Art. 482, h)",
  "Abandono de emprego (Art. 482, i)",
  "Ato lesivo à honra ou boa fama (Art. 482, j/k)",
  "Prática constante de jogos de azar (Art. 482, l)",
  "Atraso/falta injustificada",
  "Uso indevido de equipamentos",
  "Descumprimento de normas internas",
  "Outro",
];

const TIPOS = [
  { value: "advertencia_verbal", label: "Advertência Verbal" },
  { value: "advertencia_escrita", label: "Advertência Escrita" },
  { value: "suspensao", label: "Suspensão" },
  { value: "justa_causa", label: "Demissão por Justa Causa" },
];

interface AdvertenciaFormProps {
  funcionarioIdPrefixado?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AdvertenciaForm({ funcionarioIdPrefixado, onSuccess, onCancel }: AdvertenciaFormProps) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState("");
  const [funcionarioId, setFuncionarioId] = useState(funcionarioIdPrefixado || "");
  const [motivo, setMotivo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataOcorrencia, setDataOcorrencia] = useState(new Date().toISOString().split("T")[0]);
  const [diasSuspensao, setDiasSuspensao] = useState<number>(1);
  const [dataInicioSuspensao, setDataInicioSuspensao] = useState("");
  const [dataFimSuspensao, setDataFimSuspensao] = useState("");
  const [testemunha1, setTestemunha1] = useState("");
  const [testemunha2, setTestemunha2] = useState("");
  const [recusouAssinar, setRecusouAssinar] = useState(false);
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    async function fetchFuncionarios() {
      const { data } = await supabase
        .from("funcionarios")
        .select("id, nome_completo, funcao")
        .eq("ativo", true)
        .order("nome_completo");
      if (data) setFuncionarios(data);
    }
    fetchFuncionarios();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo || !funcionarioId || !motivo || !descricao || !dataOcorrencia) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios." });
      return;
    }

    if (tipo === "suspensao") {
      if (diasSuspensao > 30) {
        toast({ variant: "destructive", title: "Suspensão máxima de 30 dias (CLT Art. 474)." });
        return;
      }
      if (!dataInicioSuspensao) {
        toast({ variant: "destructive", title: "Informe a data de início da suspensão." });
        return;
      }
    }

    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from("advertencias_suspensoes").insert({
      funcionario_id: funcionarioId,
      tipo,
      motivo,
      descricao,
      data_ocorrencia: dataOcorrencia,
      dias_suspensao: tipo === "suspensao" ? diasSuspensao : null,
      data_inicio_suspensao: tipo === "suspensao" ? dataInicioSuspensao : null,
      data_fim_suspensao: tipo === "suspensao" ? dataFimSuspensao : null,
      testemunha_1: testemunha1 || null,
      testemunha_2: testemunha2 || null,
      funcionario_recusou_assinar: recusouAssinar,
      observacoes: observacoes || null,
      registrado_por: userData?.user?.id || null,
    });

    setLoading(false);

    if (error) {
      toast({ variant: "destructive", title: "Erro ao registrar", description: error.message });
    } else {
      toast({ title: "Registro disciplinar criado com sucesso." });
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <h3 className="text-lg font-semibold">Nova Advertência / Suspensão</h3>

      {/* Funcionário */}
      {!funcionarioIdPrefixado && (
        <div className="space-y-1">
          <Label>Funcionário *</Label>
          <Select value={funcionarioId} onValueChange={setFuncionarioId}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {funcionarios.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.nome_completo} — {f.funcao}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Tipo */}
      <div className="space-y-1">
        <Label>Tipo *</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
          <SelectContent>
            {TIPOS.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Motivo CLT */}
      <div className="space-y-1">
        <Label>Motivo (base legal CLT) *</Label>
        <Select value={motivo} onValueChange={setMotivo}>
          <SelectTrigger><SelectValue placeholder="Selecione o motivo..." /></SelectTrigger>
          <SelectContent>
            {MOTIVOS_CLT.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data da ocorrência */}
      <div className="space-y-1">
        <Label>Data da Ocorrência *</Label>
        <Input type="date" value={dataOcorrencia} onChange={e => setDataOcorrencia(e.target.value)} />
      </div>

      {/* Descrição */}
      <div className="space-y-1">
        <Label>Descrição detalhada da ocorrência *</Label>
        <Textarea
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          placeholder="Descreva os fatos de forma clara e objetiva..."
          rows={4}
        />
      </div>

      {/* Campos de suspensão */}
      {tipo === "suspensao" && (
        <div className="space-y-3 rounded-md border p-3 bg-muted/30">
          <p className="text-sm font-medium text-muted-foreground">Dados da Suspensão (máx. 30 dias — CLT Art. 474)</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Dias</Label>
              <Input type="number" min={1} max={30} value={diasSuspensao} onChange={e => setDiasSuspensao(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Início</Label>
              <Input type="date" value={dataInicioSuspensao} onChange={e => setDataInicioSuspensao(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fim</Label>
              <Input type="date" value={dataFimSuspensao} onChange={e => setDataFimSuspensao(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Testemunhas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Testemunha 1</Label>
          <Input value={testemunha1} onChange={e => setTestemunha1(e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="space-y-1">
          <Label>Testemunha 2</Label>
          <Input value={testemunha2} onChange={e => setTestemunha2(e.target.value)} placeholder="Nome completo" />
        </div>
      </div>

      {/* Recusa */}
      <div className="flex items-center gap-3">
        <Switch checked={recusouAssinar} onCheckedChange={setRecusouAssinar} />
        <Label>Funcionário recusou-se a assinar</Label>
      </div>

      {/* Observações */}
      <div className="space-y-1">
        <Label>Observações adicionais</Label>
        <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Registrar
        </Button>
      </div>
    </form>
  );
}
