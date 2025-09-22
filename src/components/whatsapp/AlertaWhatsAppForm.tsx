import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Plus, X } from "lucide-react";
import { AlertaWhatsApp } from "@/hooks/useWhatsAppAlertas";

interface AlertaWhatsAppFormProps {
  alerta?: AlertaWhatsApp;
  onSalvar: (dados: any) => Promise<void>;
  onCancelar: () => void;
}

export function AlertaWhatsAppForm({ alerta, onSalvar, onCancelar }: AlertaWhatsAppFormProps) {
  const [dados, setDados] = useState<{
    nome: string;
    mensagem: string;
    numeros_destino: string[];
    frequencia_tipo: 'horario_especifico' | 'horas' | 'dias' | 'semanas' | 'meses';
    frequencia_valor: number;
    horario_especifico: string;
    data_inicio: string;
    ativo: boolean;
    mensagem_dinamica: boolean;
    timezone: string;
  }>({
    nome: '',
    mensagem: '',
    numeros_destino: [],
    frequencia_tipo: 'dias',
    frequencia_valor: 1,
    horario_especifico: '09:00',
    data_inicio: new Date().toISOString().slice(0, 16),
    ativo: true,
    mensagem_dinamica: false,
    timezone: 'America/Sao_Paulo'
  });

  const [novoNumero, setNovoNumero] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (alerta) {
      setDados({
        nome: alerta.nome,
        mensagem: alerta.mensagem,
        numeros_destino: [...alerta.numeros_destino],
        frequencia_tipo: alerta.frequencia_tipo,
        frequencia_valor: alerta.frequencia_valor,
        horario_especifico: alerta.horario_especifico || '09:00',
        data_inicio: new Date(alerta.data_inicio).toISOString().slice(0, 16),
        ativo: alerta.ativo,
        mensagem_dinamica: alerta.mensagem_dinamica,
        timezone: alerta.timezone
      });
    }
  }, [alerta]);

  const validarFormulario = () => {
    const newErrors: Record<string, string> = {};

    if (!dados.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (!dados.mensagem.trim()) {
      newErrors.mensagem = 'Mensagem é obrigatória';
    }

    if (dados.numeros_destino.length === 0) {
      newErrors.numeros_destino = 'Pelo menos um número é obrigatório';
    }

    if (dados.frequencia_valor < 1) {
      newErrors.frequencia_valor = 'Valor deve ser maior que 0';
    }

    if (dados.frequencia_tipo === 'horario_especifico' && !dados.horario_especifico) {
      newErrors.horario_especifico = 'Horário é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const adicionarNumero = () => {
    if (!novoNumero.trim()) return;
    
    // Validar formato do número (básico)
    const numeroLimpo = novoNumero.replace(/\D/g, '');
    if (numeroLimpo.length < 10) {
      setErrors({ ...errors, novoNumero: 'Número deve ter pelo menos 10 dígitos' });
      return;
    }

    // Adicionar código do país se não tiver
    const numeroFormatado = numeroLimpo.startsWith('55') ? `+${numeroLimpo}` : `+55${numeroLimpo}`;
    
    if (dados.numeros_destino.includes(numeroFormatado)) {
      setErrors({ ...errors, novoNumero: 'Número já foi adicionado' });
      return;
    }

    setDados({
      ...dados,
      numeros_destino: [...dados.numeros_destino, numeroFormatado]
    });
    setNovoNumero('');
    setErrors({ ...errors, novoNumero: '' });
  };

  const removerNumero = (index: number) => {
    setDados({
      ...dados,
      numeros_destino: dados.numeros_destino.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validarFormulario()) return;

    setLoading(true);
    try {
      await onSalvar(dados);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="nome">Nome do Alerta *</Label>
          <Input
            id="nome"
            value={dados.nome}
            onChange={(e) => setDados({ ...dados, nome: e.target.value })}
            placeholder="Ex: Lembrete de Medicação"
            className={errors.nome ? 'border-destructive' : ''}
          />
          {errors.nome && (
            <p className="text-sm text-destructive mt-1">{errors.nome}</p>
          )}
        </div>

        <div>
          <Label htmlFor="mensagem">Mensagem *</Label>
          <Textarea
            id="mensagem"
            value={dados.mensagem}
            onChange={(e) => setDados({ ...dados, mensagem: e.target.value })}
            placeholder="Digite a mensagem que será enviada..."
            rows={4}
            className={errors.mensagem ? 'border-destructive' : ''}
          />
          {errors.mensagem && (
            <p className="text-sm text-destructive mt-1">{errors.mensagem}</p>
          )}
          {dados.mensagem_dinamica && (
            <div className="mt-2 p-3 bg-muted rounded text-sm">
              <p className="font-medium mb-2">Variáveis disponíveis:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span><code>{'{{data_atual}}'}</code> - Data atual</span>
                <span><code>{'{{hora_atual}}'}</code> - Hora atual</span>
                <span><code>{'{{data_hora_atual}}'}</code> - Data e hora</span>
                <span><code>{'{{dia_semana}}'}</code> - Dia da semana</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <Label>Números de WhatsApp *</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={novoNumero}
              onChange={(e) => setNovoNumero(e.target.value)}
              placeholder="Ex: 11987654321"
              className={errors.novoNumero ? 'border-destructive' : ''}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), adicionarNumero())}
            />
            <Button type="button" variant="outline" onClick={adicionarNumero}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {errors.novoNumero && (
            <p className="text-sm text-destructive mt-1">{errors.novoNumero}</p>
          )}
          {errors.numeros_destino && (
            <p className="text-sm text-destructive mt-1">{errors.numeros_destino}</p>
          )}
          {dados.numeros_destino.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {dados.numeros_destino.map((numero, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {numero}
                  <button
                    type="button"
                    onClick={() => removerNumero(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configurações de Frequência</CardTitle>
            <CardDescription>
              Defina quando e com que frequência o alerta será enviado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Tipo de Frequência</Label>
              <Select
                value={dados.frequencia_tipo}
                onValueChange={(value: any) => setDados({ ...dados, frequencia_tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="horario_especifico">Horário Específico (Diário)</SelectItem>
                  <SelectItem value="horas">A cada X horas</SelectItem>
                  <SelectItem value="dias">A cada X dias</SelectItem>
                  <SelectItem value="semanas">A cada X semanas</SelectItem>
                  <SelectItem value="meses">A cada X meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dados.frequencia_tipo === 'horario_especifico' ? (
              <div>
                <Label htmlFor="horario">Horário *</Label>
                <Input
                  id="horario"
                  type="time"
                  value={dados.horario_especifico}
                  onChange={(e) => setDados({ ...dados, horario_especifico: e.target.value })}
                  className={errors.horario_especifico ? 'border-destructive' : ''}
                />
                {errors.horario_especifico && (
                  <p className="text-sm text-destructive mt-1">{errors.horario_especifico}</p>
                )}
              </div>
            ) : (
              <div>
                <Label htmlFor="valor">
                  {dados.frequencia_tipo === 'horas' && 'A cada quantas horas'}
                  {dados.frequencia_tipo === 'dias' && 'A cada quantos dias'}
                  {dados.frequencia_tipo === 'semanas' && 'A cada quantas semanas'}
                  {dados.frequencia_tipo === 'meses' && 'A cada quantos meses'}
                  *
                </Label>
                <Input
                  id="valor"
                  type="number"
                  min="1"
                  value={dados.frequencia_valor}
                  onChange={(e) => setDados({ ...dados, frequencia_valor: parseInt(e.target.value) || 1 })}
                  className={errors.frequencia_valor ? 'border-destructive' : ''}
                />
                {errors.frequencia_valor && (
                  <p className="text-sm text-destructive mt-1">{errors.frequencia_valor}</p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="data_inicio">Data/Hora de Início</Label>
              <Input
                id="data_inicio"
                type="datetime-local"
                value={dados.data_inicio}
                onChange={(e) => setDados({ ...dados, data_inicio: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="ativo">Alerta Ativo</Label>
              <p className="text-sm text-muted-foreground">
                Desative para pausar o alerta sem excluí-lo
              </p>
            </div>
            <Switch
              id="ativo"
              checked={dados.ativo}
              onCheckedChange={(checked) => setDados({ ...dados, ativo: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="mensagem_dinamica">Mensagem Dinâmica</Label>
              <p className="text-sm text-muted-foreground">
                Permite usar variáveis como data/hora atual na mensagem
              </p>
            </div>
            <Switch
              id="mensagem_dinamica"
              checked={dados.mensagem_dinamica}
              onCheckedChange={(checked) => setDados({ ...dados, mensagem_dinamica: checked })}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : alerta ? 'Atualizar' : 'Criar Alerta'}
        </Button>
      </div>
    </form>
  );
}