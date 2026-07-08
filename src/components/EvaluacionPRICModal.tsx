import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FileSearch, X, ChevronDown, CheckCircle2, AlertTriangle, XCircle, Info, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { useToast } from '@/hooks/use-toast';

interface TipoProyectoPRIC {
  tipo: string;
  categoria: string;
  descripcion: string | null;
  requiere_superficie_util?: boolean | null;
}

type DictamenTipo =
  | 'viable'
  | 'viable_condicionado'
  | 'no_viable'
  | 'requiere_revision_manual'
  | 'sin_zona_identificada_en_este_instrumento'
  | string;

interface DictamenInstrumento {
  instrumento: string;
  dictamen: DictamenTipo;
  motivos?: string[];
  zona_uso_suelo?: string | null;
  riesgos_detectados?: Array<{ capa: string }>;
  patrimonio_detectado?: Array<{ capa: string }>;
}

interface EvaluacionResultado {
  resuelto?: boolean;
  motivo?: string;
  cobertura?: string;
  comuna?: string;
  region?: string;
  dictamenes_por_instrumento?: DictamenInstrumento[];
  estacionamientos?: { cupos_requeridos?: number; nota?: string } | null;
  restricciones_ambientales_universales?: Array<{ capa: string }>;
}

export interface EvaluacionPRICData {
  nombreProyecto: string;
  tipoProyecto: string;
  categoria: string;
  latitud: number;
  longitud: number;
  superficiePredio: number;
  superficieTotalConstruir: number;
  superficieOcupacionSuelo: number;
  alturaMaxima: number;
  superficieUtilConstruida: number;
  descripcion: string;
}

interface EvaluacionPRICModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EvaluacionPRICData) => void;
  isLoading?: boolean;
}

// Descriptions for each "tipo" (project type)
const tipoDescriptions: Record<string, string> = {
  'Proyectos Residenciales': 'Edificaciones destinadas principalmente a la habitabilidad y el descanso, incluyendo vivienda permanente, vivienda social (hasta 1.000 UF) y hospedaje temporal.',
  'Equipamiento': 'Edificaciones destinadas a prestar servicios a la comunidad: científico/cultura, comercio, salud, educación, seguridad, deporte, servicios y esparcimiento.',
  'Actividades Productivas': 'Proyectos clasificados según nivel de externalidades: inofensivas, molestas, contaminantes/peligrosas y logística/bodegaje.',
  'Infraestructura': 'Instalaciones de gran envergadura: sanitaria (plantas de agua), energética (centrales), y transporte (terminales, puertos, aeropuertos).',
  'Espacio Público': 'Áreas verdes intercomunales, espacio público (vial) y equipamiento turístico-recreacional en planicies costeras.',
};

// Descriptions for each "categoria"
const categoriaDescriptions: Record<string, string> = {
  'Vivienda': 'Construcciones destinadas a la residencia permanente de personas.',
  'Vivienda Social': 'Conjuntos habitacionales con un valor de hasta 1.000 UF; el Plan otorga facilidades especiales para su ubicación incluso en ciertas áreas rurales (ARU).',
  'Hospedaje': 'Proyectos destinados a alojamiento temporal: hoteles, apart-hoteles y moteles.',
  'Científico y Cultura': 'Centros de investigación, museos y centros de difusión (permitidos incluso en áreas protegidas APVN con restricciones de altura).',
  'Comercio': 'Supermercados, locales comerciales, estaciones de servicio y restaurantes.',
  'Salud': 'Hospitales, clínicas y consultorios.',
  'Educación': 'Colegios e instituciones de educación técnica o superior.',
  'Salud y Educación': 'Hospitales, clínicas, consultorios, colegios e instituciones de educación técnica o superior.',
  'Seguridad': 'Cuarteles de bomberos y unidades policiales.',
  'Deporte': 'Gimnasios y centros deportivos.',
  'Seguridad y Deporte': 'Cuarteles de bomberos, unidades policiales, gimnasios y centros deportivos.',
  'Servicios': 'Oficinas y bancos.',
  'Social y Esparcimiento': 'Parques de entretenciones y casinos.',
  'Inofensivas': 'Actividades que no causan daños ni molestias al vecindario.',
  'Molestas': 'Actividades que pueden causar ruidos, vibraciones u olores; deben ubicarse preferentemente en la Zona Productiva Molesta (ZPM).',
  'Contaminantes y Peligrosas': 'Proyectos de alto impacto con emisiones nocivas o riesgos críticos, restringidos a la Zona Productiva Contaminante (ZPC).',
  'Logística y Bodegaje': 'Instalaciones destinadas al acopio y distribución de mercancías.',
  'Sanitaria': 'Plantas de captación y tratamiento de agua potable o servidas, y rellenos sanitarios (zonas ZI-S).',
  'Energética': 'Centrales de generación o distribución de energía y redes de telecomunicaciones (zonas ZI-E).',
  'Transporte': 'Terminales de carga terrestre, recintos marítimos/portuarios (ZI-TP) e instalaciones aeroportuarias (ZI-TA).',
  'Áreas Verdes Intercomunales': 'Parques y plazas que sirven como amortiguadores ambientales entre zonas industriales y residenciales.',
  'Espacio Público': 'Sistema vial y espacios de uso público general.',
  'Turístico Recreacional': 'Balnearios, campamentos turísticos y equipamiento de esparcimiento ligero en planicies costeras.',
};

