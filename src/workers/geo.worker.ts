import type {
  WorkerRequest,
  WorkerResponse,
  GeoDBResponse,
  GeoDBCityRaw,
  City,
} from '../types/geo';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ctx: any = self as any;

ctx.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    switch (req.type) {
      case 'START_FETCH': {
        const { offsetStart, totalToFetch, limitPerPage = 100, query, headers } = req.payload;
        const collected: City[] = [];
        let fetchedCount = 0;

        while (collected.length < totalToFetch) {
          const pageLimit = Math.min(limitPerPage, totalToFetch - collected.length);
          const offset = offsetStart + fetchedCount;
          const params = new URLSearchParams();
          params.set('offset', String(offset));
          params.set('limit', String(pageLimit));
          if (query) params.set('namePrefix', query);

          const url = `https://wft-geo-db.p.rapidapi.com/v1/geo/cities?${params.toString()}`;

          const res = await fetch(url, { headers: headers as Record<string, string> | undefined });
          if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

          const json = (await res.json()) as GeoDBResponse<GeoDBCityRaw>;
          const raw = json.data ?? [];

          // Safety: if API returned no items this page, stop to avoid infinite loop
          if (raw.length === 0) {
            break;
          }

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

          const progress = Math.min(100, Math.round((collected.length / totalToFetch) * 100));
          const progressMsg: WorkerResponse = {
            type: 'FETCH_PROGRESS',
            payload: { progress, message: `fetched ${collected.length} / ${totalToFetch}` },
          };
          ctx.postMessage(progressMsg);

          if (collected.length >= totalToFetch) break;

          await delay(1200);
        }

        const completeMsg: WorkerResponse = { type: 'FETCH_COMPLETE', payload: { cities: collected } };
        ctx.postMessage(completeMsg);
        break;
      }

      case 'RUN_KMEANS': {
        console.log('RUN_KMEANS payload (worker):', req.payload);
        break;
      }

      case 'TERMINATE': {
        ctx.close();
        break;
      }

      default:
        ctx.postMessage({ type: 'ERROR', payload: { message: 'Unknown request type' } } as WorkerResponse);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ type: 'ERROR', payload: { message } } as WorkerResponse);
  }
});
