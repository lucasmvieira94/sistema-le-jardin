import React, { useState } from 'react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Loader2 } from 'lucide-react';
import { validateFuncionarioCode } from '@/utils/validation';

interface CodigoFinalizacaoProntuarioProps {
  onCodigoValidado: (codigo: string, funcionarioNome: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export default function CodigoFinalizacaoProntuario({ 
  onCodigoValidado, 
  onCancel,
  disabled = false 
}: CodigoFinalizacaoProntuarioProps) {
  const [codigo, setCodigo] = useState('');
  const [validando, setValidando] = useState(false);

  const validarCodigo = async () => {
    if (!validateFuncionarioCode(codigo)) {
      toast({
        variant: "destructive",
        title: "Código inválido",
        description: "O código deve ter 4 dígitos numéricos"
      });
      return;
    }

    setValidando(true);
    try {
      // Validar código do funcionário
      const { data, error } = await supabase
        .rpc('validar_codigo_funcionario', { p_codigo: codigo });

      if (error) {
        console.error('Erro na validação:', error);
        toast({
          variant: "destructive",
          title: "Erro na validação",
          description: "Erro interno do servidor. Tente novamente."
        });
        return;
      }

      const resultado = data?.[0];
      
      if (resultado?.valid) {
        toast({
          title: "Código validado",
          description: `Funcionário: ${resultado.nome_completo}`,
        });
        onCodigoValidado(codigo, resultado.nome_completo);
      } else {
        toast({
          variant: "destructive",
          title: "Código não encontrado",
          description: "Código de funcionário inválido ou funcionário inativo."
        });
      }
    } catch (error) {
      console.error('Erro na validação:', error);
      toast({
        variant: "destructive",
        title: "Erro inesperado",
        description: "Não foi possível validar o código. Tente novamente."
      });
    } finally {
      setValidando(false);
    }
  };

  const handleCodigoChange = (value: string) => {
    setCodigo(value);
    if (value.length === 4) {
      // Auto-submit quando completar 4 dígitos
      setTimeout(() => {
        if (value === codigo) {
          validarCodigo();
        }
      }, 500);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Shield className="w-12 h-12 text-primary mx-auto mb-3" />
        <h3 className="text-lg font-semibold">Confirmação de Segurança</h3>
        <p className="text-sm text-muted-foreground">
          Digite seu código de 4 dígitos para finalizar o prontuário
        </p>
      </div>

      <div className="flex justify-center">
        <InputOTP
          maxLength={4}
          value={codigo}
          onChange={handleCodigoChange}
          disabled={validando || disabled}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={validando || disabled}
            className="flex-1"
          >
            Cancelar
          </Button>
        )}
        <Button
          onClick={validarCodigo}
          disabled={codigo.length !== 4 || validando || disabled}
          className="flex-1"
        >
          {validando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Validando...
            </>
          ) : (
            'Finalizar Prontuário'
          )}
        </Button>
      </div>
    </div>
  );
}