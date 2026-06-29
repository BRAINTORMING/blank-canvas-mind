import { useState, useCallback } from 'react';

interface GeocoderFeature {
  id: string;
  place_name: string;
  center: [number, number];
  bbox?: [number, number, number, number];
}

export const useMapboxGeocoder = (accessToken: string) => {
  const [suggestions, setSuggestions] = useState<GeocoderFeature[]>([]);
  const [loading, setLoading] = useState(false);

  const getSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `country=CL&` + // Filtrar solo Chile
        `language=es&` +
        `limit=5&` +
        `access_token=${accessToken}`
      );

      const data = await response.json();
      setSuggestions(data.features || []);
    } catch (error) {
      console.error('Error fetching geocoding suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  return { suggestions, loading, getSuggestions, setSuggestions };
};
