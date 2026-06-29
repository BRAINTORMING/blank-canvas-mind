import { useState, useEffect, useMemo, useRef } from 'react';
import { externalSupabase } from '@/integrations/supabase/externalClient';

export interface Proyecto {
  id: string;
  nombre: string;
  web: string | null;
  tipoPresentacion: string | null;
  region: string | null;
  comuna: string | null;
  provincia: string | null;
  tipoProyecto: string | null;
  razonIngreso: string | null;
  titular: string | null;
  inversion: number | null;
  fechaPresentacion: string | null;
  estadoProyecto: string | null;
  fechaCalificacion: string | null;
  sectorProductivo: string | null;
  latitud: number | null;
  longitud: number | null;
}

export interface ProyectoFilters {
  searchText: string;
  tipoPresentacion: { DIA: boolean; EIA: boolean };
  estadosSeleccionados: string[];
  sectoresSeleccionados: string[];
  inversionMin: number;
  inversionMax: number;
}

const mapProyecto = (row: any): Proyecto => ({
  id: row.id,
  nombre: row['nombre_proyecto'] || row.nombre || '',
  web: row['web'] || row.sitio_web || null,
  tipoPresentacion: row['tipo_presentacion'] || null,
  region: row['region'] || null,
  comuna: row['comuna'] || null,
  provincia: row['provincia'] || null,
  tipoProyecto: row['tipo_proyecto'] || null,
  razonIngreso: row['razon_ingreso'] || null,
  titular: row['titular'] || row.empresa_operadora || null,
  inversion: parseFloat(row['inversion_mmu']) || row.inversion_usd || null,
  fechaPresentacion: row['fecha_presentacion'] || null,
  estadoProyecto: row['estado_proyecto'] || row.estado || null,
  fechaCalificacion: row['fecha_calificacion'] || null,
  sectorProductivo: row['sector_productivo'] || null,
  latitud: parseFloat(row['latitud_punto_representativo']) || row.latitud || null,
  longitud: parseFloat(row['longitud_punto_representativo']) || row.longitud || null,
});

// Normalize a region string for fuzzy comparison
function normalizeRegion(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^region\s+(de(l)?\s+)?/i, '')
    .replace(/[_\s]+/g, ' ')
    .trim();
}

export function regionsMatch(regionA: string, regionB: string): boolean {
  const a = normalizeRegion(regionA);
  const b = normalizeRegion(regionB);
  return a === b || a.includes(b) || b.includes(a);
}

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

function getTableForRegion(regionName: string): string | null {
  if (REGION_TABLE_MAP[regionName]) return REGION_TABLE_MAP[regionName];
  for (const [key, table] of Object.entries(REGION_TABLE_MAP)) {
    if (regionsMatch(regionName, key)) return table;
  }
  return null;
}

/**
 * Fetches projects from the regional table for the selected region.
 * Returns empty if no region is selected.
 * Optionally filters by selectedComunas (lowercase-dashed IDs like "alto-hospicio").
 */
