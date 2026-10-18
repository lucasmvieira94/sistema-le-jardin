/**
 * Formulário "Cancelar contrato": escolhe a hipótese de rescisão da Cláusula Sexta,
 * mostra a prévia do cálculo e grava o distrato.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { hojeISO, formatarData } from "@/utils/dateUtils";
import { calcularDistrato, TIPOS_RESCISAO, type TipoRescisao, type ParteRescisao } from "@/utils/distratoContrato";
import type { ContratoData } from "./types";

export interface DistratoData {
  id: string;
  contrato_id: string;
  numero_distrato: string;
  tipo_rescisao: string;
  parte_iniciadora: string;
  data_distrato: string;
  data_efetiva: string;
  valor_proporcional: number;
  valor_indenizacao: number;
  valor_adaptacao: number;
  valor_pendencias: number;
  valor_total: number;
  retem_garantia: boolean;
  condicao_livre: string | null;
  valores_pendentes: { competencia: string; valor: number }[];
  observacoes: string | null;
  created_at: string;
}

interface Pendencia { id: string; competencia: string; valor_total: number; valor_pago: number }

const moeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  contrato: ContratoData;
  residenteId: string;
  onSaved: (d: DistratoData) => void;
  onCancel: () => void;
}

export default function DistratoForm({ contrato, residenteId, onSaved, onCancel }: Props) {
  const { toast } = useToast();
  const [tipo, setTipo] = useState<TipoRescisao>("aviso_previo");
  const [parte, setParte] = useState<ParteRescisao>("contratante");
  const [dataDistrato, setDataDistrato] = useState(hojeISO());
  const [dataEfetivaAcordo, setDataEfetivaAcordo] = useState(hojeISO());
  const [valorAcordo, setValorAcordo] = useState("0");
  const [condicao, setCondicao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [incluir, setIncluir] = useState<Record<string, boolean>>({});
  const [salvando, setSalvando] = useState(false);

  // Mensalidades em aberto deste contrato
  useEffect(() => {
    if (!contrato.id) return;
    supabase
      .from("mensalidades_residentes")
      .select("id, competencia, valor_total, valor_pago, status")
      .eq("contrato_id", contrato.id)
      .not("status", "in", "(pago,cancelado)")
      .order("competencia")
      .then(({ data }) => {
        const lista = (data || []) as Pendencia[];
        setPendencias(lista);
        setIncluir(Object.fromEntries(lista.map((p) => [p.id, true])));
      });
  }, [contrato.id]);

  const selecionadas = pendencias.filter((p) => incluir[p.id]);
  const totalPend = selecionadas.reduce((s, p) => s + Number(p.valor_total) - Number(p.valor_pago || 0), 0);

  const r = useMemo(
    () =>
      calcularDistrato({
        tipo,
        valorMensalidade: Number(contrato.valor_mensalidade),
        dataInicioContrato: contrato.data_inicio_contrato,
        dataDistrato,
        parteIniciadora: parte,
        dataEfetivaAcordo,
        valorAcordo: Number(valorAcordo) || 0,
        pendencias: totalPend,
      }),
    [tipo, contrato, dataDistrato, parte, dataEfetivaAcordo, valorAcordo, totalPend],
  );

  const info = TIPOS_RESCISAO.find((t) => t.valor === tipo)!;

  const salvar = async () => {
    if (tipo === "acordo" && condicao.trim().length < 10) {
      toast({ title: "Descreva a condição acordada", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      const { data: res } = await supabase.from("residentes").select("tenant_id").eq("id", residenteId).maybeSingle();
      const { data, error } = await supabase
        .from("contratos_distratos")
        .insert({
          contrato_id: contrato.id!,
          residente_id: residenteId,
          tenant_id: (res as any)?.tenant_id ?? null,
          numero_distrato: `D-${contrato.numero_contrato}`,
          tipo_rescisao: tipo,
          parte_iniciadora: parte,
          data_distrato: dataDistrato,
          data_efetiva: r.dataEfetiva,
          valor_proporcional: r.valorProporcional,
          valor_indenizacao: r.valorIndenizacao,
          valor_adaptacao: r.valorAdaptacao,
          valor_pendencias: r.valorPendencias,
          valor_total: r.valorTotal,
          retem_garantia: r.retemGarantia,
          condicao_livre: tipo === "acordo" ? condicao.trim() : null,
          valores_pendentes: selecionadas.map((p) => ({ competencia: p.competencia, valor: Number(p.valor_total) - Number(p.valor_pago || 0) })),
          observacoes: observacoes.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Contrato fica ativo até a data efetiva (aviso prévio) e depois encerra
      const encerrarAgora = r.dataEfetiva <= hojeISO();
      const { error: e2 } = await supabase
        .from("contratos_residentes")
        .update({ data_fim_contrato: r.dataEfetiva, ...(encerrarAgora ? { status: "encerrado" } : {}) })
        .eq("id", contrato.id!);
      if (e2) throw e2;

      toast({ title: "Distrato gerado", description: `Encerramento em ${formatarData(r.dataEfetiva)}.` });
      onSaved(data as unknown as DistratoData);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao gerar distrato", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Motivo da rescisão</Label>
        <Select value={tipo} onValueChange={(v) => setTipo(v as TipoRescisao)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIPOS_RESCISAO.map((t) => (
              <SelectItem key={t.valor} value={t.valor}>{t.clausula} — {t.rotulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{info.descricao}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{tipo === "falecimento" ? "Data do falecimento" : "Data do distrato"}</Label>
          <Input type="date" value={dataDistrato} onChange={(e) => setDataDistrato(e.target.value)} />
        </div>
        {(tipo === "aviso_previo" || tipo === "sem_aviso" || tipo === "acordo") && (
          <div className="space-y-2">
            <Label>Quem solicitou</Label>
            <RadioGroup value={parte} onValueChange={(v) => setParte(v as ParteRescisao)} className="flex gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="contratante" />Contratante</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="contratada" />Contratada</label>
            </RadioGroup>
          </div>
        )}
      </div>

      {tipo === "acordo" && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-2">
            <Label>Condição acordada entre as partes</Label>
            <Textarea rows={4} maxLength={3000} value={condicao} onChange={(e) => setCondicao(e.target.value)} placeholder="Descreva as condições do acordo..." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Data de encerramento</Label>
              <Input type="date" value={dataEfetivaAcordo} onChange={(e) => setDataEfetivaAcordo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Valor acordado (R$, negativo = a devolver)</Label>
              <Input type="number" step="0.01" value={valorAcordo} onChange={(e) => setValorAcordo(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {pendencias.length > 0 && (
        <div className="space-y-2">
          <Label>Mensalidades em aberto</Label>
          {pendencias.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!incluir[p.id]} onCheckedChange={(c) => setIncluir((s) => ({ ...s, [p.id]: !!c }))} />
              {formatarData(p.competencia)} — {moeda(Number(p.valor_total) - Number(p.valor_pago || 0))}
            </label>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea rows={2} maxLength={2000} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </div>

      <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1">
        <p className="font-semibold mb-2">Prévia do cálculo</p>
        <p>Encerramento efetivo: <strong>{formatarData(r.dataEfetiva)}</strong></p>
        {r.valorProporcional !== 0 && <p>{tipo === "acordo" ? "Valor acordado" : tipo === "falecimento" ? "Mês do falecimento" : "Mensalidade proporcional"}: {moeda(r.valorProporcional)}</p>}
        {r.valorIndenizacao > 0 && <p>Indenização (Cl. 6.1), paga pela {r.indenizacaoPagaPor}: {moeda(r.valorIndenizacao)}</p>}
        {r.valorAdaptacao > 0 && <p>Adaptação: {r.diasAdaptacao} dia(s) × R$ 250,00 = {moeda(r.valorAdaptacao)}</p>}
        {r.valorPendencias > 0 && <p>Mensalidades em aberto: {moeda(r.valorPendencias)}</p>}
        {r.retemGarantia && <p>Garantia não será restituída (Cl. 2.10).</p>}
        <p className="pt-2 font-semibold">
          {r.valorTotal >= 0 ? `Total devido pelo contratante: ${moeda(r.valorTotal)}` : `Total a restituir ao contratante: ${moeda(-r.valorTotal)}`}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Voltar</Button>
        <Button variant="destructive" onClick={salvar} disabled={salvando}>
          {salvando ? "Gerando..." : "Gerar distrato"}
        </Button>
      </div>
    </div>
  );
}
