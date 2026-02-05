import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  WorkerRequest,
  WorkerResponse,
  City,
  Cluster,
} from '../types/geo';

type StartFetchPayload = Extract<WorkerRequest, { readonly type: 'START_FETCH' }>['payload'];
type RunKMeansPayload = Extract<WorkerRequest, { readonly type: 'RUN_KMEANS' }>['payload'];

export const useGeoWorker = (workerUrl?: string) => {
  const workerRef = useRef<Worker | null>(null);
  
  const startOffsetRef = useRef(0);

  const [isWorking, setIsWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [workerData, setWorkerData] = useState<readonly City[] | null>(null);
  const [clusters, setClusters] = useState<readonly Cluster[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const worker = workerUrl
      ? new Worker(workerUrl, { type: 'module' })
      : new Worker(new URL('../workers/geo.worker.ts', import.meta.url), { type: 'module' });

    workerRef.current = worker;

    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'FETCH_PROGRESS':
          setIsWorking(true);
          setProgress(msg.payload.progress);
          break;

        case 'FETCH_COMPLETE':
          setIsWorking(false);
          setProgress(100);
          
          setWorkerData((prev) => {
             const newCities = msg.payload.cities || [];
             
             if (startOffsetRef.current === 0) {
               return newCities;
             }
             
             const allCities = [...(prev || []), ...newCities];
             
             const uniqueCities = Array.from(
                new Map(allCities.map(city => [city.id, city])).values()
             );

             return uniqueCities;
          });
          break;

        case 'KMEANS_RESULT':
          setIsWorking(false);
          setClusters(msg.payload.clusters);
          alert(`Agrupamento concluído em ${msg.payload.iterations} iterações!`);
          break;
          
        case 'ERROR':
          setIsWorking(false);
          setError(msg.payload.message);
          break;
        default:
          break;
      }
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', (e) => setError(String((e as ErrorEvent).message || e)));

    return () => {
      worker.removeEventListener('message', onMessage);
      worker.terminate();
      workerRef.current = null;
    };
  }, [workerUrl]);

  const startFetch = useCallback((payload: StartFetchPayload) => {
    if (!workerRef.current) {
      setError('Worker not available');
      return;
    }
    setError(null);
    setProgress(0);
    setIsWorking(true);

    startOffsetRef.current = payload.offsetStart;

    if (payload.offsetStart === 0) {
      setWorkerData([]);
    }

    const msg: WorkerRequest = { type: 'START_FETCH', payload } as WorkerRequest;
    workerRef.current.postMessage(msg);
  }, []);

  const stopFetch = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: 'STOP_FETCH' });
  }, []);

  const runKMeans = useCallback((payload: { cities: readonly City[]; k: number }) => {
    if (!workerRef.current) { setError('Worker not available'); return; }
    workerRef.current.postMessage({ 
      type: 'RUN_KMEANS', 
      payload: { cities: payload.cities, k: payload.k } 
    } as WorkerRequest);
  }, []);

  const terminate = useCallback(() => {
    workerRef.current?.postMessage({ type: 'TERMINATE' } as WorkerRequest);
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsWorking(false);
  }, []);

  return {
    isWorking,
    progress,
    error,
    workerData,
    clusters,
    setWorkerData,
    startFetch,
    stopFetch,
    runKMeans,
    terminate,
  } as const;
};

export default useGeoWorker;