export function useProyectos(selectedRegion?: string, selectedComunas?: string[]) {
  const [allProyectos, setAllProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, Proyecto[]>>({});

  useEffect(() => {
    if (!selectedRegion) {
      setAllProyectos([]);
      setLoading(false);
      setError(null);
      return;
    }

    const tableName = getTableForRegion(selectedRegion);
    if (!tableName) {
      console.warn(`[useProyectos] No table found for region: ${selectedRegion}`);
      setAllProyectos([]);
      return;
    }

    // Use cache if available
    if (cacheRef.current[tableName]) {
      setAllProyectos(cacheRef.current[tableName]);
      return;
    }

    let cancelled = false;
    const fetchData = async () => {
      if (!externalSupabase) {
        setError('Supabase client not configured');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const allData: any[] = [];
        const batchSize = 1000;
        let offset = 0;
        while (true) {
          const { data, error: fetchError } = await externalSupabase
            .from(tableName)
            .select('*')
            .range(offset, offset + batchSize - 1);
          if (fetchError) throw new Error(fetchError.message);
          if (data && data.length > 0) {
            allData.push(...data);
            offset += batchSize;
            if (data.length < batchSize) break;
          } else break;
        }
        const mapped = allData.map(mapProyecto);
        cacheRef.current[tableName] = mapped;
        if (!cancelled) setAllProyectos(mapped);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [selectedRegion]);

  // Filter by selected comunas (lowercase-dashed IDs)
  const proyectos = useMemo(() => {
    if (!selectedComunas || selectedComunas.length === 0) return allProyectos;
    return allProyectos.filter(p => {
      if (!p.comuna) return false;
      const comunaId = p.comuna.toLowerCase().replace(/\s+/g, '-');
      return selectedComunas.includes(comunaId);
    });
  }, [allProyectos, selectedComunas]);

  // Get unique estados from data
  const estadosUnicos = useMemo(() => {
    const estados = new Set<string>();
    proyectos.forEach(p => {
      if (p.estadoProyecto) estados.add(p.estadoProyecto);
    });
    const ordenEstados = [
      'No calificado', 'En Calificación', 'Aprobado', 'Abandonado',
      'Caducado', 'Desistido', 'No Admitido a Tramitación', 'Rechazado'
    ];
    return ordenEstados.filter(e => estados.has(e));
  }, [proyectos]);

  // Get unique sectores from data
  const sectoresUnicos = useMemo(() => {
    const sectores = new Set<string>();
    proyectos.forEach(p => {
      if (p.sectorProductivo) sectores.add(p.sectorProductivo);
    });
    return Array.from(sectores).sort();
  }, [proyectos]);

  // Calculate investment stats
  const inversionStats = useMemo(() => {
    const inversiones = proyectos
      .map(p => p.inversion)
      .filter((i): i is number => i !== null && !isNaN(i));
    if (inversiones.length === 0) return { min: 0, max: 1000, total: 0 };
    return {
      min: Math.min(...inversiones),
      max: Math.max(...inversiones),
      total: inversiones.reduce((sum, i) => sum + i, 0)
    };
  }, [proyectos]);

  return { proyectos, loading, error, estadosUnicos, sectoresUnicos, inversionStats };
}

export function useFilteredProyectos(proyectos: Proyecto[], filters: ProyectoFilters) {
  return useMemo(() => {
    const hasAnyFilterActive = 
      filters.tipoPresentacion.DIA || 
      filters.tipoPresentacion.EIA ||
      filters.estadosSeleccionados.length > 0 ||
      filters.sectoresSeleccionados.length > 0 ||
      filters.searchText.trim() !== '';

    if (!hasAnyFilterActive) return [];

    return proyectos.filter(proyecto => {
      if (filters.searchText.trim()) {
        const searchLower = filters.searchText.toLowerCase();
        if (!proyecto.nombre.toLowerCase().includes(searchLower)) return false;
      }
      if (filters.tipoPresentacion.DIA || filters.tipoPresentacion.EIA) {
        const tipo = proyecto.tipoPresentacion?.toUpperCase();
        if (filters.tipoPresentacion.DIA && !filters.tipoPresentacion.EIA) {
          if (tipo !== 'DIA') return false;
        } else if (!filters.tipoPresentacion.DIA && filters.tipoPresentacion.EIA) {
          if (tipo !== 'EIA') return false;
        }
      }
      if (filters.estadosSeleccionados.length > 0) {
        if (!proyecto.estadoProyecto || !filters.estadosSeleccionados.includes(proyecto.estadoProyecto)) return false;
      }
      if (filters.sectoresSeleccionados.length > 0) {
        if (!proyecto.sectorProductivo || !filters.sectoresSeleccionados.includes(proyecto.sectorProductivo)) return false;
      }
      if (proyecto.inversion !== null) {
        if (proyecto.inversion < filters.inversionMin || proyecto.inversion > filters.inversionMax) return false;
      }
      return true;
    });
  }, [proyectos, filters]);
}
