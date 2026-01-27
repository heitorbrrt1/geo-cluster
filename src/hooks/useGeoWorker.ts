import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  WorkerRequest,
  WorkerResponse,
  City,
} from '../types/geo';

type StartFetchPayload = Extract<WorkerRequest, { readonly type: 'START_FETCH' }>['payload'];
type RunKMeansPayload = Extract<WorkerRequest, { readonly type: 'RUN_KMEANS' }>['payload'];

export const useGeoWorker = (workerUrl?: string) => {
  const workerRef = useRef<Worker | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [workerData, setWorkerData] = useState<readonly City[] | null>(null);

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
          setWorkerData(msg.payload.cities);
          break;
        case 'KMEANS_RESULT':
          setIsWorking(false);
          // future: set KMeans result state
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
    const msg: WorkerRequest = { type: 'START_FETCH', payload } as WorkerRequest;
    workerRef.current.postMessage(msg);
  }, []);

  const runKMeans = useCallback((payload: RunKMeansPayload) => {
    if (!workerRef.current) {
      setError('Worker not available');
      return;
    }
    const msg: WorkerRequest = { type: 'RUN_KMEANS', payload } as WorkerRequest;
    workerRef.current.postMessage(msg);
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
    setWorkerData,
    startFetch,
    runKMeans,
    terminate,
  } as const;
};

export default useGeoWorker;
