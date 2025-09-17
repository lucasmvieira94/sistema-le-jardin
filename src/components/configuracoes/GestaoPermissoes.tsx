import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Users, Shield, Mail, RefreshCw, X, Clock, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'employee';
  funcionario?: {
    nome_completo: string;
    email: string;
  };
}

interface Convite {
  id: string;
  email: string;
  role: 'admin' | 'employee';
  token: string;
  status: string; // Permitir string genérico do banco
  data_envio: string;
  data_expiracao: string;
  enviado_por: string;
}

export const GestaoPermissoes = forwardRef<{ carregarDados: () => void }>((props, ref) => {
  const [users, setUsers] = useState<UserRole[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [reenviadoConvites, setReenviadoConvites] = useState<string[]>([]);

  const carregarDados = async () => {
    await Promise.all([carregarUsuarios(), carregarConvites()]);
  };

  useImperativeHandle(ref, () => ({
    carregarDados
  }));

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarUsuarios = async () => {
    try {
      // Buscar users roles junto com dados dos funcionários
      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select('*');

      if (error) throw error;

      // Para cada user role, buscar dados do funcionário
      const usersWithFuncionarios = await Promise.all(
        (userRoles || []).map(async (userRole) => {
          const { data: funcionario } = await supabase
            .from('funcionarios')
            .select('nome_completo, email')
            .eq('user_id', userRole.user_id)
            .single();

          return {
            ...userRole,
            funcionario
          };
        })
      );

      setUsers(usersWithFuncionarios.filter(user => user.funcionario));
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const carregarConvites = async () => {
    try {
      const { data, error } = await supabase
        .from('convites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setConvites(data || []);
    } catch (error) {
      console.error('Erro ao carregar convites:', error);
      toast.error('Erro ao carregar convites');
    }
  };

  const atualizarRole = async (userId: string, newRole: 'admin' | 'employee') => {
    setUpdating(userId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Permissão atualizada com sucesso!');
      await carregarDados();
    } catch (error) {
      console.error('Erro ao atualizar permissão:', error);
      toast.error('Erro ao atualizar permissão');
    } finally {
      setUpdating(null);
    }
  };

  const removerUsuario = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Usuário removido com sucesso!');
      await carregarDados();
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
      toast.error('Erro ao remover usuário');
    }
  };

  const reenviarConvite = async (conviteId: string, email: string) => {
    try {
      setReenviadoConvites(prev => [...prev, conviteId]);
      
      const { error } = await supabase.functions.invoke('enviar-convite-gestor', {
        body: { 
          email,
          isReenvio: true,
          conviteId 
        }
      });

      if (error) throw error;

      // Atualizar data de envio do convite
      await supabase
        .from('convites')
        .update({ data_envio: new Date().toISOString() })
        .eq('id', conviteId);

      toast.success('Convite reenviado com sucesso!');
      await carregarConvites();
    } catch (error) {
      console.error('Erro ao reenviar convite:', error);
      toast.error('Erro ao reenviar convite');
    } finally {
      setReenviadoConvites(prev => prev.filter(id => id !== conviteId));
    }
  };

  const revogarConvite = async (conviteId: string) => {
    try {
      const { error } = await supabase
        .from('convites')
        .update({ status: 'revogado' })
        .eq('id', conviteId);

      if (error) throw error;

      toast.success('Convite revogado com sucesso!');
      await carregarConvites();
    } catch (error) {
      console.error('Erro ao revogar convite:', error);
      toast.error('Erro ao revogar convite');
    }
  };

  const getRoleBadge = (role: string) => {
    return role === 'admin' ? (
      <Badge variant="default" className="flex items-center gap-1">
        <Shield className="w-3 h-3" />
        Administrador
      </Badge>
    ) : (
      <Badge variant="secondary">Funcionário</Badge>
    );
  };

  const getStatusBadge = (status: string, dataExpiracao: string) => {
    const isExpired = new Date(dataExpiracao) < new Date();
    
    if (status === 'revogado') {
      return <Badge variant="destructive">Revogado</Badge>;
    } else if (status === 'aceito') {
      return <Badge variant="default" className="bg-green-100 text-green-800">Aceito</Badge>;
    } else if (isExpired || status === 'expirado') {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-600">Expirado</Badge>;
    } else {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
        <Clock className="w-3 h-3 mr-1" />
        Pendente
      </Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Gestão de Permissões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center p-4 border rounded">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-32"></div>
                  <div className="h-3 bg-muted rounded w-48"></div>
                </div>
                <div className="h-8 bg-muted rounded w-24"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Gestão de Permissões
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="usuarios" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="usuarios">Usuários Ativos</TabsTrigger>
            <TabsTrigger value="convites">Convites ({convites.filter(c => c.status === 'pendente').length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="usuarios" className="space-y-4 mt-4">
            {users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum usuário encontrado
              </div>
            ) : (
              users.map((user) => (
                <div key={user.id} className="flex justify-between items-center p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">{user.funcionario?.nome_completo}</div>
                    <div className="text-sm text-muted-foreground">{user.funcionario?.email}</div>
                    {getRoleBadge(user.role)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={user.role}
                      onValueChange={(newRole) => atualizarRole(user.user_id, newRole as 'admin' | 'employee')}
                      disabled={updating === user.user_id}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Funcionário</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover usuário</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removerUsuario(user.user_id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="convites" className="space-y-4 mt-4">
            {convites.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>Nenhum convite encontrado</p>
                <p className="text-sm">Use o "Convidar Gestor" para enviar novos convites</p>
              </div>
            ) : (
              <div className="space-y-3">
                {convites.map((convite) => (
                  <div key={convite.id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{convite.email}</span>
                        {getRoleBadge(convite.role)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          Enviado {formatDistanceToNow(new Date(convite.data_envio), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </span>
                        <span>•</span>
                        <span>
                          Expira {formatDistanceToNow(new Date(convite.data_expiracao), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </span>
                      </div>
                      {getStatusBadge(convite.status, convite.data_expiracao)}
                    </div>
                    
                    {convite.status === 'pendente' && new Date(convite.data_expiracao) > new Date() && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reenviarConvite(convite.id, convite.email)}
                          disabled={reenviadoConvites.includes(convite.id)}
                        >
                          {reenviadoConvites.includes(convite.id) ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Mail className="w-4 h-4" />
                          )}
                          Reenviar
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <X className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revogar convite</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja revogar este convite para {convite.email}? 
                                O usuário não conseguirá mais usar este link para se cadastrar.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => revogarConvite(convite.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Revogar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
});

GestaoPermissoes.displayName = 'GestaoPermissoes';