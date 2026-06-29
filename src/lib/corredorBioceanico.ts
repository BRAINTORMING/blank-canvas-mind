// Corredor Bioceánico Capricornio – registry of routes shown in the sidebar
// Each route has a unique id, display name, highlight color (used when the
// user selects an individual subset of routes) and a public GeoJSON URL.

export interface CorredorRoute {
  id: string;
  name: string;
  shortLabel: string;
  /** Color used to highlight this route when the user selects a subset. */
  color: string;
  /** Public path (served from /public) to the GeoJSON LineString collection. */
  url: string;
}

/** Base color (intense red) used when ALL routes are selected (default state). */
export const CORREDOR_BASE_COLOR = '#DC2626'; // intense red
export const CORREDOR_BASE_WIDTH = 5.5;
export const CORREDOR_HIGHLIGHT_WIDTH = 6;

export const CORREDOR_ROUTES: CorredorRoute[] = [
  { id: 'ruta-1',    name: 'Ruta 1 · Antofagasta – Río Loa – Iquique',                  shortLabel: 'Ruta 1',    color: '#2563EB', url: '/corredor/ruta1.geojson' },
  { id: 'ruta-5',    name: 'Ruta 5 Norte · Longitudinal Norte',                          shortLabel: 'Ruta 5',    color: '#0EA5E9', url: '/corredor/ruta5.geojson' },
  { id: 'ruta-16',   name: 'Ruta 16 · Iquique – Cruce Ruta 5',                           shortLabel: 'Ruta 16',   color: '#10B981', url: '/corredor/ruta16.geojson' },
  { id: 'ruta-23',   name: 'Ruta 23 CH · Calama – San Pedro de Atacama – Paso Sico',     shortLabel: 'Ruta 23',   color: '#F59E0B', url: '/corredor/ruta23.geojson' },
  { id: 'ruta-24',   name: 'Ruta 24 · Cruce Ruta 5 (Crucero) – Tocopilla',               shortLabel: 'Ruta 24',   color: '#8B5CF6', url: '/corredor/ruta24.geojson' },
  { id: 'ruta-25',   name: 'Ruta 25 · Cruce Ruta 5 (Carmen Alto) – Calama',              shortLabel: 'Ruta 25',   color: '#EC4899', url: '/corredor/ruta25.geojson' },
  { id: 'ruta-26',   name: 'Ruta 26 · Cruce Ruta 5 (Uribe) – Antofagasta',               shortLabel: 'Ruta 26',   color: '#14B8A6', url: '/corredor/ruta26.geojson' },
  { id: 'ruta-27',   name: 'Ruta 27 CH · San Pedro de Atacama – Paso Jama',              shortLabel: 'Ruta 27',   color: '#F97316', url: '/corredor/ruta27.geojson' },
  { id: 'ruta-b39',  name: 'Ruta B-39 · Baquedano – Tilopozo – Cruce Ruta 23 CH',        shortLabel: 'Ruta B-39', color: '#A855F7', url: '/corredor/rutab39.geojson' },
  { id: 'ruta-b400', name: 'Ruta B-400 · Cruce Ruta 5 (Estación Uribe) – Cruce Ruta 1',  shortLabel: 'Ruta B-400',color: '#EAB308', url: '/corredor/rutab400.geojson' },
];

/** Source id used in Mapbox for a given route. */
export const corredorSourceId = (id: string) => `corredor-src-${id}`;
/** Main line layer id. */
export const corredorLayerId = (id: string) => `corredor-lyr-${id}`;
/** Glow / casing layer id (under the main line). */
export const corredorCasingId = (id: string) => `corredor-casing-${id}`;

export const CORREDOR_EVENT = 'corredor:selection-changed';
export interface CorredorSelectionDetail {
  selected: string[]; // route ids currently visible
}
