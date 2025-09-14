import { Badge } from "@/components/ui/badge";
import { Heart, Pill, Stethoscope, Clock, User, AlertTriangle } from "lucide-react";

interface ProntuarioDetalhadoProps {
  dados: any;
  prontuario: any;
}

// Mapeamento dos campos dinâmicos
const camposConfig: { [key: string]: { label: string; secao: string; tipo: string; opcoes?: string[] } } = {
  // Aspectos Clínicos
  "campo_1d790b13-9944-4867-870c-eb50adac5738": { label: "Pressão arterial", secao: "aspectos_clinicos", tipo: "text" },
  "campo_c79bfd92-840c-41b2-8454-e9d081bc068e": { label: "Temperatura corporal", secao: "aspectos_clinicos", tipo: "text" },
  "campo_419f71ca-bfa8-477c-ad51-1e36776ce3c4": { label: "Oximetria (Batimentos e Nível de Oxigênio)", secao: "aspectos_clinicos", tipo: "text" },
  "campo_b7e36a22-0d97-472b-bc2f-6c78fb34523c": { label: "Medicamentos administrados", secao: "aspectos_clinicos", tipo: "textarea" },
  
  // Bem-estar
  "campo_d5a3898d-a893-4696-b840-9a4109b5be7f": { label: "Nível de dor (0-10)", secao: "bem_estar", tipo: "slider" },
  "campo_d911585d-d20a-4b4a-a8b7-4be4cec9f09f": { label: "Estado emocional", secao: "bem_estar", tipo: "radio", opcoes: ["Alegre", "Calmo", "Ansioso", "Triste", "Irritado"] },
  "campo_712a9708-fc5d-41a4-9bb1-144c43ef66d9": { label: "Atividade extra", secao: "bem_estar", tipo: "radio", opcoes: ["Educador físico", "Dançaterapia", "Oficina terapêutica", "Arteterapia", "Musicoterapia", "Fisioterapia"] },
  "campo_edafe2df-3ba3-4754-9ba4-353af3e060ac": { label: "Participação em atividades", secao: "bem_estar", tipo: "radio", opcoes: ["Ativa", "Moderada", "Pouca", "Nenhuma"] },
  
  // Rotina Diária
  "campo_49a563f2-32fc-4440-9df6-a5f2c4a8845a": { label: "Qualidade do sono", secao: "rotina_diaria", tipo: "radio", opcoes: ["Boa", "Regular", "Ruim"] },
  "campo_0c918f30-790d-4a9c-a6ae-4ab01f541abd": { label: "Café da manhã", secao: "rotina_diaria", tipo: "radio", opcoes: ["Boa", "Regular", "Ruim"] },
  "campo_43674c2a-0dec-4302-ac50-3a37b356d800": { label: "Lanche da manhã", secao: "rotina_diaria", tipo: "radio", opcoes: ["Boa", "Regular", "Ruim"] },
  "campo_cbed61fa-1b17-433d-9b84-05dd535f2cc9": { label: "Almoço", secao: "rotina_diaria", tipo: "radio", opcoes: ["Boa", "Regular", "Ruim"] },
  "campo_b3d270f6-3783-4d29-958d-8c3e3a91581d": { label: "Lanche da tarde", secao: "rotina_diaria", tipo: "radio", opcoes: ["Boa", "Regular", "Ruim"] },
  "campo_27773742-edf3-4783-8089-b786a6998e84": { label: "Jantar", secao: "rotina_diaria", tipo: "radio", opcoes: ["Boa", "Regular", "Ruim"] },
  "campo_dd0b760e-6ff9-4a80-8b65-a2c01fec3601": { label: "Ceia", secao: "rotina_diaria", tipo: "radio", opcoes: ["Boa", "Regular", "Ruim"] },
  "campo_bf7a5e5c-2666-4c6c-8327-c98f2cc2e452": { label: "Defecou (Cocô)", secao: "rotina_diaria", tipo: "checkbox", opcoes: ["Manhã", "Tarde", "Noite", "Madrugada"] },
  "campo_846c84c6-3f5c-4259-8662-434445fde48d": { label: "Urina (Xixi)", secao: "rotina_diaria", tipo: "checkbox", opcoes: ["Manhã", "Tarde", "Noite", "Madruga"] },
  "campo_b1bf2888-2d63-4276-adf6-a63c9070b314": { label: "Mobilidade", secao: "rotina_diaria", tipo: "radio", opcoes: ["Boa", "Regular", "Ruim"] },
  "campo_3914a697-63f5-441c-a8ef-53bb17c2a15b": { label: "Banho", secao: "rotina_diaria", tipo: "radio", opcoes: ["Manhã, somente corpo", "Manhã, completo", "Tarde, somente corpo", "Tarde, completo", "Noite, somente corpo", "Noite, completo", "Madrugada, somente corpo", "Madrugada, completo"] },
  "campo_2e896390-fc74-444b-9a06-8d23749082b6": { label: "Corte de unhas", secao: "rotina_diaria", tipo: "radio", opcoes: ["Sim", "Não"] },
  "campo_97473b6b-4578-4a0f-bf60-8a24c6132168": { label: "Escovar os dentes", secao: "rotina_diaria", tipo: "checkbox", opcoes: ["Manhã", "Tarde", "Noite", "Madrugada"] },
  
  // Observações
  "campo_2acd9f04-080f-4f28-b69a-8e72584804be": { label: "Observações gerais", secao: "observacoes", tipo: "textarea" },
  
  // Ocorrências
  "campo_55fd8a42-e0de-475b-8fe4-9e281b9d29bf": { label: "Intercorrências", secao: "ocorrencias", tipo: "checkbox", opcoes: ["Queda", "Confusão mental", "Agitação", "Recusa medicação", "Outros"] },
  "campo_aae7cd98-0b35-429a-afb0-a60e5a7ea60e": { label: "Descrição detalhada", secao: "ocorrencias", tipo: "textarea" }
};

