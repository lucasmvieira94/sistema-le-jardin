import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CartaoVacinalResidente } from "@/components/vacinas/CartaoVacinalResidente";
import { Syringe, Search, ArrowLeft } from "lucide-react";

interface Residente {
  id: string;
  nome_completo: string;
  numero_prontuario: string | null;
  quarto: string | null;
}

export default function ControleVacinasPublico() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const funcionarioId = params.get("funcionario_id") || undefined;
  const funcionarioNome = params.get("funcionario_nome") || "Funcionário";

  const [residentes, setResidentes] = useState<Residente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("residentes")
      .select("id, nome_completo, numero_prontuario, quarto")
      .eq("ativo", true)
      .order("nome_completo")
      .then(({ data }) => {
        setResidentes(data || []);
        setLoading(false);
      });
  }, []);

  const filtrados = residentes.filter((r) =>
    r.nome_completo.toLowerCase().includes(search.toLowerCase()),
  );

  const selecionado = residentes.find((r) => r.id === selectedId);

  if (selecionado) {
    return (
      <div className="container mx-auto p-4 max-w-3xl space-y-4">
        <Button variant="ghost" onClick={() => setSelectedId(null)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-xl font-bold">{selecionado.nome_completo}</h1>
          <p className="text-sm text-muted-foreground">
            {selecionado.numero_prontuario}
            {selecionado.quarto ? ` • Quarto ${selecionado.quarto}` : ""}
          </p>
        </div>
        <CartaoVacinalResidente
          residenteId={selecionado.id}
          residenteNome={selecionado.nome_completo}
          funcionarioId={funcionarioId}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/funcionario-access")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <span className="text-sm text-muted-foreground">{funcionarioNome}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
          <Syringe className="w-6 h-6 text-pink-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Cartão Vacinal</h1>
          <p className="text-xs text-muted-foreground">Selecione um residente para ver/registrar vacinas</p>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar residente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((r) => (
            <Card
              key={r.id}
              className="cursor-pointer hover:border-primary/40 active:scale-[0.99] transition-all"
              onClick={() => setSelectedId(r.id)}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{r.nome_completo}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.numero_prontuario}
                    {r.quarto ? ` • Quarto ${r.quarto}` : ""}
                  </p>
                </div>
                <Syringe className="w-5 h-5 text-pink-600" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
