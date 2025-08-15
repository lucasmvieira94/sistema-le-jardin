import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, UserPlus, Edit, User } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useUserRole } from "@/hooks/useUserRole";

interface Residente {
  id: string;
  nome_completo: string;
  data_nascimento: string;
  numero_prontuario: string;
  quarto?: string;
  responsavel_nome?: string;
  responsavel_telefone?: string;
  condicoes_medicas?: string;
  ativo: boolean;
  created_at: string;
}

export default function ResidentesList() {
  const [residentes, setResidentes] = useState<Residente[]>([]);
  const [filteredResidentes, setFilteredResidentes] = useState<Residente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isAdmin } = useUserRole();

  const fetchResidentes = async () => {
    try {
      const { data, error } = await supabase
        .from('residentes')
        .select('*')
        .eq('ativo', true)
        .order('nome_completo');

      if (error) throw error;
      
      setResidentes(data || []);
      setFilteredResidentes(data || []);
    } catch (error) {
      console.error('Erro ao carregar residentes:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar lista de residentes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResidentes();
  }, []);

  useEffect(() => {
    const filtered = residentes.filter(residente =>
      residente.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      residente.numero_prontuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (residente.quarto && residente.quarto.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredResidentes(filtered);
  }, [searchTerm, residentes]);

  const calcularIdade = (dataNascimento: string) => {
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();
    
    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    
    return idade;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Carregando residentes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por nome, prontuário ou quarto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        {isAdmin && (
          <Button className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Novo Residente
          </Button>
        )}
      </div>

      {filteredResidentes.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                {searchTerm ? "Nenhum residente encontrado" : "Nenhum residente cadastrado"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Tente uma busca diferente" : "Cadastre o primeiro residente para começar"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResidentes.map((residente) => (
            <Card key={residente.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg text-gray-900 mb-1">
                      {residente.nome_completo}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {residente.numero_prontuario}
                      </Badge>
                      {residente.quarto && (
                        <Badge variant="outline" className="text-xs">
                          Quarto {residente.quarto}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Idade:</span>
                    <span className="font-medium">{calcularIdade(residente.data_nascimento)} anos</span>
                  </div>
                  
                  {residente.responsavel_nome && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Responsável:</span>
                      <span className="font-medium text-right">{residente.responsavel_nome}</span>
                    </div>
                  )}
                  
                  {residente.responsavel_telefone && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Telefone:</span>
                      <span className="font-medium">{residente.responsavel_telefone}</span>
                    </div>
                  )}
                  
                  {residente.condicoes_medicas && (
                    <div className="mt-3 p-2 bg-yellow-50 rounded-md">
                      <p className="text-xs text-yellow-800 font-medium mb-1">Condições médicas:</p>
                      <p className="text-xs text-yellow-700">{residente.condicoes_medicas}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}