import { useSearchParams, useNavigate } from 'react-router-dom';
import { useFuncionarioSession } from '@/hooks/useFuncionarioSession';
import { useMinhasFolhasPonto, getFolhaPontoSignedUrl } from '@/hooks/useFolhasPonto';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Loader2, Download, Clock } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { formatarTimestampDataHora } from '@/utils/formatTimestamp';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function MinhasFolhasPonto() {
  useFuncionarioSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const funcionarioId = params.get('funcionario_id');
  const funcionarioNome = params.get('funcionario_nome') || '';

  const { data, isLoading } = useMinhasFolhasPonto(funcionarioId);

  const abrir = async (path: string, download = false) => {
    const url = await getFolhaPontoSignedUrl(path);
    if (!url) {
      toast({ variant: 'destructive', title: 'Não foi possível abrir a folha de ponto' });
      return;
    }
    if (download) {
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split('/').pop() || 'folha-ponto.pdf';
      a.click();
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="bg-white" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="text-white">
            <h1 className="text-xl sm:text-2xl font-bold">Minhas Folhas de Ponto</h1>
            <p className="text-sm opacity-90">{funcionarioNome}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Clock className="w-5 h-5" /> Folhas de ponto disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-green-700" /></div>
            ) : !data || data.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma folha de ponto disponível ainda.</p>
                <p className="text-xs mt-1">
                  Assim que o gestor gerar o relatório mensal, ela aparecerá aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <div>
                      <div className="font-semibold">
                        {MESES[f.mes - 1]} / {f.ano}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Disponibilizado em {formatarTimestampDataHora(f.created_at)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => abrir(f.path, false)}>
                        <FileText className="w-4 h-4 mr-1" /> Ver
                      </Button>
                      <Button size="sm" onClick={() => abrir(f.path, true)} className="bg-green-700 hover:bg-green-800">
                        <Download className="w-4 h-4 mr-1" /> Baixar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}