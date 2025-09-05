import { useState } from 'react';
import { UserPlus, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export function ConviteGestor() {
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
      // Criar funcionário primeiro
      const { data: funcionario, error: funcionarioError } = await supabase
        .from('funcionarios')
        .insert({
          nome_completo: formData.nome_completo,
          email: formData.email,
          cpf: formData.cpf,
          funcao: formData.funcao,
          data_nascimento: new Date().toISOString().split('T')[0], // Data temporária
          data_admissao: new Date().toISOString().split('T')[0],
          data_inicio_vigencia: new Date().toISOString().split('T')[0],
          escala_id: 1, // Escala padrão
          codigo_4_digitos: Math.floor(1000 + Math.random() * 9000).toString(),
          ativo: false // Inativo até aceitar o convite
        })
        .select()
        .single();

      if (funcionarioError) throw funcionarioError;

      // Enviar convite por email através de edge function
      const { error: emailError } = await supabase.functions.invoke('enviar-convite-gestor', {
        body: {
          email: formData.email,
          nome: formData.nome_completo,
          funcao: formData.funcao,
          funcionario_id: funcionario.id
        }
      });

      if (emailError) throw emailError;

      toast.success('Convite enviado com sucesso!');
      setFormData({ email: '', nome_completo: '', cpf: '', funcao: 'Gestor' });
      setOpen(false);
    } catch (error) {
      console.error('Erro ao enviar convite:', error);
      toast.error('Erro ao enviar convite');
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