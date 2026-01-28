import type {
  WorkerRequest,
  WorkerResponse,
  GeoDBResponse,
  GeoDBCityRaw,
  City,
} from '../types/geo';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ctx: any = self as any;

// Variável de controle fora do listener para persistir entre mensagens
let shouldStop = false;

ctx.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    switch (req.type) {
      case 'START_FETCH': {
        shouldStop = false; // Reseta a flag ao iniciar
        const { offsetStart, totalToFetch, limitPerPage = 10, query, headers } = req.payload;
        
        // collected armazena apenas o que for baixado NESTA sessão
        const collected: City[] = []; 
        let fetchedCount = 0;

        // Loop Principal
        while (collected.length < totalToFetch) {
          // 1. CHECAGEM DE PARADA
          if (shouldStop) {
            ctx.postMessage({
              type: 'FETCH_PROGRESS',
              payload: { progress: 100, message: '🛑 Parando e salvando...' },
            });
            break; // Sai do loop e entrega o que já pegou
          }

          const pageLimit = Math.min(limitPerPage, totalToFetch - collected.length);
          // O offset real é o inicial + o que já andamos
          const offset = offsetStart + fetchedCount;
          
          const params = new URLSearchParams();
          params.set('offset', String(offset));
          params.set('limit', String(pageLimit));
          params.set('sort', '-population'); // Importante para manter a ordem
          if (query) params.set('namePrefix', query);

          const url = `https://wft-geo-db.p.rapidapi.com/v1/geo/cities?${params.toString()}`;

          // Lógica de Retry (simples para exemplo)
          let res;
          try {
             res = await fetch(url, { headers: headers as Record<string, string> | undefined });
          } catch (e) {
             // Se der erro de rede, espera e tenta de novo ou para
             await delay(2000);
             continue;
          }

          if (res.status === 429) {
             // Rate Limit: espera mais e tenta de novo a mesma página
             ctx.postMessage({ type: 'FETCH_PROGRESS', payload: { progress: 0, message: '⏳ Rate limit (429). Esperando...' }});
             await delay(5000);
             continue;
          }

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
          fetchedCount += raw.length; // Avança o contador local

          // Reporta progresso
          const progress = Math.min(100, Math.round((collected.length / totalToFetch) * 100));
          ctx.postMessage({
            type: 'FETCH_PROGRESS',
            payload: { progress, message: `Baixadas: ${collected.length} (Total nesta sessão)` },
          });

          // Delay de segurança
          await delay(1500);
        }

        // FIM: Envia o que conseguiu pegar
        ctx.postMessage({ type: 'FETCH_COMPLETE', payload: { cities: collected } });
        break;
      }

      case 'STOP_FETCH': {
        shouldStop = true; // Apenas sinaliza para o loop parar
        break;
      }

      // ... Mantenha RUN_KMEANS e TERMINATE iguais ...
      case 'RUN_KMEANS':
        // ...
        break;
      case 'TERMINATE':
        ctx.close();
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ type: 'ERROR', payload: { message } });
  }
});
