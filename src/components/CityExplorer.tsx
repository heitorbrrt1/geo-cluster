'use client';

import { City } from '@/types/geo';

interface CityExplorerProps {
  manualCities: City[];
  selectedCities: City[];
  loadingManual: boolean;
  offset: number;
  totalCities: number;
  onFetchManualCities: (offset: number) => void;
  onSelectCity: (city: City) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
}

export default function CityExplorer({
  manualCities,
  selectedCities,
  loadingManual,
  offset,
  totalCities,
  onFetchManualCities,
  onSelectCity,
  onNextPage,
  onPrevPage,
}: CityExplorerProps) {
  const renderContent = () => {
    if (loadingManual) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
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
          <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m13.5 8.5-5 5" />
            <path d="m8.5 8.5 5 5" />
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
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
                onClick={() => onSelectCity(city)}
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
  };

  return (
    <section className="bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col h-full overflow-hidden">
      <div className="bg-linear-to-r from-slate-50 to-blue-50 px-6 py-4 border-b border-slate-200 shrink-0">
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

        {manualCities.length === 0 && !loadingManual && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => onFetchManualCities(0)}
              className="px-6 py-3 rounded-xl font-semibold bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Buscar Primeiras 10 Cidades
            </button>
          </div>
        )}

        {manualCities.length > 0 && (
          <div className="mt-4 flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
            <button
              onClick={onPrevPage}
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
              <span className="text-sm font-bold text-slate-900">{Math.floor((offset ?? 0) / 10) + 1}</span>
              {totalCities > 0 && (
                <>
                  <span className="text-sm text-slate-400">/</span>
                  <span className="text-sm text-slate-600">{Math.ceil((totalCities ?? 0) / 10)}</span>
                </>
              )}
            </div>

            <button
              onClick={onNextPage}
              disabled={loadingManual || (totalCities > 0 && offset + 10 >= totalCities)}
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

      <div className="p-4 overflow-y-auto flex-1 min-h-0">
        {renderContent()}
      </div>
    </section>
  );
}