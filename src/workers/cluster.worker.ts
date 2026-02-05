import type { City } from '../types/geo';

export interface ClusterWorkerRequest {
  readonly type: 'CALCULATE_DISTANCES';
  readonly payload: {
    readonly cities: readonly City[];
    readonly centroid: { readonly lat: number; readonly lon: number };
    readonly clusterId: number;
  };
}

export interface ClusterWorkerResponse {
  readonly type: 'DISTANCES_CALCULATED';
  readonly payload: {
    readonly clusterId: number;
    readonly distances: ReadonlyArray<{
      readonly cityId: string;
      readonly distance: number;
    }>;
  };
}

const ctx: any = self;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Math.sqrt(
    Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2)
  );
}

ctx.addEventListener('message', (event: MessageEvent<ClusterWorkerRequest>) => {
  const req = event.data;

  if (req.type === 'CALCULATE_DISTANCES') {
    const { cities, centroid, clusterId } = req.payload;

    console.log(`🔍 [Worker ${clusterId}] Recebido: ${cities.length} cidades para processar`);
    console.log(`📍 [Worker ${clusterId}] Centróide alvo: [${centroid.lat.toFixed(2)}, ${centroid.lon.toFixed(2)}]`);

    const distances = cities.map(city => ({
      cityId: city.id,
      distance: calculateDistance(
        city.latitude,
        city.longitude,
        centroid.lat,
        centroid.lon
      ),
    }));

    console.log(`✅ [Worker ${clusterId}] Concluído: ${distances.length} distâncias calculadas`);

    const response: ClusterWorkerResponse = {
      type: 'DISTANCES_CALCULATED',
      payload: {
        clusterId,
        distances,
      },
    };

    ctx.postMessage(response);
  }
});
