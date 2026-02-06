'use client';

import { Cluster, NormalizedCity } from '@/types/geo';

interface ClusterModalProps {
  cluster: Cluster | null;
  clusterIndex: number | null;
  onClose: () => void;
}

export default function ClusterModal({ cluster, clusterIndex, onClose }: ClusterModalProps) {
  if (!cluster || clusterIndex === null) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 bg-purple-50 rounded-t-2xl flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Grupo {clusterIndex + 1}</h3>
            <p className="text-sm text-slate-600">{cluster.members.length} cidades neste cluster</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-all"
          >
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cluster.members.map((member: NormalizedCity) => (
              <div 
                key={member.id} 
                className="bg-linear-to-br from-slate-50 to-purple-50 border border-purple-200 rounded-xl p-4 hover:shadow-lg transition-all"
              >
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

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}