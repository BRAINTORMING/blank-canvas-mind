/**
 * Region normalization utilities for robust matching
 * across inconsistent region name formats in the database.
 */

/**
 * Normalize a region string by:
 * - lowercasing
 * - removing diacritics (tildes)
 * - stripping "region de", "región del", etc.
 * - collapsing whitespace
 */
export function normalizeRegionName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/^regi[oó]n\s+(de(l)?\s+)?/i, '')
    .replace(/[_\s]+/g, ' ')
    .trim();
}

/**
 * Check if two region strings refer to the same region.
 */
export function regionsMatchNormalized(a: string, b: string): boolean {
  const na = normalizeRegionName(a);
  const nb = normalizeRegionName(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Check if a given region string matches any region in an allowed list.
 */
export function isRegionAllowed(region: string, allowedRegions: string[]): boolean {
  if (!allowedRegions || allowedRegions.length === 0) return true; // no restriction
  return allowedRegions.some(allowed => regionsMatchNormalized(region, allowed));
}

/**
 * Filter an array of items that have a `region` field by allowed regions.
 */
export function filterByAllowedRegions<T extends { region?: string | null }>(
  items: T[],
  allowedRegions: string[]
): T[] {
  if (!allowedRegions || allowedRegions.length === 0) return items;
  return items.filter(item => {
    if (!item.region) return false;
    return isRegionAllowed(item.region, allowedRegions);
  });
}
