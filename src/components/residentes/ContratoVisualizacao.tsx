import { forwardRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ContratoData, ResidenteData, EmpresaData } from "./types";

interface ContratoVisualizacaoProps {
  contrato: ContratoData;
  residente: ResidenteData;
  empresa?: EmpresaData;
}

const ContratoVisualizacao = forwardRef<HTMLDivElement, ContratoVisualizacaoProps>(
  ({ contrato, residente, empresa }, ref) => {
    const formatarMoeda = (valor: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(valor);
    };

    const formatarData = (data: string) => {
      return format(new Date(data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    };

    const getFormaPagamentoLabel = (forma: string) => {
      const labels: Record<string, string> = {
        boleto: "Boleto Bancário",
        pix: "PIX",
        transferencia: "Transferência Bancária",
        dinheiro: "Dinheiro",
        cartao: "Cartão de Crédito"
      };
      return labels[forma] || forma;
    };

    const calcularIdade = (dataNascimento: string) => {
      const hoje = new Date();
      const nascimento = new Date(dataNascimento);
      let idade = hoje.getFullYear() - nascimento.getFullYear();
      const mesAtual = hoje.getMonth();
      const mesNascimento = nascimento.getMonth();
      if (mesAtual < mesNascimento || (mesAtual === mesNascimento && hoje.getDate() < nascimento.getDate())) {
        idade--;
      }
      return idade;
    };

    // Calcular valor do adicional natalino (parcelado em 12x)
    const valorAdicionalNatalino = contrato.valor_mensalidade;
    const parcelaAdicionalNatalino = valorAdicionalNatalino / 12;

    return (
      <div ref={ref} className="bg-white text-black p-8 max-w-4xl mx-auto text-sm leading-relaxed print:p-4">
        {/* Cabeçalho */}
        <div className="text-center mb-8 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-bold uppercase tracking-wide">
            Contrato de Prestação de Serviços
          </h1>
          <h2 className="text-lg font-semibold mt-1">
            Instituição de Longa Permanência para Idosos
          </h2>
          <p className="text-xs mt-2 text-gray-600">
            Contrato nº {contrato.numero_contrato}
          </p>
        </div>

        {/* Identificação das Partes */}
        <div className="mb-6">
          <p className="text-justify mb-4">
            Pelo presente instrumento particular de Contrato de Prestação de Serviços, de um lado:
          </p>
          
          <p className="text-justify mb-4">
            <strong>CONTRATADA:</strong> <strong>{empresa?.nome_empresa || "[Nome da Empresa]"}</strong>
            {empresa?.cnpj && <>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº {empresa.cnpj}</>}
            {empresa?.endereco && <>, com sede em {empresa.endereco}</>}
            , neste ato representada por seus representantes legais.
          </p>

          <p className="text-justify mb-4">
            <strong>CONTRATANTE:</strong> <strong>{contrato.contratante_nome}</strong>
            {contrato.contratante_cpf && <>, inscrito(a) no CPF sob nº {contrato.contratante_cpf}</>}
            {contrato.contratante_rg && <>, RG nº {contrato.contratante_rg}</>}
            {contrato.contratante_endereco && <>, residente e domiciliado(a) em {contrato.contratante_endereco}</>}
            {contrato.contratante_cidade && contrato.contratante_estado && (
              <>, {contrato.contratante_cidade}/{contrato.contratante_estado}</>
            )}
            {contrato.contratante_cep && <>, CEP {contrato.contratante_cep}</>}
            {contrato.contratante_telefone && <>, telefone {contrato.contratante_telefone}</>}
            {contrato.contratante_email && <>, e-mail {contrato.contratante_email}</>}
            .
          </p>

          <p className="text-justify">
            <strong>ANUENTE (Residente):</strong> <strong>{residente.nome_completo}</strong>
            {residente.cpf && <>, inscrito(a) no CPF sob nº {residente.cpf}</>}
            , nascido(a) em {formatarData(residente.data_nascimento)}
            , atualmente com {calcularIdade(residente.data_nascimento)} anos de idade
            , prontuário nº {residente.numero_prontuario}
            {residente.quarto && <>, acomodado(a) no quarto {residente.quarto}</>}
            .
          </p>

          <p className="text-justify mt-4">
            Têm entre si, justo e contratado, o presente Contrato de Prestação de Serviços de Instituição de Longa Permanência para Idosos, que se regerá pelas cláusulas e condições seguintes:
          </p>
        </div>

        {/* CLÁUSULA PRIMEIRA: DO OBJETO */}
        <div className="mb-6">
          <h3 className="font-bold text-base mb-3 uppercase">CLÁUSULA PRIMEIRA: DO OBJETO</h3>
          
          <p className="text-justify mb-3">
            <strong>1.</strong> O objeto do presente contrato consiste na prestação de serviços de Instituição de Longa Permanência, destinada ao domicílio coletivo de pessoas com idade igual ou superior a 60 (sessenta) anos.
          </p>

          <p className="text-justify mb-2">
            <strong>1.1.</strong> Faz parte integrante do objeto do presente instrumento a prestação dos seguintes serviços pela CONTRATADA ao CONTRATANTE:
          </p>

          <div className="ml-4 mb-3 space-y-1">
            <p><strong>I –</strong> Acomodação em {residente.quarto ? `QUARTO ${residente.quarto.toUpperCase()}` : "QUARTO"}, sala coletiva de TV, sala de atendimento de enfermagem, sala de atividades, recreação e lazer, sala de jantar, conforme opção do CONTRATANTE e/ou disponibilidade da CONTRATADA;</p>
            <p><strong>II –</strong> Fornecimento mínimo de 05 (cinco) refeições diárias, conforme cardápio devidamente elaborado por um nutricionista;</p>
            <p><strong>III –</strong> Serviços de limpeza diária dos quartos, banheiros e ambientes comuns da Instituição;</p>
            <p><strong>IV –</strong> Roupa de cama e banho;</p>
            <p><strong>V –</strong> Serviços de lavanderia;</p>
            <p><strong>VI –</strong> Atividades coordenadas por profissionais devidamente capacitados visando à preservação da saúde física e mental e do aperfeiçoamento moral, intelectual, espiritual e social do CONTRATANTE;</p>
            <p><strong>VII –</strong> Atividades que buscam a preservação do vínculo familiar.</p>
          </div>

          <p className="text-justify mb-2">
            <strong>1.2.</strong> Não estão incluídos no objeto deste Contrato os seguintes serviços:
          </p>

          <div className="ml-4 mb-3 space-y-1 text-xs">
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
            <p><strong>XV –</strong> Quando prestado qualquer um dos serviços enumerados serão faturados juntamente com a mensalidade de Prestação de Serviços, especificado cada despesa como extra no final de cada mês;</p>
            <p><strong>XVI –</strong> Alimentos de uso pessoal e específico.</p>
          </div>
        </div>

        {/* CLÁUSULA SEGUNDA: DO VALOR */}
        <div className="mb-6">
          <h3 className="font-bold text-base mb-3 uppercase">CLÁUSULA SEGUNDA: DO VALOR</h3>
          
          <p className="text-justify mb-3">
            <strong>2.</strong> Pelos serviços descritos nas cláusulas anteriores, o CONTRATANTE pagará à CONTRATADA o valor mensal equivalente ao Grau de Dependência do Idoso:
          </p>

          <div className="ml-4 mb-3 space-y-1 text-xs">
            <p><strong>A)</strong> Indivíduo Autônomo – é aquele que detém poder decisório e controle sobre a sua vida.</p>
            <p><strong>B)</strong> Grau de Dependência I – idosos independentes, mesmo que requeiram uso de equipamentos de autoajuda;</p>
            <p><strong>C)</strong> Grau de Dependência II – idosos com dependência em até três atividades de autocuidado para a vida diária tais como: alimentação, mobilidade, higiene; sem comprometimento cognitivo ou com alteração cognitiva controlada;</p>
            <p><strong>D)</strong> Grau de Dependência III – idosos com dependência que requeiram assistência em todas as atividades de autocuidado para a vida diária e ou com comprometimento cognitivo.</p>
          </div>

          <p className="text-justify mb-3 text-xs">
            <strong>Parágrafo Único:</strong> A AVALIAÇÃO DE GRAU DE DEPENDÊNCIA DO IDOSO (AGDI) ocorrerá no ato do acolhimento, através da avaliação física em conjunto com as informações contidas na FICHA DE ACOLHIMENTO. A AGDI também poderá ocorrer a qualquer momento que a CONTRATANTE julgue necessário, em virtude de adequar os serviços prestados a fim de atender todas as demandas da CONTRATADA e sua ANUENTE.
          </p>

          <p className="text-justify mb-2">
            <strong>2.1.</strong> Valor mensal a ser pago pela prestação de serviços: <strong>{formatarMoeda(contrato.valor_mensalidade)}</strong> ({valorPorExtenso(contrato.valor_mensalidade)}) mensais até o final da vigência deste contrato, incluso todos os custos necessários para o perfeito cumprimento do presente contrato.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>2.2.</strong> Sempre que o idoso tiver o seu Grau de Dependência alterado, o valor da mensalidade será atualizado conforme tabela de valores vigente.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>2.3.</strong> O valor mensal descrito na CLÁUSULA SEGUNDA será corrigido ao término da vigência desse contrato conforme tabela de valores vigente.
          </p>

          <p className="text-justify mb-2">
            <strong>2.4.</strong> O valor descrito na CLÁUSULA SEGUNDA deverá ser pago pelo CONTRATANTE até o <strong>dia {contrato.dia_vencimento}</strong> de cada mês, através de <strong>{getFormaPagamentoLabel(contrato.forma_pagamento)}</strong>.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>2.5.</strong> Havendo atraso no pagamento dos valores descritos na CLÁUSULA SEGUNDA haverá incidência de multa moratória de até 2% (dois por cento) e juros de 1% ao mês do seu valor em conformidade com o disposto no §1.º do artigo 52 da Lei 8.078/90 (Código de Defesa do Consumidor).
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>2.6.</strong> O não cumprimento do pagamento da mensalidade por período igual ou superior a 30 (trinta) dias após o seu vencimento, implica na retirada imediata do residente. Sendo por conta do residente e/ou do seu responsável, todas as despesas inerentes à sua deslocação do residencial para outro destino.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>2.7.</strong> Não será restituído, em caso algum, importâncias já pagas como por exemplo em situação de falecimento, internamento hospitalar, férias, ausências temporárias, rescisão de contrato sem aviso prévio ou abandono da Instituição.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>2.8.</strong> O acolhimento do residente fica condicionado ao pagamento de uma mensalidade por parte do CONTRATANTE, a título de garantia. A CONTRATADA se reserva ao direito de recusar a entrada do residente na falta do pagamento da garantia estipulada neste artigo.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>2.9.</strong> A garantia, estipulada no artigo anterior, será integralmente devolvida ao final do contrato, podendo ser abatido o valor da última mensalidade no caso de não renovação deste contrato. A devolução integral fica condicionada a análise dos bens móveis e imóveis utilizados pelo residente ao decorrer dos 12 meses. Caso estes necessitem de manutenção para acomodação de outro residente, será descontado o valor necessário para os reparos, mediante apresentação de comprovação por parte da CONTRATADA.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>2.10.</strong> No caso de rescisão contratual sem aviso prévio ou unilateral por quebra de cláusula contratual não haverá reembolso da garantia, a fim de verba indenizatória por quebra de contrato, prevista em contrato.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>2.11.</strong> É dado ao CONTRATANTE 10 (dez) dias de carência ao ingressar no residencial, para fins de adaptação. No caso de desistência, será descontado o valor da diária da respectiva garantia.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>2.12.</strong> O CONTRATANTE deverá no ato do pagamento dos valores descritos nas cláusulas anteriores ressarcir a CONTRATADA de todos os gastos e despesas extras que pela CONTRATADA excepcionalmente venham a ser antecipados, tais como materiais de higiene, medicamentos, fraldas, manicure, cabeleireiro ou similares, utilizados pelo CONTRATANTE durante o mês imediatamente anterior, devendo a CONTRATADA comprovar tais despesas através da apresentação de notas fiscais e/ou recibos.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>2.13. ADICIONAL NATALINO:</strong> Será cobrada uma taxa de 100% a mais sobre a mensalidade de prestação de serviços, para pagamentos de despesas adicionais como décimos terceiros e férias, que deverá ser pago pelo CONTRATANTE em 12 (doze) parcelas, na mesma data de vencimento da mensalidade. Valor: {formatarMoeda(valorAdicionalNatalino)} em 12x {formatarMoeda(parcelaAdicionalNatalino)}.
          </p>
        </div>

        {/* CLÁUSULA TERCEIRA: DAS OBRIGAÇÕES DO CONTRATANTE */}
        <div className="mb-6">
          <h3 className="font-bold text-base mb-3 uppercase">CLÁUSULA TERCEIRA: DAS OBRIGAÇÕES DO CONTRATANTE E/OU RESPONSÁVEL ANUENTE</h3>
          
          <p className="text-justify mb-2 text-xs">
            <strong>3.</strong> Indicar para a CONTRATADA, no prazo máximo de 48 (quarenta e oito) horas a contar do início da vigência deste instrumento, todos os dados cadastrais e telefones de contatos de profissionais que atendam às necessidades particulares do CONTRATANTE, tais como médicos, fisioterapeutas, dentistas, nutricionistas, dentre outros profissionais de forma a permitir que, em caso de necessidade, a CONTRATADA possa entrar em contato com estes profissionais.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>3.1.</strong> Indicar para a CONTRATADA, no ato de assinatura deste instrumento, a relação de medicamentos controlados ou não que faça uso o CONTRATANTE, bem como informações pessoais (como alergias, patologias, tipo sanguíneo, etc.) e os respectivos receituários médicos com a descrição dos medicamentos, dosagem e posologia.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>3.2.</strong> Promover o pagamento dos valores devidos à CONTRATADA descritos na CLÁUSULA SEGUNDA deste instrumento, na forma e prazos estabelecidos.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>3.3.</strong> Fornecer à CONTRATADA no ato de assinatura do presente Instrumento, uma relação com os bens e pertences pessoais do CONTRATANTE, atualizando a relação com a entrada e/ou retirada destes itens, com entrega de recibo de depósito dos bens confiados à CONTRATADA.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>3.4.</strong> O CONTRATANTE deverá respeitar as normas e regulamentos da Instituição.
          </p>
        </div>

        {/* CLÁUSULA QUARTA: DAS OBRIGAÇÕES DA CONTRATADA */}
        <div className="mb-6">
          <h3 className="font-bold text-base mb-3 uppercase">CLÁUSULA QUARTA: DAS OBRIGAÇÕES DA CONTRATADA</h3>
          
          <p className="text-justify mb-2 text-xs">
            <strong>4.</strong> Manter padrões de habitação compatíveis com as necessidades dos idosos atendidos, bem como provê-los com alimentação regular e higiene, indispensáveis às normas sanitárias e com estas condizentes, conforme estabelecido na RDC 283, bem como na Lei n.º 10.741/2003 (Estatuto do Idoso).
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>4.1.</strong> Estabelecer atendimento de moradia digna adotando os seguintes princípios estabelecidos no artigo 49 e 50 da Lei n.º 10.741 de 1.º de outubro de 2003 (Estatuto do Idoso):
          </p>

          <div className="ml-4 mb-3 space-y-1 text-xs">
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
            <p><strong>XV –</strong> Comunicar o Ministério Público para as providências cabíveis, a situação de abandono moral ou material por parte dos familiares.</p>
          </div>

          <p className="text-justify mb-2 text-xs">
            <strong>4.2.</strong> A CONTRATADA se compromete a envidar todos os esforços necessários para cumprir com o exposto no presente contrato, preservando identidade e privacidade do CONTRATANTE e do seu ANUENTE, agindo sempre em consonância com os ditames legais, éticos e de boa fé aplicáveis, respeitando todos os direitos da pessoa idosa.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>4.3.</strong> A CONTRATADA conta com o seguinte quadro de profissionais com formação específica a fim de atender ao CONTRATANTE: Assistente Social; Nutricionista; Fisioterapeuta; Educador físico; Terapeuta ocupacional; e Cuidadores de idosos.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>4.4.</strong> A qualquer momento quando surgir uma urgência ou emergência a CONTRATADA encaminhará o ANUENTE ao Hospital sugerido e autorizado pelo CONTRATANTE no ato da assinatura do contrato e de imediato entrará em contato com o responsável para avisar.
          </p>
        </div>

        {/* CLÁUSULA QUINTA: DA VIGÊNCIA DO CONTRATO */}
        <div className="mb-6">
          <h3 className="font-bold text-base mb-3 uppercase">CLÁUSULA QUINTA: DA VIGÊNCIA DO CONTRATO</h3>
          
          <p className="text-justify">
            <strong>5.</strong> O contrato terá validade de 12 meses a contar da data de <strong>{formatarData(contrato.data_inicio_contrato)}</strong>
            {contrato.data_fim_contrato && <>, com término previsto para <strong>{formatarData(contrato.data_fim_contrato)}</strong></>}
            .
          </p>
        </div>

        {/* CLÁUSULA SEXTA: DA RESCISÃO */}
        <div className="mb-6">
          <h3 className="font-bold text-base mb-3 uppercase">CLÁUSULA SEXTA: DA RESCISÃO</h3>
          
          <p className="text-justify mb-2">
            <strong>6.</strong> Rescisão por qualquer das partes: As partes contratantes reservam o direito de rescindir este contrato a qualquer momento, mediante o fornecimento de um aviso prévio de 30 (trinta) dias.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>6.1.</strong> Indenização por Descumprimento do Aviso Prévio: Caso uma das partes não cumpra o aviso prévio estipulado na Cláusula 6, a parte infratora concorda em indenizar a outra parte com o valor equivalente a uma mensalidade, conforme estabelecido neste contrato.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>6.2.</strong> Caberá a rescisão unilateral imediata nos seguintes casos:
          </p>

          <div className="ml-4 mb-3 space-y-1 text-xs">
            <p><strong>I –</strong> Atraso pelo CONTRATANTE no pagamento das parcelas ajustadas na CLÁUSULA SEGUNDA deste instrumento no prazo superior a 30 (trinta) dias;</p>
            <p><strong>II –</strong> Descumprimento de quaisquer cláusulas contratuais por quaisquer das partes;</p>
            <p><strong>III –</strong> Após necessidade de nova AGDI e mudança no grau de dependência, o atual contrato será extinto automaticamente, ficando a CONTRATADA desobrigada em renovar o contrato.</p>
          </div>

          <p className="text-justify mb-2 text-xs">
            <strong>6.3.</strong> O presente contrato será ainda rescindido de pleno direito no caso de falecimento do CONTRATANTE, ficando acordado entre as partes o pagamento do mês relativo ao falecimento deste, referente aos serviços prestados no período.
          </p>
        </div>

        {/* CLÁUSULA SÉTIMA: DAS DISPOSIÇÕES GERAIS */}
        <div className="mb-6">
          <h3 className="font-bold text-base mb-3 uppercase">CLÁUSULA SÉTIMA: DAS DISPOSIÇÕES GERAIS</h3>
          
          <p className="text-justify mb-2 text-xs">
            <strong>7.</strong> O CONTRATANTE declara-se ciente de que as cláusulas e disposições presentes neste instrumento de prestação de serviços perdurarão até que se opere a rescisão do presente por uma das formas previstas na CLÁUSULA SEXTA.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>7.1.</strong> Qualquer tolerância por quaisquer das partes em relação a obrigações que devam ser cumpridas pela outra não deverá ser interpretada como precedente, novação ou renúncia aos direitos que a lei e o presente contrato assegure.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>7.2.</strong> Por questões de vigilância e segurança, as instalações, sala de estar, quartos, sala de jantar, sala de enfermagem e áreas externas, encontram-se monitoradas com vídeo vigilância e gravação interna, somente para uso da Instituição.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>7.3.</strong> As fotos e filmagens tiradas dos residentes serão de uso exclusivo de divulgação em redes sociais e em grupos de familiares, não serão usadas para outros fins.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>7.4.</strong> Fica pactuada entre a CONTRATADA e a CONTRATANTE a ausência de qualquer tipo de relação de subordinação.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>7.5.</strong> É obrigação da CONTRATADA oferecer ao CONTRATANTE cópia do presente instrumento, contendo todas as especificidades da prestação de serviços da CONTRATADA.
          </p>

          <p className="text-justify mb-2 text-xs">
            <strong>7.6.</strong> Fica eleito o foro da Comarca onde se localiza a CONTRATADA para dirimir quaisquer questões oriundas deste contrato, renunciando as PARTES a qualquer outro, por mais privilegiado que seja.
          </p>
        </div>

        {/* Cláusulas Especiais */}
        {contrato.clausulas_especiais && (
          <div className="mb-6">
            <h3 className="font-bold text-base mb-3 uppercase">CLÁUSULA OITAVA: CLÁUSULAS ESPECIAIS</h3>
            <p className="text-justify whitespace-pre-line text-xs">{contrato.clausulas_especiais}</p>
          </div>
        )}

        {/* Observações */}
        {contrato.observacoes && (
          <div className="mb-6">
            <h3 className="font-bold text-base mb-3 uppercase">OBSERVAÇÕES</h3>
            <p className="text-justify whitespace-pre-line text-xs">{contrato.observacoes}</p>
          </div>
        )}

        {/* Fechamento */}
        <div className="mb-6">
          <p className="text-justify">
            E assim, por estarem justas e contratadas as PARTES firmam o presente instrumento, em duas vias de igual teor e forma, na presença de 02 (duas) testemunhas abaixo qualificadas, obrigando-se ao seu fiel cumprimento, por si e seus sucessores.
          </p>
        </div>

        {/* Data e Local */}
        <div className="text-center my-8">
          <p>
            _________________, {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Assinaturas */}
        <div className="grid grid-cols-2 gap-8 mt-12">
          <div className="text-center">
            <div className="border-t border-black pt-2 mx-4">
              <p className="font-semibold">{empresa?.nome_empresa || "[Nome da Empresa]"}</p>
              <p className="text-xs">CONTRATADA</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-2 mx-4">
              <p className="font-semibold">{contrato.contratante_nome}</p>
              <p className="text-xs">CONTRATANTE</p>
            </div>
          </div>
        </div>

        {/* Anuente */}
        <div className="flex justify-center mt-8">
          <div className="text-center w-1/2">
            <div className="border-t border-black pt-2 mx-4">
              <p className="font-semibold">{residente.nome_completo}</p>
              <p className="text-xs">ANUENTE (Residente)</p>
            </div>
          </div>
        </div>

        {/* Testemunhas */}
        <div className="grid grid-cols-2 gap-8 mt-12">
          <div className="text-center">
            <div className="border-t border-black pt-2 mx-4">
              <p className="text-xs">Testemunha 1</p>
              <p className="text-xs mt-1">Nome: _______________________</p>
              <p className="text-xs">CPF: _______________________</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-2 mx-4">
              <p className="text-xs">Testemunha 2</p>
              <p className="text-xs mt-1">Nome: _______________________</p>
              <p className="text-xs">CPF: _______________________</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ContratoVisualizacao.displayName = "ContratoVisualizacao";

// Função auxiliar para converter valor em extenso
function valorPorExtenso(valor: number): string {
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezADezenove = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  const parteInteira = Math.floor(valor);
  const centavos = Math.round((valor - parteInteira) * 100);

  const converterCentenaParaExtenso = (num: number): string => {
    if (num === 0) return '';
    if (num === 100) return 'cem';
    
    const c = Math.floor(num / 100);
    const d = Math.floor((num % 100) / 10);
    const u = num % 10;
    
    let resultado = centenas[c];
    
    if (d === 1) {
      resultado += (resultado ? ' e ' : '') + dezADezenove[u];
    } else {
      if (d > 0) resultado += (resultado ? ' e ' : '') + dezenas[d];
      if (u > 0) resultado += (resultado ? ' e ' : '') + unidades[u];
    }
    
    return resultado;
  };

  const converterMilharParaExtenso = (num: number): string => {
    if (num === 0) return 'zero';
    if (num < 1000) return converterCentenaParaExtenso(num);
    
    const milhares = Math.floor(num / 1000);
    const resto = num % 1000;
    
    let resultado = milhares === 1 ? 'mil' : converterCentenaParaExtenso(milhares) + ' mil';
    
    if (resto > 0) {
      resultado += ' e ' + converterCentenaParaExtenso(resto);
    }
    
    return resultado;
  };

  let extenso = converterMilharParaExtenso(parteInteira);
  extenso += parteInteira === 1 ? ' real' : ' reais';

  if (centavos > 0) {
    extenso += ' e ' + converterCentenaParaExtenso(centavos);
    extenso += centavos === 1 ? ' centavo' : ' centavos';
  }

  return extenso;
}

export default ContratoVisualizacao;
