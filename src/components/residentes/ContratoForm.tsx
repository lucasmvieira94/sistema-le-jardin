import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ContratoFormData } from "./types";

interface ContratoFormProps {
  initialData?: Partial<ContratoFormData>;
  residenteNome: string;
  responsavelNome?: string;
  responsavelTelefone?: string;
  responsavelEmail?: string;
  onSubmit: (data: ContratoFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const SERVICOS_DISPONIVEIS = [
  "Hospedagem completa",
  "Alimentação (café, almoço, lanche, jantar)",
  "Cuidados de enfermagem 24h",
  "Higiene pessoal assistida",
  "Lavanderia",
  "Recreação e atividades",
  "Fisioterapia",
  "Acompanhamento médico",
  "Medicamentos básicos",
  "Transporte para consultas",
];

const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function ContratoForm({
  initialData,
  residenteNome,
  responsavelNome,
  responsavelTelefone,
  responsavelEmail,
  onSubmit,
  onCancel,
  isLoading
}: ContratoFormProps) {
  const [formData, setFormData] = useState<ContratoFormData>({
    valor_mensalidade: initialData?.valor_mensalidade || "",
    dia_vencimento: initialData?.dia_vencimento || "10",
    forma_pagamento: initialData?.forma_pagamento || "boleto",
    data_inicio_contrato: initialData?.data_inicio_contrato || new Date().toISOString().split('T')[0],
    data_fim_contrato: initialData?.data_fim_contrato || "",
    contratante_nome: initialData?.contratante_nome || responsavelNome || "",
    contratante_cpf: initialData?.contratante_cpf || "",
    contratante_rg: initialData?.contratante_rg || "",
    contratante_endereco: initialData?.contratante_endereco || "",
    contratante_cidade: initialData?.contratante_cidade || "",
    contratante_estado: initialData?.contratante_estado || "SP",
    contratante_cep: initialData?.contratante_cep || "",
    contratante_telefone: initialData?.contratante_telefone || responsavelTelefone || "",
    contratante_email: initialData?.contratante_email || responsavelEmail || "",
    servicos_inclusos: initialData?.servicos_inclusos || ["Hospedagem completa", "Alimentação (café, almoço, lanche, jantar)", "Cuidados de enfermagem 24h"],
    servicos_adicionais: initialData?.servicos_adicionais || "",
    clausulas_especiais: initialData?.clausulas_especiais || "",
    observacoes: initialData?.observacoes || ""
  });

  const handleServicoToggle = (servico: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      servicos_inclusos: checked
        ? [...prev.servicos_inclusos, servico]
        : prev.servicos_inclusos.filter(s => s !== servico)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <ScrollArea className="h-[70vh] pr-4">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações do Residente */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <h3 className="font-semibold text-lg mb-2">Residente</h3>
          <p className="text-muted-foreground">{residenteNome}</p>
        </div>

        {/* Dados Financeiros */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">Informações Financeiras</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="valor_mensalidade">Valor da Mensalidade (R$) *</Label>
              <Input
                id="valor_mensalidade"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_mensalidade}
                onChange={(e) => setFormData({ ...formData, valor_mensalidade: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="dia_vencimento">Dia de Vencimento *</Label>
              <Select
                value={formData.dia_vencimento}
                onValueChange={(value) => setFormData({ ...formData, dia_vencimento: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(dia => (
                    <SelectItem key={dia} value={dia.toString()}>
                      Dia {dia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="forma_pagamento">Forma de Pagamento *</Label>
              <Select
                value={formData.forma_pagamento}
                onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto Bancário</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="data_inicio_contrato">Data de Início do Contrato *</Label>
              <Input
                id="data_inicio_contrato"
                type="date"
                value={formData.data_inicio_contrato}
                onChange={(e) => setFormData({ ...formData, data_inicio_contrato: e.target.value })}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="data_fim_contrato">Data de Término (opcional)</Label>
              <Input
                id="data_fim_contrato"
                type="date"
                value={formData.data_fim_contrato}
                onChange={(e) => setFormData({ ...formData, data_fim_contrato: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Dados do Contratante */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">Dados do Contratante (Responsável Financeiro)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contratante_nome">Nome Completo *</Label>
              <Input
                id="contratante_nome"
                value={formData.contratante_nome}
                onChange={(e) => setFormData({ ...formData, contratante_nome: e.target.value })}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="contratante_cpf">CPF *</Label>
              <Input
                id="contratante_cpf"
                value={formData.contratante_cpf}
                onChange={(e) => setFormData({ ...formData, contratante_cpf: e.target.value })}
                placeholder="000.000.000-00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contratante_rg">RG</Label>
              <Input
                id="contratante_rg"
                value={formData.contratante_rg}
                onChange={(e) => setFormData({ ...formData, contratante_rg: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="contratante_telefone">Telefone *</Label>
              <Input
                id="contratante_telefone"
                value={formData.contratante_telefone}
                onChange={(e) => setFormData({ ...formData, contratante_telefone: e.target.value })}
                placeholder="(11) 99999-9999"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="contratante_email">E-mail</Label>
            <Input
              id="contratante_email"
              type="email"
              value={formData.contratante_email}
              onChange={(e) => setFormData({ ...formData, contratante_email: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="contratante_endereco">Endereço Completo</Label>
            <Input
              id="contratante_endereco"
              value={formData.contratante_endereco}
              onChange={(e) => setFormData({ ...formData, contratante_endereco: e.target.value })}
              placeholder="Rua, número, complemento, bairro"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="contratante_cidade">Cidade</Label>
              <Input
                id="contratante_cidade"
                value={formData.contratante_cidade}
                onChange={(e) => setFormData({ ...formData, contratante_cidade: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="contratante_estado">Estado</Label>
              <Select
                value={formData.contratante_estado}
                onValueChange={(value) => setFormData({ ...formData, contratante_estado: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_BRASIL.map(uf => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="contratante_cep">CEP</Label>
              <Input
                id="contratante_cep"
                value={formData.contratante_cep}
                onChange={(e) => setFormData({ ...formData, contratante_cep: e.target.value })}
                placeholder="00000-000"
              />
            </div>
          </div>
        </div>

        {/* Serviços Inclusos */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">Serviços Inclusos</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SERVICOS_DISPONIVEIS.map(servico => (
              <div key={servico} className="flex items-center space-x-2">
                <Checkbox
                  id={servico}
                  checked={formData.servicos_inclusos.includes(servico)}
                  onCheckedChange={(checked) => handleServicoToggle(servico, checked as boolean)}
                />
                <Label htmlFor={servico} className="text-sm font-normal cursor-pointer">
                  {servico}
                </Label>
              </div>
            ))}
          </div>

          <div>
            <Label htmlFor="servicos_adicionais">Serviços Adicionais</Label>
            <Textarea
              id="servicos_adicionais"
              value={formData.servicos_adicionais}
              onChange={(e) => setFormData({ ...formData, servicos_adicionais: e.target.value })}
              placeholder="Descreva outros serviços específicos contratados..."
              className="min-h-[60px]"
            />
          </div>
        </div>

        {/* Cláusulas e Observações */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">Termos Adicionais</h3>
          
          <div>
            <Label htmlFor="clausulas_especiais">Cláusulas Especiais</Label>
            <Textarea
              id="clausulas_especiais"
              value={formData.clausulas_especiais}
              onChange={(e) => setFormData({ ...formData, clausulas_especiais: e.target.value })}
              placeholder="Condições especiais acordadas entre as partes..."
              className="min-h-[80px]"
            />
          </div>

          <div>
            <Label htmlFor="observacoes">Observações Gerais</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Outras informações relevantes..."
              className="min-h-[60px]"
            />
          </div>
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-background pb-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar Contrato"}
          </Button>
        </div>
      </form>
    </ScrollArea>
  );
}
