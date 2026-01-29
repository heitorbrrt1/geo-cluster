"use client";

import { Fragment } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Cluster } from '@/types/geo';

// Cores para diferenciar os 5 grupos
const COLORS = [
  '#ef4444', // Vermelho (Grupo 1)
  '#3b82f6', // Azul (Grupo 2)
  '#10b981', // Verde (Grupo 3)
  '#f59e0b', // Laranja (Grupo 4)
  '#8b5cf6', // Roxo (Grupo 5)
];

interface ClusterMapProps {
  clusters: readonly Cluster[];
}

export default function ClusterMap({ clusters }: ClusterMapProps) {
  // Centraliza o mapa no primeiro centróide ou no Brasil/Mundo se vazio
  const firstCentroid = clusters[0]?.centroid.coords;
  const center: [number, number] = firstCentroid 
    ? [firstCentroid[0], firstCentroid[1]] 
    : [20, 0]; // Visão global padrão

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer
        center={center}
        zoom={2}
        style={{ height: '100%', width: '100%', borderRadius: '1rem' }}
        // Desabilita interações via opções do mapa
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
        scrollWheelZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomControl={false}
      >
        {/* Mapa Base (OpenStreetMap) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {clusters.map((cluster, groupIndex) => {
          const color = COLORS[groupIndex % COLORS.length];

          return (
            <Fragment key={groupIndex}>
              {/* 1. Desenha as CIDADES do grupo (Bolinhas pequenas) */}
              {cluster.members.map((city: any) => (
                <CircleMarker
                  key={city.id}
                  center={[city.original.latitude, city.original.longitude]}
                  radius={4} // Tamanho da bolinha
                  pathOptions={{ 
                    color: color, 
                    fillColor: color, 
                    fillOpacity: 0.6, 
                    weight: 1 
                  }}
                >
                  <Tooltip>{city.name} (Grupo {groupIndex + 1})</Tooltip>
                </CircleMarker>
              ))}

              {/* 2. Desenha o CENTRÓIDE do grupo (Bola grande com borda preta) */}
              <CircleMarker
                center={[cluster.centroid.coords[0], cluster.centroid.coords[1]]}
                radius={12}
                pathOptions={{ 
                  color: 'black', 
                  fillColor: color, 
                  fillOpacity: 1, 
                  weight: 3 
                }}
              >
                <Popup>
                  <strong>CENTRO DO GRUPO {groupIndex + 1}</strong><br/>
                  População: {cluster.members.length} cidades
                </Popup>
              </CircleMarker>
            </Fragment>
          );
        })}
      </MapContainer>

      {/* Legenda Flutuante */}
      <div className="absolute bottom-4 right-4 bg-white/90 p-3 rounded-lg shadow-xl z-1000 text-xs">
        <h4 className="font-bold mb-2">Legenda</h4>
        {clusters.map((c, i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
            <span>Grupo {i + 1} ({c.members.length})</span>
          </div>
        ))}
      </div>
    </div>
  );
}