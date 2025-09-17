import { useState } from 'react';
import { UserPlus, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ConviteGestorProps {
  onConviteEnviado?: () => void;
}

export function ConviteGestor({ onConviteEnviado }: ConviteGestorProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    nome_completo: '',
    cpf: '',
    funcao: 'Gestor'
  });

  const enviarConvite = async () => {
    if (!formData.email || !formData.nome_completo || !formData.cpf) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSending(true);
    try {
      // Verificar se CPF já existe
      const { data: existingCpf, error: cpfError } = await supabase
        .from('funcionarios')
        .select('id, nome_completo')
        .eq('cpf', formData.cpf)
        .maybeSingle();

      if (cpfError && cpfError.code !== 'PGRST116') {
        throw cpfError;
      }

      if (existingCpf) {
        toast.error(`CPF já cadastrado para: ${existingCpf.nome_completo}`);
        return;
      }

      // Verificar se email já existe
      const { data: existingEmail, error: emailCheckError } = await supabase
        .from('funcionarios')
        .select('id, nome_completo')
        .eq('email', formData.email)
        .maybeSingle();

      if (emailCheckError && emailCheckError.code !== 'PGRST116') {
        throw emailCheckError;
      }

      if (existingEmail) {
        toast.error(`Email já cadastrado para: ${existingEmail.nome_completo}`);
        return;
      }

      // Verificar se já existe convite pendente para este email
      const { data: convitePendente } = await supabase
        .from('convites')
        .select('id, status')
        .eq('email', formData.email)
        .eq('status', 'pendente')
        .maybeSingle();

      if (convitePendente) {
        toast.error('Já existe um convite pendente para este email');
        return;
      }

      // Gerar token único para o convite
      const { data: tokenData, error: tokenError } = await supabase
        .rpc('gerar_token_convite');

      if (tokenError || !tokenData) {
        throw new Error('Erro ao gerar token de convite');
      }

      // Criar convite na tabela
      const { data: novoConvite, error: conviteError } = await supabase
        .from('convites')
        .insert({
          email: formData.email,
          role: 'admin', // Gestores são admins por padrão
          token: tokenData,
          status: 'pendente',
          enviado_por: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (conviteError) throw conviteError;

      // Gerar código único de 4 dígitos
      const gerarCodigoUnico = async (): Promise<string> => {
        for (let tentativas = 0; tentativas < 10; tentativas++) {
          const codigo = Math.floor(1000 + Math.random() * 9000).toString();
          const { data: existingCodigo, error: codigoError } = await supabase
            .from('funcionarios')
            .select('id')
            .eq('codigo_4_digitos', codigo)
            .maybeSingle();
          
          if (codigoError && codigoError.code !== 'PGRST116') {
            throw codigoError;
          }
          
          if (!existingCodigo) {
            return codigo;
          }
        }
        throw new Error('Não foi possível gerar um código único');
      };

      const codigoUnico = await gerarCodigoUnico();

      // Buscar primeira escala disponível
      const { data: escalaDisponivel, error: escalaError } = await supabase
        .from('escalas')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (escalaError) {
        throw new Error('Erro ao buscar escalas disponíveis');
      }

      if (!escalaDisponivel) {
        toast.error('Nenhuma escala cadastrada. Cadastre uma escala antes de convidar gestores.');
        return;
      }

      // Criar funcionário
      const { data: funcionario, error: funcionarioError } = await supabase
        .from('funcionarios')
        .insert({
          nome_completo: formData.nome_completo,
          email: formData.email,
          cpf: formData.cpf,
          funcao: formData.funcao,
          data_nascimento: new Date().toISOString().split('T')[0],
          data_admissao: new Date().toISOString().split('T')[0],
          data_inicio_vigencia: new Date().toISOString().split('T')[0],
          escala_id: escalaDisponivel.id,
          codigo_4_digitos: codigoUnico,
          ativo: false
        })
        .select()
        .single();

      if (funcionarioError) throw funcionarioError;

      // Enviar convite por email através de edge function
      const { error: inviteEmailError } = await supabase.functions.invoke('enviar-convite-gestor', {
        body: {
          email: formData.email,
          nome: formData.nome_completo,
          funcao: formData.funcao,
          funcionario_id: funcionario.id,
          token: tokenData,
          conviteId: novoConvite.id
        }
      });

      if (inviteEmailError) {
        // Se falhou ao enviar email, marcar convite como erro
        await supabase
          .from('convites')
          .update({ status: 'erro_envio' })
          .eq('id', novoConvite.id);
        
        throw inviteEmailError;
      }

      toast.success('Convite enviado com sucesso!');
      setFormData({ email: '', nome_completo: '', cpf: '', funcao: 'Gestor' });
      setOpen(false);
      
      // Notificar componente pai
      if (onConviteEnviado) {
        onConviteEnviado();
      }
    } catch (error: any) {
      console.error('Erro ao enviar convite:', error);
      
      // Tratamento específico de erros
      if (error?.code === '23505') {
        if (error.message.includes('funcionarios_cpf_key')) {
          toast.error('Este CPF já está cadastrado no sistema');
        } else if (error.message.includes('funcionarios_email_key')) {
          toast.error('Este email já está cadastrado no sistema');
        } else {
          toast.error('Dados já existem no sistema');
        }
      } else if (error?.message) {
        toast.error(`Erro: ${error.message}`);
      } else {
        toast.error('Erro ao enviar convite. Tente novamente.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Convidar Novo Gestor
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Mail className="w-4 h-4 mr-2" />
                Enviar Convite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar Novo Gestor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="nome">Nome Completo *</Label>
                  <Input
                    id="nome"
                    value={formData.nome_completo}
                    onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                    placeholder="Nome completo do gestor"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <Label htmlFor="cpf">CPF *</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <Label htmlFor="funcao">Função</Label>
                  <Input
                    id="funcao"
                    value={formData.funcao}
                    onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
                    placeholder="Gestor"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={enviarConvite} disabled={sending}>
                    {sending ? 'Enviando...' : 'Enviar Convite'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Convide novos gestores para acessar o sistema. Eles receberão um email com instruções para criar sua conta.
        </p>
      </CardContent>
    </Card>
  );
}