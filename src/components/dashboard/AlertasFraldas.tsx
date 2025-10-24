import { AlertTriangle, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFraldas } from "@/hooks/useFraldas";
import { useNavigate } from "react-router-dom";

export const AlertasFraldas = () => {
  const { alertas, loadingAlertas } = useFraldas();
  const navigate = useNavigate();

  if (loadingAlertas) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Alertas de Fraldas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  if (!alertas || alertas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Alertas de Fraldas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Nenhum alerta de estoque
          </div>
        </CardContent>
      </Card>
    );
  }

  const alertasCriticos = alertas.filter((a) => a.nivel_alerta === "critico");
  const alertasAviso = alertas.filter((a) => a.nivel_alerta === "aviso");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Alertas de Fraldas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {alertasCriticos.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Crítico ({alertasCriticos.length})
              </h4>
              <div className="space-y-2">
                {alertasCriticos.slice(0, 3).map((alerta) => (
                  <div
                    key={alerta.estoque_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {alerta.tipo_fralda} - {alerta.tamanho}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {alerta.quantidade_atual} unidades ({alerta.dias_restantes} dias
                        restantes)
                      </p>
                    </div>
                    <Badge variant="destructive">Crítico</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alertasAviso.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Aviso ({alertasAviso.length})
              </h4>
              <div className="space-y-2">
                {alertasAviso.slice(0, 2).map((alerta) => (
                  <div
                    key={alerta.estoque_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {alerta.tipo_fralda} - {alerta.tamanho}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {alerta.quantidade_atual} unidades ({alerta.dias_restantes} dias
                        restantes)
                      </p>
                    </div>
                    <Badge variant="outline">Aviso</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alertas.length > 5 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/controle-fraldas")}
            >
              Ver todos os alertas ({alertas.length})
            </Button>
          )}

          {alertas.length <= 5 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/controle-fraldas")}
            >
              Gerenciar Estoque
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
