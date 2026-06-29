import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MapPin, FileUp, Sparkles, Navigation, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeocoderFeature {
  id: string;
  place_name: string;
  center: [number, number];
}

interface PreEvaluacionData {
  nombre: string;
  direccion: string;
  coordenadas: { lat: number; lng: number } | null;
  kmzFile: File | null;
  tipoProyecto: string;
  descripcion: string;
}

interface PreEvaluacionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PreEvaluacionData) => void;
  isLoading?: boolean;
}

const TIPOS_PROYECTO = [
  'Energía Solar',
  'Energía Eólica',
  'Minería',
  'Infraestructura',
  'Turismo',
  'Agricultura',
  'Industrial',
  'Inmobiliario',
  'Comercial',
  'Portuario',
  'Transporte',
  'Otro',
];

const MAPBOX_TOKEN = 'pk.eyJ1Ijoiam9yZ2VsZW1vcyIsImEiOiJjbTQ0OGh5YnowY2dpMmpxeHNzYWdyOHY0In0.0gSA5HpMjbaUdkHi9FKlUQ';

export default function PreEvaluacionModal({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isLoading = false 
}: PreEvaluacionModalProps) {
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const [coordenadasManual, setCoordenadasManual] = useState('');
  const [kmzFile, setKmzFile] = useState<File | null>(null);
  const [tipoProyecto, setTipoProyecto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  
  // Geocoding state
  const [suggestions, setSuggestions] = useState<GeocoderFeature[]>([]);
  const [isLoadingGeo, setIsLoadingGeo] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [useManualCoords, setUseManualCoords] = useState(false);

  // Debounced geocoding
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoadingGeo(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `country=CL&` +
        `language=es&` +
        `limit=5&` +
        `access_token=${MAPBOX_TOKEN}`
      );
      const data = await response.json();
      setSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching geocoding suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoadingGeo(false);
    }
  }, []);

  // Debounce effect for address input
  useEffect(() => {
    if (useManualCoords) return;
    
    const timer = setTimeout(() => {
      fetchSuggestions(direccion);
    }, 300);

    return () => clearTimeout(timer);
  }, [direccion, fetchSuggestions, useManualCoords]);

  // Parse manual coordinates
  useEffect(() => {
    if (!useManualCoords || !coordenadasManual) {
      if (useManualCoords) setCoordenadas(null);
      return;
    }

    // Try to parse "lat, lng" format
    const parts = coordenadasManual.split(',').map(p => p.trim());
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setCoordenadas({ lat, lng });
        return;
      }
    }
    setCoordenadas(null);
  }, [coordenadasManual, useManualCoords]);

  const handleSelectSuggestion = (suggestion: GeocoderFeature) => {
    setDireccion(suggestion.place_name);
    setCoordenadas({
      lat: suggestion.center[1],
      lng: suggestion.center[0],
    });
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.kmz')) {
      setKmzFile(file);
    }
  };

  const handleSubmit = () => {
    onSubmit({
      nombre,
      direccion,
      coordenadas,
      kmzFile,
      tipoProyecto,
      descripcion,
    });
  };

  const isValid = nombre.trim() && tipoProyecto && descripcion.trim();

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setNombre('');
      setDireccion('');
      setCoordenadas(null);
      setCoordenadasManual('');
      setKmzFile(null);
      setTipoProyecto('');
      setDescripcion('');
      setSuggestions([]);
      setShowSuggestions(false);
      setUseManualCoords(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-white border-0 shadow-2xl font-graphik">
        <DialogHeader className="pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-2">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Datos de tu Proyecto
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mt-0.5">
                Completa la información para generar tu pre-evaluación territorial
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4 max-h-[60vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
          {/* Nombre del proyecto */}
          <div className="space-y-2">
            <Label htmlFor="nombre" className="text-sm font-medium text-gray-700">
              Nombre del proyecto <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Parque Solar Atacama Norte"
              className="h-11 border-gray-200 focus:border-violet-400 focus:ring-violet-400"
            />
          </div>

          {/* Dirección con geocoding */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="direccion" className="text-sm font-medium text-gray-700">
                Dirección
              </Label>
              <button
                type="button"
                onClick={() => setUseManualCoords(!useManualCoords)}
                className="text-xs text-violet-600 hover:text-violet-700 font-medium"
              >
                {useManualCoords ? 'Usar dirección' : 'Ingresar coordenadas'}
              </button>
            </div>
            
            {!useManualCoords ? (
              <div className="relative">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="direccion"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Buscar ubicación en Chile..."
                    className="h-11 pl-10 pr-10 border-gray-200 focus:border-violet-400 focus:ring-violet-400"
                  />
                  {isLoadingGeo && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                  )}
                </div>
                
                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className="w-full text-left px-4 py-3 hover:bg-violet-50 transition-colors flex items-center gap-3 border-b border-gray-100 last:border-0"
                      >
                        <Navigation className="h-4 w-4 text-violet-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate">{suggestion.place_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Input
                value={coordenadasManual}
                onChange={(e) => setCoordenadasManual(e.target.value)}
                placeholder="Ej: -20.2133, -70.1503"
                className="h-11 border-gray-200 focus:border-violet-400 focus:ring-violet-400"
              />
            )}
          </div>

          {/* Coordenadas (auto-filled or manual) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Coordenadas
            </Label>
            <div className={cn(
              "h-11 px-4 rounded-lg border flex items-center gap-2 text-sm",
              coordenadas 
                ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                : "bg-gray-50 border-gray-200 text-gray-400"
            )}>
              {coordenadas ? (
                <>
                  <Check className="h-4 w-4" />
                  <span className="font-mono">
                    {coordenadas.lat.toFixed(6)}, {coordenadas.lng.toFixed(6)}
                  </span>
                </>
              ) : (
                <span>Se completará automáticamente con la dirección</span>
              )}
            </div>
          </div>

          {/* KMZ Upload (optional) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Archivo KMZ <span className="text-gray-400 font-normal">(opcional)</span>
            </Label>
            <div className="relative">
              <input
                type="file"
                accept=".kmz"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className={cn(
                "h-11 px-4 rounded-lg border-2 border-dashed flex items-center gap-3 transition-colors",
                kmzFile 
                  ? "bg-violet-50 border-violet-300" 
                  : "bg-gray-50 border-gray-200 hover:border-violet-300 hover:bg-violet-50/50"
              )}>
                <FileUp className={cn("h-4 w-4", kmzFile ? "text-violet-600" : "text-gray-400")} />
                <span className={cn("text-sm truncate", kmzFile ? "text-violet-700" : "text-gray-500")}>
                  {kmzFile ? kmzFile.name : 'Subir archivo KMZ del proyecto'}
                </span>
                {kmzFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setKmzFile(null);
                    }}
                    className="ml-auto p-1 hover:bg-violet-100 rounded"
                  >
                    <X className="h-3.5 w-3.5 text-violet-600" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tipo de proyecto */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Tipo de proyecto <span className="text-red-500">*</span>
            </Label>
            <Select value={tipoProyecto} onValueChange={setTipoProyecto}>
              <SelectTrigger className="h-11 border-gray-200 focus:border-violet-400 focus:ring-violet-400">
                <SelectValue placeholder="Selecciona el tipo de proyecto" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_PROYECTO.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="descripcion" className="text-sm font-medium text-gray-700">
              Descripción del proyecto <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe brevemente tu proyecto, incluyendo objetivos, alcance y características principales..."
              className="min-h-[100px] border-gray-200 focus:border-violet-400 focus:ring-violet-400 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="pt-4 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-200"
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="bg-primary hover:bg-primary/90 text-white shadow-2/50 min-w-[140px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analizando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generar Evaluación
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
