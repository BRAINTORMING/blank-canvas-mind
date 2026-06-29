import { useState, useEffect } from 'react';
import { Layers, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';

interface Capa {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: string | null;
  color: string | null;
  icono: string | null;
  opacidad: number;
  visible_por_defecto: boolean;
}

interface LayerState {
  visible: boolean;
  opacity: number;
}

interface LayerControlProps {
  onLayersChange?: (layerIds: string[]) => void;
}

export default function LayerControl({ onLayersChange }: LayerControlProps) {
  const [capas, setCapas] = useState<Capa[]>([]);
  const [layerStates, setLayerStates] = useState<{ [key: string]: LayerState }>({});
  const [isOpen, setIsOpen] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadCapas();
  }, []);

  async function loadCapas() {
    try {
      const { data, error } = await (supabase as any)
        .from('capas')
        .select('*')
        .eq('publico', true)
        .order('orden');

      if (error) throw error;
      
      const capasData = data || [];
      setCapas(capasData);
      
      // Inicializar estados de capas
      const initialStates: { [key: string]: LayerState } = {};
      capasData.forEach(capa => {
        initialStates[capa.id] = {
          visible: capa.visible_por_defecto,
          opacity: capa.opacidad || 0.7,
        };
      });
      setLayerStates(initialStates);
    } catch (error) {
      console.error('Error loading capas:', error);
    }
  }

  const toggleLayerVisibility = (capaId: string) => {
    setLayerStates(prev => {
      const newStates = {
        ...prev,
        [capaId]: {
          ...prev[capaId],
          visible: !prev[capaId]?.visible,
        },
      };
      
      // Notify parent of visible layers
      const visibleLayers = Object.keys(newStates).filter(id => newStates[id]?.visible);
      onLayersChange?.(visibleLayers);
      
      return newStates;
    });
  };

  const updateLayerOpacity = (capaId: string, opacity: number) => {
    setLayerStates(prev => ({
      ...prev,
      [capaId]: {
        ...prev[capaId],
        opacity: opacity / 100,
      },
    }));
  };

  const visibleLayersCount = Object.values(layerStates).filter(state => state.visible).length;

  return (
    <div className="glass-panel rounded-xl overflow-hidden animate-slide-in-right">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-4 hover:bg-primary/10"
          >
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <span className="font-semibold">Capas del Mapa</span>
              {visibleLayersCount > 0 && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  {visibleLayersCount}
                </span>
              )}
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-3 max-h-[60vh] overflow-y-auto">
            {capas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay capas disponibles
              </p>
            ) : (
              capas.map((capa) => {
                const state = layerStates[capa.id] || { visible: false, opacity: 0.7 };
                
                return (
                  <Card 
                    key={capa.id} 
                    className={`transition-all ${state.visible ? 'border-primary' : 'border-transparent'}`}
                  >
                    <CardHeader className="p-3 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <Checkbox
                            id={`capa-${capa.id}`}
                            checked={state.visible}
                            onCheckedChange={() => toggleLayerVisibility(capa.id)}
                          />
                          <Label
                            htmlFor={`capa-${capa.id}`}
                            className="cursor-pointer font-semibold text-sm flex items-center gap-2"
                          >
                            {capa.color && (
                              <div 
                                className="w-3 h-3 rounded-full border border-white shadow-sm"
                                style={{ backgroundColor: capa.color }}
                              />
                            )}
                            {capa.nombre}
                          </Label>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleLayerVisibility(capa.id)}
                          className="h-8 w-8 p-0"
                        >
                          {state.visible ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    
                    {state.visible && (
                      <CardContent className="p-3 pt-0">
                        {capa.descripcion && (
                          <p className="text-xs text-muted-foreground mb-2">
                            {capa.descripcion}
                          </p>
                        )}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Opacidad</span>
                            <span className="font-semibold">{Math.round(state.opacity * 100)}%</span>
                          </div>
                          <Slider
                            value={[state.opacity * 100]}
                            onValueChange={(value) => updateLayerOpacity(capa.id, value[0])}
                            max={100}
                            step={10}
                            className="w-full"
                          />
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}