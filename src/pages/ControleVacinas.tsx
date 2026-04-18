import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CartaoVacinalResidente } from "@/components/vacinas/CartaoVacinalResidente";
import { Syringe, Search, ArrowLeft, AlertCircle } from "lucide-react";
import { format, parseISO, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Residente {
  id: string;
  nome_completo: string;
  numero_prontuario: string | null;
  quarto: string | null;
}

interface AlertaVacina {
  residente_id: string;
  residente_nome: string;
  vacina_nome: string;
  data_prevista: string;
  dias_diferenca: number;
}

export default function ControleVacinas() {
  const [residentes, setResidentes] = useState<Residente[]>([]);
  const [alertas, setAlertas] = useState<AlertaVacina[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);

      const [resRes, vacRes] = await Promise.all([
        supabase
          .from("residentes")
          .select("id, nome_completo, numero_prontuario, quarto")
          .eq("ativo", true)
          .order("nome_completo"),
        supabase
          .from("vacinas_residentes")
          .select("residente_id, nome_vacina, proxima_dose_prevista, residentes!inner(nome_completo)")
          .not("proxima_dose_prevista", "is", null),
      ]);

      setResidentes(resRes.data || []);

      // Calcular alertas (próximas 30 dias e atrasadas)
      const hoje = new Date();
      const alertasCalc: AlertaVacina[] = (vacRes.data || [])
        .map((v: any) => {
          const data = parseISO(v.proxima_dose_prevista);
          const diff = differenceInDays(data, hoje);
          return {
            residente_id: v.residente_id,
            residente_nome: v.residentes?.nome_completo || "—",
            vacina_nome: v.nome_vacina,
            data_prevista: v.proxima_dose_prevista,
            dias_diferenca: diff,
          };
        })
        .filter((a) => a.dias_diferenca <= 30)
        .sort((a, b) => a.dias_diferenca - b.dias_diferenca);

      setAlertas(alertasCalc);
      setLoading(false);
    };
    carregar();
  }, [selectedId]);

  const filtrados = residentes.filter((r) =>
    r.nome_completo.toLowerCase().includes(search.toLowerCase()),
  );

  const selecionado = residentes.find((r) => r.id === selectedId);

  if (selecionado) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-4">
        <Button variant="ghost" onClick={() => setSelectedId(null)} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar à lista
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{selecionado.nome_completo}</h1>
          <p className="text-sm text-muted-foreground">
            Prontuário: {selecionado.numero_prontuario || "—"}
            {selecionado.quarto ? ` • Quarto ${selecionado.quarto}` : ""}
          </p>
        </div>
        <CartaoVacinalResidente residenteId={selecionado.id} residenteNome={selecionado.nome_completo} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Syringe className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Controle de Vacinas</h1>
          <p className="text-sm text-muted-foreground">
            Cartão vacinal digital dos residentes — calendário do idoso e acompanhamento
          </p>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Alertas de Vacinação ({alertas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {alertas.map((a, i) => {
              const atrasada = a.dias_diferenca < 0;
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between p-2 rounded border-l-4 cursor-pointer hover:bg-accent/50 ${
                    atrasada ? "border-destructive bg-destructive/5" : "border-amber-500 bg-amber-500/5"
                  }`}
                  onClick={() => setSelectedId(a.residente_id)}
                >
                  <div>
                    <p className="font-medium text-sm">{a.residente_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.vacina_nome} • {format(parseISO(a.data_prevista), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge variant={atrasada ? "destructive" : "secondary"}>
                    {atrasada ? `Atrasada ${Math.abs(a.dias_diferenca)}d` : `Em ${a.dias_diferenca}d`}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar residente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map((r) => (
            <Card
              key={r.id}
              className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
              onClick={() => setSelectedId(r.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.nome_completo}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.numero_prontuario || "—"}
                      {r.quarto ? ` • Quarto ${r.quarto}` : ""}
                    </p>
                  </div>
                  <Syringe className="w-5 h-5 text-primary flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