const getSecaoIcon = (secao: string) => {
  switch (secao) {
    case "aspectos_clinicos":
      return <Stethoscope className="w-4 h-4" />;
    case "bem_estar":
      return <Heart className="w-4 h-4" />;
    case "rotina_diaria":
      return <Clock className="w-4 h-4" />;
    case "observacoes":
      return <User className="w-4 h-4" />;
    case "ocorrencias":
      return <AlertTriangle className="w-4 h-4" />;
    default:
      return <User className="w-4 h-4" />;
  }
};

const getSecaoNome = (secao: string) => {
  switch (secao) {
    case "aspectos_clinicos":
      return "Aspectos Clínicos";
    case "bem_estar":
      return "Bem-estar";
    case "rotina_diaria":
      return "Rotina Diária";
    case "observacoes":
      return "Observações";
    case "ocorrencias":
      return "Ocorrências";
    default:
      return "Outros";
  }
};

const formatarValor = (valor: any, tipo: string, opcoes?: string[]) => {
  if (!valor || (Array.isArray(valor) && valor.length === 0)) {
    return <span className="text-gray-400 italic">Não informado</span>;
  }

  if (tipo === "checkbox" && Array.isArray(valor)) {
    return (
      <div className="flex flex-wrap gap-1">
        {valor.map((item, index) => (
          <Badge key={index} variant="outline" className="text-xs">
            {item}
          </Badge>
        ))}
      </div>
    );
  }

  if (tipo === "slider") {
    const numValue = Array.isArray(valor) ? valor[0] : valor;
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium">{numValue}/10</span>
        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
          <div 
            className={`h-2 rounded-full ${numValue > 7 ? 'bg-red-500' : numValue > 4 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${(numValue / 10) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  if (Array.isArray(valor)) {
    return valor.join(", ");
  }

  return valor;
};

export default function ProntuarioDetalhado({ dados, prontuario }: ProntuarioDetalhadoProps) {
  if (!dados || Object.keys(dados).length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum conteúdo registrado neste prontuário.</p>
      </div>
    );
  }

  // Agrupar campos por seção
  const secoes: { [key: string]: Array<{ campo: string; config: any; valor: any }> } = {};
  
  Object.keys(dados).forEach(campo => {
    if (campo.startsWith('campo_')) {
      const config = camposConfig[campo];
      if (config) {
        const secao = config.secao;
        if (!secoes[secao]) {
          secoes[secao] = [];
        }
        secoes[secao].push({ campo, config, valor: dados[campo] });
      }
    }
  });

  return (
    <div className="space-y-6">
      {/* Informações do Cabeçalho */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium text-blue-800">Residente:</span>
            <p className="text-blue-700">{prontuario.residentes?.nome_completo}</p>
          </div>
          <div>
            <span className="font-medium text-blue-800">Data:</span>
            <p className="text-blue-700">{new Date(prontuario.data_registro).toLocaleDateString('pt-BR')}</p>
          </div>
          <div>
            <span className="font-medium text-blue-800">Horário:</span>
            <p className="text-blue-700">{prontuario.horario_registro?.substring(0, 5)}</p>
          </div>
          <div>
            <span className="font-medium text-blue-800">Funcionário:</span>
            <p className="text-blue-700">{prontuario.funcionarios?.nome_completo || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Medicações */}
      {dados.medicacoes && dados.medicacoes.length > 0 && (
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
            <Pill className="w-5 h-5 text-green-600" />
            Medicações
          </h3>
          <div className="space-y-3">
            {dados.medicacoes.map((med: any, index: number) => (
              <div key={index} className="bg-green-50 p-3 rounded border-l-4 border-green-400">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <div>
                    <strong>Nome:</strong> {med.nome || 'Não informado'}
                  </div>
                  <div>
                    <strong>Dosagem:</strong> {med.dosagem || 'Não informada'}
                  </div>
                  <div>
                    <strong>Horários:</strong> {med.horarios?.join(', ') || 'Não informado'}
                  </div>
                  {med.observacoes && (
                    <div className="md:col-span-3">
                      <strong>Observações:</strong> {med.observacoes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seções Dinâmicas */}
      {Object.keys(secoes).map(secaoKey => (
        <div key={secaoKey} className="border rounded-lg p-4">
          <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
            {getSecaoIcon(secaoKey)}
            {getSecaoNome(secaoKey)}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {secoes[secaoKey].map(({ campo, config, valor }) => (
              <div key={campo} className="flex flex-col space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  {config.label}
                </label>
                <div className="text-sm">
                  {formatarValor(valor, config.tipo, config.opcoes)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Campos não mapeados */}
      {Object.keys(dados).filter(key => 
        !key.startsWith('campo_') && 
        !['medicacoes', 'dor', 'doencas_cronicas', 'deficiencias', 'atividades_realizadas', 'ocorrencias'].includes(key)
      ).length > 0 && (
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
            <User className="w-5 h-5 text-gray-600" />
            Outras Informações
          </h3>
          <div className="space-y-2">
            {Object.keys(dados).filter(key => 
              !key.startsWith('campo_') && 
              !['medicacoes', 'dor', 'doencas_cronicas', 'deficiencias', 'atividades_realizadas', 'ocorrencias'].includes(key)
            ).map(key => (
              <div key={key} className="flex justify-between">
                <span className="font-medium text-gray-700 capitalize">
                  {key.replace(/_/g, ' ')}:
                </span>
                <span className="text-gray-600">
                  {Array.isArray(dados[key]) ? dados[key].join(', ') : dados[key]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}