'use client';

import dynamic from 'next/dynamic';
import { Cluster } from '@/types/geo';

const ClusterMap = dynamic(() => import('@/components/ClusterMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-slate-100 animate-pulse flex items-center justify-center rounded-2xl text-slate-400 font-medium">
      Carregando Mapa...
    </div>
  ),
});

interface ClusterMapSectionProps {
  clusters: readonly Cluster[];
}

export default function ClusterMapSection({ clusters }: ClusterMapSectionProps) {
  if (clusters.length === 0) return null;

  return (
    <section className="w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-700">
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

      <div className="h-150 w-full p-1 bg-slate-50"> 
        <ClusterMap clusters={clusters} />
      </div>
    </section>
  );
}