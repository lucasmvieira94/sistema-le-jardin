import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, PauseCircle, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { validateTime } from '@/utils/validation';

interface BotoesRegistroPontoProps {
  funcionarioId: string;
  funcionarioNome: string;
  latitude: number | null;
  longitude: number | null;
  onRegistroRealizado: () => void;
}

type TipoRegistro = 'entrada' | 'intervalo_inicio' | 'intervalo_fim' | 'saida';

// Função utilitária para traduzir mensagens conhecidas do Supabase/Postgres
function traduzirErro(error: any): string {
  // Mensagens de erro comuns do Postgres/Supabase
  if (!error) return "Erro desconhecido ao registrar ponto.";

  if (typeof error === "string") return error;

  // Supabase v2
  if (error.message) {
    // Erro de chave duplicada
    if (error.message.includes("duplicate key value")) {
      return "Já existe um registro de ponto para este horário.";
    }
    // Falha de autenticação/autorização
    if (error.message.includes("permission denied") || error.message.includes("not authorized")) {
      return "Você não tem permissão para registrar este ponto.";
    }
    // Campos obrigatórios
    if (error.message.includes("null value in column")) {
      return "Informações obrigatórias não foram preenchidas.";
    }
    // Latitude/Longitude inválidas
    if (error.message.includes("latitude") || error.message.includes("longitude")) {
      return "Falha ao registrar a localização. Permita o acesso ao GPS.";
    }
    // Outros erros conhecidos podem ser adicionados aqui
    return error.message;
  }

  // Objeto de erro genérico
  if (error.error_description) return error.error_description;

  // Fallback
  return "Erro ao registrar ponto. Tente novamente.";
}

export default function BotoesRegistroPonto({ 
  funcionarioId, 
  funcionarioNome, 
  latitude, 
  longitude,
  onRegistroRealizado 
}: BotoesRegistroPontoProps) {
  const [registrando, setRegistrando] = useState<TipoRegistro | null>(null);
  const { logEvent } = useAuditLog();

  const registrarPonto = async (tipo: TipoRegistro) => {
    setRegistrando(tipo);
    
    try {
      const agora = new Date();
      const data = agora.toISOString().split('T')[0];
      const horario = agora.toTimeString().split(' ')[0];

      // Validate time format
      if (!validateTime(horario)) {
        throw new Error('Formato de horário inválido');
      }

      // Verificar se já existe registro para hoje
      const { data: registroExistente, error: errorBusca } = await supabase
        .from('registros_ponto')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .eq('data', data)
        .single();

      if (errorBusca && errorBusca.code !== 'PGRST116') {
        throw errorBusca;
      }

      let updateData: any = {
        latitude: latitude,
        longitude: longitude,
      };

      // Definir o campo a ser atualizado baseado no tipo
      switch (tipo) {
        case 'entrada':
          updateData.entrada = horario;
          break;
        case 'intervalo_inicio':
          updateData.intervalo_inicio = horario;
          break;
        case 'intervalo_fim':
          updateData.intervalo_fim = horario;
          break;
        case 'saida':
          updateData.saida = horario;
          break;
      }

      if (registroExistente) {
        // Log audit event for update
        await logEvent('registros_ponto', 'UPDATE', registroExistente, updateData);
        
        // Atualizar registro existente
        const { error } = await supabase
          .from('registros_ponto')
          .update(updateData)
          .eq('id', registroExistente.id);

        if (error) throw error;
      } else {
        const newRecord = {
          funcionario_id: funcionarioId,
          data: data,
          ...updateData,
        };
        
        // Log audit event for insert
        await logEvent('registros_ponto', 'INSERT', null, newRecord);
        
        // Criar novo registro
        const { error } = await supabase
          .from('registros_ponto')
          .insert(newRecord);

        if (error) throw error;
      }

      const tipoNomes = {
        entrada: 'Entrada',
        intervalo_inicio: 'Início do Intervalo',
        intervalo_fim: 'Fim do Intervalo',
        saida: 'Saída'
      };

      toast({
        title: "Ponto registrado!",
        description: `${tipoNomes[tipo]} registrada às ${horario.slice(0, 5)}`
      });

      onRegistroRealizado();
    } catch (error: any) {
      console.error('Erro ao registrar ponto:', error);

      toast({
        variant: "destructive",
        title: "Erro",
        description: traduzirErro(error)
      });
    } finally {
      setRegistrando(null);
    }
  };

  const botoes = [
    { tipo: 'entrada' as TipoRegistro, label: 'Entrada', icon: LogIn, cor: 'bg-primary hover:bg-emerald-700' },
    { tipo: 'intervalo_inicio' as TipoRegistro, label: 'Início Intervalo', icon: PauseCircle, cor: 'bg-accent hover:bg-green-400' },
    { tipo: 'intervalo_fim' as TipoRegistro, label: 'Fim Intervalo', icon: RotateCcw, cor: 'bg-secondary hover:bg-green-200' },
    { tipo: 'saida' as TipoRegistro, label: 'Saída', icon: LogOut, cor: 'bg-muted-foreground hover:bg-gray-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold">Olá, {funcionarioNome}!</h3>
        <p className="text-sm text-muted-foreground">
          Escolha o tipo de registro:
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {botoes.map(({ tipo, label, icon: Icon, cor }) => (
          <Button
            key={tipo}
            onClick={() => registrarPonto(tipo)}
            disabled={registrando !== null}
            className={`${cor} text-white font-semibold py-4 text-base flex items-center justify-center gap-2 shadow transition-all`}
            size="lg"
          >
            {registrando === tipo ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <Icon className="w-5 h-5" />
                {label}
              </>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
