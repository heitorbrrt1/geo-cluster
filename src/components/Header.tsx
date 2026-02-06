'use client';

import { ChangeEvent } from 'react';
import { City } from '@/types/geo';

interface HeaderProps {
  totalCount: number;
  selectedCitiesCount: number;
  isWorking: boolean;
  isKMeansRunning: boolean;
  workerData: readonly City[] | null;
  manualOffset: number;
  kValue: number;
  progress: number;
  kmeansProgress: number;
  workerError: string | null;
  onManualOffsetChange: (value: number) => void;
  onKValueChange: (value: number) => void;
  onStartMining: () => void;
  onStopFetch: () => void;
  onClearMemory: () => void;
  onLoadFromFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onDownloadData: () => void;
  onRunKMeans: () => void;
}

export default function Header({
  totalCount,
  selectedCitiesCount,
  isWorking,
  isKMeansRunning,
  workerData,
  manualOffset,
  kValue,
  progress,
  kmeansProgress,
  workerError,
  onManualOffsetChange,
  onKValueChange,
  onStartMining,
  onStopFetch,
  onClearMemory,
  onLoadFromFile,
  onDownloadData,
  onRunKMeans,
}: HeaderProps) {
  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex gap-3">
              <div className="px-4 py-2 bg-slate-100 rounded-xl">
                <div className="text-xs text-slate-500 font-medium">Total API</div>
                <div className="text-lg font-bold text-slate-900">{(totalCount ?? 0).toLocaleString()}</div>
              </div>
              <div className="px-4 py-2 bg-blue-100 rounded-xl">
                <div className="text-xs text-blue-600 font-medium">Selecionadas</div>
                <div className="text-lg font-bold text-blue-900">{selectedCitiesCount}</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {!isWorking && !isKMeansRunning && (
                <div className="flex gap-3">
                  {(!workerData || workerData.length === 0) && (
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">
                        Começar do Offset
                      </label>
                      <input 
                        type="number" 
                        value={manualOffset}
                        onChange={(e) => onManualOffsetChange(Number(e.target.value))}
                        className="w-24 px-3 py-3 rounded-xl border border-slate-200 text-center font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        placeholder="0"
                        min={0}
                      />
                    </div>
                  )}
                  
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-purple-600 uppercase ml-1">
                      Cluster K
                    </label>
                    <input 
                      type="number" 
                      value={kValue}
                      onChange={(e) => onKValueChange(Math.max(1, Number(e.target.value)))}
                      className="w-20 px-3 py-3 rounded-xl border border-purple-300 text-center font-bold text-purple-700 focus:ring-2 focus:ring-purple-500 outline-none shadow-sm bg-purple-50"
                      placeholder="5"
                      min={1}
                      max={20}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={isWorking ? onStopFetch : onStartMining}
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

            <div className="flex gap-2 mr-4">
              {workerData && workerData.length > 0 && !isWorking && (
                <button
                  onClick={onClearMemory}
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
                  onChange={onLoadFromFile}
                />
              </label>

              {workerData && workerData.length > 0 && (
                <button
                  onClick={onDownloadData}
                  className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-2 rounded text-sm font-bold"
                >
                  💾 Salvar JSON
                </button>
              )}

              {workerData && workerData.length > 0 && !isWorking && !isKMeansRunning && (
                <button
                  onClick={onRunKMeans}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all flex items-center gap-2"
                >
                  <span className="text-lg">🧠</span>
                  Agrupar (K={kValue})
                </button>
              )}

              {isKMeansRunning && (
                <div className="flex items-center gap-2 bg-purple-100 px-4 py-2 rounded-lg border border-purple-300">
                  <svg className="animate-spin h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  <span className="text-sm font-bold text-purple-700">{kValue} Workers: {kmeansProgress}%</span>
                </div>
              )}
            </div>
          </div>
        </div>

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
  );
}