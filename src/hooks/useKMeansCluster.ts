/**
 * Hook para coordenar K workers paralelos no algoritmo K-Means
 * Cada worker calcula distâncias para um centróide específico
 */

import { useState, useCallback, useRef } from 'react';
import type { City, Cluster, NormalizedCity } from '../types/geo';
import type { ClusterWorkerRequest, ClusterWorkerResponse } from '../workers/cluster.worker';

interface UseKMeansClusterProps {
  onProgress?: (progress: number, message?: string) => void;
  onComplete?: (clusters: readonly Cluster[], iterations: number) => void;
  onError?: (error: string) => void;
}

export const useKMeansCluster = (props?: UseKMeansClusterProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [clusters, setClusters] = useState<readonly Cluster[]>([]);
  
  const workersRef = useRef<Worker[]>([]);
  const abortRef = useRef(false);

  // Inicializa K centróides aleatórios
  const initializeCentroids = (cities: readonly City[], k: number) => {
    const shuffled = [...cities].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, k).map(city => ({
      lat: city.latitude,
      lon: city.longitude,
    }));
  };

  // Cria K workers
  const createWorkers = (k: number): Worker[] => {
    const workers: Worker[] = [];
    for (let i = 0; i < k; i++) {
      const worker = new Worker(
        new URL('../workers/cluster.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workers.push(worker);
    }
    return workers;
  };

  // Solicita cálculo de distâncias de todos os workers em paralelo
  const calculateDistancesParallel = (
    workers: Worker[],
    cities: readonly City[],
    centroids: Array<{ lat: number; lon: number }>
  ): Promise<Map<number, Map<string, number>>> => {
    return new Promise((resolve, reject) => {
      const distancesByCluster = new Map<number, Map<string, number>>();
      let completedWorkers = 0;

      workers.forEach((worker, clusterId) => {
        const onMessage = (event: MessageEvent<ClusterWorkerResponse>) => {
          if (event.data.type === 'DISTANCES_CALCULATED') {
            const { clusterId: responseClusterId, distances } = event.data.payload;
            
            console.log(`   ✅ Worker ${responseClusterId}: ${distances.length} distâncias calculadas`);
            
            // Armazena as distâncias deste cluster
            const distanceMap = new Map<string, number>();
            distances.forEach(({ cityId, distance }) => {
              distanceMap.set(cityId, distance);
            });
            distancesByCluster.set(responseClusterId, distanceMap);

            completedWorkers++;

            // Quando todos os workers terminarem, resolve a promise
            if (completedWorkers === workers.length) {
              worker.removeEventListener('message', onMessage);
              resolve(distancesByCluster);
            }
          }
        };

        worker.addEventListener('message', onMessage);

        // Envia requisição para calcular distâncias
        const request: ClusterWorkerRequest = {
          type: 'CALCULATE_DISTANCES',
          payload: {
            cities,
            centroid: centroids[clusterId],
            clusterId,
          },
        };
        worker.postMessage(request);
      });
    });
  };

  // Atribui cada cidade ao cluster mais próximo
  const assignCitiesToClusters = (
    cities: readonly City[],
    distancesByCluster: Map<number, Map<string, number>>,
    k: number
  ): Cluster[] => {
    const clusters: Cluster[] = Array.from({ length: k }, (_, i) => ({
      id: String(i),
      centroid: { id: String(i), coords: [0, 0] },
      members: [] as NormalizedCity[],
    }));

    cities.forEach(city => {
      let minDistance = Infinity;
      let closestCluster = 0;

      // Verifica a distância desta cidade para cada cluster
      for (let clusterId = 0; clusterId < k; clusterId++) {
        const distance = distancesByCluster.get(clusterId)?.get(city.id) ?? Infinity;
        if (distance < minDistance) {
          minDistance = distance;
          closestCluster = clusterId;
        }
      }

      // Adiciona a cidade ao cluster mais próximo
      const member: NormalizedCity = {
        id: city.id,
        name: city.name,
        country: city.country,
        latNorm: city.latitude,
        lonNorm: city.longitude,
        popNorm: city.population,
        original: city,
      };

      (clusters[closestCluster].members as NormalizedCity[]).push(member);
    });

    return clusters;
  };

  // Recalcula centróides baseado nas cidades atribuídas
  const recalculateCentroids = (clusters: Cluster[]) => {
    return clusters.map(cluster => {
      if (!cluster.members || cluster.members.length === 0) {
        return { lat: 0, lon: 0 };
      }

      const sumLat = cluster.members.reduce((sum, m) => sum + m.original.latitude, 0);
      const sumLon = cluster.members.reduce((sum, m) => sum + m.original.longitude, 0);

      return {
        lat: sumLat / cluster.members.length,
        lon: sumLon / cluster.members.length,
      };
    });
  };

  // Verifica se houve convergência
  const hasConverged = (
    oldCentroids: Array<{ lat: number; lon: number }>,
    newCentroids: Array<{ lat: number; lon: number }>,
    threshold = 0.001
  ): boolean => {
    let maxShift = 0;

    for (let i = 0; i < oldCentroids.length; i++) {
      const shift = Math.sqrt(
        Math.pow(newCentroids[i].lat - oldCentroids[i].lat, 2) +
        Math.pow(newCentroids[i].lon - oldCentroids[i].lon, 2)
      );
      if (shift > maxShift) maxShift = shift;
    }

    return maxShift < threshold;
  };

  // Atualiza centróides nos clusters
  const updateClusterCentroids = (
    clusters: Cluster[],
    centroids: Array<{ lat: number; lon: number }>
  ): Cluster[] => {
    return clusters.map((cluster, i) => ({
      ...cluster,
      centroid: {
        ...cluster.centroid,
        coords: [centroids[i].lat, centroids[i].lon],
      },
    }));
  };

  // Função principal de K-Means com K workers paralelos
  const runKMeans = useCallback(
    async (cities: readonly City[], k: number, maxIterations = 50) => {
      if (!cities || cities.length === 0) {
        props?.onError?.('Sem dados para agrupar.');
        return;
      }

      if (k <= 0 || k > cities.length) {
        props?.onError?.(`K inválido: deve estar entre 1 e ${cities.length}`);
        return;
      }

      setIsRunning(true);
      setProgress(0);
      abortRef.current = false;

      try {
        // 1. Cria K workers
        console.log(`🚀 [K-MEANS] Criando ${k} workers paralelos...`);
        const workers = createWorkers(k);
        workersRef.current = workers;
        workers.forEach((worker, i) => {
          console.log(`   ✅ Worker ${i} criado (Cluster ${i})`);
        });

        // 2. Inicializa centróides aleatórios
        let centroids = initializeCentroids(cities, k);
        let currentClusters: Cluster[] = [];
        let iterations = 0;
        let converged = false;

        // 3. Loop principal
        while (!converged && iterations < maxIterations && !abortRef.current) {
          iterations++;

          // Reporta progresso
          const progressPercent = Math.round((iterations / maxIterations) * 100);
          setProgress(progressPercent);
          props?.onProgress?.(progressPercent, `Iteração ${iterations} (${k} workers)`);

          console.log(`\n🔄 [ITERAÇÃO ${iterations}] Enviando cidades para ${k} workers...`);
          centroids.forEach((centroid, i) => {
            console.log(`   📤 Worker ${i}: Calculando distâncias para Centróide [${centroid.lat.toFixed(2)}, ${centroid.lon.toFixed(2)}]`);
          });

          // 4. Calcula distâncias em paralelo (K workers simultâneos)
          const distancesByCluster = await calculateDistancesParallel(
            workers,
            cities,
            centroids
          );

          console.log(`✅ [ITERAÇÃO ${iterations}] Todos os ${workers.length} workers responderam!`);

          // 5. Atribui cidades aos clusters
          currentClusters = assignCitiesToClusters(cities, distancesByCluster, k);

          console.log(`📊 [ITERAÇÃO ${iterations}] Distribuição após ${k} workers:`);
          currentClusters.forEach((cluster, i) => {
            console.log(`   Cluster ${i}: ${cluster.members.length} cidades`);
          });

          // 6. Recalcula centróides
          const newCentroids = recalculateCentroids(currentClusters);

          // 7. Verifica convergência
          converged = hasConverged(centroids, newCentroids);

          // 8. Atualiza centróides para próxima iteração
          centroids = newCentroids;

          // Pequeno delay para não travar a UI
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        // 9. Finaliza: atualiza clusters com centróides finais
        console.log(`\n🎯 [CONVERGÊNCIA] Centróides estabilizaram após ${iterations} iterações!`);
        console.log(`🧹 Finalizando ${workers.length} workers...`);
        
        const finalClusters = updateClusterCentroids(currentClusters, centroids);
        setClusters(finalClusters);

        // 10. Limpa workers
        workers.forEach((w, i) => {
          console.log(`   🛑 Worker ${i} finalizado`);
          w.terminate();
        });
        workersRef.current = [];
        console.log(`✅ [K-MEANS] Processo concluído com sucesso!`);

        setProgress(100);
        setIsRunning(false);
        props?.onComplete?.(finalClusters, iterations);

      } catch (error) {
        console.error('Erro no K-Means:', error);
        props?.onError?.(String(error));
        setIsRunning(false);
        
        // Limpa workers em caso de erro
        workersRef.current.forEach(w => w.terminate());
        workersRef.current = [];
      }
    },
    [props]
  );

  // Cancela execução
  const abort = useCallback(() => {
    abortRef.current = true;
    workersRef.current.forEach(w => w.terminate());
    workersRef.current = [];
    setIsRunning(false);
  }, []);

  return {
    runKMeans,
    abort,
    isRunning,
    progress,
    clusters,
  } as const;
};

export default useKMeansCluster;
