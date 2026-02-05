import type {
  WorkerRequest,
  WorkerResponse,
  GeoDBResponse,
  GeoDBCityRaw,
  City,
  Cluster,
  NormalizedCity,
} from '../types/geo';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ctx: any = self;

let isMining = false;
let currentController: AbortController | null = null;

async function mineCities(
  offsetStart: number, 
  totalToFetch: number, 
  limitPerPage: number, 
  headers?: Record<string, string>, 
  query?: string
) {
  const collected: City[] = [];
  let fetchedCount = 0;

  try {
    while (isMining && collected.length < totalToFetch) {
      currentController = new AbortController();
      const signal = currentController.signal;

      const pageLimit = Math.min(limitPerPage, totalToFetch - collected.length);
      const offset = offsetStart + fetchedCount;

      const params = new URLSearchParams();
      params.set('offset', String(offset));
      params.set('limit', String(pageLimit));
      params.set('sort', '-population');
      if (query) params.set('namePrefix', query);

      const url = `https://wft-geo-db.p.rapidapi.com/v1/geo/cities?${params.toString()}`;

      try {
        const res = await fetch(url, { 
          headers: headers as Record<string, string> | undefined,
          signal
        });

        if (res.status === 429) {
          ctx.postMessage({ 
            type: 'FETCH_PROGRESS', 
            payload: { progress: 0, message: '⏳ Rate limit (429). Esperando 5s...' } 
          });
          await delay(5000);
          continue;
        }

        if (!res.ok) throw new Error(`Erro API: ${res.status}`);

        const json = (await res.json()) as GeoDBResponse<GeoDBCityRaw>;
        const raw = json.data ?? [];

        if (raw.length === 0) break;

        const good = raw
          .filter((r) => r.population != null && r.population !== 0)
          .map<City>((r) => ({
            id: String(r.id),
            wikiDataId: r.wikiDataId ?? null,
            name: r.name,
            country: r.country,
            latitude: r.latitude,
            longitude: r.longitude,
            population: Number(r.population ?? 0),
          }));

        collected.push(...good);
        fetchedCount += raw.length;

        const totalAccumulated = offsetStart + fetchedCount;
        const target = offsetStart + totalToFetch;
        console.log(
          `%c⛏️ Mineração: ${totalAccumulated} (Alvo: ${target}) | Lote: ${good.length}`,
          'color: #00ffff; font-weight: bold;'
        );

        const progress = Math.min(100, Math.round((collected.length / totalToFetch) * 100));
        ctx.postMessage({
          type: 'FETCH_PROGRESS',
          payload: { progress, message: `Baixadas nesta sessão: ${collected.length}` },
        });

      } catch (err: any) {
        if (err.name === 'AbortError') {
           break; 
        }
        console.error("Erro no fetch:", err);
        await delay(2000);
      }

      await delay(1200);
    }
  } finally {
    isMining = false;
    
    ctx.postMessage({ 
      type: 'FETCH_COMPLETE', 
      payload: { cities: collected } 
    });
  }
}

ctx.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;

  switch (req.type) {
    case 'START_FETCH': {
      if (isMining) return;

      isMining = true;
      const { offsetStart, totalToFetch, limitPerPage = 10, headers, query } = req.payload;
      
      mineCities(offsetStart, totalToFetch, limitPerPage, headers, query);
      break;
    }

    case 'STOP_FETCH': {
      isMining = false;
      
      if (currentController) {
        currentController.abort();
      }
      
      ctx.postMessage({
        type: 'FETCH_PROGRESS',
        payload: { progress: 100, message: '🛑 Parando...' },
      });
      break;
    }

    case 'RUN_KMEANS': {
      const { cities, k, maxIterations = 50 } = req.payload as {
        readonly cities: readonly City[];
        readonly k: number;
        readonly maxIterations?: number;
      };

      if (!cities || cities.length === 0) {
        ctx.postMessage({ type: 'ERROR', payload: { message: 'Sem dados para agrupar.' } });
        break;
      }

      type LocalCentroid = { lat: number; lon: number };

      const citiesCopy: City[] = [...cities];
      const shuffled = citiesCopy.sort(() => 0.5 - Math.random());
      let centroids: LocalCentroid[] = shuffled
        .slice(0, k)
        .map((c: City) => ({ lat: c.latitude, lon: c.longitude }));

      let clustersResult: Cluster[] = [];
      let hasConverged = false;
      let iterations = 0;

      while (!hasConverged && iterations < maxIterations) {
        iterations++;

        const newClusters: Cluster[] = centroids.map((centroid: LocalCentroid, index: number) => ({
          id: String(index),
          centroid: { id: String(index), coords: [centroid.lat, centroid.lon] },
          members: [] as NormalizedCity[],
        }));

        for (const city of cities) {
          let minDistance = Infinity;
          let closestClusterIndex = 0;

          centroids.forEach((centroid: LocalCentroid, index: number) => {
            const dist = Math.sqrt(
              Math.pow(city.latitude - centroid.lat, 2) +
              Math.pow(city.longitude - centroid.lon, 2)
            );
            if (dist < minDistance) {
              minDistance = dist;
              closestClusterIndex = index;
            }
          });

          const member: NormalizedCity = {
            id: city.id,
            name: city.name,
            country: city.country,
            latNorm: city.latitude,
            lonNorm: city.longitude,
            popNorm: city.population,
            original: city,
          };

          (newClusters[closestClusterIndex].members as NormalizedCity[]).push(member);
        }

        let maxCentroidShift = 0;

        const newCentroids = newClusters.map((cluster: Cluster, i: number) => {
          if (!cluster.members || cluster.members.length === 0) return centroids[i];

          const sumLat = cluster.members.reduce((sum: number, p: NormalizedCity) => sum + p.original.latitude, 0);
          const sumLon = cluster.members.reduce((sum: number, p: NormalizedCity) => sum + p.original.longitude, 0);

          const newLat = sumLat / cluster.members.length;
          const newLon = sumLon / cluster.members.length;

          const shift = Math.sqrt(Math.pow(newLat - centroids[i].lat, 2) + Math.pow(newLon - centroids[i].lon, 2));
          if (shift > maxCentroidShift) maxCentroidShift = shift;

          return { lat: newLat, lon: newLon } as LocalCentroid;
        });

        centroids = newCentroids;
        clustersResult = newClusters;

        if (maxCentroidShift < 0.001) hasConverged = true;

        ctx.postMessage({ type: 'FETCH_PROGRESS', payload: { progress: Math.round((iterations / maxIterations) * 100), message: `K-Means: Iteração ${iterations}` } });

        await delay(10);
      }

      ctx.postMessage({ type: 'KMEANS_RESULT', payload: { clusters: clustersResult, iterations } });
      break;
    }

    case 'TERMINATE':
      isMining = false;
      if (currentController) currentController.abort();
      ctx.close();
      break;
  }
});