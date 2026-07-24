import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Loader2, Brain, Search, ArrowUp, Wand2, Filter, Layers, MapPin, Leaf, ChevronRight, Briefcase, History, Clock, FileSearch, TrendingUp, ClipboardList, Maximize2, Minimize2, Lock } from 'lucide-react';
import GdudexMark from '@/components/icons/GdudexMark';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { COMUNAS_TARAPACA } from './ActivosLayerControl';
import { cn } from '@/lib/utils';
import { type Proyecto } from '@/hooks/useProyectos';
import EvaluacionPRICModal, { type EvaluacionPRICData } from './EvaluacionPRICModal';
import OportunidadesPanel from './OportunidadesPanel';

import { useAuth } from '@/contexts/AuthContext';
import { showPaidLockToast } from '@/lib/planLocks';

interface ActivoMapa {
  id: string;
  etiqueta: string;
  latitud: number;
  longitud: number;
  capa?: string;
  categoria?: string;
}

export interface FilterAction {
  capas: string[];
  categorias: string[];
  comunas: string[];
  medioambienteKeys: string[];
  clearPrevious?: boolean;
  proyectoSearch?: string;
  activateAllPlanRegulador?: boolean;
  pricQueryPoint?: { lat: number; lng: number };
}

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  onRegionSelect?: (regionId: string) => void;
  onAddressSelect?: (coordinates: [number, number], bounds?: [number, number, number, number]) => void;
  onCoordinatesExtracted?: (coords: Array<[number, number]>) => void;
  onLabelSearch?: (label: string) => void;
  onResponseClose?: () => void;
  onFiltersApply?: (filters: FilterAction) => void;
  onSyncFilters?: (filters: FilterAction) => void;
  activos?: ActivoMapa[];
  availableCapas?: { capa: string; categorias: string[] }[];
  availableMedioambiente?: { capa: string; categorias: { categoria: string; etiquetas: string[] }[] }[];
  proyectos?: Proyecto[];
  isMobile?: boolean;
  selectedComunas?: string[];
  isPointInSelectedComunas?: (lng: number, lat: number) => boolean;
  sidebarCollapsed?: boolean;
  sidebarWidth?: number;
  onPricFormOpenChange?: (open: boolean) => void;
}

export interface SearchFilters {
  categorias: string[];
  regiones: string[];
  estados: string[];
}

type SearchMode = 'general' | 'ai';
type AIMode = 'pre-evaluacion' | 'oportunidades' | 'requisitos';

interface SearchSuggestion {
  id: string;
  label: string;
  type: 'capa' | 'categoria' | 'comuna' | 'poligono' | 'etiqueta' | 'proyecto' | 'history';
  parentLabel?: string;
  icon: typeof Layers;
  data: {
    capa?: string;
    categoria?: string;
    comunaId?: string;
    medioambienteKey?: string;
    proyectoId?: string;
    proyectoNombre?: string;
  };
}

interface SearchHistoryItem {
  id: string;
  label: string;
  type: SearchSuggestion['type'];
  timestamp: number;
  data: SearchSuggestion['data'];
}

// Hook para obtener y almacenar la ubicación del usuario
const useUserLocation = () => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const storedLocation = localStorage.getItem('userLocation');
    if (storedLocation) {
      setLocation(JSON.parse(storedLocation));
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          localStorage.setItem('userLocation', JSON.stringify(coords));
          setLocation(coords);
          toast({
            title: "Ubicación obtenida",
            description: "Tu ubicación ha sido guardada para mejorar las consultas",
          });
        },
        (error) => {
          console.error('Error obteniendo ubicación:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        }
      );
    }
  }, [toast]);

  return location;
};

// Animated placeholder words for AI mode
const PLACEHOLDER_WORDS = [
  'Tarapacá',
  'Áreas protegidas',
  'Minería',
  'Recursos hídricos',
  'Energía solar',
  'Comunas',
  'Inversiones',
  'Zonas costeras',
  'Parques nacionales',
  'Infraestructura',
  'Turismo',
  'Agricultura',
  'Puertos',
  'Transporte',
  'Emprendimiento',
  'Innovación',
  'Desarrollo',
  'Oportunidades',
  'Potencial',
  'Proyectos',
];

// Hook for animated placeholder
const useAnimatedPlaceholder = (isActive: boolean) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % PLACEHOLDER_WORDS.length);
        setIsAnimating(false);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, [isActive]);

  return { currentWord: PLACEHOLDER_WORDS[currentIndex], isAnimating };
};

