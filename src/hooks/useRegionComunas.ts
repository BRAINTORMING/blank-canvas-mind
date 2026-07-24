import { useState, useEffect, useRef, useCallback } from 'react';
import { externalSupabase as supabase } from '@/integrations/supabase/externalClient';

// Alto Hospicio now lives in the remote DB (region_comunas table); no client-side injection needed.


export interface RegionComunaData {
  id?: number;
  region: string;
  comuna: string;
  coordenadas: string;
}

export interface RegionWithComunas {
  region: string;
  comunas: { comuna: string; coordenadas: string }[];
}

export function useRegionComunas() {
  const [data, setData] = useState<RegionComunaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [coordsReady, setCoordsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regionsWithComunas, setRegionsWithComunas] = useState<RegionWithComunas[]>([]);
  const coordsLoadedRef = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) {
      console.error('[useRegionComunas] Supabase client not configured');
      setError('Supabase client not configured');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('[useRegionComunas] Phase 1: Loading region + comuna names...');

      // Phase 1: lightweight — only names, no coordenadas
      const allRows: any[] = [];
      const batchSize = 200;
      let offset = 0;
      while (true) {
        const { data: batch, error: fetchError } = await supabase
          .from('region_comunas')
          .select('id, region, comuna')
          .range(offset, offset + batchSize - 1);

        if (fetchError) {
          console.error('[useRegionComunas] Error fetching names:', fetchError);
          throw fetchError;
        }
        if (batch && batch.length > 0) {
          allRows.push(...batch);
          offset += batchSize;
          if (batch.length < batchSize) break;
        } else break;
      }

      console.log('[useRegionComunas] Phase 1 done:', allRows.length, 'records');

      if (allRows.length === 0) {
        setData([]);
        setRegionsWithComunas([]);
        setError(null);
        setLoading(false);
        return;
      }

      const rows: RegionComunaData[] = allRows.map((r: any) => ({
        ...r,
        coordenadas: '',
      }));

      setData(rows);
      buildRegionsIndex(rows);
      setError(null);
      setLoading(false);

      // Phase 2: load coordenadas in background, one row at a time (small queries, no timeout)
      loadCoordenadasBackground(allRows);
    } catch (err) {
      console.error('[useRegionComunas] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }

  async function loadCoordenadasBackground(rows: any[]) {
    if (!supabase || coordsLoadedRef.current) return;
    coordsLoadedRef.current = true;

    console.log('[useRegionComunas] Phase 2: Loading coordenadas in background...');

    // Fetch coordenadas in small batches of 10 rows at a time
    const BATCH = 10;
    const updatedRows: RegionComunaData[] = rows.map((r: any) => ({ ...r, coordenadas: '' }));

    for (let i = 0; i < rows.length; i += BATCH) {
      const ids = rows.slice(i, i + BATCH).map((r: any) => r.id).filter(Boolean);
      if (ids.length === 0) continue;

      try {
        const { data: coordBatch } = await supabase
          .from('region_comunas')
          .select('id, coordenadas')
          .in('id', ids);

        if (coordBatch) {
          for (const cb of coordBatch) {
            const idx = updatedRows.findIndex(r => r.id === cb.id);
            if (idx !== -1) updatedRows[idx].coordenadas = cb.coordenadas || '';
          }
        }
      } catch {
        // Skip failed batch, continue with next
      }
    }

    console.log('[useRegionComunas] Phase 2 done: coordenadas loaded');
    setData([...updatedRows]);
    buildRegionsIndex(updatedRows);
    setCoordsReady(true);
  }

  function buildRegionsIndex(rows: RegionComunaData[]) {
    const regionMap = new Map<string, { comuna: string; coordenadas: string }[]>();
    for (const item of rows) {
      if (!item.region) continue;
      if (!regionMap.has(item.region)) regionMap.set(item.region, []);
      regionMap.get(item.region)!.push({ comuna: item.comuna, coordenadas: item.coordenadas });
    }

    const result: RegionWithComunas[] = [];
    regionMap.forEach((comunas, region) => {
      result.push({ region, comunas: comunas.sort((a, b) => a.comuna.localeCompare(b.comuna)) });
    });

    const sorted = result.sort((a, b) => a.region.localeCompare(b.region));
    console.log('[useRegionComunas] Regions index:', sorted.map(r => r.region));
    setRegionsWithComunas(sorted);
  }

  const getComunasByRegion = (region: string) => {
    return data.filter(item => item.region === region);
  };

  const getComunaCoordinates = useCallback((comuna: string): string | null => {
    const item = data.find(d => d.comuna === comuna);
    return item?.coordenadas || null;
  }, [data]);

  const getAllRegions = (): string[] => {
    return [...new Set(data.map(item => item.region))].filter(Boolean).sort();
  };

  const getAllComunas = (): string[] => {
    return [...new Set(data.map(item => item.comuna))].filter(Boolean).sort();
  };

  return {
    data,
    loading,
    coordsReady,
    error,
    regionsWithComunas,
    getComunasByRegion,
    getComunaCoordinates,
    getAllRegions,
    getAllComunas,
    reload: loadData
  };
}
