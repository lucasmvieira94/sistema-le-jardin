import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileDown, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { hojeExtenso, formatarDataExtenso } from "@/utils/dateUtils";
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
  empresa,
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
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

    const formatarData = (data: string) => format(new Date(data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    const getFormaPagamentoLabel = (forma: string) => {
      const labels: Record<string, string> = {
        boleto: "Boleto Bancário",
        pix: "PIX",
        transferencia: "Transferência Bancária",
        dinheiro: "Dinheiro",
        cartao: "Cartão de Crédito",
      };
      return labels[forma] || forma;
    };

    const hoje = hojeExtenso();
    const nomeEmpresa = empresaConfig?.nome_empresa || empresa?.nome_empresa || "EMPRESA";
    const cnpj = empresaConfig?.cnpj || empresa?.cnpj || "";
    const cidade = empresaConfig?.cidade || "";
    const endereco = empresaConfig?.endereco || "";
    const logoUrl = empresaConfig?.logo_url || "";

    return `
      <div class="header">
        ${logoUrl ? `<img src="${logoUrl}" alt="Logotipo" style="max-height:60px;margin:0 auto 8px;display:block;" />` : ""}
        <h1>${nomeEmpresa}</h1>
        ${cnpj ? `<p style="font-size:10pt;margin:3px 0 0">CNPJ: ${cnpj}</p>` : ""}
        ${endereco ? `<p style="font-size:9pt;margin:2px 0 0">${endereco}</p>` : ""}
      </div>

      <div class="tipo-doc">CONTRATO DE PRESTAÇÃO DE SERVIÇOS<br/>Instituição de Longa Permanência para Idosos</div>

      <!-- QUALIFICAÇÃO DAS PARTES -->
      <div class="info-box">
        <p class="justify"><strong>CONTRATADA:</strong> <strong>LE JARDIN RESIDENCIAL SÊNIOR LTDA ME</strong>, pessoa jurídica de direito privado, com sede na Rua Promotor Arquibaldo Mendonça, 660, Bairro Suíssa, Aracaju/SE, inscrita no CNPJ sob o nº 48.897.411/0001-58, neste ato representada pela sócia <strong>Rosângela Moraes Sobral</strong>, Divorciada, Brasileira, Naturalidade Aracaju/SE, portadora da Cédula de Identidade R.G. nº 905.849 SSP/SE e CPF nº 532.193.685-49.</p>
      </div>

      <div class="info-box">
        <p class="justify"><strong>CONTRATANTE:</strong> <strong>${contrato.contratante_nome}</strong>, BRASILEIRO(A)${contrato.contratante_cpf ? `, portador(a) do CPF: ${contrato.contratante_cpf}` : ""}${contrato.contratante_rg ? `, RG: ${contrato.contratante_rg}` : ""}${contrato.contratante_endereco ? `, residente e domiciliado(a) na ${contrato.contratante_endereco}` : ""}${contrato.contratante_cidade && contrato.contratante_estado ? `, ${contrato.contratante_cidade}/${contrato.contratante_estado}` : ""}${contrato.contratante_cep ? `, CEP: ${contrato.contratante_cep}` : ""}, juntamente com o seu <strong>ANUENTE</strong>: <strong>${residente.nome_completo}</strong>${residente.cpf ? `, CPF: ${residente.cpf}` : ""}, DATA DE NASCIMENTO: ${formatarData(residente.data_nascimento)}.</p>
      </div>

      <p class="justify" style="margin-top:12px">Pelo presente instrumento particular, as partes acima qualificadas, doravante denominadas CONTRATANTE e CONTRATADA, na melhor forma de direito, ajustam e contratam a prestação de serviços profissionais destinados a moradia definitiva, temporária e/ou provisória de idosos nos termos da Lei 10.741/2003 (Estatuto do Idoso), segundo as cláusulas e condições adiante arroladas.</p>

      <!-- CLÁUSULA PRIMEIRA: DO OBJETO -->
      <h3 class="clausula">CLÁUSULA PRIMEIRA: DO OBJETO</h3>
      <p class="justify"><strong>1.</strong> O objeto do presente contrato consiste na prestação de serviços de Instituição de Longa Permanência, destinada ao domicílio coletivo de pessoas com idade igual ou superior a 60 (sessenta) anos.</p>
      <p class="justify"><strong>1.1.</strong> Faz parte integrante do objeto do presente instrumento a prestação dos seguintes serviços pela CONTRATADA ao CONTRATANTE:</p>
      <div class="lista">
        <p><strong>I –</strong> Acomodação em ${residente.quarto ? `QUARTO ${residente.quarto.toUpperCase()}` : "QUARTO"}, sala coletiva de TV, sala de atendimento de enfermagem, sala de atividades, recreação e lazer, sala de jantar, conforme opção do CONTRATANTE e/ou disponibilidade da CONTRATADA;</p>
        <p><strong>II –</strong> Fornecimento mínimo de 05 (cinco) refeições diárias, conforme cardápio devidamente elaborado por um nutricionista;</p>
        <p><strong>III –</strong> Serviços de limpeza diária dos quartos, banheiros e ambientes comuns da Instituição;</p>
        <p><strong>IV –</strong> Roupa de cama e banho;</p>
        <p><strong>V –</strong> Serviços de lavanderia;</p>
        <p><strong>VI –</strong> Atividades coordenadas por profissionais devidamente capacitados visando à preservação da saúde física e mental e do aperfeiçoamento moral, intelectual, espiritual e social do CONTRATANTE;</p>
        <p><strong>VII –</strong> Atividades que buscam a preservação do vínculo familiar.</p>
      </div>
      <p class="justify"><strong>1.2.</strong> Não estão incluídos no objeto deste Contrato os seguintes serviços:</p>
      <div class="lista small">
        <p><strong>I –</strong> Disponibilização de profissionais para serviços externos do CONTRATANTE como, consultas médicas, acompanhamento hospitalar, internação hospitalar, exames, dentre outros similares;</p>
        <p><strong>II –</strong> Fornecimento de fraldas descartáveis, lenços de higiene íntima, materiais de higiene pessoal em geral;</p>
        <p><strong>III –</strong> Fornecimento de materiais para curativos, material para tratar úlceras por pressão, úlcera arterial, úlcera venosa e escaras em geral, sondas e similares;</p>
        <p><strong>IV –</strong> Fornecimento de medicação e suplementos vitamínicos de uso particular;</p>
        <p><strong>V –</strong> Vestuário pessoal;</p>
        <p><strong>VI –</strong> Fisioterapia de reabilitação;</p>
        <p><strong>VII –</strong> Exames complementares de diagnóstico;</p>
        <p><strong>VIII –</strong> Consultas médicas de urgência;</p>
        <p><strong>IX –</strong> Aluguel de aparelhos hospitalares;</p>
        <p><strong>X –</strong> Oxigênio;</p>
        <p><strong>XI –</strong> Transporte a consultas externas de rotina e realização de exames;</p>
        <p><strong>XII –</strong> Transporte em ambulância e/ou táxi;</p>
        <p><strong>XIII –</strong> Tratamentos de beleza e estética;</p>
        <p><strong>XIV –</strong> Outros extras, de caráter pessoal, solicitados pelo cliente;</p>
        <p><strong>XV –</strong> Quando prestado qualquer um dos serviços enumerados, serão faturados juntamente com a mensalidade de Prestação de Serviços, especificado cada despesa como extra no final de cada mês;</p>
        <p><strong>XVI –</strong> Alimentos de uso pessoal e específico.</p>
      </div>

      <!-- CLÁUSULA SEGUNDA: DO VALOR -->
      <h3 class="clausula">CLÁUSULA SEGUNDA: DO VALOR</h3>
      <p class="justify"><strong>2.</strong> Pelos serviços descritos nas cláusulas anteriores, o CONTRATANTE pagará à CONTRATADA o valor mensal equivalente ao Grau de Dependência do Idoso:</p>
      <div class="lista small">
        <p><strong>A)</strong> Indivíduo Autônomo – é aquele que detém poder decisório e controle sobre a sua vida.</p>
        <p><strong>B)</strong> Grau de Dependência I – idosos independentes, mesmo que requeiram uso de equipamentos de autoajuda;</p>
        <p><strong>C)</strong> Grau de Dependência II – idosos com dependência em até três atividades de autocuidado para a vida diária tais como: alimentação, mobilidade, higiene; sem comprometimento cognitivo ou com alteração cognitiva controlada;</p>
        <p><strong>D)</strong> Grau de Dependência III – idosos com dependência que requeiram assistência em todas as atividades de autocuidado para a vida diária e/ou com comprometimento cognitivo.</p>
      </div>
      <p class="justify small"><strong>Parágrafo Único:</strong> A AVALIAÇÃO DE GRAU DE DEPENDÊNCIA DO IDOSO (AGDI) ocorrerá no ato do acolhimento, através da avaliação física em conjunto com as informações contidas na FICHA DE ACOLHIMENTO. A AGDI também poderá ocorrer a qualquer momento que a CONTRATANTE julgue necessário, em virtude de adequar os serviços prestados a fim de atender todas as demandas da CONTRATADA e sua ANUENTE.</p>
      <p class="justify"><strong>2.1.</strong> Valor mensal a ser pago pela prestação de serviços: no valor de <strong>${formatarMoeda(contrato.valor_mensalidade)}</strong> (${valorPorExtenso(contrato.valor_mensalidade)}) mensais até o final da vigência deste contrato, incluso todos os custos necessários para o perfeito cumprimento do presente contrato.</p>
      <p class="justify small"><strong>2.2.</strong> Sempre que o idoso tiver o seu Grau de Dependência alterado, o valor da mensalidade será atualizado conforme tabela de valores vigente.</p>
      <p class="justify small"><strong>2.3.</strong> O valor mensal descrito na CLÁUSULA SEGUNDA será corrigido ao término da vigência desse contrato conforme tabela de valores vigente.</p>
      <p class="justify"><strong>2.4.</strong> O valor descrito na CLÁUSULA SEGUNDA deverá ser pago pelo CONTRATANTE até o <strong>dia ${contrato.dia_vencimento}</strong> de cada mês, que deverá ser realizado via <strong>${getFormaPagamentoLabel(contrato.forma_pagamento)}</strong> na chave: <strong>48.897.411/0001-58</strong>, em nome de LE JARDIN RESIDENCIAL SENIOR LTDA, CNPJ: 48.897.411/0001-58.</p>
      <p class="justify small"><strong>2.5.</strong> Havendo atraso no pagamento dos valores descritos na CLÁUSULA SEGUNDA, haverá incidência de multa moratória de até 2% (dois por cento) e juros de 1% ao mês do seu valor em conformidade com o disposto no §1º do artigo 52 da Lei 8.078/90 (Código de Defesa do Consumidor).</p>
      <p class="justify small"><strong>2.6.</strong> O não cumprimento do pagamento da mensalidade por período igual ou superior a 30 (trinta) dias após o seu vencimento, implica na retirada imediata do residente. Sendo por conta do residente e/ou do seu responsável, todas as despesas inerentes à sua deslocação do residencial para outro destino.</p>
      <p class="justify small"><strong>2.7.</strong> Não será restituído, em caso algum, importâncias já pagas como por exemplo em situação de falecimento, internamento hospitalar, férias, ausências temporárias, rescisão de contrato sem aviso prévio ou abandono do Le Jardin Residencial Sênior.</p>
      <p class="justify small"><strong>2.8.</strong> O acolhimento do residente fica condicionado ao pagamento de uma mensalidade por parte do CONTRATANTE, a título de garantia. A CONTRATADA se reserva ao direito de recusar a entrada do residente na falta do pagamento da garantia estipulada neste artigo.</p>
      <p class="justify small"><strong>2.9.</strong> A garantia, estipulada no artigo anterior, será integralmente devolvida ao final do contrato, podendo ser abatido o valor da última mensalidade no caso de não renovação deste contrato. A devolução integral fica condicionada à análise dos bens móveis e imóveis utilizados pelo residente ao decorrer dos 12 meses. Caso estes necessitem de manutenção para acomodação de outro residente, será descontado o valor necessário para os reparos, mediante apresentação de comprovação por parte da CONTRATADA.</p>
      <p class="justify small"><strong>2.10.</strong> No caso de rescisão contratual sem aviso prévio ou unilateral por quebra de cláusula contratual não haverá reembolso da garantia, a fim de verba indenizatória por quebra de contrato, prevista em contrato.</p>
      <p class="justify small"><strong>2.11.</strong> É dado ao CONTRATANTE 10 (dez) dias de carência ao ingressar no residencial, para fins de adaptação. No caso de desistência, será descontado o valor da diária da respectiva garantia, no valor de R$250,00 (duzentos e cinquenta reais) por dia.</p>
      <p class="justify small"><strong>2.12.</strong> Para fins de reserva da vaga, o CONTRATANTE deverá efetuar o pagamento de <strong>30% (trinta por cento)</strong> do valor da primeira mensalidade, a título de sinal de reserva. O saldo restante de <strong>70% (setenta por cento)</strong> deverá ser quitado na data de entrada do residente na Instituição. O valor do sinal de reserva <strong>não será reembolsável</strong> em caso de desistência por parte do CONTRATANTE antes da data de entrada do residente.</p>
      <p class="justify small"><strong>2.13.</strong> O CONTRATANTE deverá no ato do pagamento dos valores descritos nas cláusulas anteriores ressarcir a CONTRATADA de todos os gastos e despesas extras que pela CONTRATADA excepcionalmente venham a ser antecipados, tais como materiais de higiene, medicamentos, fraldas, manicure, cabeleireiro ou similares, utilizados pelo CONTRATANTE durante o mês imediatamente anterior, devendo a CONTRATADA comprovar tais despesas através da apresentação de notas fiscais e/ou recibos.</p>
      

      <!-- CLÁUSULA TERCEIRA: DAS OBRIGAÇÕES DO CONTRATANTE -->
      <h3 class="clausula">CLÁUSULA TERCEIRA: DAS OBRIGAÇÕES DO CONTRATANTE E/OU RESPONSÁVEL ANUENTE</h3>
      <p class="justify"><strong>3.</strong> Indicar para a CONTRATADA, no prazo máximo de 48 (quarenta e oito) horas a contar do início da vigência deste instrumento, todos os dados cadastrais e telefones de contatos de profissionais que atendam às necessidades particulares do CONTRATANTE, tais como médicos, fisioterapeutas, dentistas, nutricionistas, dentre outros profissionais de forma a permitir que, em caso de necessidade, a CONTRATADA possa entrar em contato com estes profissionais.</p>
      <p class="justify"><strong>3.1.</strong> Indicar para a CONTRATADA, no ato de assinatura deste instrumento, a relação de medicamentos controlados que faça uso o CONTRATANTE, bem como informações pessoais (como alergias, patologias, tipo sanguíneo, etc.) e os respectivos receituários médicos com a descrição dos medicamentos, dosagem e posologia.</p>
      <p class="justify small"><strong>PARÁGRAFO ÚNICO:</strong> É DE RESPONSABILIDADE DO CONTRATANTE O FORNECIMENTO DE MEDICAMENTOS E MATERIAIS DE HIGIENE PESSOAL PREVISTOS POR MÉDICO OU NECESSIDADE DO RESIDENTE NA SEDE DA CONTRATADA EM TEMPO HÁBIL PARA UTILIZAÇÃO. PODERÁ A CONTRATANTE, A SEU CRITÉRIO, SOLICITAR A COMPRA DESTES ITENS À CONTRATADA, MEDIANTE ACRÉSCIMO DE TAXA DE SERVIÇO DE COMPRA.</p>
      <div class="lista small">
        <p><strong>1.</strong> O SERVIÇO DE COMPRA de quaisquer medicamentos ou materiais de higiene pessoal previamente autorizados pelo CONTRATANTE implica uma taxa de 20% a ser paga à CONTRATADA sobre o valor da nota fiscal emitida pelo estabelecimento comercial onde foram adquiridos os itens. Este estabelecimento será de livre escolha da CONTRATADA.</p>
        <p><strong>2.</strong> Os VALORES – valor expresso na nota fiscal mais taxa de serviço – devem ser ressarcidos em até 02 (dois) dias úteis da data de efetiva compra, comunicada pela CONTRATADA via WhatsApp. Após esse período será cobrada multa de 10% do valor total, e juros de 1% ao mês.</p>
      </div>
      <p class="justify"><strong>3.2.</strong> Promover o pagamento dos valores devidos à CONTRATADA descritos na CLÁUSULA SEGUNDA e demais cláusulas deste instrumento, na forma e prazos estabelecidos.</p>
      <p class="justify"><strong>3.3.</strong> Fornecer à CONTRATADA no ato de assinatura do presente Instrumento, uma relação com os bens e pertences pessoais do CONTRATANTE, atualizando a relação com a entrada e/ou retirada destes itens, com entrega de recibo de depósito dos bens confiados à CONTRATADA.</p>
      <p class="justify"><strong>3.4.</strong> O CONTRATANTE deverá respeitar as normas e regulamentos da Instituição.</p>

      <!-- CLÁUSULA QUARTA: DAS OBRIGAÇÕES DA CONTRATADA -->
      <h3 class="clausula">CLÁUSULA QUARTA: DAS OBRIGAÇÕES DA CONTRATADA</h3>
      <p class="justify"><strong>4.</strong> Manter padrões de habitação compatíveis com as necessidades dos idosos atendidos, bem como provê-los com alimentação regular e higiene, indispensáveis às normas sanitárias e com estas condizentes, conforme estabelecido na RDC 283, bem como na Lei nº 10.741/2003 (Estatuto do Idoso).</p>
      <p class="justify"><strong>4.1.</strong> Estabelecer atendimento de moradia digna adotando os seguintes princípios estabelecidos nos artigos 49 e 50 da Lei nº 10.741 de 1º de outubro de 2003 (Estatuto do Idoso):</p>
      <div class="lista small">
        <p><strong>I –</strong> Preservação dos vínculos familiares;</p>
        <p><strong>II –</strong> Atendimento personalizado e em pequenos grupos;</p>
        <p><strong>III –</strong> Manutenção do idoso na mesma instituição, salvo em caso de força maior;</p>
        <p><strong>IV –</strong> Participação do idoso nas atividades comunitárias, de caráter interno e externo;</p>
        <p><strong>V –</strong> Observância dos direitos e garantias dos idosos;</p>
        <p><strong>VI –</strong> Preservação da identidade do idoso e oferecimento de ambiente de respeito e dignidade;</p>
        <p><strong>VII –</strong> Oferecer acomodações apropriadas para recebimento de visitas;</p>
        <p><strong>VIII –</strong> Propiciar cuidados à saúde, conforme necessidade do idoso;</p>
        <p><strong>IX –</strong> Promover atividades educacionais, esportivas, culturais e de lazer;</p>
        <p><strong>X –</strong> Propiciar assistência religiosa àqueles que desejarem, de acordo com as suas crenças;</p>
        <p><strong>XI –</strong> Proceder ao estudo social e pessoal de cada caso;</p>
        <p><strong>XII –</strong> Comunicar à autoridade competente de saúde toda ocorrência de idoso portador de doenças infectocontagiosas;</p>
        <p><strong>XIII –</strong> Providenciar ou solicitar que o Ministério Público requisite os documentos necessários ao exercício da cidadania àqueles que não os tiverem, na forma da lei;</p>
        <p><strong>XIV –</strong> Manter arquivo de anotações onde constem data e circunstâncias do atendimento, nome do idoso, responsável, parentes, endereços, cidade e relação de seus pertences, bem como o valor de contribuições, e suas alterações, se houver, e demais dados que possibilitem sua identificação e a individualização do atendimento;</p>
        <p><strong>XV –</strong> Comunicar ao Ministério Público, para as providências cabíveis, a situação de abandono moral ou material por parte dos familiares.</p>
      </div>
      <p class="justify"><strong>4.2.</strong> A CONTRATADA se compromete a envidar todos os esforços necessários para cumprir com o exposto no presente contrato, preservando identidade e privacidade do CONTRATANTE e do seu ANUENTE, agindo sempre em consonância com os ditames legais, éticos e de boa-fé aplicáveis, respeitando todos os direitos da pessoa idosa.</p>
      <p class="justify"><strong>4.3.</strong> A CONTRATADA conta com o seguinte quadro de profissionais com formação específica a fim de atender ao CONTRATANTE: Assistente Social; Nutricionista; Fisioterapeuta; Educador Físico; Terapeuta Ocupacional; e Cuidadores de Idosos.</p>
      <p class="justify"><strong>4.4.</strong> A qualquer momento quando surgir uma urgência ou emergência, a CONTRATADA encaminhará o ANUENTE ao hospital sugerido e autorizado pelo CONTRATANTE no ato da assinatura do contrato e de imediato entrará em contato com o responsável para avisar.</p>

      <!-- CLÁUSULA QUINTA: DA VIGÊNCIA -->
      <h3 class="clausula">CLÁUSULA QUINTA: DA VIGÊNCIA DO CONTRATO</h3>
      <p class="justify"><strong>5.</strong> O contrato terá validade de 12 (doze) meses a contar da data de assinatura deste contrato${contrato.data_inicio_contrato ? `, com início em <strong>${formatarData(contrato.data_inicio_contrato)}</strong>` : ""}${contrato.data_fim_contrato ? ` e término em <strong>${formatarData(contrato.data_fim_contrato)}</strong>` : ""}.</p>

      <!-- CLÁUSULA SEXTA: DA RESCISÃO -->
      <h3 class="clausula">CLÁUSULA SEXTA: DA RESCISÃO</h3>
      <p class="justify"><strong>6. Rescisão por qualquer das partes:</strong> As partes contratantes reservam o direito de rescindir este contrato a qualquer momento, mediante o fornecimento de um aviso prévio de 30 (trinta) dias.</p>
      <p class="justify"><strong>6.1. Indenização por Descumprimento do Aviso Prévio:</strong> Caso uma das partes não cumpra o aviso prévio estipulado na Cláusula 6, a parte infratora concorda em indenizar a outra parte com o valor equivalente a uma mensalidade, conforme estabelecido neste contrato.</p>
      <p class="justify"><strong>6.2.</strong> Caberá a rescisão unilateral imediata nos seguintes casos:</p>
      <div class="lista small">
        <p><strong>I –</strong> Atraso pelo CONTRATANTE no pagamento das parcelas ajustadas na CLÁUSULA SEGUNDA deste instrumento no prazo superior a 30 (trinta) dias;</p>
        <p><strong>II –</strong> Descumprimento de quaisquer cláusulas contratuais por quaisquer das partes;</p>
        <p><strong>III –</strong> Após necessidade de nova AGDI e mudança no grau de dependência, o atual contrato será extinto automaticamente, ficando a CONTRATADA desobrigada em renovar o contrato.</p>
      </div>
      <p class="justify"><strong>6.3.</strong> O presente contrato será ainda rescindido de pleno direito no caso de falecimento do CONTRATANTE, ficando acordado entre as partes o pagamento do mês relativo ao falecimento deste, referente aos serviços prestados no período.</p>

      <!-- CLÁUSULA SÉTIMA: DISPOSIÇÕES GERAIS -->
      <h3 class="clausula">CLÁUSULA SÉTIMA: DAS DISPOSIÇÕES GERAIS</h3>
      <p class="justify"><strong>7.</strong> O CONTRATANTE declara-se ciente de que as cláusulas e disposições presentes neste instrumento de prestação de serviços perdurarão até que se opere a rescisão do presente por uma das formas previstas na CLÁUSULA SEXTA.</p>
      <p class="justify"><strong>7.1.</strong> Qualquer tolerância por quaisquer das partes em relação a obrigações que devam ser cumpridas pela outra não deverá ser interpretada como precedente, novação ou renúncia aos direitos que a lei e o presente contrato assegurem.</p>
      <p class="justify"><strong>7.2.</strong> Por questões de vigilância e segurança, nossas instalações, sala de estar, quartos, sala de jantar, sala de enfermagem e áreas externas, encontram-se monitoradas com vídeo vigilância e gravação interna, somente para uso da Instituição.</p>
      <p class="justify"><strong>7.3.</strong> As fotos e filmagens tiradas de nossos clientes serão de uso exclusivo de divulgação em redes sociais e em grupos de familiares do WhatsApp, não serão usadas para outros fins.</p>
      <p class="justify"><strong>7.4.</strong> Fica pactuada entre a CONTRATADA e a CONTRATANTE a ausência de qualquer tipo de relação de subordinação.</p>
      <p class="justify"><strong>7.5.</strong> É obrigação da CONTRATADA oferecer ao CONTRATANTE cópia do presente instrumento, contendo todas as especificidades da prestação de serviços da CONTRATADA.</p>
      <p class="justify"><strong>7.6.</strong> Fica eleito o foro da Comarca de Aracaju – SE para dirimir quaisquer questões oriundas deste contrato, renunciando as PARTES a qualquer outro, por mais privilegiado que seja.</p>

      ${
        contrato.clausulas_especiais
          ? `
        <h3 class="clausula">CLÁUSULA OITAVA: CLÁUSULAS ESPECIAIS</h3>
        <p class="justify">${contrato.clausulas_especiais.replace(/\n/g, "<br/>")}</p>
      `
          : ""
      }

      ${
        contrato.observacoes
          ? `
        <h3 class="clausula">OBSERVAÇÕES</h3>
        <p class="justify">${contrato.observacoes.replace(/\n/g, "<br/>")}</p>
      `
          : ""
      }

      <p class="justify" style="margin-top:15px">E assim, por estarem justas e contratadas as PARTES firmam o presente instrumento, em duas vias de igual teor e forma, na presença de 02 (duas) testemunhas abaixo qualificadas, obrigando-se ao seu fiel cumprimento, por si e seus sucessores.</p>

      <div class="data-local">
        <p>${cidade || "Aracaju/SE"}, ${hoje}</p>
      </div>

      <div class="assinaturas">
        <div class="assinatura-row">
          <div class="assinatura-item">
            <div class="assinatura-linha">
              <p><strong>ROSÂNGELA MORAES SOBRAL</strong></p>
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

      <div class="rodape-contrato" style="margin-top:20px;text-align:center;font-size:9pt;color:#555;border-top:1px solid #ccc;padding-top:8px;">
        <p>CNPJ: 48.897.411/0001-58 – Rua Promotor Arquibaldo Mendonça, 660, Suíssa, Aracaju/SE</p>
        <p>E-mail: lejardinresidencial.senior@gmail.com – Fone: (79) 99133-9098</p>
      </div>
    `;
  };

  const getStyleSheet = () => `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.5; color: #000; padding: 20px 50px; }
    .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 8px; }
    .header h1 { font-size: 13pt; font-weight: bold; margin-bottom: 2px; letter-spacing: 1px; }
    .header h2 { font-size: 11pt; font-weight: normal; color: #333; }
    .tipo-doc { text-align: center; font-size: 13pt; font-weight: bold; margin: 12px 0; text-decoration: underline; letter-spacing: 1px; }
    .info-box { border: 1px solid #333; padding: 8px 12px; margin: 8px 0; }
    .clausula { font-weight: bold; font-size: 11pt; margin: 14px 0 6px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
    .justify { text-align: justify; margin-bottom: 4px; }
    .small { font-size: 10pt; }
    .lista { margin-left: 20px; margin-bottom: 6px; }
    .lista p { margin-bottom: 2px; }
    .data-local { text-align: right; margin: 20px 0; font-size: 11pt; }
    .assinaturas { margin-top: 30px; }
    .assinatura-row { display: flex; justify-content: space-between; margin-bottom: 35px; }
    .assinatura-item { text-align: center; width: 45%; }
    .assinatura-linha { border-top: 1px solid #000; padding-top: 4px; margin-top: 30px; font-size: 10pt; }
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
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "0";
      tempContainer.style.width = "210mm";
      tempContainer.style.backgroundColor = "#ffffff";
      tempContainer.style.fontFamily = "'Times New Roman', Times, serif";
      tempContainer.style.fontSize = "11pt";
      tempContainer.style.lineHeight = "1.5";
      tempContainer.style.padding = "20px 50px";
      tempContainer.style.color = "#000";
      tempContainer.innerHTML = generateContractHTML();

      // Apply inline styles for rendering
      const style = document.createElement("style");
      style.textContent = getStyleSheet();
      tempContainer.prepend(style);

      document.body.appendChild(tempContainer);

      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: tempContainer.scrollWidth,
        height: tempContainer.scrollHeight,
      });

      document.body.removeChild(tempContainer);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
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
        pdf.addImage(imgData, "PNG", 0, -position, pdfWidth, scaledHeight);
        position += pageHeight;
        page++;
      }

      const fileName = `Contrato_${contrato.numero_contrato.replace(/\//g, "-")}_${residente.nome_completo.split(" ")[0]}.pdf`;
      pdf.save(fileName);

      toast({ title: "PDF gerado com sucesso!", description: "O download foi iniciado." });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
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
          <DialogDescription>Visualize, imprima ou baixe o contrato em PDF.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto border rounded-lg bg-gray-100 p-4">
          <div
            ref={printRef}
            className="bg-white text-black p-8 max-w-4xl mx-auto border rounded shadow-sm"
            style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "11pt", lineHeight: "1.5" }}
            dangerouslySetInnerHTML={{ __html: generateContractHTML() }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Função auxiliar para converter valor em extenso
function valorPorExtenso(valor: number): string {
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const dezADezenove = [
    "dez",
    "onze",
    "doze",
    "treze",
    "quatorze",
    "quinze",
    "dezesseis",
    "dezessete",
    "dezoito",
    "dezenove",
  ];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = [
    "",
    "cento",
    "duzentos",
    "trezentos",
    "quatrocentos",
    "quinhentos",
    "seiscentos",
    "setecentos",
    "oitocentos",
    "novecentos",
  ];

  const parteInteira = Math.floor(valor);
  const centavos = Math.round((valor - parteInteira) * 100);

  const converterCentena = (num: number): string => {
    if (num === 0) return "";
    if (num === 100) return "cem";
    const c = Math.floor(num / 100),
      d = Math.floor((num % 100) / 10),
      u = num % 10;
    let r = centenas[c];
    if (d === 1) {
      r += (r ? " e " : "") + dezADezenove[u];
    } else {
      if (d > 0) r += (r ? " e " : "") + dezenas[d];
      if (u > 0) r += (r ? " e " : "") + unidades[u];
    }
    return r;
  };

  const converterMilhar = (num: number): string => {
    if (num === 0) return "zero";
    if (num < 1000) return converterCentena(num);
    const milhares = Math.floor(num / 1000),
      resto = num % 1000;
    let r = milhares === 1 ? "mil" : converterCentena(milhares) + " mil";
    if (resto > 0) r += " e " + converterCentena(resto);
    return r;
  };

  let extenso = converterMilhar(parteInteira) + (parteInteira === 1 ? " real" : " reais");
  if (centavos > 0) extenso += " e " + converterCentena(centavos) + (centavos === 1 ? " centavo" : " centavos");
  return extenso;
}
