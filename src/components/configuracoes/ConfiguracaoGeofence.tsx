import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MapPin, Crosshair, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ConfiguracaoGeofenceProps {
  geofence_ativo: boolean;
  geofence_latitude: number | null;
  geofence_longitude: number | null;
  geofence_raio_metros: number;
  onChange: (campos: {
    geofence_ativo?: boolean;
    geofence_latitude?: number | null;
    geofence_longitude?: number | null;
    geofence_raio_metros?: number;
  }) => void;
}

export function ConfiguracaoGeofence({
  geofence_ativo,
  geofence_latitude,
  geofence_longitude,
  geofence_raio_metros,
  onChange,
}: ConfiguracaoGeofenceProps) {
  const [capturando, setCapturando] = useState(false);

  const capturarLocalizacao = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não é suportada neste dispositivo.");
      return;
    }

    setCapturando(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(7));
        const lng = Number(position.coords.longitude.toFixed(7));
        onChange({
          geofence_latitude: lat,
          geofence_longitude: lng,
        });
        toast.success(
          `Localização capturada com precisão de ${Math.round(position.coords.accuracy)}m. Lembre-se de salvar.`
        );
        setCapturando(false);
      },
      (error) => {
        console.error("Erro ao capturar localização:", error);
        toast.error(
          `Falha ao capturar localização: ${error.message}. Verifique se o GPS está ativo e permita o acesso.`
        );
        setCapturando(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const temCoordenadas = geofence_latitude != null && geofence_longitude != null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          Geofence (Cerca Virtual) do Ponto
        </CardTitle>
        <CardDescription>
          Restringe o registro de ponto à área física da empresa, validada por GPS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Toggle ativar/desativar */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="geofence-ativo" className="text-base">
              Ativar geofence para registro de ponto
            </Label>
            <p className="text-sm text-muted-foreground">
              Quando ativada, funcionários só conseguem bater ponto dentro do raio definido.
            </p>
          </div>
          <Switch
            id="geofence-ativo"
            checked={geofence_ativo}
            onCheckedChange={(checked) => onChange({ geofence_ativo: checked })}
          />
        </div>

        {/* Captura da localização */}
        <div className="space-y-3">
          <Label>Localização da Empresa</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lat" className="text-xs text-muted-foreground">
                Latitude
              </Label>
              <Input
                id="lat"
                type="number"
                step="0.0000001"
                value={geofence_latitude ?? ""}
                onChange={(e) =>
                  onChange({
                    geofence_latitude: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="-23.5505199"
              />
            </div>
            <div>
              <Label htmlFor="lng" className="text-xs text-muted-foreground">
                Longitude
              </Label>
              <Input
                id="lng"
                type="number"
                step="0.0000001"
                value={geofence_longitude ?? ""}
                onChange={(e) =>
                  onChange({
                    geofence_longitude: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="-46.6333094"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={capturarLocalizacao}
            disabled={capturando}
            className="w-full"
          >
            {capturando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Capturando localização...
              </>
            ) : (
              <>
                <Crosshair className="w-4 h-4 mr-2" />
                Usar minha localização atual
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground">
            💡 Acesse esta tela <strong>do dispositivo dentro da empresa</strong> e
            clique no botão acima para cadastrar automaticamente o ponto central.
          </p>
        </div>

        {/* Raio */}
        <div>
          <Label htmlFor="raio">Raio permitido (metros)</Label>
          <Input
            id="raio"
            type="number"
            min={20}
            max={5000}
            value={geofence_raio_metros}
            onChange={(e) =>
              onChange({ geofence_raio_metros: parseInt(e.target.value) || 150 })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Recomendado: 100m a 300m. Valores menores podem falhar em dias de baixo sinal de GPS.
          </p>
        </div>

        {/* Status */}
        {geofence_ativo && !temCoordenadas && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Configuração incompleta</AlertTitle>
            <AlertDescription>
              Geofence ativada, mas as coordenadas ainda não foram cadastradas.
              Funcionários não conseguirão registrar ponto até que a localização seja
              definida e salva.
            </AlertDescription>
          </Alert>
        )}

        {geofence_ativo && temCoordenadas && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Geofence configurada</AlertTitle>
            <AlertDescription>
              Apenas registros feitos dentro do raio de {geofence_raio_metros}m serão aceitos.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}