import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Copy, Check, FileText, Loader2, Trash2, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Solicitacao {
  id: string;
  token: string;
  contratante_nome: string | null;
  contratante_cpf: string | null;
  contratante_rg: string | null;
  contratante_endereco: string | null;
  contratante_telefone: string | null;
  contratante_email: string | null;
  residente_nome: string | null;
  residente_cpf: string | null;
  residente_data_nascimento: string | null;
  residente_observacoes: string | null;
  valor_mensalidade: number | null;
  dia_vencimento: number | null;
  forma_pagamento: string | null;
  data_inicio_contrato: string | null;
  data_fim_contrato: string | null;
  observacoes_empresa: string | null;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  aguardando_contratante: { label: "Aguardando Contratante", variant: "outline" },
  aguardando_empresa: { label: "Aguardando Empresa", variant: "secondary" },
  contrato_gerado: { label: "Contrato Gerado", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

function valorPorExtenso(valor: number): string {
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezADezenove = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const parteInteira = Math.floor(valor);
  const centavos = Math.round((valor - parteInteira) * 100);
  const converterCentena = (num: number): string => {
    if (num === 0) return '';
    if (num === 100) return 'cem';
    const c = Math.floor(num / 100), d = Math.floor((num % 100) / 10), u = num % 10;
    let r = centenas[c];
    if (d === 1) { r += (r ? ' e ' : '') + dezADezenove[u]; }
    else { if (d > 0) r += (r ? ' e ' : '') + dezenas[d]; if (u > 0) r += (r ? ' e ' : '') + unidades[u]; }
    return r;
  };
  const converterMilhar = (num: number): string => {
    if (num === 0) return 'zero';
    if (num < 1000) return converterCentena(num);
    const milhares = Math.floor(num / 1000), resto = num % 1000;
    let r = milhares === 1 ? 'mil' : converterCentena(milhares) + ' mil';
    if (resto > 0) r += ' e ' + converterCentena(resto);
    return r;
  };
  let extenso = converterMilhar(parteInteira) + (parteInteira === 1 ? ' real' : ' reais');
  if (centavos > 0) extenso += ' e ' + converterCentena(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
  return extenso;
}

function generateTemporaryContractHTML(s: Solicitacao, empresaConfig: any) {
  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  const formatarData = (data: string) =>
    format(new Date(data + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const getFormaPagamentoLabel = (forma: string) => {
    const labels: Record<string, string> = {
      boleto: "Boleto Bancário", pix: "PIX", transferencia: "Transferência Bancária",
      dinheiro: "Dinheiro", cartao: "Cartão de Crédito"
    };
    return labels[forma] || forma;
  };

  const nomeEmpresa = empresaConfig?.nome_empresa || "LE JARDIN RESIDENCIAL SÊNIOR LTDA ME";
  const cnpj = empresaConfig?.cnpj || "48.897.411/0001-58";
  const endereco = empresaConfig?.endereco || "Rua Promotor Arquibaldo Mendonça, 660, Bairro Suíssa, Aracaju/SE";
  const cidade = empresaConfig?.cidade || "Aracaju";
  const logoUrl = empresaConfig?.logo_url || "";
  const hoje = hojeExtenso();

  return `
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="Logotipo" style="max-height:60px;margin:0 auto 8px;display:block;" />` : ''}
      <h1>${nomeEmpresa}</h1>
      ${cnpj ? `<p style="font-size:10pt;margin:3px 0 0">CNPJ: ${cnpj}</p>` : ''}
      <h2>Contrato de Prestação de Serviços – Curta Temporada</h2>
    </div>

    <div class="tipo-doc">CONTRATO DE HOSPEDAGEM TEMPORÁRIA<br/>Instituição de Longa Permanência para Idosos</div>

    <p class="justify">Pelo presente instrumento particular de Contrato de Prestação de Serviços de Hospedagem Temporária, de um lado:</p>

    <div class="info-box">
      <p class="justify"><strong>CONTRATADA:</strong> <strong>${nomeEmpresa}</strong>, pessoa jurídica de direito privado, com sede em ${endereco}, inscrita no CNPJ sob o nº ${cnpj}.</p>
    </div>

    <div class="info-box">
      <p class="justify"><strong>CONTRATANTE:</strong> <strong>${s.contratante_nome || "_______________"}</strong>${s.contratante_cpf ? `, CPF nº ${s.contratante_cpf}` : ''}${s.contratante_rg ? `, RG nº ${s.contratante_rg}` : ''}${s.contratante_endereco ? `, residente em ${s.contratante_endereco}` : ''}${s.contratante_telefone ? `, Tel: ${s.contratante_telefone}` : ''}${s.contratante_email ? `, E-mail: ${s.contratante_email}` : ''}.</p>
    </div>

    <div class="info-box">
      <p class="justify"><strong>RESIDENTE (Hóspede):</strong> <strong>${s.residente_nome || "_______________"}</strong>${s.residente_cpf ? `, CPF nº ${s.residente_cpf}` : ''}${s.residente_data_nascimento ? `, nascido(a) em ${formatarData(s.residente_data_nascimento)}` : ''}.</p>
    </div>

    <p class="justify" style="margin-top:12px">Têm entre si, justo e contratado, o presente Contrato de Hospedagem Temporária que se regerá pelas cláusulas e condições seguintes:</p>

    <h3 class="clausula">CLÁUSULA PRIMEIRA: DO OBJETO</h3>
    <p class="justify"><strong>1.</strong> O objeto do presente contrato consiste na prestação de serviços de hospedagem temporária em Instituição de Longa Permanência para Idosos, pelo período determinado neste instrumento.</p>
    <p class="justify"><strong>1.1.</strong> Serviços inclusos durante a hospedagem:</p>
    <div class="lista">
      <p><strong>I –</strong> Acomodação em quarto;</p>
      <p><strong>II –</strong> Fornecimento de refeições diárias;</p>
      <p><strong>III –</strong> Serviços de limpeza e higienização;</p>
      <p><strong>IV –</strong> Roupa de cama e banho;</p>
      <p><strong>V –</strong> Acompanhamento por cuidadores capacitados;</p>
      <p><strong>VI –</strong> Participação em atividades recreativas e de lazer.</p>
    </div>
    <p class="justify"><strong>1.2.</strong> Não estão incluídos: fraldas descartáveis, medicamentos de uso pessoal, materiais de higiene pessoal, transporte externo, consultas médicas e exames.</p>

    <h3 class="clausula">CLÁUSULA SEGUNDA: DO VALOR E PAGAMENTO</h3>
    <p class="justify"><strong>2.</strong> Pelos serviços descritos, o CONTRATANTE pagará à CONTRATADA o valor total de <strong>${s.valor_mensalidade ? formatarMoeda(s.valor_mensalidade) : "_______________"}</strong>${s.valor_mensalidade ? ` (${valorPorExtenso(s.valor_mensalidade)})` : ''}, referente a todo o período de hospedagem estabelecido neste contrato.</p>
    <p class="justify"><strong>2.1.</strong> O pagamento será realizado da seguinte forma:</p>
    <div class="lista">
      <p><strong>I –</strong> <strong>Sinal de reserva:</strong> 30% (trinta por cento) do valor total, correspondente a <strong>${s.valor_mensalidade ? formatarMoeda(s.valor_mensalidade * 0.3) : "_______________"}</strong>${s.valor_mensalidade ? ` (${valorPorExtenso(s.valor_mensalidade * 0.3)})` : ''}, a ser pago no ato da contratação para garantia da reserva. <strong>Este valor não é reembolsável</strong> em caso de desistência por parte do CONTRATANTE.</p>
      <p><strong>II –</strong> <strong>Saldo restante:</strong> 70% (setenta por cento) do valor total, correspondente a <strong>${s.valor_mensalidade ? formatarMoeda(s.valor_mensalidade * 0.7) : "_______________"}</strong>${s.valor_mensalidade ? ` (${valorPorExtenso(s.valor_mensalidade * 0.7)})` : ''}, a ser pago na data de entrada (hospedagem) do residente na instituição.</p>
    </div>
    <p class="justify"><strong>2.2.</strong> A forma de pagamento será via <strong>${s.forma_pagamento ? getFormaPagamentoLabel(s.forma_pagamento) : "_______________"}</strong>.</p>
    <p class="justify small"><strong>2.3.</strong> Atraso no pagamento do saldo restante: multa de 2% e juros de 1% ao mês.</p>
    <p class="justify small"><strong>2.4.</strong> O não pagamento do saldo restante até a data de entrada autoriza o cancelamento da reserva sem restituição do sinal.</p>

    <h3 class="clausula">CLÁUSULA TERCEIRA: DA VIGÊNCIA</h3>
    <p class="justify"><strong>3.</strong> O presente contrato tem vigência determinada, com início em <strong>${s.data_inicio_contrato ? formatarData(s.data_inicio_contrato) : "_______________"}</strong> e término em <strong>${s.data_fim_contrato ? formatarData(s.data_fim_contrato) : "_______________"}</strong>.</p>
    <p class="justify small"><strong>3.1.</strong> A renovação ou prorrogação dependerá de acordo expresso entre as partes.</p>
    <p class="justify small"><strong>3.2.</strong> A permanência além do período contratado sem novo acordo será cobrada proporcionalmente com acréscimo de 20%.</p>

    <h3 class="clausula">CLÁUSULA QUARTA: DAS OBRIGAÇÕES DO CONTRATANTE</h3>
    <p class="justify small"><strong>4.</strong> Informar dados de saúde, medicamentos em uso, alergias e restrições alimentares.</p>
    <p class="justify small"><strong>4.1.</strong> Realizar pagamentos nos prazos estabelecidos.</p>
    <p class="justify small"><strong>4.2.</strong> Respeitar normas e regulamentos da Instituição.</p>
    <p class="justify small"><strong>4.3.</strong> Manter contato atualizado para emergências.</p>

    <h3 class="clausula">CLÁUSULA QUINTA: DAS OBRIGAÇÕES DA CONTRATADA</h3>
    <p class="justify small"><strong>5.</strong> Prestar serviços conforme descrito na Cláusula Primeira.</p>
    <p class="justify small"><strong>5.1.</strong> Comunicar imediatamente ao CONTRATANTE qualquer ocorrência relevante.</p>
    <p class="justify small"><strong>5.2.</strong> Em caso de urgência/emergência, encaminhar ao hospital mais próximo com aviso imediato.</p>

    <h3 class="clausula">CLÁUSULA SEXTA: DA RESCISÃO</h3>
    <p class="justify small"><strong>6.</strong> Em caso de desistência pelo CONTRATANTE antes do início da hospedagem, o sinal de 30% (trinta por cento) <strong>não será restituído</strong>, a título de indenização pela reserva.</p>
    <p class="justify small"><strong>6.1.</strong> Em caso de desistência após o início da hospedagem, não haverá restituição de valores já pagos, podendo haver cobrança proporcional de dias utilizados caso o saldo restante não tenha sido quitado integralmente.</p>
    <p class="justify small"><strong>6.2.</strong> Rescisão por iniciativa da CONTRATADA, sem justa causa, obriga a devolução integral dos valores pagos.</p>
    <p class="justify small"><strong>6.3.</strong> Descumprimento de cláusulas autoriza rescisão imediata sem ônus para a parte prejudicada.</p>

    <h3 class="clausula">CLÁUSULA SÉTIMA: DAS DISPOSIÇÕES GERAIS</h3>
    <p class="justify small"><strong>7.</strong> Tolerância não constitui novação ou renúncia de direitos.</p>
    <p class="justify small"><strong>7.1.</strong> Foro da Comarca de ${cidade} para dirimir quaisquer dúvidas.</p>

    ${s.observacoes_empresa ? `
      <h3 class="clausula">OBSERVAÇÕES DA EMPRESA</h3>
      <p class="justify small">${s.observacoes_empresa.replace(/\n/g, '<br/>')}</p>
    ` : ''}

    ${s.residente_observacoes ? `
      <h3 class="clausula">OBSERVAÇÕES DO CONTRATANTE</h3>
      <p class="justify small">${s.residente_observacoes.replace(/\n/g, '<br/>')}</p>
    ` : ''}

    <p class="justify" style="margin-top:15px">E assim, por estarem justas e contratadas, as PARTES firmam o presente instrumento em duas vias de igual teor, na presença de 02 (duas) testemunhas.</p>

    <div class="data-local">
      <p>${cidade}, ${hoje}</p>
    </div>

    <div class="assinaturas">
      <div class="assinatura-row">
        <div class="assinatura-item">
          <div class="assinatura-linha">
            <p><strong>${nomeEmpresa}</strong></p>
            <p>CONTRATADA</p>
          </div>
        </div>
        <div class="assinatura-item">
          <div class="assinatura-linha">
            <p><strong>${s.contratante_nome || "_______________"}</strong></p>
            <p>CONTRATANTE</p>
          </div>
        </div>
      </div>
      <div class="assinatura-row">
        <div class="assinatura-item">
          <div class="assinatura-linha">
            <p><strong>Testemunha 1</strong></p>
            <p>Nome: _______________________</p>
            <p>CPF: _______________________</p>
          </div>
        </div>
        <div class="assinatura-item">
          <div class="assinatura-linha">
            <p><strong>Testemunha 2</strong></p>
            <p>Nome: _______________________</p>
            <p>CPF: _______________________</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getContractStyleSheet() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; color: #000; padding: 20px 50px; }
    .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 8px; }
    .header h1 { font-size: 15pt; font-weight: bold; margin-bottom: 2px; letter-spacing: 1px; }
    .header h2 { font-size: 12pt; font-weight: normal; color: #333; }
    .tipo-doc { text-align: center; font-size: 13pt; font-weight: bold; margin: 12px 0; text-decoration: underline; letter-spacing: 1px; }
    .info-box { border: 1px solid #333; padding: 8px 12px; margin: 8px 0; }
    .clausula { font-weight: bold; font-size: 12pt; margin: 14px 0 6px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
    .justify { text-align: justify; margin-bottom: 4px; }
    .small { font-size: 10.5pt; }
    .lista { margin-left: 20px; margin-bottom: 6px; }
    .lista p { margin-bottom: 2px; }
    .data-local { text-align: right; margin: 20px 0; font-size: 12pt; }
    .assinaturas { margin-top: 30px; }
    .assinatura-row { display: flex; justify-content: space-between; margin-bottom: 35px; }
    .assinatura-item { text-align: center; width: 45%; }
    .assinatura-linha { border-top: 1px solid #000; padding-top: 4px; margin-top: 30px; font-size: 10.5pt; }
    @media print { body { padding: 15px 40px; } }
  `;
}

export default function ContratosTemporarios() {
  const { toast } = useToast();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<Solicitacao | null>(null);
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [empresaConfig, setEmpresaConfig] = useState<any>(null);

  const [valorMensalidade, setValorMensalidade] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("10");
  const [formaPagamento, setFormaPagamento] = useState("boleto");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [obsEmpresa, setObsEmpresa] = useState("");

  const fetchSolicitacoes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("solicitacoes_contrato_temporario" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSolicitacoes(data as any);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSolicitacoes();
  }, [fetchSolicitacoes]);

  useEffect(() => {
    async function fetchEmpresa() {
      const { data } = await supabase
        .from("configuracoes_empresa")
        .select("nome_empresa, cnpj, logo_url, cidade, endereco")
        .limit(1)
        .single();
      if (data) setEmpresaConfig(data);
    }
    fetchEmpresa();
  }, []);

  const criarNovaSolicitacao = async () => {
    setCreating(true);
    const { data, error } = await supabase
      .from("solicitacoes_contrato_temporario" as any)
      .insert({ status: "aguardando_contratante" } as any)
      .select()
      .single();

    if (error) {
      toast({ title: "Erro", description: "Não foi possível criar o link.", variant: "destructive" });
    } else {
      toast({ title: "Link criado!", description: "Copie o link e envie ao contratante." });
      fetchSolicitacoes();
    }
    setCreating(false);
  };

  const copiarLink = (token: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/contrato-temporario/${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copiado!", description: "Cole e envie ao contratante." });
  };

  const abrirFinalizar = (s: Solicitacao) => {
    setSelectedSolicitacao(s);
    setValorMensalidade(s.valor_mensalidade?.toString() || "");
    setDiaVencimento(s.dia_vencimento?.toString() || "10");
    setFormaPagamento(s.forma_pagamento || "boleto");
    setDataInicio(s.data_inicio_contrato || "");
    setDataFim(s.data_fim_contrato || "");
    setObsEmpresa(s.observacoes_empresa || "");
    setShowFinalizarDialog(true);
  };

  const finalizarContrato = async () => {
    if (!selectedSolicitacao || !valorMensalidade || !dataInicio || !dataFim) {
      toast({ title: "Campos obrigatórios", description: "Preencha valor, data de início e data de fim.", variant: "destructive" });
      return;
    }

    setFinalizando(true);

    const { error } = await supabase
      .from("solicitacoes_contrato_temporario" as any)
      .update({
        valor_mensalidade: parseFloat(valorMensalidade),
        dia_vencimento: parseInt(diaVencimento),
        forma_pagamento: formaPagamento,
        data_inicio_contrato: dataInicio,
        data_fim_contrato: dataFim,
        observacoes_empresa: obsEmpresa,
        status: "contrato_gerado",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", selectedSolicitacao.id);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível finalizar.", variant: "destructive" });
    } else {
      toast({ title: "Contrato finalizado!", description: "O contrato temporário foi registrado com sucesso." });
      setShowFinalizarDialog(false);
      fetchSolicitacoes();
    }
    setFinalizando(false);
  };

  const cancelarSolicitacao = async (id: string) => {
    const { error } = await supabase
      .from("solicitacoes_contrato_temporario" as any)
      .update({ status: "cancelado", updated_at: new Date().toISOString() } as any)
      .eq("id", id);

    if (!error) {
      toast({ title: "Solicitação cancelada" });
      fetchSolicitacoes();
    }
  };

  const imprimirContrato = (s: Solicitacao) => {
    const htmlContent = generateTemporaryContractHTML(s, empresaConfig);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({ title: "Erro", description: "Não foi possível abrir a janela de impressão. Verifique se popups estão permitidos.", variant: "destructive" });
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Contrato Temporário - ${s.contratante_nome || "Sem nome"}</title>
        <style>${getContractStyleSheet()}</style>
      </head>
      <body>${htmlContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const formatarMoeda = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Contratos Temporários</h2>
          <p className="text-sm text-muted-foreground">Contratos de curta temporada (menos de 1 ano)</p>
        </div>
        <Button onClick={criarNovaSolicitacao} disabled={creating}>
          {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Gerar Link
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : solicitacoes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum contrato temporário ainda.</p>
            <p className="text-sm text-muted-foreground mt-1">Clique em "Gerar Link" para criar um link de preenchimento para o contratante.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contratante</TableHead>
                  <TableHead>Residente</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitacoes.map((s) => {
                  const st = statusConfig[s.status] || statusConfig.aguardando_contratante;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{s.contratante_nome || "—"}</span>
                          {s.contratante_telefone && (
                            <p className="text-xs text-muted-foreground">{s.contratante_telefone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{s.residente_nome || "—"}</TableCell>
                      <TableCell>
                        {s.data_inicio_contrato && s.data_fim_contrato
                          ? `${format(new Date(s.data_inicio_contrato + "T12:00:00"), "dd/MM/yy")} - ${format(new Date(s.data_fim_contrato + "T12:00:00"), "dd/MM/yy")}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {s.valor_mensalidade ? (
                          <div>
                            <span className="font-medium">{formatarMoeda(s.valor_mensalidade)}</span>
                            <p className="text-xs text-muted-foreground">Sinal: {formatarMoeda(s.valor_mensalidade * 0.3)}</p>
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {s.status === "aguardando_contratante" && (
                            <Button size="sm" variant="outline" onClick={() => copiarLink(s.token)} title="Copiar link">
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {s.status === "aguardando_empresa" && (
                            <Button size="sm" onClick={() => abrirFinalizar(s)}>
                              <Check className="w-3.5 h-3.5 mr-1" /> Finalizar
                            </Button>
                          )}
                          {s.status === "contrato_gerado" && (
                            <Button size="sm" variant="outline" onClick={() => imprimirContrato(s)} title="Imprimir contrato">
                              <Printer className="w-3.5 h-3.5 mr-1" /> Imprimir
                            </Button>
                          )}
                          {(s.status === "aguardando_contratante" || s.status === "aguardando_empresa") && (
                            <Button size="sm" variant="destructive" onClick={() => cancelarSolicitacao(s.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog para finalizar contrato */}
      <Dialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Finalizar Contrato Temporário</DialogTitle>
            <DialogDescription>
              Dados do contratante: <strong>{selectedSolicitacao?.contratante_nome}</strong>
              <br />
              Residente: <strong>{selectedSolicitacao?.residente_nome}</strong>
              {selectedSolicitacao?.residente_observacoes && (
                <span className="block mt-1 text-xs">Obs: {selectedSolicitacao.residente_observacoes}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Valor Total do Período (R$) *</Label>
              <Input type="number" step="0.01" value={valorMensalidade} onChange={(e) => setValorMensalidade(e.target.value)} placeholder="0,00" />
              {valorMensalidade && parseFloat(valorMensalidade) > 0 && (
                <div className="mt-2 p-3 rounded-md bg-muted text-sm space-y-1">
                  <p className="text-muted-foreground">
                    <strong>Sinal (30%):</strong>{" "}
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(valorMensalidade) * 0.3)}
                    <span className="text-xs ml-1">(não reembolsável)</span>
                  </p>
                  <p className="text-muted-foreground">
                    <strong>Restante (70%):</strong>{" "}
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(valorMensalidade) * 0.7)}
                    <span className="text-xs ml-1">(na hospedagem)</span>
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Início *</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div>
                <Label>Data de Fim *</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Observações da Empresa</Label>
              <Textarea value={obsEmpresa} onChange={(e) => setObsEmpresa(e.target.value)} rows={2} />
            </div>

            <Button onClick={finalizarContrato} className="w-full" disabled={finalizando}>
              {finalizando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Confirmar e Gerar Contrato
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
