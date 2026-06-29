import { useState, useEffect, useCallback } from 'react';
import { COMUNAS_TARAPACA } from '@/components/ActivosLayerControl';

interface ComunaPolygons {
  [comunaId: string]: GeoJSON.Feature[];
}

// Ray casting algorithm for point-in-polygon
function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

// Check if point is in any of the polygon's rings
function pointInGeoJSONPolygon(point: [number, number], geometry: GeoJSON.Geometry): boolean {
  if (geometry.type === 'Polygon') {
    // Check outer ring
    if (!pointInPolygon(point, geometry.coordinates[0] as number[][])) {
      return false;
    }
    // Check holes
    for (let i = 1; i < geometry.coordinates.length; i++) {
      if (pointInPolygon(point, geometry.coordinates[i] as number[][])) {
        return false;
      }
    }
    return true;
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      if (!pointInPolygon(point, polygon[0] as number[][])) {
        continue;
      }
      // Check holes
      let inHole = false;
      for (let i = 1; i < polygon.length; i++) {
        if (pointInPolygon(point, polygon[i] as number[][])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return true;
    }
    return false;
  } else if (geometry.type === 'GeometryCollection') {
    for (const geom of geometry.geometries) {
      if (pointInGeoJSONPolygon(point, geom)) {
        return true;
      }
    }
    return false;
  }
  return false;
}

// Parse GeoJSON string and extract polygon features
function parseGeoJSONToFeatures(coordenadas: string): GeoJSON.Feature[] {
  try {
    const geojson = JSON.parse(coordenadas);
    
    if (geojson.type === 'FeatureCollection') {
      return geojson.features.filter(
        (f: GeoJSON.Feature) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon' || f.geometry.type === 'GeometryCollection')
      );
    } else if (geojson.type === 'Feature') {
      if (geojson.geometry && (geojson.geometry.type === 'Polygon' || geojson.geometry.type === 'MultiPolygon' || geojson.geometry.type === 'GeometryCollection')) {
        return [geojson];
      }
    } else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon' || geojson.type === 'GeometryCollection') {
      return [{ type: 'Feature', geometry: geojson, properties: {} } as GeoJSON.Feature];
    }
    return [];
  } catch (e) {
    console.error('Error parsing GeoJSON:', e);
    return [];
  }
}

export function usePointInPolygon(selectedComunas: string[]) {
  const [comunaPolygons, setComunaPolygons] = useState<ComunaPolygons>({});
  const [loading, setLoading] = useState(false);

  // Load GeoJSON for selected comunas
  useEffect(() => {
    if (selectedComunas.length === 0) {
      setComunaPolygons({});
      return;
    }

    const loadComunas = () => {
      setLoading(true);
      const newPolygons: ComunaPolygons = {};

      for (const comunaId of selectedComunas) {
        // Skip if already loaded
        if (comunaPolygons[comunaId]) {
          newPolygons[comunaId] = comunaPolygons[comunaId];
          continue;
        }

        const comunaInfo = COMUNAS_TARAPACA.find(c => c.id === comunaId);
        if (!comunaInfo || !comunaInfo.coordenadas) continue;

        try {
          const features = parseGeoJSONToFeatures(comunaInfo.coordenadas);
          newPolygons[comunaId] = features;
        } catch (error) {
          console.error(`Error loading comuna ${comunaId}:`, error);
        }
      }

      setComunaPolygons(newPolygons);
      setLoading(false);
    };

    loadComunas();
  }, [selectedComunas]);

  // Check if a point is within any of the selected comunas
  const isPointInSelectedComunas = useCallback((lng: number, lat: number): boolean => {
    // If no comunas selected, point is considered "in" (show all)
    if (selectedComunas.length === 0) {
      return true;
    }

    const point: [number, number] = [lng, lat];

    for (const comunaId of selectedComunas) {
      const features = comunaPolygons[comunaId];
      if (!features) continue;

      for (const feature of features) {
        if (feature.geometry && pointInGeoJSONPolygon(point, feature.geometry)) {
          return true;
        }
      }
    }

    return false;
  }, [selectedComunas, comunaPolygons]);

  // Check if a polygon (from GeoJSON string) intersects with selected comunas
  const isPolygonInSelectedComunas = useCallback((coordenadasJson: string): boolean => {
    // If no comunas selected, polygon is considered "in" (show all)
    if (selectedComunas.length === 0) {
      return true;
    }

    try {
      const geojson = JSON.parse(coordenadasJson);
      
      // Get centroid of the polygon
      const coords: [number, number][] = [];
      
      const extractCoords = (geometry: GeoJSON.Geometry) => {
        switch (geometry.type) {
          case 'Polygon':
            geometry.coordinates[0].forEach((coord: number[]) => {
              coords.push([coord[0], coord[1]]);
            });
            break;
          case 'MultiPolygon':
            geometry.coordinates.forEach((polygon: number[][][]) => {
              polygon[0].forEach((coord: number[]) => {
                coords.push([coord[0], coord[1]]);
              });
            });
            break;
          case 'GeometryCollection':
            geometry.geometries.forEach((geom: GeoJSON.Geometry) => {
              extractCoords(geom);
            });
            break;
        }
      };
      
      if (geojson.type === 'FeatureCollection') {
        geojson.features.forEach((feature: GeoJSON.Feature) => {
          if (feature.geometry) extractCoords(feature.geometry);
        });
      } else if (geojson.type === 'Feature') {
        if (geojson.geometry) extractCoords(geojson.geometry);
      } else {
        extractCoords(geojson);
      }

      if (coords.length === 0) return false;

      // Check if centroid is in any selected comuna
      const centroidLng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
      const centroidLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;

      return isPointInSelectedComunas(centroidLng, centroidLat);
    } catch (e) {
      console.error('Error parsing polygon GeoJSON:', e);
      return false;
    }
  }, [isPointInSelectedComunas, selectedComunas]);

  return {
    isPointInSelectedComunas,
    isPolygonInSelectedComunas,
    loading,
    hasSelectedComunas: selectedComunas.length > 0
  };
}
