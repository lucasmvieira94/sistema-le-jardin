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

    return (
      <div ref={ref} className="bg-white text-black p-8 max-w-4xl mx-auto text-sm leading-relaxed print:p-4">
        {/* Cabeçalho */}
        <div className="text-center mb-8 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-bold uppercase tracking-wide">
            Contrato de Prestação de Serviços
          </h1>
          <h2 className="text-lg font-semibold mt-1">
            Residencial para Idosos
          </h2>
          <p className="text-xs mt-2 text-gray-600">
            Contrato nº {contrato.numero_contrato}
          </p>
        </div>

        {/* Dados da Empresa */}
        <div className="mb-6">
          <h3 className="font-bold text-base mb-2 uppercase border-b pb-1">1. Contratada</h3>
          <p className="text-justify">
            <strong>{empresa?.nome_empresa || "[Nome da Empresa]"}</strong>
            {empresa?.cnpj && <>, inscrita no CNPJ sob nº {empresa.cnpj}</>}
            {empresa?.endereco && <>, com sede em {empresa.endereco}</>}
            , doravante denominada <strong>CONTRATADA</strong>.
          </p>
        </div>

        {/* Dados do Contratante */}
        <div className="mb-6">
          <h3 className="font-bold text-base mb-2 uppercase border-b pb-1">2. Contratante</h3>
          <p className="text-justify">
            <strong>{contrato.contratante_nome}</strong>
            {contrato.contratante_cpf && <>, inscrito(a) no CPF sob nº {contrato.contratante_cpf}</>}
            {contrato.contratante_rg && <>, RG nº {contrato.contratante_rg}</>}
            {contrato.contratante_endereco && <>, residente em {contrato.contratante_endereco}</>}
            {contrato.contratante_cidade && contrato.contratante_estado && (
              <>, {contrato.contratante_cidade}/{contrato.contratante_estado}</>
            )}
            {contrato.contratante_cep && <>, CEP {contrato.contratante_cep}</>}
            {contrato.contratante_telefone && <>, telefone {contrato.contratante_telefone}</>}
            {contrato.contratante_email && <>, e-mail {contrato.contratante_email}</>}
            , doravante denominado(a) <strong>CONTRATANTE</strong>.
          </p>
        </div>

        {/* Dados do Residente */}
        <div className="mb-6">
          <h3 className="font-bold text-base mb-2 uppercase border-b pb-1">3. Residente</h3>
          <p className="text-justify">
            <strong>{residente.nome_completo}</strong>
            {residente.cpf && <>, inscrito(a) no CPF sob nº {residente.cpf}</>}
            , nascido(a) em {formatarData(residente.data_nascimento)}
            , atualmente com {calcularIdade(residente.data_nascimento)} anos de idade
            , prontuário nº {residente.numero_prontuario}
            {residente.quarto && <>, acomodado(a) no quarto {residente.quarto}</>}
            , doravante denominado(a) <strong>RESIDENTE</strong>.
          </p>
        </div>

        {/* Objeto do Contrato */}
        <div className="mb-6">
          <h3 className="font-bold text-base mb-2 uppercase border-b pb-1">4. Objeto do Contrato</h3>
          <p className="text-justify mb-2">
            O presente contrato tem por objeto a prestação de serviços de hospedagem e cuidados ao 
            <strong> RESIDENTE</strong>, nos termos e condições a seguir especificados.
          </p>
          
          {contrato.servicos_inclusos && contrato.servicos_inclusos.length > 0 && (
            <div className="mt-3">
              <p className="font-semibold mb-1">4.1. Serviços Inclusos:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                {contrato.servicos_inclusos.map((servico, index) => (
                  <li key={index}>{servico}</li>
                ))}
              </ul>
            </div>
          )}

          {contrato.servicos_adicionais && (
            <div className="mt-3">
              <p className="font-semibold mb-1">4.2. Serviços Adicionais:</p>
              <p className="ml-4">{contrato.servicos_adicionais}</p>
            </div>
          )}
        </div>

        {/* Condições Financeiras */}
        <div className="mb-6">
          <h3 className="font-bold text-base mb-2 uppercase border-b pb-1">5. Condições Financeiras</h3>
          <p className="text-justify">
            <strong>5.1.</strong> O <strong>CONTRATANTE</strong> pagará à <strong>CONTRATADA</strong> o valor 
            mensal de <strong>{formatarMoeda(contrato.valor_mensalidade)}</strong> ({valorPorExtenso(contrato.valor_mensalidade)}).
          </p>
          <p className="text-justify mt-2">
            <strong>5.2.</strong> O pagamento deverá ser efetuado até o <strong>dia {contrato.dia_vencimento}</strong> de 
            cada mês, através de <strong>{getFormaPagamentoLabel(contrato.forma_pagamento)}</strong>.
          </p>
          <p className="text-justify mt-2">
            <strong>5.3.</strong> Em caso de atraso no pagamento, incidirão multa de 2% (dois por cento) sobre o 
            valor devido, acrescido de juros de mora de 1% (um por cento) ao mês.
          </p>
        </div>

        {/* Vigência */}
        <div className="mb-6">
          <h3 className="font-bold text-base mb-2 uppercase border-b pb-1">6. Vigência</h3>
          <p className="text-justify">
            <strong>6.1.</strong> O presente contrato entra em vigor na data de <strong>{formatarData(contrato.data_inicio_contrato)}</strong>
            {contrato.data_fim_contrato ? (
              <> e terá vigência até <strong>{formatarData(contrato.data_fim_contrato)}</strong></>
            ) : (
              <>, por prazo indeterminado</>
            )}
            , podendo ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias.
          </p>
        </div>

        {/* Cláusulas Especiais */}
        {contrato.clausulas_especiais && (
          <div className="mb-6">
            <h3 className="font-bold text-base mb-2 uppercase border-b pb-1">7. Cláusulas Especiais</h3>
            <p className="text-justify whitespace-pre-line">{contrato.clausulas_especiais}</p>
          </div>
        )}

        {/* Observações */}
        {contrato.observacoes && (
          <div className="mb-6">
            <h3 className="font-bold text-base mb-2 uppercase border-b pb-1">
              {contrato.clausulas_especiais ? "8. Observações" : "7. Observações"}
            </h3>
            <p className="text-justify whitespace-pre-line">{contrato.observacoes}</p>
          </div>
        )}

        {/* Disposições Gerais */}
        <div className="mb-6">
          <h3 className="font-bold text-base mb-2 uppercase border-b pb-1">
            {contrato.clausulas_especiais && contrato.observacoes ? "9" : contrato.clausulas_especiais || contrato.observacoes ? "8" : "7"}. Disposições Gerais
          </h3>
          <p className="text-justify mb-2">
            As partes elegem o foro da comarca onde se localiza a <strong>CONTRATADA</strong> para dirimir 
            quaisquer dúvidas ou litígios decorrentes do presente contrato, com renúncia expressa a qualquer outro, 
            por mais privilegiado que seja.
          </p>
          <p className="text-justify">
            E por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias 
            de igual teor e forma, na presença de 2 (duas) testemunhas.
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