// Hook for search history
const useSearchHistory = () => {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  
  useEffect(() => {
    const stored = localStorage.getItem('searchHistory');
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing search history:', e);
      }
    }
  }, []);

  const addToHistory = (item: Omit<SearchHistoryItem, 'id' | 'timestamp'>) => {
    setHistory(prev => {
      // Remove duplicate if exists
      const filtered = prev.filter(h => h.label !== item.label);
      const newItem: SearchHistoryItem = {
        ...item,
        id: `history-${Date.now()}`,
        timestamp: Date.now(),
      };
      const updated = [newItem, ...filtered].slice(0, 10); // Keep last 10
      localStorage.setItem('searchHistory', JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('searchHistory');
  };

  return { history, addToHistory, clearHistory };
};

export default function SearchBar({ 
  onSearch, 
  onRegionSelect, 
  onAddressSelect, 
  onCoordinatesExtracted, 
  onLabelSearch, 
  onResponseClose, 
  onFiltersApply,
  onSyncFilters,
  activos = [], 
  availableCapas = [],
  availableMedioambiente = [],
  proyectos = [],
  isMobile = false,
  selectedComunas = [],
  isPointInSelectedComunas,
  sidebarCollapsed = false,
  sidebarWidth = 0,
  onPricFormOpenChange
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isResponseExpanded, setIsResponseExpanded] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('general');
  const [aiMode, setAiMode] = useState<AIMode>('pre-evaluacion');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [showPreEvaluacionModal, setShowPreEvaluacionModal] = useState(false);
  const [isPreEvaluacionLoading, setIsPreEvaluacionLoading] = useState(false);
  // Oportunidades: punto seleccionado en el mapa + modo picking (reutiliza los
  // eventos pric:pickMode / pric:pointPicked que el mapa ya escucha).
  const [oportPoint, setOportPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [oportPicking, setOportPicking] = useState(false);
  useEffect(() => {
    if (aiMode !== 'oportunidades' || searchMode !== 'ai') return;
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { lat: number; lng: number };
      if (!d) return;
      setOportPoint({ lat: d.lat, lng: d.lng });
      setOportPicking(false);
    };
    window.addEventListener('pric:pointPicked', handler);
    return () => window.removeEventListener('pric:pointPicked', handler);
  }, [aiMode, searchMode]);
  useEffect(() => {
    if (aiMode !== 'oportunidades' || searchMode !== 'ai') {
      if (oportPicking) {
        window.dispatchEvent(new CustomEvent('pric:pickMode', { detail: { enabled: false } }));
        setOportPicking(false);
      }
      return;
    }
    window.dispatchEvent(new CustomEvent('pric:pickMode', { detail: { enabled: oportPicking } }));
  }, [oportPicking, aiMode, searchMode]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { hasPermission, isFreePlan } = useAuth();
  const userLocation = useUserLocation();
  const { currentWord, isAnimating } = useAnimatedPlaceholder(searchMode === 'ai');
  const { history, addToHistory } = useSearchHistory();

  // The right-side drawer signal covers both PRIC and Oportunidades panels so
  // the map shrinks identically for both flows.
  const oportunidadesOpen = searchMode === 'ai' && aiMode === 'oportunidades' && !isFreePlan;
  useEffect(() => {
    onPricFormOpenChange?.(showPreEvaluacionModal || oportunidadesOpen);
  }, [showPreEvaluacionModal, oportunidadesOpen, onPricFormOpenChange]);


  const canUseGeneral = hasPermission('busqueda_general');
  const canUseAI = hasPermission('consulta_ia');
  const canSeeProyectos = hasPermission('proyectos');

  // If user doesn't have general but has AI, default to AI mode
  useEffect(() => {
    if (!canUseGeneral && canUseAI) {
      setSearchMode('ai');
    }
  }, [canUseGeneral, canUseAI]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to calculate correct scrollHeight
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Clamp between min and max
      const newHeight = Math.min(Math.max(scrollHeight, 24), 96);
      textareaRef.current.style.height = newHeight + 'px';
    }
  }, [query]);

  // Normalizar texto para comparación (quitar acentos, lowercase)
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  // Build all searchable items including proyectos - filtered by selected comunas
  const allSearchableItems = useMemo((): SearchSuggestion[] => {
    const items: SearchSuggestion[] = [];

    // Add capas and their categories (always shown - they filter the points inside)
    availableCapas.forEach(capaData => {
      items.push({
        id: `capa-${capaData.capa}`,
        label: capaData.capa,
        type: 'capa',
        icon: Layers,
        data: { capa: capaData.capa }
      });

      capaData.categorias.forEach(categoria => {
        items.push({
          id: `categoria-${capaData.capa}-${categoria}`,
          label: categoria,
          type: 'categoria',
          parentLabel: capaData.capa,
          icon: Filter,
          data: { capa: capaData.capa, categoria }
        });
      });
    });

    // Add comunas (always shown)
    COMUNAS_TARAPACA.forEach(comuna => {
      items.push({
        id: `comuna-${comuna.id}`,
        label: comuna.nombre,
        type: 'comuna',
        icon: MapPin,
        data: { comunaId: comuna.id }
      });
    });

    // Add medioambiente items (always shown - they filter the polygons inside)
    availableMedioambiente.forEach(capaData => {
      items.push({
        id: `poligono-capa-${capaData.capa}`,
        label: capaData.capa,
        type: 'poligono',
        parentLabel: 'Medioambiente',
        icon: Leaf,
        data: { capa: capaData.capa }
      });

      capaData.categorias.forEach(catData => {
        catData.etiquetas.forEach(etiqueta => {
          const key = `${capaData.capa}::${catData.categoria}::${etiqueta}`;
          items.push({
            id: `poligono-${key}`,
            label: etiqueta || catData.categoria,
            type: 'poligono',
            parentLabel: `${capaData.capa} › ${catData.categoria}`,
            icon: Leaf,
            data: { medioambienteKey: key }
          });
        });
      });
    });

    // Add etiquetas from activos - filtered by selected comunas
    const uniqueEtiquetas = new Map<string, ActivoMapa>();
    activos.forEach(activo => {
      // If comunas selected, only include activos inside those comunas
      if (selectedComunas.length > 0 && isPointInSelectedComunas) {
        if (!isPointInSelectedComunas(activo.longitud, activo.latitud)) {
          return;
        }
      }
      if (!uniqueEtiquetas.has(activo.etiqueta)) {
        uniqueEtiquetas.set(activo.etiqueta, activo);
      }
    });

    uniqueEtiquetas.forEach((activo, etiqueta) => {
      items.push({
        id: `etiqueta-${activo.id}`,
        label: etiqueta,
        type: 'etiqueta',
        parentLabel: activo.capa,
        icon: MapPin,
        data: { capa: activo.capa, categoria: activo.categoria }
      });
    });

    // Add proyectos from Intelligence Projects - filtered by selected comunas
    // Only include if user has the 'proyectos' permission (free accounts excluded).
    if (canSeeProyectos) {
      proyectos.forEach(proyecto => {
        // If comunas selected, only include proyectos inside those comunas
        if (selectedComunas.length > 0 && isPointInSelectedComunas) {
          if (proyecto.latitud === null || proyecto.longitud === null) return;
          if (!isPointInSelectedComunas(proyecto.longitud, proyecto.latitud)) {
            return;
          }
        }
        items.push({
          id: `proyecto-${proyecto.id}`,
          label: proyecto.nombre,
          type: 'proyecto',
          parentLabel: proyecto.sectorProductivo || 'Proyecto',
          icon: Briefcase,
          data: {
            proyectoId: proyecto.id,
            proyectoNombre: proyecto.nombre
          }
        });
      });
    }

    return items;
  }, [availableCapas, availableMedioambiente, activos, proyectos, selectedComunas, isPointInSelectedComunas, canSeeProyectos]);

  // Filter suggestions based on query - includes history when empty
  const filteredSuggestions = useMemo(() => {
    if (searchMode !== 'general') return [];
    
    // If no query, show history
    if (!query.trim()) {
      return history.slice(0, 5).map(h => ({
        id: h.id,
        label: h.label,
        type: h.type,
        icon: Clock,
        parentLabel: 'Historial',
        data: h.data,
      } as SearchSuggestion));
    }

    const normalizedQuery = normalizeText(query);
    
    return allSearchableItems
      .filter(item => {
        const normalizedLabel = normalizeText(item.label);
        const normalizedParent = item.parentLabel ? normalizeText(item.parentLabel) : '';
        return normalizedLabel.includes(normalizedQuery) || normalizedParent.includes(normalizedQuery);
      })
      .sort((a, b) => {
        // Prioritize exact matches
        const aExact = normalizeText(a.label).startsWith(normalizedQuery);
        const bExact = normalizeText(b.label).startsWith(normalizedQuery);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Then by type priority
        const typePriority = { capa: 0, categoria: 1, comuna: 2, poligono: 3, etiqueta: 4, proyecto: 5, history: 6 };
        return typePriority[a.type] - typePriority[b.type];
      })
      .slice(0, 10);
  }, [query, searchMode, allSearchableItems, history]);

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    // Always start with a clean filter state
    const filters: FilterAction = {
      capas: [],
      categorias: [],
      comunas: [],
      medioambienteKeys: [],
      clearPrevious: true, // Always clear previous filters
      proyectoSearch: '', // Explicitly clear with empty string (not undefined)
    };

    switch (suggestion.type) {
      case 'capa':
        if (suggestion.data.capa) filters.capas = [suggestion.data.capa];
        break;
      case 'categoria':
        if (suggestion.data.capa) filters.capas = [suggestion.data.capa];
        if (suggestion.data.categoria) filters.categorias = [suggestion.data.categoria];
        break;
      case 'comuna':
        if (suggestion.data.comunaId) filters.comunas = [suggestion.data.comunaId];
        break;
      case 'poligono':
        if (suggestion.data.medioambienteKey) {
          filters.medioambienteKeys = [suggestion.data.medioambienteKey];
        } else if (suggestion.data.capa) {
          const capaData = availableMedioambiente.find(c => c.capa === suggestion.data.capa);
          if (capaData) {
            capaData.categorias.forEach(cat => {
              cat.etiquetas.forEach(etiqueta => {
                filters.medioambienteKeys.push(`${capaData.capa}::${cat.categoria}::${etiqueta}`);
              });
            });
          }
        }
        break;
      case 'etiqueta':
        if (suggestion.data.capa) filters.capas = [suggestion.data.capa];
        if (suggestion.data.categoria) filters.categorias = [suggestion.data.categoria];
        onLabelSearch?.(suggestion.label);
        break;
      case 'proyecto':
        filters.proyectoSearch = suggestion.data.proyectoNombre;
        break;
      case 'history':
        // For history items, determine the original type and reapply
        if (suggestion.data.comunaId) filters.comunas = [suggestion.data.comunaId];
        else if (suggestion.data.medioambienteKey) filters.medioambienteKeys = [suggestion.data.medioambienteKey];
        else if (suggestion.data.proyectoNombre) filters.proyectoSearch = suggestion.data.proyectoNombre;
        else if (suggestion.data.capa) {
          filters.capas = [suggestion.data.capa];
          if (suggestion.data.categoria) filters.categorias = [suggestion.data.categoria];
        }
        break;
    }

    // Add to history (only for non-history items)
    if (suggestion.type !== 'history') {
      addToHistory({
        label: suggestion.label,
        type: suggestion.type,
        data: suggestion.data,
      });
    }

    onFiltersApply?.(filters);
    onSyncFilters?.(filters);
    
    setQuery('');
    setShowSuggestions(false);
    
    toast({
      title: "Filtro aplicado",
      description: `Se ha aplicado el filtro: ${suggestion.label}`,
    });
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (searchMode === 'general' && showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
      } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        handleSelectSuggestion(filteredSuggestions[selectedSuggestionIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (searchMode === 'ai' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAISearch();
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedSuggestionIndex(-1);
  }, [filteredSuggestions]);

  // Detectar filtros a aplicar basándose en el texto de la consulta y respuesta (para AI mode)
  const detectFiltersFromText = (queryText: string, responseText: string): FilterAction => {
    const normalizedQuery = normalizeText(queryText);
    const normalizedResponse = normalizeText(responseText);
    const combinedText = normalizedQuery + ' ' + normalizedResponse;
    
    const filters: FilterAction = {
      capas: [],
      categorias: [],
      comunas: [],
      medioambienteKeys: [],
      clearPrevious: true,
      proyectoSearch: undefined,
    };

    // Check for all comunas
    const wantsAllComunas = 
      normalizedQuery.includes('todas las comunas') || 
      normalizedQuery.includes('toda la region') ||
      normalizedQuery.includes('mostrar todas las comunas');

    if (wantsAllComunas) {
      filters.comunas = COMUNAS_TARAPACA.map(c => c.id);
    } else {
      COMUNAS_TARAPACA.forEach(comuna => {
        const normalizedName = normalizeText(comuna.nombre);
        if (normalizedQuery.includes(normalizedName) || normalizedResponse.includes(normalizedName)) {
          if (!filters.comunas.includes(comuna.id)) {
            filters.comunas.push(comuna.id);
          }
        }
      });
    }

    // Detect capas and categories
    availableCapas.forEach(capaData => {
      const normalizedCapa = normalizeText(capaData.capa);
      const capaVariations = [normalizedCapa, normalizedCapa.replace(/s$/, ''), normalizedCapa + 's'];
      
      const capaFound = capaVariations.some(variation => 
        combinedText.includes(variation) || combinedText.includes(variation.replace(/ /g, ''))
      );
      
      if (capaFound) {
        filters.capas.push(capaData.capa);
        capaData.categorias.forEach(categoria => {
          const normalizedCat = normalizeText(categoria);
          const catVariations = [normalizedCat, normalizedCat.replace(/s$/, ''), normalizedCat + 's'];
          if (catVariations.some(v => combinedText.includes(v))) {
            filters.categorias.push(categoria);
          }
        });
      }
    });

    // Detect medioambiente
    const medioambienteKeywords = [
      'area protegida', 'areas protegidas', 'reserva', 'parque nacional',
      'santuario', 'monumento natural', 'medioambiente', 'medio ambiente'
    ];
    
    const hasMedioambienteContext = medioambienteKeywords.some(kw => 
      combinedText.includes(normalizeText(kw))
    );

    if (hasMedioambienteContext && availableMedioambiente.length > 0) {
      availableMedioambiente.forEach(capaData => {
        const normalizedCapa = normalizeText(capaData.capa);
        const capaFound = combinedText.includes(normalizedCapa);
        
        if (capaFound || hasMedioambienteContext) {
          capaData.categorias.forEach(catData => {
            const normalizedCat = normalizeText(catData.categoria);
            if (combinedText.includes(normalizedCat) || capaFound) {
              catData.etiquetas.forEach(etiqueta => {
                const key = `${capaData.capa}::${catData.categoria}::${etiqueta}`;
                if (!filters.medioambienteKeys.includes(key)) {
                  filters.medioambienteKeys.push(key);
                }
              });
            }
          });
        }
      });
    }

    return filters;
  };

  // Format number to Chilean regional format (thousands: ".", decimals: ",")
  const formatChileanNumber = (num: number, decimals: number = 2): string => {
    const fixed = num.toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decPart ? `${formattedInt},${decPart}` : formattedInt;
  };

  // Handle PRIC Evaluation modal submission.
  // The RPC call to `evaluar_proyecto_pric` runs inside EvaluacionPRICModal
  // (against Supabase in EPSG:4326, using lat/lng exactly as entered).
  // Here we only react to a successful submission by zooming to the point
  // and activating the Plan Regulador layers on the map.
  const handleEvaluacionPRICSubmit = (data: EvaluacionPRICData) => {
    if (onFiltersApply) {
      onFiltersApply({
        capas: [],
        categorias: [],
        comunas: [],
        medioambienteKeys: [],
        clearPrevious: false,
        activateAllPlanRegulador: true,
        pricQueryPoint: { lat: data.latitud, lng: data.longitud }
      });
    }

    if (onAddressSelect) {
      onAddressSelect([data.longitud, data.latitud]);
    }
  };

  // Handle AI mode change - open modal for pre-evaluacion, allow switching between modes.
  // Free plan users are locked out of every AI search mode.
  const handleAiModeChange = (mode: AIMode) => {
    if (isFreePlan) {
      showPaidLockToast();
      return;
    }
    // Close any open modal first when switching modes
    if (showPreEvaluacionModal && mode !== 'pre-evaluacion') {
      setShowPreEvaluacionModal(false);
    }

    setAiMode(mode);
    if (mode === 'pre-evaluacion') {
      setShowPreEvaluacionModal(true);
    }
  };

  const handleAISearch = async () => {
    // La pestaña "Oportunidades" tiene su propio panel (Edge Function).
    // Ignoramos aquí para no golpear el webhook antiguo de N8N.
    if (aiMode === 'oportunidades') return;
    if (!query.trim()) {
      toast({
        title: "Mensaje vacío",
        description: "Por favor ingresa una pregunta para la IA",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingAI(true);
    setAiResponse('');

    try {
      let messageToSend = query;
      if (userLocation) {
        messageToSend = `${query}\n\n[Información del usuario: Mi ubicación actual es latitud ${userLocation.lat.toFixed(6)}, longitud ${userLocation.lng.toFixed(6)}]`;
      }

      const response = await fetch('https://gdudex2026.app.n8n.cloud/webhook/df1d3d2e-e2dd-4221-b3d8-1d50bf4fad70', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend }),
      });

      if (!response.ok) throw new Error('Error al conectar con el servicio de IA');

      const data = await response.json();
      let responseText = data.response || data.message || JSON.stringify(data);
      responseText = formatResponseWithMarkdown(responseText);
      
      setAiResponse(responseText);
      
      const detectedFilters = detectFiltersFromText(query, responseText);
      const hasFilters = detectedFilters.capas.length > 0 || 
                        detectedFilters.categorias.length > 0 || 
                        detectedFilters.comunas.length > 0 || 
                        detectedFilters.medioambienteKeys.length > 0;
      
      if (hasFilters && onFiltersApply) {
        onFiltersApply(detectedFilters);
        onSyncFilters?.(detectedFilters);
        toast({
          title: "Filtros aplicados",
          description: "Se han aplicado los filtros según tu consulta",
        });
      }
      
      extractAndZoomToCoordinates(responseText);
      searchLabelsInResponse(responseText);
      
      toast({
        title: "Respuesta recibida",
        description: "La IA ha procesado tu consulta exitosamente",
      });
    } catch (error) {
      console.error('Error al consultar la IA:', error);
      toast({
        title: "Error",
        description: "No se pudo obtener respuesta de la IA. Intenta nuevamente.",
        variant: "destructive",
      });
      setAiResponse('Error al obtener respuesta. Por favor intenta nuevamente.');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const formatResponseWithMarkdown = (text: string): string => {
    let formatted = text.replace(/\\n\\n\\n+/g, '\n\n').replace(/\\n/g, '\n');
    const sections = formatted.split('\n\n');
    let result = '';
    
    sections.forEach((section) => {
      const trimmed = section.trim();
      if (!trimmed) return;
      
      if (trimmed.match(/^[A-ZÁÉÍÓÚÑ][^.!?]*:$/)) {
        result += `\n\n### ${trimmed.replace(/:$/, '')}\n\n`;
      } else if (trimmed.match(/^[A-Z][A-Za-z\s]+[A-Z][A-Za-z\s]*$/m) && trimmed.length < 80 && !trimmed.includes('.')) {
        result += `\n\n#### ${trimmed}\n\n`;
      } else {
        let processed = trimmed.replace(
          /\b(irradiancia|ubicación óptima|factibilidad|recurso solar|infraestructura|análisis|región de Tarapacá|potencial|recomendación|conclusión)\b/gi,
          '**$1**'
        );
        result += processed + '\n\n';
      }
    });
    
    return result.trim();
  };

  const extractAndZoomToCoordinates = (text: string) => {
    if (!onCoordinatesExtracted) return;
    const coords: Array<[number, number]> = [];
    const coordPattern = /(?:lat(?:itud)?[:\s]*)?(-?\d+\.?\d*)\s*[,°]\s*(?:lng|lon(?:gitud)?[:\s]*)?(-?\d+\.?\d*)/gi;
    const coordMatches = [...text.matchAll(coordPattern)];
    
    coordMatches.forEach(match => {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        coords.push([lng, lat]);
      }
    });

    if (coords.length > 0) {
      onCoordinatesExtracted(coords);
    }
  };

  const searchLabelsInResponse = (text: string) => {
    if (!onLabelSearch || !activos.length) return;
    const foundLabels = activos.filter(activo => 
      text.toLowerCase().includes(activo.etiqueta.toLowerCase())
    );
    if (foundLabels.length > 0) {
      onLabelSearch(foundLabels[0].etiqueta);
    }
  };

  const getTypeLabel = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'capa': return 'Capa';
      case 'categoria': return 'Categoría';
      case 'comuna': return 'Comuna';
      case 'poligono': return 'Polígono';
      case 'etiqueta': return 'Punto';
      case 'proyecto': return 'Proyecto';
      case 'history': return 'Historial';
      default: return '';
    }
  };

  const getTypeColor = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'capa': return 'bg-blue-100 text-blue-700';
      case 'categoria': return 'bg-purple-100 text-purple-700';
      case 'comuna': return 'bg-amber-100 text-amber-700';
      case 'poligono': return 'bg-emerald-100 text-emerald-700';
      case 'etiqueta': return 'bg-rose-100 text-rose-700';
      case 'proyecto': return 'bg-violet-100 text-violet-700';
      case 'history': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <>
      {/* Search Bar - Top Center - positioned higher to avoid overlapping globe */}
      <div 
        className={`fixed z-[900] font-graphik transition-all duration-300 ${isMobile ? 'top-3 left-16 right-4' : 'top-4'}`} 
        style={!isMobile ? { 
          left: sidebarCollapsed ? '50%' : `calc(${sidebarWidth}px + (100% - ${sidebarWidth}px) / 2)`, 
          transform: 'translateX(-50%)' 
        } : undefined}
        ref={containerRef}
      >
        <div className={`flex flex-col ${isMobile ? 'w-full' : 'w-[520px]'}`}>
          {/* Search Input Container */}
          <div className="relative">
            <div
              className="flex flex-col rounded-2xl transition-all duration-300 ease-out"
              style={{
                background: 'hsl(var(--card))',
                border: 'none',
                boxShadow: 'none',
              }}
            >
              {/* Main input row */}
              <div className="flex items-stretch min-h-[56px]">
                {/* Mode Toggle */}
                <div className="flex items-center pl-2 pr-2 flex-shrink-0">
                  {(canUseGeneral || canUseAI) && (
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary">
                      {canUseGeneral && (
                        <button
                          onClick={() => setSearchMode('general')}
                          className={cn(
                            "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold transition-all duration-300 ease-out",
                            searchMode === 'general'
                              ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Search className="h-3.5 w-3.5" strokeWidth={2} />
                          <span>Buscar</span>
                        </button>
                      )}
                      {canUseAI && (
                        <button
                          onClick={() => setSearchMode('ai')}
                          className={cn(
                            "relative flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold transition-all duration-300 ease-out",
                            searchMode === 'ai'
                              ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <GdudexMark className="h-3.5 w-3.5" />
                          <span>IA</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Textarea container */}
                <div className={cn(
                  "flex-1 relative flex items-center min-w-0 py-2 pr-2"
                )}
                style={{ background: 'transparent' }}
                >

                  <textarea
                    ref={textareaRef}
                    placeholder={searchMode === 'general'
                      ? "Busca capas, comunas, proyectos..."
                      : ""
                    }
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (searchMode === 'general') {
                        setShowSuggestions(true);
                      }
                    }}
                    onFocus={() => {
                      if (searchMode === 'general') {
                        setShowSuggestions(true);
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    className={cn(
                      "w-full bg-transparent focus:outline-none resize-none leading-6 relative z-10 font-medium text-sm px-2 block"
                    )}
                    style={{
                      minHeight: '24px',
                      maxHeight: '96px',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                      paddingTop: '0',
                      paddingBottom: '0',
                      color: 'hsl(var(--foreground))',
                      caretColor: 'hsl(var(--primary))',
                      verticalAlign: 'middle',
                    }}
                  />
                  {/* Animated placeholder for AI mode */}
                  {searchMode === 'ai' && !query && (
                    <div className="absolute inset-0 flex items-center pointer-events-none overflow-hidden px-2 z-0">
                      <span className="text-sm leading-6 font-medium truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        Pregunta sobre{' '}
                        <span
                          className={cn(
                            "inline-block transition-all duration-300",
                            isAnimating
                              ? "opacity-0 transform -translate-y-2"
                              : "opacity-100 transform translate-y-0"
                          )}
                          style={{ color: 'hsl(var(--muted-foreground))' }}
                        >
                          {currentWord}...
                        </span>
                      </span>
                    </div>
                  )}
                  {/* General mode placeholder styling */}
                  {searchMode === 'general' && (
                    <style>{`
                      textarea::placeholder { color: hsl(var(--muted-foreground)) !important; }
                    `}</style>
                  )}
                </div>

                {/* Send button - only visible in AI mode */}
                {searchMode === 'ai' && (
                  <div className="flex items-center pr-2 flex-shrink-0">
                    <button
                      onClick={handleAISearch}
                      disabled={isLoadingAI || !query.trim()}
                      className="flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-[140ms] ease-out disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5"
                      style={{
                        background: 'hsl(var(--primary))',
                        color: 'white',
                      }}
                      title="Enviar pregunta"
                    >
                      {isLoadingAI ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <ArrowUp className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* AI Mode Chips - only visible in AI mode */}
              {searchMode === 'ai' && (
                <div className="px-3 pb-3 pt-1 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleAiModeChange('pre-evaluacion')}
                      className={cn(
                        "group relative flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-[14px] text-[11px] font-semibold transition-all duration-[140ms] ease-out border text-center font-display",
                        aiMode === 'pre-evaluacion'
                          ? "text-white border-transparent"
                          : "text-foreground hover:-translate-y-0.5 hover:scale-[1.02]"
                      )}
                      style={aiMode === 'pre-evaluacion'
                        ? { background: 'hsl(var(--primary))' }
                        : { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }
                      }
                      title="Plan Regulador Intercomunal Costero"
                    >
                      <FileSearch className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">Evaluación PRIC</span>
                      {isFreePlan && <Lock className="h-3 w-3 flex-shrink-0 opacity-70" />}
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-black text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-[1000] shadow-md">
                        Evaluación Rápida PRIC - Plan Regulador Intercomunal Costero
                      </span>
                    </button>
                    <button
                      onClick={() => handleAiModeChange('oportunidades')}
                      className={cn(
                        "group relative flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-[14px] text-[11px] font-semibold transition-all duration-[140ms] ease-out border text-center font-display",
                        aiMode === 'oportunidades'
                          ? "text-white border-transparent"
                          : "text-foreground hover:-translate-y-0.5 hover:scale-[1.02]"
                      )}
                      style={aiMode === 'oportunidades'
                        ? { background: 'hsl(var(--primary))' }
                        : { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }
                      }
                    >
                      <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#FFB300' }} />
                      <span className="truncate">Oportunidades</span>
                      {isFreePlan && <Lock className="h-3 w-3 flex-shrink-0 opacity-70" />}
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-black text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-[1000] shadow-md">
                        Oportunidades de Inversión
                      </span>
                    </button>
                    <button
                      onClick={() => handleAiModeChange('requisitos')}
                      className={cn(
                        "group relative flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-[14px] text-[11px] font-semibold transition-all duration-[140ms] ease-out border text-center font-display",
                        aiMode === 'requisitos'
                          ? "text-white border-transparent"
                          : "text-foreground hover:-translate-y-0.5 hover:scale-[1.02]"
                      )}
                      style={aiMode === 'requisitos'
                        ? { background: 'hsl(var(--primary))' }
                        : { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }
                      }
                      title="Pasos según Tipo de Proyecto"
                    >
                      <ClipboardList className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#2979FF' }} />
                      <span className="truncate">Pasos a seguir</span>
                      {isFreePlan && <Lock className="h-3 w-3 flex-shrink-0 opacity-70" />}
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-black text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-[1000] shadow-md">
                        Qué pasos a seguir de acuerdo al Tipo de Proyecto
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Panel de Oportunidades — se renderiza como drawer lateral fuera del contenedor (ver más abajo) */}




            {/* Suggestions Dropdown */}
            {searchMode === 'general' && showSuggestions && filteredSuggestions.length > 0 && (
              <div 
                className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200 max-h-[400px]"
                style={{ 
                  overflowY: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  boxShadow: '0 8px 28px -8px rgba(0,0,0,0.12)',
                }}
                ref={suggestionsRef}
              >
                <style>{`
                  div::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>
                {!query.trim() && history.length > 0 && (
                  <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Búsquedas recientes</span>
                  </div>
                )}
                <div className="py-1.5">
                  {filteredSuggestions.map((suggestion, index) => {
                    const Icon = suggestion.icon;
                    return (
                      <button
                        key={suggestion.id}
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-[120ms]",
                          index === selectedSuggestionIndex 
                            ? "bg-secondary" 
                            : "hover:bg-secondary"
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-center h-8 w-8 rounded-lg",
                          getTypeColor(suggestion.type).split(' ')[0]
                        )}>
                          <Icon className={cn("h-4 w-4", getTypeColor(suggestion.type).split(' ')[1])} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground truncate">
                              {suggestion.label}
                            </span>
                            {suggestion.type !== 'history' && (
                              <span className={cn(
                                "flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded",
                                getTypeColor(suggestion.type)
                              )}>
                                {getTypeLabel(suggestion.type)}
                              </span>
                            )}
                          </div>
                          {suggestion.parentLabel && suggestion.type !== 'history' && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-muted-foreground truncate">
                                {suggestion.parentLabel}
                              </span>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state for general search */}
            {searchMode === 'general' && showSuggestions && query.trim() && filteredSuggestions.length === 0 && (
              <div 
                className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200"
                style={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', boxShadow: '0 8px 28px -8px rgba(0,0,0,0.12)' }}
              >
                <div className="px-4 py-6 text-center">
                  <Search className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No se encontraron resultados</p>
                  <p className="text-xs text-muted-foreground mt-1">Intenta con otro término de búsqueda</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Response - Right Side Panel */}
      {aiResponse && (
        <div className={`fixed z-[900] font-graphik animate-in slide-in-from-right-4 duration-300 transition-all ${
          isResponseExpanded
            ? 'top-4 left-4 right-4 bottom-4'
            : isMobile 
              ? 'top-16 left-4 right-4 bottom-20' 
              : 'top-6 right-6 bottom-6 w-[420px]'
        }`}>
          <div className="h-full rounded-xl border border-primary/20 flex flex-col overflow-hidden" style={{ background: 'hsl(var(--card))', boxShadow: 'var(--shadow-3)' }}>
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/40" style={{ background: 'hsl(var(--muted))' }}>
              <div className="rounded-full p-2 flex-shrink-0" style={{ background: 'hsl(var(--primary) / 0.12)' }}>
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-sm text-foreground flex-1">Geodude X responde</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsResponseExpanded(prev => !prev)}
                className="h-8 w-8 rounded-lg hover:bg-primary/10"
                title={isResponseExpanded ? 'Reducir' : 'Ampliar'}
              >
                {isResponseExpanded 
                  ? <Minimize2 className="h-4 w-4 text-primary" />
                  : <Maximize2 className="h-4 w-4 text-primary" />
                }
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setAiResponse('');
                  setIsResponseExpanded(false);
                  onResponseClose?.();
                }}
                className="h-8 w-8 rounded-lg hover:bg-gray-100"
              >
                <X className="h-4 w-4 text-gray-500" />
              </Button>
            </div>
            
            <div 
              className="flex-1 overflow-y-auto px-5 py-4"
              style={{ 
                scrollbarWidth: 'thin',
              }}
            >
              <div className={`prose max-w-none ${isResponseExpanded ? 'prose-base' : 'prose-sm'}`}>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({children}) => <h1 className="text-xl font-bold text-foreground mt-5 mb-3 pb-2 border-b border-border">{children}</h1>,
                    h2: ({children}) => <h2 className="text-lg font-bold text-foreground mt-5 mb-2">{children}</h2>,
                    h3: ({children}) => <h3 className="text-base font-semibold text-foreground mt-4 mb-2">{children}</h3>,
                    h4: ({children}) => <h4 className="text-sm font-semibold text-foreground mt-3 mb-1.5">{children}</h4>,
                    p: ({children}) => <p className={`leading-relaxed mb-3 text-foreground ${isResponseExpanded ? 'text-[15px]' : 'text-sm'}`}>{children}</p>,
                    ul: ({children}) => <ul className="list-disc pl-5 space-y-1.5 mb-3">{children}</ul>,
                    ol: ({children}) => <ol className="list-decimal pl-5 space-y-1.5 mb-3">{children}</ol>,
                    li: ({children}) => <li className={`text-foreground ${isResponseExpanded ? 'text-[15px]' : 'text-sm'}`}>{children}</li>,
                    strong: ({children}) => <strong className="font-semibold text-primary">{children}</strong>,
                    em: ({children}) => <em className="text-muted-foreground italic">{children}</em>,
                    blockquote: ({children}) => <blockquote className="border-l-3 border-primary/40 pl-4 py-1 my-3 bg-primary/5 rounded-r-lg text-muted-foreground italic">{children}</blockquote>,
                    code: ({children}) => <code className="bg-muted text-primary px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                    a: ({href, children}) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/30 hover:decoration-primary/60 transition-colors">
                        {children}
                      </a>
                    ),
                    table: ({children}) => <div className="overflow-x-auto my-3 rounded-lg border border-border"><table className="w-full text-sm">{children}</table></div>,
                    thead: ({children}) => <thead className="bg-muted/50">{children}</thead>,
                    th: ({children}) => <th className="px-3 py-2 text-left text-xs font-semibold text-foreground uppercase tracking-wider border-b border-border">{children}</th>,
                    td: ({children}) => <td className="px-3 py-2 text-sm text-foreground border-b border-border/30">{children}</td>,
                    hr: () => <hr className="my-4 border-border" />,
                  }}
                >
                  {aiResponse}
                </ReactMarkdown>
              </div>
            </div>
            
            <div className="px-4 py-2.5 border-t border-border/30 bg-muted/20">
              <p className="text-[10px] text-muted-foreground text-center">
                Respuesta generada por IA • Los datos pueden requerir verificación
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Global style to hide scrollbars */}
      <style>{`
        textarea::-webkit-scrollbar,
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Evaluación PRIC Modal */}
      <EvaluacionPRICModal
        open={showPreEvaluacionModal}
        onOpenChange={setShowPreEvaluacionModal}
        onSubmit={handleEvaluacionPRICSubmit}
        isLoading={isPreEvaluacionLoading}
      />

      {/* Oportunidades side drawer — mismo layout que Evaluación PRIC */}
      <OportunidadesPanel
        open={oportunidadesOpen}
        onClose={() => setAiMode('pre-evaluacion')}
        currentPoint={oportPoint}
        onRequestPickPoint={() => setOportPicking((v) => !v)}
        isPickingPoint={oportPicking}
        pickMode={oportPicking}
      />
    </>
  );
}

