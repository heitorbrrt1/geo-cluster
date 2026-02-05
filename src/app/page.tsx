'use client';

import { useState, useCallback, ChangeEvent, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useGeoWorker } from '@/hooks/useGeoWorker';
import { useKMeansCluster } from '@/hooks/useKMeansCluster';
import type { City, GeoDBCityRaw, GeoDBResponse } from '@/types/geo';

// Importação dinâmica para evitar erro de 'window is not defined' no Leaflet
const ClusterMap = dynamic(() => import('@/components/ClusterMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-slate-100 animate-pulse flex items-center justify-center rounded-2xl text-slate-400 font-medium">
      Carregando Mapa...
    </div>
  ),
});

export default function GeoClusterPage() {
  const [manualCities, setManualCities] = useState<readonly City[]>([]);
  const [selectedCities, setSelectedCities] = useState<readonly City[]>([]);
  const [loadingManual, setLoadingManual] = useState(false);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [manualOffset, setManualOffset] = useState(0);
  const [kValue, setKValue] = useState(5);
  const [selectedClusterForModal, setSelectedClusterForModal] = useState<number | null>(null);
  const cacheRef = useRef<Map<number, City[]>>(new Map());

  const { startFetch, stopFetch, isWorking, progress, workerData, error: workerError, setWorkerData } = useGeoWorker();
  
  // Hook para K-Means paralelo com K workers
  const kmeansCluster = useKMeansCluster({
    onProgress: (progress, message) => {
      console.log(`K-Means: ${message}`);
    },
    onComplete: (resultClusters, iterations) => {
      alert(`✅ Agrupamento concluído em ${iterations} iterações com ${kValue} workers paralelos!`);
    },
    onError: (error) => {
      alert(`❌ Erro no K-Means: ${error}`);
    },
  });

  const clusters = kmeansCluster.clusters;

  const fetchManualCities = useCallback(async (currentOffset: number) => {
    // Verifica cache primeiro
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

      // Salva no cache
      cacheRef.current.set(currentOffset, validCities);
      console.log(`📥 [API] Página ${currentOffset} buscada e cacheada`);

      setManualCities(validCities);
      setTotalCount(json.totalCount);
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
    fetchManualCities(newOffset);
  }, [offset, fetchManualCities]);

  const handlePrevPage = useCallback(() => {
    if (offset === 0) return;
    const newOffset = offset - 10;
    setOffset(newOffset);
    fetchManualCities(newOffset);
  }, [offset, fetchManualCities]);

  const handleSelectCity = useCallback((city: City) => {
    if (!selectedCities.some((c) => c.id === city.id)) {
      setSelectedCities((prev) => [...prev, city]); 
    }
  }, [selectedCities]);

  const handleRemoveCity = useCallback((cityId: string) => {
    setSelectedCities((prev) => prev.filter((c) => c.id !== cityId));
  }, []);

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

  // Função para disparar o download do JSON gerado pelo worker
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

  // Função para limpar a memória do worker
  const handleClearMemory = useCallback(() => {
    if (confirm('Deseja apagar todas as cidades da memória local?')) {
      setWorkerData([]);
    }
  }, [setWorkerData]);

  const handleLoadFromFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const loadedCities = JSON.parse(content) as City[];
        
        setWorkerData(loadedCities); // Manda para o Worker (K-Means)
        setManualCities(loadedCities); // <--- ADICIONE ISSO (Mostra na lista da esquerda)
        
        console.log(`Carregadas ${loadedCities.length} cidades do arquivo!`);
        alert(`Sucesso! ${loadedCities.length} cidades carregadas.`);
      } catch (err) {
        console.error(err);
        alert('Erro ao ler JSON.');
      }
    };
    reader.readAsText(file);
  }, [setWorkerData]);

  // Memoiza filtro de cidades selecionadas para evitar re-cálculo a cada render
  const filteredSelectedCities = useMemo(() => 
    selectedCities.filter(city =>
      city.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      city.country.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [selectedCities, searchTerm]
  );

  const handleOpenClusterModal = useCallback((clusterIndex: number) => {
    setSelectedClusterForModal(clusterIndex);
  }, []);

  const handleCloseClusterModal = useCallback(() => {
    setSelectedClusterForModal(null);
  }, []);

  // Memoiza lista de cidades para evitar re-render ao digitar
  const cityCards = useMemo(() => {
    if (loadingManual) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <svg className="animate-spin h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          <p className="font-medium">Carregando cidades...</p>
        </div>
      );
    }
    
    if (manualCities.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-medium">Nenhuma cidade encontrada</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {manualCities.map((city) => (
          <div
            key={city.id}
            className="group bg-slate-50 hover:bg-linear-to-r hover:from-blue-50 hover:to-indigo-50 border border-slate-200 rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-lg mb-1">{city.name}</h3>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-lg text-xs font-medium text-slate-600 border border-slate-200">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                    {city.country}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {city.population.toLocaleString()}
                </div>
              </div>
              
              <button
                onClick={() => handleSelectCity(city)}
                disabled={selectedCities.some((c) => c.id === city.id)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 ${
                  selectedCities.some((c) => c.id === city.id)
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50'
                }`}
              >
                {selectedCities.some((c) => c.id === city.id) ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Adicionada
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Adicionar
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }, [manualCities, loadingManual, selectedCities, handleSelectCity]);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* HEADER MODERNO */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* LOGO E TÍTULO */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-linear-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-linear-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  GeoCluster
                </h1>
                <p className="text-sm text-slate-500">Processamento paralelo de dados geográficos</p>
              </div>
            </div>

            {/* CONTROLES DO WORKER */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* STATS */}
              <div className="flex gap-3">
                <div className="px-4 py-2 bg-slate-100 rounded-xl">
                  <div className="text-xs text-slate-500 font-medium">Total API</div>
                  <div className="text-lg font-bold text-slate-900">{(totalCount ?? 0).toLocaleString()}</div>
                </div>
                <div className="px-4 py-2 bg-blue-100 rounded-xl">
                  <div className="text-xs text-blue-600 font-medium">Selecionadas</div>
                  <div className="text-lg font-bold text-blue-900">{selectedCities.length}</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* CAMPOS DE CONFIGURAÇÃO (Só aparecem se não estiver rodando) */}
                {!isWorking && !kmeansCluster.isRunning && (
                  <div className="flex gap-3">
                    {/* CAMPO DE OFFSET MANUAL (Só se não tiver dados carregados) */}
                    {(!workerData || workerData.length === 0) && (
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">
                          Começar do Offset
                        </label>
                        <input 
                          type="number" 
                          value={manualOffset}
                          onChange={(e) => setManualOffset(Number(e.target.value))}
                          className="w-24 px-3 py-3 rounded-xl border border-slate-200 text-center font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                          placeholder="0"
                          min={0}
                        />
                      </div>
                    )}
                    
                    {/* CAMPO K (Sempre visível quando não está rodando) */}
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-purple-600 uppercase ml-1">
                        Cluster K
                      </label>
                      <input 
                        type="number" 
                        value={kValue}
                        onChange={(e) => setKValue(Math.max(1, Number(e.target.value)))}
                        className="w-20 px-3 py-3 rounded-xl border border-purple-300 text-center font-bold text-purple-700 focus:ring-2 focus:ring-purple-500 outline-none shadow-sm bg-purple-50"
                        placeholder="5"
                        min={1}
                        max={20}
                      />
                    </div>
                  </div>
                )}

                {/* BOTÃO DUPLO: INICIAR / PARAR */}
                <button
                  onClick={isWorking ? stopFetch : handleStartMining}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 shadow-lg ${
                    isWorking
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/30'
                      : 'bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/30'
                  }`}
                >
                  {isWorking ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Parar e Salvar
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Iniciar ({10000 - manualOffset} restantes)
                    </>
                  )}
                </button>
              </div>
              {/* UPLOAD / DOWNLOAD JSON */}
              <div className="flex gap-2 mr-4">
                  {/* Botão de Lixeira */}
                  {workerData && workerData.length > 0 && !isWorking && (
                    <button
                      onClick={handleClearMemory}
                      className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg border border-red-200"
                      title="Limpar memória"
                    >
                      🗑️
                    </button>
                  )}

                  <label className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm">
                    📂 Carregar JSON
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleLoadFromFile}
                    />
                  </label>

                  {workerData && workerData.length > 0 && (
                    <button
                      onClick={handleDownloadData}
                      className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-2 rounded text-sm font-bold"
                    >
                      💾 Salvar JSON
                    </button>
                  )}
                  {/* Botão K-Means - Só aparece se tiver dados e não estiver trabalhando */}
                  {workerData && workerData.length > 0 && !isWorking && !kmeansCluster.isRunning && (
                    <button
                      onClick={handleRunKMeans}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all flex items-center gap-2"
                    >
                      <span className="text-lg">🧠</span>
                      Agrupar (K={kValue})
                    </button>
                  )}
                  {/* Indicador de K-Means rodando */}
                  {kmeansCluster.isRunning && (
                    <div className="flex items-center gap-2 bg-purple-100 px-4 py-2 rounded-lg border border-purple-300">
                      <svg className="animate-spin h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      <span className="text-sm font-bold text-purple-700">{kValue} Workers: {kmeansCluster.progress}%</span>
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* PROGRESS BAR */}
          {isWorking && (
            <div className="mt-4 bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-700">Progresso da Mineração</span>
                <span className="text-sm font-bold text-blue-600">{progress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 bg-linear-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 shadow-lg shadow-blue-500/50"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* SUCCESS MESSAGE */}
          {!isWorking && workerData && workerData.length > 0 && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-green-900">Mineração Concluída!</div>
                <div className="text-sm text-green-700">{workerData.length.toLocaleString()} cidades carregadas em memória</div>
              </div>
            </div>
          )}

          {/* ERROR MESSAGE */}
          {workerError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-red-900">Erro na Mineração</div>
                <div className="text-sm text-red-700">{workerError}</div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto p-6 space-y-6"> {/* Adicione space-y-6 para dar espaçamento vertical */}
        {/* PARTE 1: AS DUAS COLUNAS (LADO A LADO) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-150"> {/* Altura fixa ajuda a manter o layout estável */}
          
          {/* COLUNA ESQUERDA: EXPLORADOR API */}
          <section className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-linear-to-r from-slate-50 to-blue-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Explorador de Cidades</h2>
                    <p className="text-xs text-slate-500">Navegue pela API GeoDB</p>
                  </div>
                </div>
              </div>

              {/* BOTÃO DE BUSCAR PRIMEIRAS 10 */}
              {manualCities.length === 0 && !loadingManual && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => fetchManualCities(0)}
                    className="px-6 py-3 rounded-xl font-semibold bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Buscar Primeiras 10 Cidades
                  </button>
                </div>
              )}

              {/* PAGINAÇÃO */}
              {manualCities.length > 0 && (
                <div className="mt-4 flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
                  <button
                    onClick={handlePrevPage}
                    disabled={offset === 0 || loadingManual}
                    className="px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Anterior
                  </button>
                
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-600">Página</span>
                  <span className="text-sm font-bold text-slate-900">{Math.floor(offset / 10) + 1}</span>
                  <span className="text-sm text-slate-400">/</span>
                  <span className="text-sm text-slate-600">1000</span>
                </div>

                <button
                  onClick={handleNextPage}
                  disabled={loadingManual}
                  className="px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2"
                >
                  Próxima
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              )}
            </div>

            {/* LISTA DE CIDADES */}
            <div className="p-4 h-[calc(100vh-400px)] overflow-y-auto">
              {cityCards}
            </div>
          </section>

          {/* COLUNA DIREITA: LISTA DE CLUSTERS (Volta a ser apenas lista) */}
          <section className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
            
            {/* CABEÇALHO DA COLUNA */}
            <div className={`px-6 py-4 border-b border-slate-200 ${clusters.length > 0 ? 'bg-purple-50' : 'bg-linear-to-r from-indigo-50 to-purple-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${clusters.length > 0 ? 'bg-purple-100' : 'bg-indigo-100'}`}>
                    {clusters.length > 0 ? (
                      <span className="text-xl">🧠</span>
                    ) : (
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {clusters.length > 0 ? 'Resultado do K-Means' : 'Repositório Local'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {clusters.length > 0 ? `${clusters.length} grupos formados` : 'Suas cidades selecionadas'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* LISTA DE CONTEÚDO */}
            <div className="p-4 overflow-y-auto flex-1">
              
              {/* CENÁRIO 1: MOSTRAR CLUSTERS (SE O K-MEANS RODOU) */}
              {clusters.length > 0 ? (
                <div className="space-y-6">
                  {clusters.map((cluster, i) => (
                    <div key={i} className="border border-purple-200 rounded-xl overflow-hidden shadow-sm">
                      {/* Cabeçalho do Grupo */}
                      <div className="bg-purple-100 px-4 py-2 flex justify-between items-center">
                        <span className="font-bold text-purple-900">Grupo {i + 1}</span>
                        <span className="text-xs bg-white text-purple-700 px-2 py-1 rounded-full font-bold border border-purple-200">
                          {cluster.members.length} cidades
                        </span>
                      </div>
                      
                      {/* Detalhes do Centróide */}
                      <div className="bg-purple-50 px-4 py-2 text-xs text-purple-600 border-b border-purple-100 flex gap-4">
                        <span>📍 Centro Lat: {cluster.centroid.coords[0].toFixed(2)}</span>
                        <span>📍 Centro Lon: {cluster.centroid.coords[1].toFixed(2)}</span>
                      </div>

                      {/* Lista das primeiras 5 cidades do grupo (Amostra) */}
                      <div className="p-2 space-y-1">
                        {cluster.members.slice(0, 5).map((member: any) => (
                          <div key={member.id} className="text-sm text-slate-600 px-2 py-1 bg-white rounded border border-slate-100 flex justify-between">
                            <span>{member.name}</span>
                            <span className="text-xs text-slate-400">{member.country}</span>
                          </div>
                        ))}
                        {cluster.members.length > 5 && (
                          <div className="flex justify-center py-2">
                            <button
                              onClick={() => handleOpenClusterModal(i)}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-all shadow-sm flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              Ver todas ({cluster.members.length})
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* CENÁRIO 2: MOSTRAR SELEÇÃO MANUAL (SE NÃO RODOU K-MEANS) */
                selectedCities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 min-h-50">
                    <p className="font-semibold text-slate-600 mb-1">Repositório vazio</p>
                    <p className="text-sm text-slate-400">Selecione cidades ou rode o K-Means</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSelectedCities.map((city, index) => (
                      <div key={city.id} className="group bg-linear-to-r from-slate-50 to-indigo-50 border border-indigo-200 rounded-xl p-4">
                         <div className="flex justify-between">
                            <span className="font-bold">{city.name}</span>
                            <button onClick={() => handleRemoveCity(city.id)} className="text-red-500 hover:text-red-700">Remover</button>
                         </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </section>
        </div>

        {/* PARTE 2: O MAPA (EMBAIXO, LARGURA TOTAL) */}
        {/* Só mostramos essa seção se o K-Means já tiver rodado */}
        {clusters.length > 0 && (
          <section className="w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-700">
            {/* Cabeçalho do Mapa */}
            <div className="px-6 py-4 border-b border-slate-200 bg-linear-to-r from-emerald-50 to-teal-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-xl">
                  🌍
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Mapa de Clusters</h2>
                  <p className="text-xs text-slate-500">Visualização geoespacial dos grupos</p>
                </div>
              </div>
            </div>

            {/* O Mapa em si */}
            <div className="h-150 w-full p-1 bg-slate-50"> 
              {/* Altura de 600px garante uma ótima visualização */}
              <ClusterMap clusters={clusters} />
            </div>
          </section>
        )}

      </main>

      {/* MODAL DE CIDADES DO CLUSTER */}
      {selectedClusterForModal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleCloseClusterModal}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Cabeçalho do Modal */}
            <div className="px-6 py-4 border-b border-slate-200 bg-purple-50 rounded-t-2xl flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Grupo {selectedClusterForModal + 1}</h3>
                <p className="text-sm text-slate-600">{clusters[selectedClusterForModal].members.length} cidades neste cluster</p>
              </div>
              <button
                onClick={handleCloseClusterModal}
                className="w-10 h-10 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-all"
              >
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Corpo do Modal com Scroll */}
            <div className="overflow-y-auto p-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clusters[selectedClusterForModal].members.map((member: any) => (
                  <div key={member.id} className="bg-linear-to-br from-slate-50 to-purple-50 border border-purple-200 rounded-xl p-4 hover:shadow-lg transition-all">
                    <h4 className="font-bold text-slate-900 mb-2">{member.name}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                        <span>{member.country}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span>{member.original.population.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 text-xs">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{member.original.latitude.toFixed(2)}, {member.original.longitude.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end">
              <button
                onClick={handleCloseClusterModal}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}