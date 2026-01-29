import type {
  WorkerRequest,
  WorkerResponse,
  GeoDBResponse,
  GeoDBCityRaw,
  City,
  Cluster
} from '../types/geo';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Define como 'any' para o TypeScript aceitar tanto postMessage quanto close()
const ctx: any = self;

// --- ESTADO GLOBAL DO WORKER ---
// Estas variáveis vivem fora das funções para serem acessadas por todos os eventos
let isMining = false; // "Chave geral" da mineração
let currentController: AbortController | null = null; // Para cancelar requisições travadas

// Função principal de Mineração (Separada do Event Listener para não travar)
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
      // 1. Cria um Controller para poder cancelar este fetch específico se pararmos
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
          signal // Liga o sinal de cancelamento
        });

        // Tratamento de Rate Limit (429)
        if (res.status === 429) {
          ctx.postMessage({ 
            type: 'FETCH_PROGRESS', 
            payload: { progress: 0, message: '⏳ Rate limit (429). Esperando 5s...' } 
          });
          await delay(5000);
          continue; // Tenta de novo a mesma página
        }

        if (!res.ok) throw new Error(`Erro API: ${res.status}`);

        const json = (await res.json()) as GeoDBResponse<GeoDBCityRaw>;
        const raw = json.data ?? [];

        if (raw.length === 0) break; // Acabaram as cidades na API

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

        // Log bonito no console
        const totalAccumulated = offsetStart + fetchedCount; // Ajuste para mostrar o real processado
        const target = offsetStart + totalToFetch;
        console.log(
          `%c⛏️ Mineração: ${totalAccumulated} (Alvo: ${target}) | Lote: ${good.length}`,
          'color: #00ffff; font-weight: bold;'
        );

        // Reporta progresso
        const progress = Math.min(100, Math.round((collected.length / totalToFetch) * 100));
        ctx.postMessage({
          type: 'FETCH_PROGRESS',
          payload: { progress, message: `Baixadas nesta sessão: ${collected.length}` },
        });

      } catch (err: any) {
        // Se o erro foi "AbortError", é porque paramos propositalmente. Ignora.
        if (err.name === 'AbortError') {
           break; 
        }
        // Se foi erro de rede, espera um pouco e continua
        console.error("Erro no fetch:", err);
        await delay(2000);
      }

      // Pequeno delay para não sobrecarregar a CPU e dar chance de parar
      await delay(1200);
    }
  } finally {
    // FIM (Seja por acabar, por erro ou por parar)
    isMining = false; // Garante que a flag baixou
    
    // Entrega o que pegou até agora
    ctx.postMessage({ 
      type: 'FETCH_COMPLETE', 
      payload: { cities: collected } 
    });
  }
}

// --- ESCUTADOR DE EVENTOS (O Porteiro) ---
ctx.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;

  switch (req.type) {
    case 'START_FETCH': {
      // Se já estiver rodando, ignora ou reinicia (aqui optamos por ignorar duplicado)
      if (isMining) return;

      isMining = true;
      const { offsetStart, totalToFetch, limitPerPage = 10, headers, query } = req.payload;
      
      // DISPARA A FUNÇÃO SEM 'AWAIT'
      // Isso libera o Event Loop imediatamente para ouvir o 'STOP'
      mineCities(offsetStart, totalToFetch, limitPerPage, headers, query);
      break;
    }

    case 'STOP_FETCH': {
      // 1. Baixa a flag (o loop vai parar na próxima volta)
      isMining = false;
      
      // 2. Aborta a requisição atual imediatamente (para não esperar o fetch voltar)
      if (currentController) {
        currentController.abort();
      }
      
      // Envia feedback imediato
      ctx.postMessage({
        type: 'FETCH_PROGRESS',
        payload: { progress: 100, message: '🛑 Parando...' },
      });
      break;
    }

    case 'RUN_KMEANS': {
       // ... (Mantenha seu código do K-Means aqui igual ao anterior)
       // Se precisar, eu reenvio o bloco do K-Means
       // ...
       break;
    }

    case 'TERMINATE':
      isMining = false;
      if (currentController) currentController.abort();
      ctx.close();
      break;
  }
});