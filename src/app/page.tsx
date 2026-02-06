'use client';

import { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import { useGeoWorker } from '@/hooks/useGeoWorker';
import { useKMeansCluster } from '@/hooks/useKMeansCluster';
import type { City, GeoDBCityRaw, GeoDBResponse } from '@/types/geo';

import Header from '@/components/Header';
import CityExplorer from '@/components/CityExplorer';
import LocalRepository from '@/components/LocalRepository';
import ClusterModal from '@/components/ClusterModal';
import ClusterMapSection from '@/components/ClusterMapSection';

export default function GeoClusterPage() {
  const [manualCities, setManualCities] = useState<City[]>([]);
  const [selectedCities, setSelectedCities] = useState<City[]>([]);
  const [loadingManual, setLoadingManual] = useState(false);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm] = useState('');
  const [manualOffset, setManualOffset] = useState(0);
  const [kValue, setKValue] = useState(5);
  const [selectedClusterForModal, setSelectedClusterForModal] = useState<number | null>(null);
  const cacheRef = useRef<Map<number, City[]>>(new Map());
  const SELECTED_STORAGE_KEY = 'geo-cluster:selectedCities';

  const { startFetch, stopFetch, isWorking, progress, workerData, error: workerError, setWorkerData } = useGeoWorker();
  
  const kmeansCluster = useKMeansCluster({
    onProgress: (_progress, message) => {
      console.log(`K-Means: ${message}`);
    },
    onComplete: (_resultClusters, iterations) => {
      alert(`✅ Agrupamento concluído em ${iterations} iterações com ${kValue} workers paralelos!`);
    },
    onError: (error) => {
      alert(`❌ Erro no K-Means: ${error}`);
    },
  });

  const fetchManualCities = useCallback(async (currentOffset: number) => {
    if (cacheRef.current.has(currentOffset)) {
      console.log(`💾 [CACHE] Página ${currentOffset} carregada do cache`);
      setManualCities(cacheRef.current.get(currentOffset)!);
      return;
    }

    setLoadingManual(true);
    try {
      const limit = 10;
      const response = await fetch(
        `https://${process.env.NEXT_PUBLIC_RAPIDAPI_HOST}/v1/geo/cities?offset=${currentOffset}&limit=${limit}&sort=-population`,
        {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': process.env.NEXT_PUBLIC_RAPIDAPI_KEY || '',
            'X-RapidAPI-Host': process.env.NEXT_PUBLIC_RAPIDAPI_HOST || '',
          },
        }
      );

      if (!response.ok) throw new Error('Erro na requisição manual');

      const json = (await response.json()) as GeoDBResponse<GeoDBCityRaw>;
      
      console.log('📊 [API Response]', { totalCount: json.totalCount, dataLength: json.data.length, offset: json.offset });
      
      const validCities: City[] = json.data
        .filter((raw) => raw.population !== null && raw.population !== undefined)
        .map((raw) => ({
          id: String(raw.id),
          wikiDataId: raw.wikiDataId,
          name: raw.name,
          country: raw.country,
          latitude: raw.latitude,
          longitude: raw.longitude,
          population: Number(raw.population),
        }));

      cacheRef.current.set(currentOffset, validCities);
      console.log(`📥 [API] Página ${currentOffset} buscada e cacheada`);

      setManualCities(validCities);
      if (json.totalCount !== undefined && json.totalCount !== null) {
        setTotalCount(json.totalCount);
        console.log('✅ Total count atualizado:', json.totalCount);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao buscar cidades. Verifique o console e sua API Key.');
    } finally {
      setLoadingManual(false);
    }
  }, []);

  const handleNextPage = useCallback(() => {
    const newOffset = offset + 10;
    setOffset(newOffset);
    
    if (workerData && workerData.length > 0) {
      setManualCities(workerData.slice(newOffset, newOffset + 10));
    } else {
      fetchManualCities(newOffset);
    }
  }, [offset, workerData, fetchManualCities]);

  const handlePrevPage = useCallback(() => {
    if (offset === 0) return;
    const newOffset = offset - 10;
    setOffset(newOffset);
    
    if (workerData && workerData.length > 0) {
      setManualCities(workerData.slice(newOffset, newOffset + 10));
    } else {
      fetchManualCities(newOffset);
    }
  }, [offset, workerData, fetchManualCities]);

  const handleSelectCity = useCallback((city: City) => {
    setSelectedCities((prev) => {
      if (prev.some((c) => c.id === city.id)) return prev;
      return [...prev, city];
    });
  }, []);

  const handleRemoveCity = useCallback((cityId: string) => {
    setSelectedCities((prev) => prev.filter((c) => c.id !== cityId));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SELECTED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as City[];
        if (Array.isArray(parsed)) {
          setSelectedCities(parsed);
        }
      }
    } catch (err) {
      console.error('Failed to load selected cities from localStorage', err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SELECTED_STORAGE_KEY, JSON.stringify(selectedCities));
    } catch (err) {
      console.error('Failed to save selected cities to localStorage', err);
    }
  }, [selectedCities]);

  const handleStartMining = useCallback(() => {
    const targetTotal = 10000;
    const offsetStart = Number(manualOffset) || 0;
    const missing = targetTotal - offsetStart;

    if (missing <= 0) {
      alert('O offset inicial já é maior ou igual a 10.000!');
      return;
    }

    startFetch({
      offsetStart: offsetStart,
      totalToFetch: missing,
      limitPerPage: 10,
      headers: {
        'X-RapidAPI-Key': process.env.NEXT_PUBLIC_RAPIDAPI_KEY || '',
        'X-RapidAPI-Host': process.env.NEXT_PUBLIC_RAPIDAPI_HOST || '',
      }
    });
  }, [manualOffset, startFetch]);

  const handleDownloadData = useCallback(() => {
    if (!workerData || workerData.length === 0) return;

    const jsonString = JSON.stringify(workerData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cidades_minedas_10k.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [workerData]);

  const handleRunKMeans = useCallback(() => {
    if (!workerData || workerData.length === 0) return;
    kmeansCluster.runKMeans(workerData, kValue);
  }, [workerData, kValue, kmeansCluster]);

  const handleClearMemory = useCallback(() => {
    if (confirm('Deseja apagar todas as cidades da memória local?')) {
      setWorkerData([]);
    }
  }, [setWorkerData]);

  const handleStopFetch = useCallback(() => {
    stopFetch();
    
    setTimeout(() => {
      if (workerData && workerData.length > 0) {
        handleDownloadData();
      }
    }, 100);
  }, [stopFetch, workerData, handleDownloadData]);

  useEffect(() => {
    if (workerData && workerData.length > 0) {
      setTotalCount(workerData.length);
      setOffset(0);
      setManualCities(workerData.slice(0, 10));
      cacheRef.current.clear();
      console.log(`✅ CityExplorer atualizado com ${workerData.length} cidades mineradas`);
    }
  }, [workerData]);

  const handleLoadFromFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const loadedCities = JSON.parse(content) as City[];
        
        setWorkerData(loadedCities);
        setTotalCount(loadedCities.length);
        setOffset(0);
        cacheRef.current.clear();
        setManualCities(loadedCities.slice(0, 10));
        
        console.log(`Carregadas ${loadedCities.length} cidades do arquivo!`);
        alert(`Sucesso! ${loadedCities.length} cidades carregadas.`);
      } catch (err) {
        console.error(err);
        alert('Erro ao ler JSON.');
      }
    };
    reader.readAsText(file);
  }, [setWorkerData]);

  const handleOpenClusterModal = useCallback((clusterIndex: number) => {
    setSelectedClusterForModal(clusterIndex);
  }, []);

  const handleCloseClusterModal = useCallback(() => {
    setSelectedClusterForModal(null);
  }, []);

  const handleClearLocalRepository = useCallback(() => {
    if (confirm('Deseja apagar todas as cidades do repositório local?')) {
      setSelectedCities([]);
      try {
        localStorage.removeItem(SELECTED_STORAGE_KEY);
      } catch (err) {
        console.error('Falha ao limpar localStorage', err);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Header
        totalCount={totalCount}
        selectedCitiesCount={selectedCities.length}
        isWorking={isWorking}
        isKMeansRunning={kmeansCluster.isRunning}
        workerData={workerData}
        manualOffset={manualOffset}
        kValue={kValue}
        progress={progress}
        kmeansProgress={kmeansCluster.progress}
        workerError={workerError}
        onManualOffsetChange={setManualOffset}
        onKValueChange={setKValue}
        onStartMining={handleStartMining}
        onStopFetch={handleStopFetch}
        onClearMemory={handleClearMemory}
        onLoadFromFile={handleLoadFromFile}
        onDownloadData={handleDownloadData}
        onRunKMeans={handleRunKMeans}
      />

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-150">
          <CityExplorer
            manualCities={manualCities}
            selectedCities={selectedCities}
            loadingManual={loadingManual}
            offset={offset}
            totalCities={workerData && workerData.length > 0 ? workerData.length : totalCount}
            onFetchManualCities={fetchManualCities}
            onSelectCity={handleSelectCity}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
          />

          <LocalRepository
            selectedCities={selectedCities}
            clusters={kmeansCluster.clusters}
            searchTerm={searchTerm}
            onRemoveCity={handleRemoveCity}
            onOpenClusterModal={handleOpenClusterModal}
            onClearLocalRepository={handleClearLocalRepository}
          />
        </div>

        <ClusterMapSection clusters={kmeansCluster.clusters} />
      </main>

      <ClusterModal
        cluster={selectedClusterForModal !== null ? kmeansCluster.clusters[selectedClusterForModal] : null}
        clusterIndex={selectedClusterForModal}
        onClose={handleCloseClusterModal}
      />
    </div>
  );
}