
import React, { useState } from 'react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Loader2, Shield } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useRateLimit } from '@/hooks/useRateLimit';
import { validateFuncionarioCode } from '@/utils/validation';

interface CodigoFuncionarioInputProps {
  onFuncionarioValidado: (funcionarioId: string, nome: string) => void;
}

export default function CodigoFuncionarioInput({ onFuncionarioValidado }: CodigoFuncionarioInputProps) {
  const [codigo, setCodigo] = useState('');
  const [validando, setValidando] = useState(false);
  const { latitude, longitude, error: geoError, loading: geoLoading } = useGeolocation();
  const { checkRateLimit, isBlocked } = useRateLimit();

  const validarCodigo = async () => {
    console.log('🔍 Iniciando validação do código:', codigo);
    console.log('🌐 Environment check:', {
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      userAgent: navigator.userAgent.substring(0, 50) + '...'
    });

    if (!validateFuncionarioCode(codigo)) {
      console.log('❌ Código inválido:', codigo);
      toast({
        variant: "destructive",
        title: "Código inválido",
        description: "O código deve ter 4 dígitos numéricos"
      });
      return;
    }

    // Check rate limiting
    console.log('🛡️ Verificando rate limit...');
    try {
      const allowed = await checkRateLimit(codigo);
      console.log('🛡️ Rate limit resultado:', allowed);
      if (!allowed) {
        toast({
          variant: "destructive",
          title: "Muitas tentativas",
          description: "Você foi temporariamente bloqueado devido a muitas tentativas. Tente novamente em 1 hora."
        });
        return;
      }
    } catch (rateLimitError) {
      console.error('❌ Erro no rate limit:', rateLimitError);
      // Continue mesmo com erro no rate limit para não bloquear funcionários válidos
    }

    setValidando(true);

    try {
      console.log('🔍 Validando funcionário usando função segura...');
      const { data: validacao, error } = await supabase
        .rpc("validar_codigo_funcionario", { p_codigo: codigo });

      console.log('📋 Resultado da validação:', { validacao, error });

      if (error) {
        console.error('❌ Erro do Supabase:', error);
        toast({
          variant: "destructive",
          title: "Erro de conexão",
          description: `Erro: ${error.message}`
        });
        return;
      }

      if (!validacao || validacao.length === 0 || !validacao[0].valid) {
        console.log('❌ Código não encontrado ou funcionário inativo');
        toast({
          variant: "destructive",
          title: "Código não encontrado",
          description: "Verifique o código e tente novamente"
        });
        return;
      }

      const funcionario = validacao[0];
      console.log('✅ Funcionário validado:', funcionario);
      onFuncionarioValidado(funcionario.funcionario_id, funcionario.nome_completo);
    } catch (err) {
      console.error('❌ Erro geral na validação:', err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: `Erro ao validar código: ${err instanceof Error ? err.message : 'Erro desconhecido'}`
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
        disabled={codigo.length !== 4 || validando || isBlocked}
        className="w-full"
        variant="secondary"
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

      <div className="space-y-2">
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
        
        {isBlocked && (
          <div className="flex items-center justify-center gap-2 text-sm text-red-500">
            <Shield className="h-4 w-4" />
            <span>Acesso temporariamente bloqueado</span>
          </div>
        )}
      </div>
    </div>
  );
}
