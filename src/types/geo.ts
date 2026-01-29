export interface GeoDBCityRaw {
  readonly id: number | string;
  readonly wikiDataId?: string | null;
  readonly name: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly population?: number | null;
  readonly [key: string]: unknown;
}

export interface GeoDBResponse<T = GeoDBCityRaw> {
  readonly totalCount: number;
  readonly offset: number;
  readonly limit?: number;
  readonly data: readonly T[];
}

export interface City {
  readonly id: string;
  readonly wikiDataId?: string | null;
  readonly name: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly population: number;
}

export interface NormalizedCity {
  readonly id: string;
  readonly name: string;
  readonly country: string;
  readonly latNorm: number;
  readonly lonNorm: number;
  readonly popNorm: number;
  readonly original: City;
}

export type WorkerRequest =
  | {
      readonly type: 'START_FETCH';
      readonly payload: {
        readonly query?: string;
        readonly offsetStart: number;
        readonly totalToFetch: number;
        readonly limitPerPage?: number;
        readonly headers?: Readonly<Record<string, string>>;
      };
    }
  | {
      readonly type: 'RUN_KMEANS';
      readonly payload: {
        readonly cities: readonly City[];
        readonly k: number;
        readonly maxIterations?: number;
      };
    }
  | { readonly type: 'STOP_FETCH' }
  | { readonly type: 'TERMINATE'; };

export type WorkerResponse =
  | {
      readonly type: 'FETCH_PROGRESS';
      readonly payload: {
        readonly progress: number;
        readonly message?: string;
      };
    }
  | {
      readonly type: 'FETCH_COMPLETE';
      readonly payload: {
        readonly cities: readonly City[];
      };
    }
  | {
      readonly type: 'KMEANS_RESULT';
      readonly payload: {
        readonly clusters: readonly Cluster[];
        readonly iterations: number;
      };
    }
  | {
      readonly type: 'ERROR';
      readonly payload: {
        readonly message: string;
        readonly code?: string;
      };
    };

export type Point = readonly number[];

export interface Centroid {
  readonly id: string;
  readonly coords: Point;
}

export interface Cluster {
  readonly id: string;
  readonly centroid: Centroid;
  readonly members: readonly NormalizedCity[];
}

export interface KMeansConfig {
  readonly k: number;
  readonly maxIterations?: number;
  readonly tolerance?: number;
  readonly seed?: number;
}