// Logistics Intelligence dataset — strategic infrastructure for the
// northern Chile logistics corridor. Coordinates are approximate and
// intended for visualization/decision-support, not navigation.

export type LogisticsCategoryId =
  | 'corredor'
  | 'puertos'
  | 'parques_industriales'
  | 'centros_logisticos'
  | 'zonas_pric';

export interface LogisticsPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description?: string;
}

export const LOGISTICS_PORTS: LogisticsPoint[] = [
  { id: 'puerto-iquique',     name: 'Puerto Iquique',     lat: -20.2074, lng: -70.1503, description: 'Terminal marítimo — Región de Tarapacá' },
  { id: 'puerto-patillos',    name: 'Puerto Patillos',    lat: -20.7522, lng: -70.1975, description: 'Terminal industrial — sal y químicos' },
  { id: 'puerto-mejillones',  name: 'Puerto Mejillones',  lat: -23.0975, lng: -70.4531, description: 'Terminal de graneles — Región de Antofagasta' },
  { id: 'puerto-antofagasta', name: 'Puerto Antofagasta', lat: -23.6524, lng: -70.4004, description: 'Terminal multipropósito — capital regional' },
  { id: 'puerto-tocopilla',   name: 'Puerto Tocopilla',   lat: -22.0919, lng: -70.2003, description: 'Terminal energético e industrial' },
];

export const LOGISTICS_PARQUES: LogisticsPoint[] = [
  { id: 'zofri-iquique',       name: 'ZOFRI Iquique',                  lat: -20.2000, lng: -70.1300, description: 'Zona Franca de Iquique' },
  { id: 'pi-alto-hospicio',    name: 'Parque Industrial Alto Hospicio', lat: -20.2800, lng: -70.1000 },
  { id: 'pi-la-negra',         name: 'Parque Industrial La Negra',      lat: -23.7500, lng: -70.3500, description: 'Antofagasta' },
];

export const LOGISTICS_CENTROS: LogisticsPoint[] = [
  { id: 'cl-alto-hospicio', name: 'Centro Logístico Alto Hospicio', lat: -20.2900, lng: -70.1100 },
  { id: 'cl-zeal-iquique',  name: 'Centro Logístico ZEAL Iquique',  lat: -20.2100, lng: -70.1500 },
];

export const LOGISTICS_PRIC: LogisticsPoint[] = [
  { id: 'pric-iquique-norte',  name: 'Zona PRIC Iquique Norte',  lat: -20.1500, lng: -70.1300 },
  { id: 'pric-alto-hospicio',  name: 'Zona PRIC Alto Hospicio',  lat: -20.2800, lng: -70.0900 },
];

export interface LogisticsCategoryMeta {
  id: LogisticsCategoryId;
  label: string;
  color: string;
  points: LogisticsPoint[];
}

export const LOGISTICS_CATEGORIES: LogisticsCategoryMeta[] = [
  { id: 'corredor',             label: 'Rutas Corredor Bioceánico', color: '#2563EB', points: [] },
  { id: 'puertos',              label: 'Puertos',                    color: '#1E3A8A', points: LOGISTICS_PORTS },
  { id: 'parques_industriales', label: 'Parques Industriales',       color: '#7C3AED', points: LOGISTICS_PARQUES },
  { id: 'centros_logisticos',   label: 'Centros Logísticos',         color: '#16A34A', points: LOGISTICS_CENTROS },
  { id: 'zonas_pric',           label: 'Zonas Logísticas PRIC',      color: '#F97316', points: LOGISTICS_PRIC },
];

export const LOGISTICS_EVENT = 'logistics:set';
export interface LogisticsEventDetail {
  active: LogisticsCategoryId[];
}
