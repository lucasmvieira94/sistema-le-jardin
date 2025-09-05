import { useState, useEffect } from 'react';
import { Users, Edit, Trash2, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'employee';
  funcionario?: {
    nome_completo: string;
    email: string;
  };
}

export function GestaoPermissoes() {
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    carregarUsuarios();
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

  const atualizarRole = async (userId: string, newRole: 'admin' | 'employee') => {
    setUpdating(userId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Permissão atualizada com sucesso!');
      await carregarUsuarios();
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
      await carregarUsuarios();
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
      toast.error('Erro ao remover usuário');
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
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}