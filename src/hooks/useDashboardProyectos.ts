import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { regionsMatch } from './useProyectos';

export interface DashboardProyecto {
  id: string;
  nombre: string;
  tipoPresentacion: string | null;
  region: string | null;
  comuna: string | null;
  provincia: string | null;
  tipoProyecto: string | null;
  titular: string | null;
  inversion: number | null;
  fechaPresentacion: string | null;
  estadoProyecto: string | null;
  sectorProductivo: string | null;
}

export interface DashboardFilters {
  regiones: string[];
  comunas: string[];
  provincias: string[];
  estados: string[];
  sectores: string[];
  inversionMin: number;
  inversionMax: number;
  titular: string;
}

const mapRow = (row: any): DashboardProyecto => ({
  id: row.id,
  nombre: row.nombre_proyecto || '',
  tipoPresentacion: row.tipo_presentacion || null,
  region: row.region || null,
  comuna: row.comuna || null,
  provincia: row.provincia || null,
  tipoProyecto: row.tipo_proyecto || null,
  titular: row.titular || null,
  inversion: parseFloat(row.inversion_mmu) || null,
  fechaPresentacion: row.fecha_presentacion || null,
  estadoProyecto: row.estado_proyecto || null,
  sectorProductivo: row.sector_productivo || null,
});

// Map region display names to table names
const REGION_TABLE_MAP: Record<string, string> = {
  'Arica y Parinacota': 'aricayparinacota_proyectos',
  'Tarapacá': 'tarapaca_proyectos',
  'Antofagasta': 'antofagasta_proyectos',
  'Atacama': 'atacama_proyectos',
  'Coquimbo': 'coquimbo_proyectos',
  'Valparaíso': 'valparaiso_proyectos',
  'Metropolitana de Santiago': 'metropolitanasantiago_proyectos',
  "O'Higgins": 'ohiggins_proyectos',
  'Maule': 'maule_proyectos',
  'Ñuble': 'nuble_proyectos',
  'Biobío': 'biobio_proyectos',
  'La Araucanía': 'laaraucania_proyectos',
  'Los Ríos': 'losrios_proyectos',
  'Los Lagos': 'loslagos_proyectos',
  'Aysén': 'aysen_proyectos',
  'Magallanes': 'magallanes_proyectos',
};

export const emptyFilters: DashboardFilters = {
  regiones: Object.keys(REGION_TABLE_MAP),
  comunas: [],
  provincias: [],
  estados: [],
  sectores: [],
  inversionMin: 0,
  inversionMax: Infinity,
  titular: '',
};

function getTableForRegion(regionName: string): string | null {
  if (REGION_TABLE_MAP[regionName]) return REGION_TABLE_MAP[regionName];
  for (const [key, table] of Object.entries(REGION_TABLE_MAP)) {
    if (regionsMatch(regionName, key)) return table;
  }
  return null;
}

// All 16 region names for the filter list
const ALL_REGIONES = Object.keys(REGION_TABLE_MAP).sort((a, b) => a.localeCompare(b, 'es'));

const SELECT_COLS = 'id, nombre_proyecto, tipo_presentacion, region, comuna, provincia, tipo_proyecto, titular, inversion_mmu, fecha_presentacion, estado_proyecto, sector_productivo';

async function fetchRegionData(tableName: string): Promise<any[]> {
  if (!externalSupabase) return [];
  const all: any[] = [];
  const batch = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await externalSupabase
      .from(tableName)
      .select(SELECT_COLS)
      .range(offset, offset + batch - 1);
    if (error) throw new Error(error.message);
    if (data && data.length > 0) {
      all.push(...data);
      offset += batch;
      if (data.length < batch) break;
    } else break;
  }
  return all;
}

