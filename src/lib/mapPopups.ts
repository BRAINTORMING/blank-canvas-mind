// Utilities for compact map hover popups + detail panel events.

export type DetailType = 'activo' | 'proyecto' | 'poligono' | 'planRegulador' | 'comuna' | 'pric';

export interface DetailPayload {
  type: DetailType;
  data: any;
  color?: string;
}

// Escape HTML-unsafe characters for safe template literal injection.
const esc = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

interface SummaryOpts {
  title: string;
  subtitle?: string;
  badge?: string;
  color?: string;
}

// Compact hover tooltip — name + location only. Sidebar-consistent.
export function summaryHTML({ title, subtitle, badge, color }: SummaryOpts): string {
  const accent = color || 'hsl(204 93% 45%)';
  return `
    <div style="
      min-width: 190px;
      max-width: 280px;
      padding: 12px 14px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #0a0a0a;
      background: #fff;
      border-radius: 18px;
      letter-spacing: -0.005em;
    ">
      <div style="
        font-weight: 600; font-size: 13.5px;
        line-height: 1.3; letter-spacing: -0.015em;
        color: #0a0a0a;
        margin-bottom: 4px;
      ">${esc(title)}</div>
      ${badge ? `
        <div style="
          font-size: 10.5px; font-weight: 600;
          color: ${accent};
          letter-spacing: 0.02em;
          margin-bottom: ${subtitle ? '4px' : '2px'};
        ">${esc(badge)}</div>
      ` : ''}
      ${subtitle ? `
        <div style="
          font-size: 11.5px; color: #525252;
          line-height: 1.35;
          display: flex; align-items: center; gap: 4px;
        ">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.7">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>${esc(subtitle)}</span>
        </div>
      ` : ''}
      <div style="
        margin-top: 8px; padding-top: 6px;
        border-top: 1px solid #f0f0f0;
        font-size: 9.5px; color: #999;
        letter-spacing: 0.04em; text-transform: uppercase;
        font-weight: 500;
      ">Click para ver detalles</div>
    </div>
  `;
}

export function openDetailPanel(payload: DetailPayload): void {
  window.dispatchEvent(new CustomEvent('map:open-detail', { detail: payload }));
}
