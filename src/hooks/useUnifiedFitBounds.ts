import { useRef, useCallback, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

interface FitBoundsOptions {
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Default padding */
  padding?: number;
  /** Max zoom level */
  maxZoom?: number;
  /** Animation duration */
  duration?: number;
  /** Called when triggerFitBounds runs and no source has coordinates. */
  onEmpty?: () => void;
}


/**
 * Unified fitBounds hook that collects coordinates from all filter sources
 * and performs a single debounced fitBounds call.
 */
export function useUnifiedFitBounds(
  map: React.RefObject<mapboxgl.Map | null>,
  options: FitBoundsOptions = {}
) {
  const {
    debounceMs = 200,
    padding = 80,
    maxZoom = 14,
    duration = 1800,
    onEmpty,
  } = options;

  // Keep the latest onEmpty callback in a ref so timeouts see the current one
  // without needing to re-create the setters on every render.
  const onEmptyRef = useRef<(() => void) | undefined>(onEmpty);
  useEffect(() => { onEmptyRef.current = onEmpty; }, [onEmpty]);


  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coordsRef = useRef<Map<string, [number, number][]>>(new Map());
  const triggerRef = useRef(0);

  /**
   * Register coordinates for a source (e.g., 'comunas', 'poligonos', 'activos', 'proyectos')
   * Pass empty array to clear that source.
   */
  const setSourceCoords = useCallback((source: string, coords: [number, number][]) => {
    if (coords.length === 0) {
      coordsRef.current.delete(source);
    } else {
      coordsRef.current.set(source, coords);
    }
  }, []);

  /**
   * Trigger a debounced fitBounds with all registered coordinates.
   */
  const triggerFitBounds = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      if (!map.current) return;

      // Collect all coordinates from all sources
      const allCoords: [number, number][] = [];
      coordsRef.current.forEach((coords) => {
        allCoords.push(...coords);
      });

      if (allCoords.length === 0) {
        // No sources have coordinates — invoke onEmpty (typically resets to
        // the initial view) so callers can revert zoom when filters clear.
        onEmptyRef.current?.();
        return;
      }


      if (allCoords.length === 1) {
        map.current.flyTo({
          center: allCoords[0],
          zoom: 12,
          duration,
          essential: true,
        });
        return;
      }

      const bounds = allCoords.reduce(
        (b, coord) => b.extend(coord),
        new mapboxgl.LngLatBounds(allCoords[0], allCoords[0])
      );

      // Smart padding: more padding when fewer sources, less when showing full country
      const sourceCount = coordsRef.current.size;
      const dynamicPadding = sourceCount <= 1 ? padding : Math.max(40, padding - sourceCount * 10);

      // Smart maxZoom: if single polygon, allow closer zoom
      const totalPoints = allCoords.length;
      const dynamicMaxZoom = totalPoints <= 20 ? maxZoom + 2 : maxZoom;

      map.current.fitBounds(bounds, {
        padding: dynamicPadding,
        maxZoom: dynamicMaxZoom,
        duration,
        essential: true,
      });
    }, debounceMs);
  }, [map, debounceMs, padding, maxZoom, duration]);

  /**
   * Clear all sources and optionally trigger a reset.
   */
  const clearAll = useCallback(() => {
    coordsRef.current.clear();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  /**
   * Get total count of visible elements across all sources.
   */
  const getTotalCount = useCallback((): Map<string, number> => {
    const counts = new Map<string, number>();
    coordsRef.current.forEach((coords, source) => {
      counts.set(source, coords.length);
    });
    return counts;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    setSourceCoords,
    triggerFitBounds,
    clearAll,
    getTotalCount,
  };
}
