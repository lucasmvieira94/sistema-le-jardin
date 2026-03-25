import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileDown, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { ContratoData, ResidenteData, EmpresaData } from "./types";

interface ContratoPDFGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato: ContratoData;
  residente: ResidenteData;
  empresa?: EmpresaData;
}

export default function ContratoPDFGenerator({
  open,
  onOpenChange,
  contrato,
  residente,
  empresa
}: ContratoPDFGeneratorProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [empresaConfig, setEmpresaConfig] = useState<{
    nome_empresa: string;
    cnpj: string | null;
    logo_url: string | null;
    cidade: string | null;
    endereco: string | null;
  } | null>(null);

  useEffect(() => {
    async function fetchEmpresa() {
      const { data } = await supabase
        .from("configuracoes_empresa")
        .select("nome_empresa, cnpj, logo_url, cidade, endereco")
        .limit(1)
        .single();
      if (data) setEmpresaConfig(data);
    }
    if (open) fetchEmpresa();
  }, [open]);

  const generateContractHTML = () => {
    const formatarMoeda = (valor: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

    const formatarData = (data: string) =>
      format(new Date(data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    const getFormaPagamentoLabel = (forma: string) => {
      const labels: Record<string, string> = {
        boleto: "Boleto Bancário", pix: "PIX", transferencia: "Transferência Bancária",
        dinheiro: "Dinheiro", cartao: "Cartão de Crédito"
      };
      return labels[forma] || forma;
    };

    const calcularIdade = (dataNascimento: string) => {
      const hoje = new Date();
      const nascimento = new Date(dataNascimento);
      let idade = hoje.getFullYear() - nascimento.getFullYear();
      if (hoje.getMonth() < nascimento.getMonth() || (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate())) idade--;
      return idade;
    };

    const valorAdicionalNatalino = contrato.valor_mensalidade;
    const parcelaAdicionalNatalino = valorAdicionalNatalino / 12;
    const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const nomeEmpresa = empresaConfig?.nome_empresa || empresa?.nome_empresa || "EMPRESA";
    const cnpj = empresaConfig?.cnpj || empresa?.cnpj || "";
    const cidade = empresaConfig?.cidade || "";
    const logoUrl = empresaConfig?.logo_url || "";

    return `
      <div class="header">
        ${logoUrl ? `<img src="${logoUrl}" alt="Logotipo" style="max-height:60px;margin:0 auto 8px;display:block;" />` : ''}
        <h1>${nomeEmpresa}</h1>
        ${cnpj ? `<p style="font-size:10pt;margin:3px 0 0">CNPJ: ${cnpj}</p>` : ''}
        <h2>Contrato de Prestação de Serviços</h2>
        <p style="font-size:9pt;margin-top:4px;color:#555">Contrato nº ${contrato.numero_contrato}</p>
      </div>

      <div class="tipo-doc">CONTRATO DE PRESTAÇÃO DE SERVIÇOS<br/>Instituição de Longa Permanência para Idosos</div>

      <p class="justify">Pelo presente instrumento particular de Contrato de Prestação de Serviços, de um lado:</p>

      <div class="info-box">
        <p class="justify"><strong>CONTRATADA:</strong> <strong>LE JARDIN RESIDENCIAL SÊNIOR LTDA ME</strong>, pessoa jurídica de direito privado, com sede na Rua Promotor Arquibaldo Mendonça, 660, Bairro Suíssa, Aracaju/SE, inscrita no CNPJ sob o nº 48.897.411/0001-58, neste ato representado pela sócia Rosângela Moraes Sobral.</p>
      </div>

      <div class="info-box">
        <p class="justify"><strong>CONTRATANTE:</strong> <strong>${contrato.contratante_nome}</strong>${contrato.contratante_cpf ? `, CPF nº ${contrato.contratante_cpf}` : ''}${contrato.contratante_rg ? `, RG nº ${contrato.contratante_rg}` : ''}${contrato.contratante_endereco ? `, residente em ${contrato.contratante_endereco}` : ''}${contrato.contratante_cidade && contrato.contratante_estado ? `, ${contrato.contratante_cidade}/${contrato.contratante_estado}` : ''}${contrato.contratante_cep ? `, CEP ${contrato.contratante_cep}` : ''}${contrato.contratante_telefone ? `, Tel: ${contrato.contratante_telefone}` : ''}.</p>
      </div>

      <div class="info-box">
        <p class="justify"><strong>ANUENTE (Residente):</strong> <strong>${residente.nome_completo}</strong>${residente.cpf ? `, CPF nº ${residente.cpf}` : ''}, nascido(a) em ${formatarData(residente.data_nascimento)}, ${calcularIdade(residente.data_nascimento)} anos, prontuário nº ${residente.numero_prontuario}${residente.quarto ? `, quarto ${residente.quarto}` : ''}.</p>
      </div>

      <p class="justify" style="margin-top:12px">Têm entre si, justo e contratado, o presente Contrato que se regerá pelas cláusulas e condições seguintes:</p>

      <!-- CLÁUSULA PRIMEIRA -->
      <h3 class="clausula">CLÁUSULA PRIMEIRA: DO OBJETO</h3>
      <p class="justify"><strong>1.</strong> O objeto do presente contrato consiste na prestação de serviços de Instituição de Longa Permanência, destinada ao domicílio coletivo de pessoas com idade igual ou superior a 60 (sessenta) anos.</p>
      <p class="justify"><strong>1.1.</strong> Serviços inclusos:</p>
      <div class="lista">
        <p><strong>I –</strong> Acomodação em ${residente.quarto ? `QUARTO ${residente.quarto.toUpperCase()}` : 'QUARTO'}, sala coletiva de TV, sala de atendimento de enfermagem, recreação e lazer;</p>
        <p><strong>II –</strong> Fornecimento mínimo de 05 (cinco) refeições diárias;</p>
        <p><strong>III –</strong> Serviços de limpeza diária;</p>
        <p><strong>IV –</strong> Roupa de cama e banho;</p>
        <p><strong>V –</strong> Serviços de lavanderia;</p>
        <p><strong>VI –</strong> Atividades coordenadas por profissionais capacitados;</p>
        <p><strong>VII –</strong> Atividades de preservação do vínculo familiar.</p>
      </div>
      <p class="justify"><strong>1.2.</strong> Não estão incluídos:</p>
      <div class="lista small">
        <p><strong>I –</strong> Profissionais para serviços externos (consultas, acompanhamento hospitalar, etc.);</p>
        <p><strong>II –</strong> Fraldas descartáveis, materiais de higiene pessoal;</p>
        <p><strong>III –</strong> Materiais para curativos e sondas;</p>
        <p><strong>IV –</strong> Medicação e suplementos de uso particular;</p>
        <p><strong>V –</strong> Vestuário pessoal;</p>
        <p><strong>VI –</strong> Fisioterapia de reabilitação;</p>
        <p><strong>VII –</strong> Exames complementares;</p>
        <p><strong>VIII –</strong> Consultas médicas de urgência;</p>
        <p><strong>IX –</strong> Aluguel de aparelhos hospitalares;</p>
        <p><strong>X –</strong> Oxigênio;</p>
        <p><strong>XI –</strong> Transporte a consultas e exames;</p>
        <p><strong>XII –</strong> Transporte em ambulância/táxi;</p>
        <p><strong>XIII –</strong> Tratamentos de beleza e estética;</p>
        <p><strong>XIV –</strong> Outros extras de caráter pessoal;</p>
        <p><strong>XV –</strong> Extras faturados juntamente com a mensalidade;</p>
        <p><strong>XVI –</strong> Alimentos de uso pessoal e específico.</p>
      </div>

      <!-- CLÁUSULA SEGUNDA -->
      <h3 class="clausula">CLÁUSULA SEGUNDA: DO VALOR</h3>
      <p class="justify"><strong>2.</strong> Pelos serviços descritos, o CONTRATANTE pagará à CONTRATADA conforme o Grau de Dependência do Idoso:</p>
      <div class="lista small">
        <p><strong>A)</strong> Indivíduo Autônomo – detém poder decisório e controle sobre a sua vida.</p>
        <p><strong>B)</strong> Grau I – independentes, mesmo com equipamentos de autoajuda;</p>
        <p><strong>C)</strong> Grau II – dependência em até três atividades de autocuidado;</p>
        <p><strong>D)</strong> Grau III – dependência que requer assistência em todas as atividades.</p>
      </div>
      <p class="justify small"><strong>Parágrafo Único:</strong> A Avaliação de Grau de Dependência ocorrerá no acolhimento e poderá ser revista a qualquer momento.</p>
      <p class="justify"><strong>2.1.</strong> Valor mensal: <strong>${formatarMoeda(contrato.valor_mensalidade)}</strong> (${valorPorExtenso(contrato.valor_mensalidade)}).</p>
      <p class="justify small"><strong>2.2.</strong> Alteração do Grau de Dependência acarreta atualização do valor.</p>
      <p class="justify small"><strong>2.3.</strong> Correção anual conforme tabela vigente.</p>
      <p class="justify"><strong>2.4.</strong> Pagamento até o <strong>dia ${contrato.dia_vencimento}</strong> de cada mês, via <strong>${getFormaPagamentoLabel(contrato.forma_pagamento)}</strong>.</p>
      <p class="justify small"><strong>2.5.</strong> Atraso: multa de 2% e juros de 1% ao mês (Art. 52, §1º, CDC).</p>
      <p class="justify small"><strong>2.6.</strong> Inadimplência superior a 30 dias implica retirada imediata do residente.</p>
      <p class="justify small"><strong>2.7.</strong> Não haverá restituição de importâncias já pagas.</p>
      <p class="justify small"><strong>2.8.</strong> Acolhimento condicionado ao pagamento de uma mensalidade de garantia.</p>
      <p class="justify small"><strong>2.9.</strong> Garantia devolvida ao final do contrato, com possíveis descontos para reparos.</p>
      <p class="justify small"><strong>2.10.</strong> Rescisão sem aviso prévio não gera reembolso da garantia.</p>
      <p class="justify small"><strong>2.11.</strong> Carência de 10 dias para adaptação.</p>
      <p class="justify small"><strong>2.12.</strong> Despesas extras comprovadas serão cobradas junto à mensalidade.</p>
      <p class="justify small"><strong>2.13. ADICIONAL NATALINO:</strong> Taxa de 100% sobre a mensalidade, em 12x de ${formatarMoeda(parcelaAdicionalNatalino)}.</p>

      <!-- CLÁUSULA TERCEIRA -->
      <h3 class="clausula">CLÁUSULA TERCEIRA: DAS OBRIGAÇÕES DO CONTRATANTE</h3>
      <p class="justify small"><strong>3.</strong> Indicar dados de profissionais de saúde em até 48h.</p>
      <p class="justify small"><strong>3.1.</strong> Informar medicamentos, alergias, patologias e receituários.</p>
      <p class="justify small"><strong>3.2.</strong> Realizar pagamentos nos prazos estabelecidos.</p>
      <p class="justify small"><strong>3.3.</strong> Fornecer relação de bens e pertences pessoais.</p>
      <p class="justify small"><strong>3.4.</strong> Respeitar normas e regulamentos da Instituição.</p>

      <!-- CLÁUSULA QUARTA -->
      <h3 class="clausula">CLÁUSULA QUARTA: DAS OBRIGAÇÕES DA CONTRATADA</h3>
      <p class="justify small"><strong>4.</strong> Manter padrões de habitação conforme RDC 283 e Estatuto do Idoso.</p>
      <p class="justify small"><strong>4.1.</strong> Atender aos princípios dos Art. 49 e 50 do Estatuto do Idoso:</p>
      <div class="lista small">
        <p><strong>I –</strong> Preservação dos vínculos familiares;</p>
        <p><strong>II –</strong> Atendimento personalizado;</p>
        <p><strong>III –</strong> Manutenção do idoso na mesma instituição;</p>
        <p><strong>IV –</strong> Participação em atividades comunitárias;</p>
        <p><strong>V –</strong> Observância dos direitos dos idosos;</p>
        <p><strong>VI –</strong> Preservação da identidade e dignidade;</p>
        <p><strong>VII –</strong> Acomodações para visitas;</p>
        <p><strong>VIII –</strong> Cuidados à saúde;</p>
        <p><strong>IX –</strong> Atividades educacionais, culturais e de lazer;</p>
        <p><strong>X –</strong> Assistência religiosa;</p>
        <p><strong>XI –</strong> Estudo social de cada caso;</p>
        <p><strong>XII –</strong> Comunicação de doenças infectocontagiosas;</p>
        <p><strong>XIII –</strong> Documentos de cidadania;</p>
        <p><strong>XIV –</strong> Arquivo de anotações;</p>
        <p><strong>XV –</strong> Comunicação ao MP em caso de abandono.</p>
      </div>
      <p class="justify small"><strong>4.2.</strong> Preservar identidade e privacidade, agindo com boa-fé.</p>
      <p class="justify small"><strong>4.3.</strong> Quadro de profissionais: Assistente Social, Nutricionista, Fisioterapeuta, Educador Físico, Terapeuta Ocupacional e Cuidadores.</p>
      <p class="justify small"><strong>4.4.</strong> Em urgência/emergência, encaminhamento ao hospital autorizado com aviso imediato.</p>

      <!-- CLÁUSULA QUINTA -->
      <h3 class="clausula">CLÁUSULA QUINTA: DA VIGÊNCIA</h3>
      <p class="justify"><strong>5.</strong> Vigência de 12 meses a partir de <strong>${formatarData(contrato.data_inicio_contrato)}</strong>${contrato.data_fim_contrato ? `, com término em <strong>${formatarData(contrato.data_fim_contrato)}</strong>` : ''}.</p>

      <!-- CLÁUSULA SEXTA -->
      <h3 class="clausula">CLÁUSULA SEXTA: DA RESCISÃO</h3>
      <p class="justify"><strong>6.</strong> Rescisão mediante aviso prévio de 30 dias.</p>
      <p class="justify small"><strong>6.1.</strong> Descumprimento do aviso prévio: indenização de uma mensalidade.</p>
      <p class="justify small"><strong>6.2.</strong> Rescisão unilateral imediata nos casos:</p>
      <div class="lista small">
        <p><strong>I –</strong> Atraso superior a 30 dias;</p>
        <p><strong>II –</strong> Descumprimento de cláusulas;</p>
        <p><strong>III –</strong> Mudança de grau de dependência.</p>
      </div>
      <p class="justify small"><strong>6.3.</strong> Falecimento: pagamento do mês do falecimento.</p>

      <!-- CLÁUSULA SÉTIMA -->
      <h3 class="clausula">CLÁUSULA SÉTIMA: DAS DISPOSIÇÕES GERAIS</h3>
      <p class="justify small"><strong>7.</strong> Cláusulas válidas até rescisão conforme Cláusula Sexta.</p>
      <p class="justify small"><strong>7.1.</strong> Tolerância não constitui novação ou renúncia.</p>
      <p class="justify small"><strong>7.2.</strong> Instalações monitoradas com vídeo vigilância.</p>
      <p class="justify small"><strong>7.3.</strong> Fotos/filmagens para uso exclusivo em redes sociais e grupos de familiares.</p>
      <p class="justify small"><strong>7.4.</strong> Ausência de subordinação entre as partes.</p>
      <p class="justify small"><strong>7.5.</strong> Obrigação de fornecer cópia do contrato ao CONTRATANTE.</p>
      <p class="justify small"><strong>7.6.</strong> Foro da Comarca da CONTRATADA.</p>

      ${contrato.clausulas_especiais ? `
        <h3 class="clausula">CLÁUSULA OITAVA: CLÁUSULAS ESPECIAIS</h3>
        <p class="justify small">${contrato.clausulas_especiais.replace(/\n/g, '<br/>')}</p>
      ` : ''}

      ${contrato.observacoes ? `
        <h3 class="clausula">OBSERVAÇÕES</h3>
        <p class="justify small">${contrato.observacoes.replace(/\n/g, '<br/>')}</p>
      ` : ''}

      <p class="justify" style="margin-top:15px">E assim, por estarem justas e contratadas, as PARTES firmam o presente instrumento em duas vias de igual teor, na presença de 02 (duas) testemunhas.</p>

      <div class="data-local">
        <p>${cidade || "_________________"}, ${hoje}</p>
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
              <p><strong>${contrato.contratante_nome}</strong></p>
              <p>CONTRATANTE</p>
            </div>
          </div>
        </div>

        <div class="assinatura-row" style="justify-content:center;">
          <div class="assinatura-item">
            <div class="assinatura-linha">
              <p><strong>${residente.nome_completo}</strong></p>
              <p>ANUENTE (Residente)</p>
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
  };

  const getStyleSheet = () => `
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

  const handlePrint = () => {
    const htmlContent = generateContractHTML();
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Contrato nº ${contrato.numero_contrato}</title>
        <style>${getStyleSheet()}</style>
      </head>
      <body>${htmlContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;

    try {
      toast({ title: "Gerando PDF...", description: "Aguarde enquanto o documento é gerado." });

      // Create a temporary hidden container with print styles
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '210mm';
      tempContainer.style.backgroundColor = '#ffffff';
      tempContainer.style.fontFamily = "'Times New Roman', Times, serif";
      tempContainer.style.fontSize = '12pt';
      tempContainer.style.lineHeight = '1.5';
      tempContainer.style.padding = '20px 50px';
      tempContainer.style.color = '#000';
      tempContainer.innerHTML = generateContractHTML();

      // Apply inline styles for rendering
      const style = document.createElement('style');
      style.textContent = getStyleSheet();
      tempContainer.prepend(style);

      document.body.appendChild(tempContainer);

      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: tempContainer.scrollWidth,
        height: tempContainer.scrollHeight,
      });

      document.body.removeChild(tempContainer);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      const pageHeight = pdfHeight;
      let position = 0;
      let page = 0;

      while (position < scaledHeight) {
        if (page > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -position, pdfWidth, scaledHeight);
        position += pageHeight;
        page++;
      }

      const fileName = `Contrato_${contrato.numero_contrato.replace(/\//g, '-')}_${residente.nome_completo.split(' ')[0]}.pdf`;
      pdf.save(fileName);

      toast({ title: "PDF gerado com sucesso!", description: "O download foi iniciado." });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Use a opção Imprimir para salvar como PDF.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Contrato nº {contrato.numero_contrato}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              <Button size="sm" onClick={handleDownloadPDF}>
                <FileDown className="w-4 h-4 mr-2" />
                Baixar PDF
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            Visualize, imprima ou baixe o contrato em PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto border rounded-lg bg-gray-100 p-4">
          <div
            ref={printRef}
            className="bg-white text-black p-8 max-w-4xl mx-auto border rounded shadow-sm"
            style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '12pt', lineHeight: '1.5' }}
            dangerouslySetInnerHTML={{ __html: generateContractHTML() }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Função auxiliar para converter valor em extenso
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
