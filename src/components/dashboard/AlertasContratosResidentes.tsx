import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileSignature, ArrowRight, AlertCircle } from "lucide-react";
import { formatarData } from "@/utils/dateUtils";
import {
  calcularStatusContrato,
  CONTRATO_STATUS_CLASSES,
  DIAS_ALERTA_RENOVACAO,
  type ContratoResumo,
} from "@/utils/contratoStatus";

type Item = {
  residenteId: string;
  nome: string;
  numeroContrato: string;
  dataFim: string;
  diasRestantes: number;
  vencido: boolean;
};

/**
 * Lembrete de gestão de contratos: lista contratos de residentes ativos
 * vencidos ou a vencer nos próximos 60 dias.
 */
export default function AlertasContratosResidentes() {
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: residentes }, { data: contratos }] = await Promise.all([
        supabase.from("residentes").select("id, nome_completo").eq("ativo", true),
        supabase
          .from("contratos_residentes")
          .select("id, residente_id, numero_contrato, status, data_inicio_contrato, data_fim_contrato"),
      ]);

      const lista: Item[] = (residentes ?? [])
        .map((r) => {
          const info = calcularStatusContrato(
            ((contratos ?? []) as ContratoResumo[]).filter((c) => c.residente_id === r.id)
          );
          if (
            (info.key !== "proximo_renovacao" && info.key !== "vencido") ||
            !info.contrato?.data_fim_contrato ||
            info.diasRestantes === null
          ) {
            return null;
          }
          return {
            residenteId: r.id,
            nome: r.nome_completo,
            numeroContrato: info.contrato.numero_contrato,
            dataFim: info.contrato.data_fim_contrato,
            diasRestantes: info.diasRestantes,
            vencido: info.key === "vencido",
          } as Item;
        })
        .filter((i): i is Item => i !== null)
        .sort((a, b) => a.diasRestantes - b.diasRestantes);

      setItens(lista);
      setLoading(false);
    })();
  }, []);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-primary" /> Contratos de Residentes
        </CardTitle>
        <Link to="/residentes">
          <Button size="sm" variant="ghost">
            Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-2">Carregando...</p>
        ) : itens.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Nenhum contrato vencendo nos próximos {DIAS_ALERTA_RENOVACAO} dias. 🎉
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-64 overflow-y-auto">
            {itens.map((i) => (
              <li
                key={i.residenteId}
                className={`flex items-center justify-between p-2 rounded text-sm border-l-4 ${
                  i.vencido ? "border-red-500 bg-red-500/5" : "border-amber-500 bg-amber-500/5"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate flex items-center gap-1">
                    {i.vencido && <AlertCircle className="h-3 w-3 text-red-600 shrink-0" />}
                    {i.nome}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Contrato {i.numeroContrato} • {formatarData(i.dataFim)}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`${CONTRATO_STATUS_CLASSES[i.vencido ? "vencido" : "proximo_renovacao"]} shrink-0 ml-2`}
                >
                  {i.vencido ? `Vencido há ${Math.abs(i.diasRestantes)}d` : `Faltam ${i.diasRestantes}d`}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