// Custom dropdown with hover tooltips
function TooltipSelect({
  value,
  onChange,
  items,
  descriptions,
  placeholder,
  disabled,
  hasError,
}: {
  value: string;
  onChange: (v: string) => void;
  items: string[];
  descriptions: Record<string, string>;
  placeholder: string;
  disabled?: boolean;
  hasError?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "flex h-8 w-full items-center justify-between rounded-md border px-3 py-2 text-xs font-medium transition-all duration-[140ms]",
          "bg-card border-border text-foreground",
          "focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none",
          !value && "text-muted-foreground",
          hasError && "border-destructive",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 opacity-50 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && items.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-full z-[9999] bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-52 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {items.map((item) => (
              <div
                key={item}
                className="relative"
                onMouseEnter={() => setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <button
                  type="button"
                  onClick={() => { onChange(item); setIsOpen(false); setHoveredItem(null); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors",
                    value === item && "bg-primary/10 text-primary"
                  )}
                >
                  {item}
                </button>

                {/* Tooltip on hover */}
                {hoveredItem === item && descriptions[item] && (
                  <div
                    className="absolute left-full top-0 ml-2 w-64 p-3 bg-card border border-primary/30 rounded-lg shadow-2 z-[10000] pointer-events-none animate-in fade-in-0 zoom-in-95 duration-150"
                  >
                    <p className="text-[10px] font-semibold text-primary mb-1">{item}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{descriptions[item]}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EvaluacionPRICModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false
}: EvaluacionPRICModalProps) {
  const { toast } = useToast();
  
  const [nombreProyecto, setNombreProyecto] = useState('');
  const [tipoProyecto, setTipoProyecto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [destinoEspecifico, setDestinoEspecifico] = useState('');
  const [destinosDisponibles, setDestinosDisponibles] = useState<string[]>([]);
  const [isLoadingDestinos, setIsLoadingDestinos] = useState(false);
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  const [superficiePredio, setSuperficiePredio] = useState('');
  const [superficieTotalConstruir, setSuperficieTotalConstruir] = useState('');
  const [superficieOcupacionSuelo, setSuperficieOcupacionSuelo] = useState('');
  const [alturaMaxima, setAlturaMaxima] = useState('');
  const [superficieUtilConstruida, setSuperficieUtilConstruida] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const [tiposProyecto, setTiposProyecto] = useState<TipoProyectoPRIC[]>([]);
  const [isLoadingTipos, setIsLoadingTipos] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [isEvaluando, setIsEvaluando] = useState(false);
  const [resultado, setResultado] = useState<EvaluacionResultado | null>(null);
  const [resultadoError, setResultadoError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTipos = async () => {
      if (!externalSupabase || !open) return;
      setIsLoadingTipos(true);
      try {
        const { data, error } = await (externalSupabase
          .from('tipo_proyecto_pric') as unknown as {
            select: (cols: string) => Promise<{ data: TipoProyectoPRIC[] | null; error: unknown }>
          })
          .select('tipo, categoria, descripcion, requiere_superficie_util');
        if (error) {
          console.error('Error fetching tipos proyecto:', error);
          toast({ title: "Error", description: "No se pudieron cargar los tipos de proyecto", variant: "destructive" });
          return;
        }
        setTiposProyecto((data as TipoProyectoPRIC[]) || []);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setIsLoadingTipos(false);
      }
    };
    fetchTipos();
  }, [open, toast]);

  const tiposUnicos = useMemo(() => {
    const unique = [...new Set(tiposProyecto.map(t => t.tipo))];
    return unique.sort();
  }, [tiposProyecto]);

  const categoriasDisponibles = useMemo(() => {
    if (!tipoProyecto) return [];
    return tiposProyecto
      .filter(t => t.tipo === tipoProyecto)
      .map(t => t.categoria)
      .sort();
  }, [tipoProyecto, tiposProyecto]);

  const requiereSuperficieUtil = useMemo(() => {
    if (!tipoProyecto || !categoria) return false;
    const match = tiposProyecto.find(t => t.tipo === tipoProyecto && t.categoria === categoria);
    return Boolean(match?.requiere_superficie_util);
  }, [tipoProyecto, categoria, tiposProyecto]);

  useEffect(() => { setCategoria(''); setDestinoEspecifico(''); setDestinosDisponibles([]); }, [tipoProyecto]);

  // Load destinos específicos when categoria changes
  useEffect(() => {
    setDestinoEspecifico('');
    setDestinosDisponibles([]);
    if (!externalSupabase || !categoria) return;
    let cancelled = false;
    (async () => {
      setIsLoadingDestinos(true);
      try {
        const { data, error } = await externalSupabase
          .from('estacionamientos_factor' as never)
          .select('destino_especifico')
          .eq('categoria_proyecto', categoria)
          .not('destino_especifico', 'is', null);
        if (cancelled) return;
        if (error) {
          console.error('Error fetching destinos:', error);
          return;
        }
        const unique = Array.from(new Set(((data as Array<{ destino_especifico: string | null }>) || [])
          .map(r => r.destino_especifico)
          .filter((v): v is string => Boolean(v))));
        setDestinosDisponibles(unique.sort());
      } finally {
        if (!cancelled) setIsLoadingDestinos(false);
      }
    })();
    return () => { cancelled = true; };
  }, [categoria]);


  const validateLatitud = (value: string) => { const num = parseFloat(value); return !isNaN(num) && num >= -90 && num <= 90; };
  const validateLongitud = (value: string) => { const num = parseFloat(value); return !isNaN(num) && num >= -180 && num <= 180; };
  const validatePositiveNumber = (value: string) => { const num = parseFloat(value); return !isNaN(num) && num > 0; };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!nombreProyecto.trim()) newErrors.nombreProyecto = 'Requerido';
    else if (nombreProyecto.length > 50) newErrors.nombreProyecto = 'Máximo 50 caracteres';
    if (!tipoProyecto) newErrors.tipoProyecto = 'Requerido';
    if (!categoria) newErrors.categoria = 'Requerido';
    if (!latitud.trim()) newErrors.latitud = 'Requerido';
    else if (!validateLatitud(latitud)) newErrors.latitud = 'Latitud inválida (-90 a 90)';
    if (!longitud.trim()) newErrors.longitud = 'Requerido';
    else if (!validateLongitud(longitud)) newErrors.longitud = 'Longitud inválida (-180 a 180)';
    if (!superficiePredio.trim()) newErrors.superficiePredio = 'Requerido';
    else if (!validatePositiveNumber(superficiePredio)) newErrors.superficiePredio = 'Valor inválido';
    if (!superficieTotalConstruir.trim()) newErrors.superficieTotalConstruir = 'Requerido';
    else if (!validatePositiveNumber(superficieTotalConstruir)) newErrors.superficieTotalConstruir = 'Valor inválido';
    if (!superficieOcupacionSuelo.trim()) newErrors.superficieOcupacionSuelo = 'Requerido';
    else if (!validatePositiveNumber(superficieOcupacionSuelo)) newErrors.superficieOcupacionSuelo = 'Valor inválido';
    if (!alturaMaxima.trim()) newErrors.alturaMaxima = 'Requerido';
    else if (!validatePositiveNumber(alturaMaxima)) newErrors.alturaMaxima = 'Valor inválido';
    if (!superficieUtilConstruida.trim()) newErrors.superficieUtilConstruida = 'Requerido';
    else if (!validatePositiveNumber(superficieUtilConstruida)) newErrors.superficieUtilConstruida = 'Valor inválido';
    if (descripcion.length > 500) newErrors.descripcion = 'Máximo 500 caracteres';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    onSubmit({
      nombreProyecto: nombreProyecto.trim(), tipoProyecto, categoria,
      latitud: parseFloat(latitud), longitud: parseFloat(longitud),
      superficiePredio: parseFloat(superficiePredio),
      superficieTotalConstruir: parseFloat(superficieTotalConstruir),
      superficieOcupacionSuelo: parseFloat(superficieOcupacionSuelo),
      alturaMaxima: parseFloat(alturaMaxima),
      superficieUtilConstruida: parseFloat(superficieUtilConstruida),
      descripcion: descripcion.trim()
    });
  };

  useEffect(() => {
    if (!open) {
      setNombreProyecto(''); setTipoProyecto(''); setCategoria('');
      setLatitud(''); setLongitud(''); setSuperficiePredio('');
      setSuperficieTotalConstruir(''); setSuperficieOcupacionSuelo('');
      setAlturaMaxima(''); setSuperficieUtilConstruida('');
      setDescripcion(''); setErrors({});
    }
  }, [open]);

  const isFormComplete = Boolean(
    nombreProyecto.trim() && tipoProyecto && categoria && latitud.trim() && longitud.trim() &&
    superficiePredio.trim() && superficieTotalConstruir.trim() && superficieOcupacionSuelo.trim() &&
    alturaMaxima.trim() && superficieUtilConstruida.trim()
  );

  if (!open) return null;

  const inputClass = "h-8 bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 text-xs font-medium transition-all duration-[140ms]";

  return (
    <div className="fixed inset-y-0 right-0 z-[2000] flex">
      <div className="flex-1 bg-foreground/30" onClick={() => onOpenChange(false)} />
      
      <div 
        className="w-[520px] max-w-[90vw] flex flex-col font-graphik animate-in slide-in-from-right duration-300"
        style={{
          background: 'hsl(var(--background))',
          borderLeft: '1px solid hsl(var(--border))',
          boxShadow: '0 0 48px rgba(0,0,0,0.08), -4px 0 24px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
          <div className="flex items-center gap-2.5">
            <div 
              className="h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ background: 'hsl(var(--primary))' }}
            >
              <FileSearch className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-display font-semibold text-foreground">Evaluación PRIC</h2>
              <p className="text-[10px] text-muted-foreground font-medium">Plan Regulador Intercomunal Costero</p>
            </div>
          </div>
          <Button 
            variant="ghost" size="icon" 
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all duration-[140ms]" 
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Nombre del Proyecto <span className="text-destructive">*</span>
            </Label>
            <Input
              value={nombreProyecto}
              onChange={(e) => setNombreProyecto(e.target.value.slice(0, 50))}
              placeholder="Ingrese el nombre del proyecto"
              maxLength={50}
              className={cn(inputClass, errors.nombreProyecto && "border-destructive")}
            />
            {errors.nombreProyecto && <p className="text-[10px] text-destructive">{errors.nombreProyecto}</p>}
          </div>

          {/* Tipo + Categoría with tooltip dropdowns */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Tipo de Proyecto <span className="text-destructive">*</span>
              </Label>
              <TooltipSelect
                value={tipoProyecto}
                onChange={setTipoProyecto}
                items={tiposUnicos}
                descriptions={tipoDescriptions}
                placeholder={isLoadingTipos ? "Cargando..." : "Seleccione tipo"}
                disabled={isLoadingTipos}
                hasError={!!errors.tipoProyecto}
              />
              {errors.tipoProyecto && <p className="text-[10px] text-destructive">{errors.tipoProyecto}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Categoría <span className="text-destructive">*</span>
              </Label>
              <TooltipSelect
                value={categoria}
                onChange={setCategoria}
                items={categoriasDisponibles}
                descriptions={categoriaDescriptions}
                placeholder={!tipoProyecto ? "Seleccione tipo primero" : "Seleccione categoría"}
                disabled={!tipoProyecto || categoriasDisponibles.length === 0}
                hasError={!!errors.categoria}
              />
              {errors.categoria && <p className="text-[10px] text-destructive">{errors.categoria}</p>}
            </div>
          </div>

          {/* Lat + Lng + Sup */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Latitud <span className="text-destructive">*</span></Label>
              <Input value={latitud} onChange={(e) => setLatitud(e.target.value.slice(0, 50))} placeholder="-20.215678" maxLength={50} className={cn(inputClass, errors.latitud && "border-destructive")} />
              {errors.latitud && <p className="text-[10px] text-destructive">{errors.latitud}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Longitud <span className="text-destructive">*</span></Label>
              <Input value={longitud} onChange={(e) => setLongitud(e.target.value.slice(0, 50))} placeholder="-70.123456" maxLength={50} className={cn(inputClass, errors.longitud && "border-destructive")} />
              {errors.longitud && <p className="text-[10px] text-destructive">{errors.longitud}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Sup. Predio <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input type="number" value={superficiePredio} onChange={(e) => setSuperficiePredio(e.target.value)} placeholder="m²" min="0" step="0.01" className={cn(inputClass, "pr-8", errors.superficiePredio && "border-destructive")} />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">m²</span>
              </div>
              {errors.superficiePredio && <p className="text-[10px] text-destructive">{errors.superficiePredio}</p>}
            </div>
          </div>

          {/* Edificación */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Edificación Proyectada</Label>
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">A. Sup. Total <span className="text-destructive">*</span></span>
                <div className="relative">
                  <Input type="number" value={superficieTotalConstruir} onChange={(e) => setSuperficieTotalConstruir(e.target.value)} placeholder="m²" min="0" step="0.01" className={cn(inputClass, "pr-8", errors.superficieTotalConstruir && "border-destructive")} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">m²</span>
                </div>
                {errors.superficieTotalConstruir && <p className="text-[10px] text-destructive">{errors.superficieTotalConstruir}</p>}
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">B. Ocup. Suelo <span className="text-destructive">*</span></span>
                <div className="relative">
                  <Input type="number" value={superficieOcupacionSuelo} onChange={(e) => setSuperficieOcupacionSuelo(e.target.value)} placeholder="m²" min="0" step="0.01" className={cn(inputClass, "pr-8", errors.superficieOcupacionSuelo && "border-destructive")} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">m²</span>
                </div>
                {errors.superficieOcupacionSuelo && <p className="text-[10px] text-destructive">{errors.superficieOcupacionSuelo}</p>}
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">C. Altura máx. <span className="text-destructive">*</span></span>
                <div className="relative">
                  <Input type="number" value={alturaMaxima} onChange={(e) => setAlturaMaxima(e.target.value)} placeholder="m" min="0" step="0.1" className={cn(inputClass, "pr-6", errors.alturaMaxima && "border-destructive")} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">m</span>
                </div>
                {errors.alturaMaxima && <p className="text-[10px] text-destructive">{errors.alturaMaxima}</p>}
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">D. Sup. útil <span className="text-destructive">*</span></span>
                <div className="relative">
                  <Input type="number" value={superficieUtilConstruida} onChange={(e) => setSuperficieUtilConstruida(e.target.value)} placeholder="m²" min="0" step="0.01" className={cn(inputClass, "pr-8", errors.superficieUtilConstruida && "border-destructive")} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">m²</span>
                </div>
                {errors.superficieUtilConstruida && <p className="text-[10px] text-destructive">{errors.superficieUtilConstruida}</p>}
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Descripción del Proyecto</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value.slice(0, 500))}
              placeholder="Descripción general del proyecto (opcional)"
              maxLength={500}
              rows={2}
              className={cn(
                "bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 resize-none text-xs min-h-[50px] font-medium transition-all duration-[140ms]",
                errors.descripcion && "border-destructive"
              )}
            />
            <div className="flex justify-between">
              {errors.descripcion && <p className="text-[10px] text-destructive">{errors.descripcion}</p>}
              <span className="text-[10px] text-muted-foreground ml-auto">{descripcion.length}/500</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex justify-center flex-shrink-0" style={{ borderTop: '1px solid hsl(var(--border))' }}>
          <Button
            onClick={handleSubmit}
            disabled={!isFormComplete || isLoading}
            className="px-8 py-2 h-10 min-w-[140px] rounded-[14px] font-display font-semibold text-sm text-white transition-all duration-[140ms] hover:-translate-y-0.5 disabled:opacity-40"
            style={{
              background: 'hsl(var(--primary))',
              
            }}
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Evaluando...</>
            ) : (
              'Evaluar'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
