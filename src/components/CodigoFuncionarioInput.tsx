
import React, { useState } from 'react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Loader2 } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';

interface CodigoFuncionarioInputProps {
  onFuncionarioValidado: (funcionarioId: string, nome: string) => void;
}

export default function CodigoFuncionarioInput({ onFuncionarioValidado }: CodigoFuncionarioInputProps) {
  const [codigo, setCodigo] = useState('');
  const [validando, setValidando] = useState(false);
  const { latitude, longitude, error: geoError, loading: geoLoading } = useGeolocation();

  const validarCodigo = async () => {
    if (codigo.length !== 4) {
      toast({
        variant: "destructive",
        title: "Código inválido",
        description: "O código deve ter 4 dígitos"
      });
      return;
    }

    setValidando(true);

    try {
      const { data: funcionario, error } = await supabase
        .from('funcionarios')
        .select('id, nome_completo, ativo')
        .eq('codigo_4_digitos', codigo)
        .eq('ativo', true)
        .single();

      if (error || !funcionario) {
        toast({
          variant: "destructive",
          title: "Código não encontrado",
          description: "Verifique o código e tente novamente"
        });
        return;
      }

      onFuncionarioValidado(funcionario.id, funcionario.nome_completo);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao validar código"
      });
    } finally {
      setValidando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Digite seu código</h3>
        <p className="text-sm text-muted-foreground">
          Insira o código de 4 dígitos que você recebeu por email
        </p>
      </div>

      <div className="flex justify-center">
        <InputOTP
          maxLength={4}
          value={codigo}
          onChange={setCodigo}
          onComplete={validarCodigo}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      <Button
        onClick={validarCodigo}
        disabled={codigo.length !== 4 || validando}
        className="w-full"
        size="lg"
      >
        {validando ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Validando...
          </>
        ) : (
          'Confirmar Código'
        )}
      </Button>

      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4" />
        {geoLoading ? (
          <span>Obtendo localização...</span>
        ) : geoError ? (
          <span className="text-red-500">{geoError}</span>
        ) : latitude && longitude ? (
          <span className="text-green-600">Localização obtida</span>
        ) : (
          <span>Localização não disponível</span>
        )}
      </div>
    </div>
  );
}
