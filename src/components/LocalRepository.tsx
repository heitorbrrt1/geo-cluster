'use client';

import { City, Cluster, NormalizedCity } from '@/types/geo';

interface LocalRepositoryProps {
  selectedCities: City[];
  clusters: readonly Cluster[];
  searchTerm: string;
  onRemoveCity: (cityId: string) => void;
  onOpenClusterModal: (clusterIndex: number) => void;
  onClearLocalRepository: () => void;
}

export default function LocalRepository({
  selectedCities,
  clusters,
  searchTerm,
  onRemoveCity,
  onOpenClusterModal,
  onClearLocalRepository,
}: LocalRepositoryProps) {
  const filteredSelectedCities = selectedCities.filter(city =>
    city.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    city.country.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderContent = () => {
    if (clusters.length > 0) {
      return (
        <div className="space-y-6">
          {clusters.map((cluster, i) => (
            <div key={i} className="border border-purple-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-purple-100 px-4 py-2 flex justify-between items-center">
                <span className="font-bold text-purple-900">Grupo {i + 1}</span>
                <span className="text-xs bg-white text-purple-700 px-2 py-1 rounded-full font-bold border border-purple-200">
                  {cluster.members.length} cidades
                </span>
              </div>
              
              <div className="bg-purple-50 px-4 py-2 text-xs text-purple-600 border-b border-purple-100 flex gap-4">
                <span>📍 Centro Lat: {cluster.centroid.coords[0].toFixed(2)}</span>
                <span>📍 Centro Lon: {cluster.centroid.coords[1].toFixed(2)}</span>
              </div>

              <div className="p-2 space-y-1">
                {cluster.members.slice(0, 5).map((member: NormalizedCity) => (
                  <div key={member.id} className="text-sm text-slate-600 px-2 py-1 bg-white rounded border border-slate-100 flex justify-between">
                    <span>{member.name}</span>
                    <span className="text-xs text-slate-400">{member.country}</span>
                  </div>
                ))}
                {cluster.members.length > 5 && (
                  <div className="flex justify-center py-2">
                    <button
                      onClick={() => onOpenClusterModal(i)}
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
      );
    }

    if (selectedCities.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 min-h-50">
          <svg className="w-16 h-16 mb-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="5" x="2" y="3" rx="1" />
            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
            <path d="m9.5 17 5-5" />
            <path d="m9.5 12 5 5" />
          </svg>
          <p className="font-semibold text-slate-400 mb-1">Repositório vazio</p>
          <p className="text-sm text-slate-400">Selecione cidades ou rode o K-Means</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredSelectedCities.map((city) => (
          <div key={city.id} className="group bg-linear-to-r from-slate-50 to-indigo-50 border border-indigo-200 rounded-xl p-4">
            <div className="flex justify-between">
              <span className="font-bold">{city.name}</span>
              <button 
                onClick={() => onRemoveCity(city.id)} 
                className="text-red-500 hover:text-red-700"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-full">
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
          <div>
            <button
              onClick={onClearLocalRepository}
              className="px-3 py-1 rounded-lg text-sm bg-white border border-slate-200 text-red-600 font-semibold hover:bg-red-50"
            >
              Limpar repositório
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 overflow-y-auto flex-1">
        {renderContent()}
      </div>
    </section>
  );
}