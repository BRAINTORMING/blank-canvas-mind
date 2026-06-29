import { useCallback, useEffect, useState } from 'react';
import type { DetailPayload } from '@/lib/mapPopups';

export interface FavoriteItem {
  id: string;
  type: DetailPayload['type'];
  title: string;
  color?: string;
  payload: DetailPayload;
}

const STORAGE_KEY = 'gdudex:favorites';
const EVENT_NAME = 'gdudex:favorites:changed';

function read(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FavoriteItem[];
  } catch {
    return [];
  }
}

function write(list: FavoriteItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function favoriteIdFor(payload: DetailPayload): string | null {
  const d = (payload.data || {}) as any;
  switch (payload.type) {
    case 'activo':       return d.id ? `activo::${d.id}` : null;
    case 'proyecto':     return d.id ? `proyecto::${d.id}` : null;
    case 'poligono':     return `poligono::${d.capa || ''}::${d.categoria || ''}::${d.etiqueta || ''}`;
    case 'planRegulador':return `planRegulador::${d.capa || ''}`;
    case 'comuna':       return `comuna::${d.comuna || ''}`;
    case 'pric':         return null;
    default:             return null;
  }
}

export function titleForPayload(payload: DetailPayload): string {
  const d = (payload.data || {}) as any;
  switch (payload.type) {
    case 'activo': return d.etiqueta || 'Activo';
    case 'proyecto': return d.nombre || 'Proyecto';
    case 'poligono': return d.etiqueta || d.categoria || 'Área';
    case 'planRegulador': return d.capa || 'Plan Regulador';
    case 'comuna': return d.comuna || 'Comuna';
    default: return 'Elemento';
  }
}

export function useFavorites() {
  const [items, setItems] = useState<FavoriteItem[]>(() => read());

  useEffect(() => {
    const handler = () => setItems(read());
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const isFavorite = useCallback((id: string | null) => {
    if (!id) return false;
    return items.some(i => i.id === id);
  }, [items]);

  const toggle = useCallback((payload: DetailPayload) => {
    const id = favoriteIdFor(payload);
    if (!id) return;
    const current = read();
    const exists = current.some(i => i.id === id);
    if (exists) {
      write(current.filter(i => i.id !== id));
    } else {
      const next: FavoriteItem = {
        id,
        type: payload.type,
        title: titleForPayload(payload),
        color: payload.color,
        payload,
      };
      write([next, ...current]);
    }
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter(i => i.id !== id));
  }, []);

  const open = useCallback((item: FavoriteItem) => {
    window.dispatchEvent(new CustomEvent('map:open-detail', { detail: item.payload }));
  }, []);

  return { items, isFavorite, toggle, remove, open };
}
