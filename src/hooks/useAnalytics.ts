import { useState, useEffect, useCallback } from 'react';

interface VisitorData {
  id: string;
  timestamp: number;
  sessionStart: number;
  device: 'desktop' | 'mobile' | 'tablet';
  isReturning: boolean;
  pagesViewed: string[];
  interactions: InteractionData[];
}

interface InteractionData {
  zone: string;
  type: 'click' | 'hover' | 'scroll' | 'view';
  timestamp: number;
  duration?: number;
}

interface ZoneEngagement {
  zone: string;
  clicks: number;
  timeSpent: number;
  views: number;
}

interface AnalyticsData {
  visitors: VisitorData[];
  zones: ZoneEngagement[];
}

const STORAGE_KEY = 'territoria_analytics';
const VISITOR_ID_KEY = 'territoria_visitor_id';
const SESSION_KEY = 'territoria_session';

// Generate unique visitor ID
const generateVisitorId = (): string => {
  return 'v_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

// Get or create visitor ID
const getVisitorId = (): string => {
  let visitorId = localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = generateVisitorId();
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }
  return visitorId;
};

// Detect device type
const detectDevice = (): 'desktop' | 'mobile' | 'tablet' => {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

// Get stored analytics data
const getStoredAnalytics = (): AnalyticsData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading analytics:', e);
  }
  return { visitors: [], zones: [] };
};

// Save analytics data
const saveAnalytics = (data: AnalyticsData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving analytics:', e);
  }
};

// Track page view
export const trackPageView = (page: string) => {
  const visitorId = getVisitorId();
  const analytics = getStoredAnalytics();
  const now = Date.now();
  
  // Check if this is a returning visitor
  const existingVisitor = analytics.visitors.find(v => v.id === visitorId);
  const isReturning = !!existingVisitor;
  
  // Get or create session
  let sessionData = sessionStorage.getItem(SESSION_KEY);
  let sessionStart = now;
  
  if (sessionData) {
    const parsed = JSON.parse(sessionData);
    sessionStart = parsed.start;
  } else {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ start: now }));
  }
  
  // Create or update visitor record
  if (existingVisitor) {
    if (!existingVisitor.pagesViewed.includes(page)) {
      existingVisitor.pagesViewed.push(page);
    }
    existingVisitor.timestamp = now;
  } else {
    analytics.visitors.push({
      id: visitorId,
      timestamp: now,
      sessionStart,
      device: detectDevice(),
      isReturning,
      pagesViewed: [page],
      interactions: []
    });
  }
  
  saveAnalytics(analytics);
};

// Track zone interaction
export const trackZoneInteraction = (zone: string, type: 'click' | 'hover' | 'scroll' | 'view', duration?: number) => {
  const visitorId = getVisitorId();
  const analytics = getStoredAnalytics();
  const now = Date.now();
  
  // Find visitor
  const visitor = analytics.visitors.find(v => v.id === visitorId);
  if (visitor) {
    visitor.interactions.push({
      zone,
      type,
      timestamp: now,
      duration
    });
  }
  
  // Update zone engagement
  let zoneData = analytics.zones.find(z => z.zone === zone);
  if (!zoneData) {
    zoneData = { zone, clicks: 0, timeSpent: 0, views: 0 };
    analytics.zones.push(zoneData);
  }
  
  if (type === 'click') zoneData.clicks++;
  if (type === 'view') zoneData.views++;
  if (duration) zoneData.timeSpent += duration;
  
  saveAnalytics(analytics);
};

