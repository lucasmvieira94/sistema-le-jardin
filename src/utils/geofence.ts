/**
 * Calcula a distância em metros entre dois pontos geográficos
 * usando a fórmula de Haversine.
 */
export function calcularDistanciaMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Raio da Terra em metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface GeofenceConfig {
  geofence_ativo: boolean;
  geofence_latitude: number | null;
  geofence_longitude: number | null;
  geofence_raio_metros: number;
}

export interface ValidacaoGeofence {
  permitido: boolean;
  distancia: number | null;
  mensagem: string;
}

/**
 * Valida se as coordenadas atuais estão dentro do geofence configurado.
 */
export function validarGeofence(
  config: GeofenceConfig | null,
  latitude: number | null,
  longitude: number | null
): ValidacaoGeofence {
  // Geofence desativada → permite sempre
  if (!config || !config.geofence_ativo) {
    return { permitido: true, distancia: null, mensagem: "" };
  }

  // Falta configuração de coordenadas
  if (config.geofence_latitude == null || config.geofence_longitude == null) {
    return {
      permitido: false,
      distancia: null,
      mensagem:
        "Geofence ativada, mas a empresa ainda não cadastrou a localização. Avise o gestor.",
    };
  }

  // Sem GPS disponível
  if (latitude == null || longitude == null) {
    return {
      permitido: false,
      distancia: null,
      mensagem:
        "Não foi possível obter sua localização. Ative o GPS e permita o acesso à localização no navegador.",
    };
  }

  const distancia = calcularDistanciaMetros(
    latitude,
    longitude,
    Number(config.geofence_latitude),
    Number(config.geofence_longitude)
  );

  const raio = config.geofence_raio_metros || 150;

  if (distancia > raio) {
    return {
      permitido: false,
      distancia,
      mensagem: `Você está a ${Math.round(distancia)}m do local de trabalho. O raio permitido é de ${raio}m.`,
    };
  }

  return {
    permitido: true,
    distancia,
    mensagem: `Dentro da área permitida (${Math.round(distancia)}m).`,
  };
}