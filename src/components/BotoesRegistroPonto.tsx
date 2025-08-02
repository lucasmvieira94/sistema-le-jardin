import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, PauseCircle, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';

interface BotoesRegistroPontoProps {
  funcionarioId: string;
  funcionarioNome: string;
  latitude: number | null;
  longitude: number | null;
  onRegistroRealizado: () => void;
}

type TipoRegistro = 'entrada' | 'intervalo_inicio' | 'intervalo_fim' | 'saida';

function formatarHorario(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    // fallback para horário fixo se a data for inválida
    return '08:00:00';
  }
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
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
      const horario = formatarHorario(agora);

      console.log('⏰ Horário formatado para envio:', horario);

      // Validação rápida do formato
      if (!/^\d{2}:\d{2}:\d{2}$/.test(horario)) {
        throw new Error(`Horário com formato inválido: ${horario}`);
      }

      const data = agora.toISOString().split('T')[0];

      // Verifica se já existe registro para hoje
      const { data: registroExistente, error: errorBusca } = await supabase
        .from('registros_ponto')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .eq('data', data)
        .single();

      if (errorBusca && errorBusca.code !== 'PGRST116') throw errorBusca;

      // Dados de atualização/inserção
      let updateData: any = {
        latitude: latitude || null,
        longitude: longitude || null,
      };

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
        await logEvent('registros_ponto', 'UPDATE', registroExistente, updateData);
        const { error } = await supabase
          .from('registros_ponto')
          .update(updateData)
          .eq('id', registroExistente.id);
        if (error) throw error;
      } else {
        const newRecord = {
          funcionario_id: funcionarioId,
          data,
          ...updateData,
        };
        await logEvent('registros_ponto', 'INSERT', null, newRecord);
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
      console.error('❌ Erro ao registrar ponto:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao registrar ponto. Tente novamente."
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
