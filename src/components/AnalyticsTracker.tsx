import { useEffect, useRef, useCallback } from 'react';
import { trackPageView, trackZoneInteraction } from '@/hooks/useAnalytics';
import { useLocation } from 'react-router-dom';

interface AnalyticsTrackerProps {
  children: React.ReactNode;
}

export const AnalyticsTracker = ({ children }: AnalyticsTrackerProps) => {
  const location = useLocation();
  const zoneTimers = useRef<{ [key: string]: number }>({});
  
  // Track page views
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);
  
  // Set up zone tracking
  useEffect(() => {
    const getTarget = (e: MouseEvent): HTMLElement | null => {
      const t = e.target;
      if (t instanceof HTMLElement) return t;
      if (t instanceof SVGElement) return (t.closest?.('svg') ?? (t as any).parentElement) as HTMLElement | null;
      return null;
    };

    const handleClick = (e: MouseEvent) => {
      const target = getTarget(e);
      if (!target) return;
      const zone = getZoneFromElement(target);
      if (zone) {
        trackZoneInteraction(zone, 'click');
      }
    };
    
    const handleMouseEnter = (e: MouseEvent) => {
      const target = getTarget(e);
      if (!target) return;
      const zone = getZoneFromElement(target);
      if (zone && !zoneTimers.current[zone]) {
        zoneTimers.current[zone] = Date.now();
        trackZoneInteraction(zone, 'view');
      }
    };
    
    const handleMouseLeave = (e: MouseEvent) => {
      const target = getTarget(e);
      if (!target) return;
      const zone = getZoneFromElement(target);
      if (zone && zoneTimers.current[zone]) {
        const duration = Date.now() - zoneTimers.current[zone];
        trackZoneInteraction(zone, 'hover', duration);
        delete zoneTimers.current[zone];
      }
    };
    
    document.addEventListener('click', handleClick);
    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('mouseenter', handleMouseEnter, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);
    };
  }, []);
  
  return <>{children}</>;
};

// Helper to determine zone from element
const getZoneFromElement = (element: HTMLElement): string | null => {
  if (typeof element.closest !== 'function') return null;
  // Check for data-analytics-zone attribute
  const zoneAttr = element.closest('[data-analytics-zone]');
  if (zoneAttr) {
    return zoneAttr.getAttribute('data-analytics-zone');
  }
  
  // Fallback: detect by class/id patterns
  const el = element.closest('[class], [id]');
  if (!el) return null;
  
  const classes = el.className?.toString().toLowerCase() || '';
  const id = el.id?.toLowerCase() || '';
  
  if (classes.includes('sidebar') || id.includes('sidebar') || classes.includes('filter')) {
    return 'filters';
  }
  if (classes.includes('search') || classes.includes('query') || id.includes('search')) {
    return 'ai-search';
  }
  if (classes.includes('marker') || classes.includes('mapboxgl-marker')) {
    return 'markers';
  }
  if (classes.includes('map') || id.includes('map') || classes.includes('mapboxgl')) {
    return 'map';
  }
  if (classes.includes('info') || classes.includes('header')) {
    return 'header';
  }
  if (classes.includes('response') || classes.includes('ai-response')) {
    return 'ai-response';
  }
  
  return null;
};

export default AnalyticsTracker;
