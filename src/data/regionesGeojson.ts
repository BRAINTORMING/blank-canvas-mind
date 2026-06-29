// Datos simplificados de bounding boxes de las regiones de Chile
// En producción, estos deberían ser polígonos completos desde una fuente oficial

export interface RegionBounds {
  id: string;
  nombre: string;
  bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  center: [number, number]; // [lng, lat]
}

export const regionesBounds: RegionBounds[] = [
  {
    id: '3435fd9f-3d16-4617-a47e-c50afaa2cb57',
    nombre: 'Arica y Parinacota',
    bounds: [-70.5, -18.8, -68.8, -17.5],
    center: [-69.65, -18.15]
  },
  {
    id: '495ac145-912a-4ebb-a9a3-1bc4d615ff3a',
    nombre: 'Tarapacá',
    bounds: [-70.2, -21.5, -68.3, -18.8],
    center: [-69.25, -20.15]
  },
  {
    id: '7f137cf7-66ec-4038-9cd0-86c86aa77e44',
    nombre: 'Antofagasta',
    bounds: [-70.5, -26.0, -67.0, -20.5],
    center: [-68.75, -23.25]
  },
  {
    id: 'a6696451-fa93-474f-abe6-33a699c704b0',
    nombre: 'Atacama',
    bounds: [-71.5, -29.5, -68.5, -25.5],
    center: [-70.0, -27.5]
  },
  {
    id: 'cc2aa0cc-27a5-4588-947e-88b0150db2cc',
    nombre: 'Coquimbo',
    bounds: [-72.0, -32.0, -69.5, -29.0],
    center: [-70.75, -30.5]
  },
  {
    id: '209383b2-1c69-4ae3-852a-eec86c13008b',
    nombre: 'Valparaíso',
    bounds: [-71.7, -33.6, -70.0, -32.0],
    center: [-70.85, -32.8]
  },
  {
    id: '4e5af7c2-6e0d-427f-9f91-b59f7c3e41b4',
    nombre: 'Metropolitana',
    bounds: [-71.5, -34.3, -70.0, -32.8],
    center: [-70.75, -33.55]
  },
  {
    id: '80f09278-f8a4-41af-a922-ad1390cf2ea5',
    nombre: "O'Higgins",
    bounds: [-72.0, -35.0, -70.0, -33.7],
    center: [-71.0, -34.35]
  },
  {
    id: 'bfde4d28-26a9-430a-a78a-2558a9d30a8f',
    nombre: 'Maule',
    bounds: [-72.5, -36.5, -70.5, -34.5],
    center: [-71.5, -35.5]
  },
  {
    id: '1d0bae41-9457-4c13-8af5-71171edc1bc2',
    nombre: 'Ñuble',
    bounds: [-72.7, -37.5, -71.0, -36.0],
    center: [-71.85, -36.75]
  },
  {
    id: '802940e9-a86f-44e6-9e83-cf1ad4fdafb3',
    nombre: 'Biobío',
    bounds: [-73.5, -38.5, -71.0, -36.5],
    center: [-72.25, -37.5]
  },
  {
    id: '10a158fa-baba-436f-be98-b5877a98f9f2',
    nombre: 'La Araucanía',
    bounds: [-73.5, -39.5, -71.0, -37.5],
    center: [-72.25, -38.5]
  },
  {
    id: '2a1c1a44-f0b6-4d01-9322-882858d52b20',
    nombre: 'Los Ríos',
    bounds: [-73.8, -40.6, -71.5, -39.2],
    center: [-72.65, -39.9]
  },
  {
    id: '1ce4769f-10cb-4631-8167-23e9bb227682',
    nombre: 'Los Lagos',
    bounds: [-74.5, -44.0, -71.0, -39.8],
    center: [-72.75, -41.9]
  },
  {
    id: '0ef33d94-994d-4c4c-8819-4f5b6eed530d',
    nombre: 'Aysén',
    bounds: [-75.5, -49.3, -71.0, -43.6],
    center: [-73.25, -46.45]
  },
  {
    id: '490d38e3-cfd0-4339-b09c-454ca632233d',
    nombre: 'Magallanes',
    bounds: [-75.6, -56.0, -66.4, -48.6],
    center: [-71.0, -52.3]
  }
];