export function useDashboardProyectos() {
  const [allProyectos, setAllProyectos] = useState<DashboardProyecto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>(emptyFilters);
  // Cache fetched regions to avoid re-fetching
  const cacheRef = useRef<Record<string, DashboardProyecto[]>>({});

  // Fetch data whenever selected regions change
  useEffect(() => {
    if (filters.regiones.length === 0) {
      setAllProyectos([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const loadRegions = async () => {
      if (!externalSupabase) { setError('Supabase no configurado'); return; }
      setLoading(true);
      setError(null);
      try {
        const results: DashboardProyecto[] = [];
        for (const region of filters.regiones) {
          // Check cache first
          if (cacheRef.current[region]) {
            results.push(...cacheRef.current[region]);
            continue;
          }
          const tableName = getTableForRegion(region);
          if (!tableName) {
            console.warn(`No table found for region: ${region}`);
            continue;
          }
          const rows = await fetchRegionData(tableName);
          const mapped = rows.map(mapRow);
          cacheRef.current[region] = mapped;
          results.push(...mapped);
        }
        if (!cancelled) setAllProyectos(results);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadRegions();
    return () => { cancelled = true; };
  }, [filters.regiones]);

  const filtered = useMemo(() => {
    return allProyectos.filter(p => {
      if (filters.comunas.length > 0) {
        if (!p.comuna || !filters.comunas.includes(p.comuna)) return false;
      }
      if (filters.provincias.length > 0) {
        if (!p.provincia || !filters.provincias.includes(p.provincia)) return false;
      }
      if (filters.estados.length > 0) {
        if (!p.estadoProyecto || !filters.estados.includes(p.estadoProyecto)) return false;
      }
      if (filters.sectores.length > 0) {
        if (!p.sectorProductivo || !filters.sectores.includes(p.sectorProductivo)) return false;
      }
      if (filters.titular.trim()) {
        if (!p.titular || !p.titular.toLowerCase().includes(filters.titular.toLowerCase())) return false;
      }
      if (p.inversion !== null) {
        if (p.inversion < filters.inversionMin) return false;
        if (filters.inversionMax !== Infinity && p.inversion > filters.inversionMax) return false;
      }
      return true;
    });
  }, [allProyectos, filters]);

  // Region list is static (all 16 regions)
  const uniqueRegiones = ALL_REGIONES;
  const uniqueEstados = useMemo(() => [...new Set(allProyectos.map(p => p.estadoProyecto).filter(Boolean) as string[])].sort(), [allProyectos]);
  const uniqueSectores = useMemo(() => [...new Set(allProyectos.map(p => p.sectorProductivo).filter(Boolean) as string[])].sort(), [allProyectos]);
  const uniqueProvincias = useMemo(() => [...new Set(allProyectos.map(p => p.provincia).filter(Boolean) as string[])].sort(), [allProyectos]);
  const uniqueComunas = useMemo(() => {
    return [...new Set(allProyectos.map(p => p.comuna).filter(Boolean) as string[])].sort();
  }, [allProyectos]);

  // KPI calculations
  const kpis = useMemo(() => {
    const total = filtered.length;
    const inversiones = filtered.map(p => p.inversion).filter((i): i is number => i !== null && !isNaN(i));
    const inversionTotal = inversiones.reduce((s, i) => s + i, 0);
    
    const estadoCounts: Record<string, number> = {};
    filtered.forEach(p => { if (p.estadoProyecto) estadoCounts[p.estadoProyecto] = (estadoCounts[p.estadoProyecto] || 0) + 1; });
    
    const regionCounts: Record<string, number> = {};
    filtered.forEach(p => { if (p.region) regionCounts[p.region] = (regionCounts[p.region] || 0) + 1; });
    const topRegiones = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    const activos = estadoCounts['En Calificación'] || 0;
    const aprobados = estadoCounts['Aprobado'] || 0;

    const sectorCounts: Record<string, number> = {};
    filtered.forEach(p => { if (p.sectorProductivo) sectorCounts[p.sectorProductivo] = (sectorCounts[p.sectorProductivo] || 0) + 1; });
    const topSectores = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    return { total, inversionTotal, activos, aprobados, topRegiones, topSectores, estadoCounts, regionCounts, sectorCounts };
  }, [filtered]);

  return {
    allProyectos,
    filtered,
    loading,
    error,
    filters,
    setFilters,
    uniqueRegiones,
    uniqueEstados,
    uniqueSectores,
    uniqueProvincias,
    uniqueComunas,
    kpis,
  };
}
