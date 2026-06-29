// Comunas de la región de Tarapacá con sus límites aproximados
export interface Comuna {
  id: string;
  nombre: string;
  bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  center: [number, number]; // [lng, lat]
  color: string;
}

export const comunasTarapaca: Comuna[] = [
  {
    id: 'iquique',
    nombre: 'Iquique',
    bounds: [-70.25, -20.35, -70.05, -20.15],
    center: [-70.1500, -20.2200],
    color: '#3B82F6'
  },
  {
    id: 'alto-hospicio',
    nombre: 'Alto Hospicio',
    bounds: [-70.15, -20.35, -70.05, -20.20],
    center: [-70.1000, -20.2667],
    color: '#8B5CF6'
  },
  {
    id: 'pozo-almonte',
    nombre: 'Pozo Almonte',
    bounds: [-70.10, -20.35, -69.50, -19.90],
    center: [-69.7875, -20.2594],
    color: '#EC4899'
  },
  {
    id: 'pica',
    nombre: 'Pica',
    bounds: [-69.50, -20.65, -68.90, -20.35],
    center: [-69.3297, -20.4928],
    color: '#F59E0B'
  },
  {
    id: 'huara',
    nombre: 'Huara',
    bounds: [-69.90, -20.00, -69.50, -19.70],
    center: [-69.7700, -19.9900],
    color: '#10B981'
  },
  {
    id: 'camina',
    nombre: 'Camiña',
    bounds: [-69.60, -19.50, -69.20, -19.20],
    center: [-69.4167, -19.3167],
    color: '#06B6D4'
  },
  {
    id: 'colchane',
    nombre: 'Colchane',
    bounds: [-69.00, -19.50, -68.50, -19.00],
    center: [-68.6333, -19.2833],
    color: '#EF4444'
  }
];

// GeoJSON features para las comunas
export const comunasTarapacaGeoJSON = {
  type: 'FeatureCollection' as const,
  features: comunasTarapaca.map(comuna => {
    const [minLng, minLat, maxLng, maxLat] = comuna.bounds;
    return {
      type: 'Feature' as const,
      id: comuna.id,
      properties: {
        nombre: comuna.nombre,
        color: comuna.color
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat]
        ]]
      }
    };
  })
};