// Hook for analytics dashboard
export const useAnalytics = () => {
  const [data, setData] = useState<AnalyticsData>({ visitors: [], zones: [] });
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(() => {
    const analytics = getStoredAnalytics();
    setData(analytics);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [refreshData]);

  // Calculate unique visitors
  const uniqueVisitors = data.visitors.length;
  
  // Calculate returning visitors
  const returningVisitors = data.visitors.filter(v => v.isReturning).length;
  
  // Calculate average session time
  const avgSessionTime = data.visitors.length > 0
    ? data.visitors.reduce((acc, v) => acc + (v.timestamp - v.sessionStart), 0) / data.visitors.length / 1000
    : 0;
  
  // Calculate bounce rate (visitors with only 1 page view and < 10 seconds)
  const bouncedVisitors = data.visitors.filter(v => 
    v.pagesViewed.length === 1 && (v.timestamp - v.sessionStart) < 10000
  ).length;
  const bounceRate = uniqueVisitors > 0 ? (bouncedVisitors / uniqueVisitors) * 100 : 0;
  
  // Device distribution
  const deviceDistribution = {
    desktop: data.visitors.filter(v => v.device === 'desktop').length,
    mobile: data.visitors.filter(v => v.device === 'mobile').length,
    tablet: data.visitors.filter(v => v.device === 'tablet').length
  };
  
  // Visitors by time period
  const getVisitorsByPeriod = (period: 'hour' | 'day' | 'week' | 'month') => {
    const now = Date.now();
    const periods: { [key: string]: number } = {};
    
    data.visitors.forEach(v => {
      const date = new Date(v.timestamp);
      let key: string;
      
      switch (period) {
        case 'hour':
          key = `${date.getHours()}:00`;
          break;
        case 'day':
          key = date.toLocaleDateString('es-CL', { weekday: 'short' });
          break;
        case 'week':
          const weekNum = Math.ceil(date.getDate() / 7);
          key = `Semana ${weekNum}`;
          break;
        case 'month':
          key = date.toLocaleDateString('es-CL', { month: 'short' });
          break;
      }
      
      periods[key] = (periods[key] || 0) + 1;
    });
    
    return Object.entries(periods).map(([name, value]) => ({ name, value }));
  };
  
  // Zone engagement data
  const zoneEngagement = data.zones.map(z => ({
    ...z,
    engagement: z.clicks + z.views,
    avgTime: z.views > 0 ? Math.round(z.timeSpent / z.views / 1000) : 0
  }));
  
  // Lean Startup Metrics
  const totalInteractions = data.visitors.reduce((acc, v) => acc + v.interactions.length, 0);
  const aiUsage = data.visitors.reduce((acc, v) => 
    acc + v.interactions.filter(i => i.zone === 'ai-search').length, 0
  );
  const filterUsage = data.visitors.reduce((acc, v) => 
    acc + v.interactions.filter(i => i.zone === 'filters').length, 0
  );
  const markerClicks = data.visitors.reduce((acc, v) => 
    acc + v.interactions.filter(i => i.zone === 'markers').length, 0
  );
  
  // Activation rate: visitors who used at least one feature
  const activatedVisitors = data.visitors.filter(v => v.interactions.length > 0).length;
  const activationRate = uniqueVisitors > 0 ? (activatedVisitors / uniqueVisitors) * 100 : 0;
  
  // Retention: returning visitors / total visitors
  const retentionRate = uniqueVisitors > 0 ? (returningVisitors / uniqueVisitors) * 100 : 0;
  
  // Engagement score: average interactions per visitor
  const engagementScore = uniqueVisitors > 0 ? totalInteractions / uniqueVisitors : 0;
  
  // Exploration depth: average zones explored per visitor
  const explorationDepth = uniqueVisitors > 0 
    ? data.visitors.reduce((acc, v) => acc + new Set(v.interactions.map(i => i.zone)).size, 0) / uniqueVisitors
    : 0;
  
  // Estimated NPS based on engagement
  const estimatedNPS = Math.min(100, Math.round(engagementScore * 10 + activationRate * 0.5));

  return {
    loading,
    refreshData,
    uniqueVisitors,
    returningVisitors,
    avgSessionTime,
    bounceRate,
    deviceDistribution,
    getVisitorsByPeriod,
    zoneEngagement,
    leanMetrics: {
      activationRate,
      retentionRate,
      engagementScore,
      aiUsage,
      filterUsage,
      markerClicks,
      explorationDepth,
      estimatedNPS
    },
    rawData: data
  };
};

// Export analytics data
export const exportAnalyticsData = () => {
  const analytics = getStoredAnalytics();
  const dataStr = JSON.stringify(analytics, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `territoria-analytics-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};
