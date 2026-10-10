/**
 * Product specification storage rules. The field definitions (labels, units, groups) live in
 * frontend/src/lib/specs.ts — keep SPEC_TEMPLATE_IDS in sync with the template ids there.
 */
export const SPEC_TEMPLATE_IDS = [
  'laptop',
  'desktop',
  'monitor',
  'gpu',
  'cpu',
  'ram',
  'storage',
  'motherboard',
  'keyboard',
  'mouse',
  'audio',
  'printer',
  'networking',
  'accessory',
] as const;

export type SpecTemplateId = (typeof SPEC_TEMPLATE_IDS)[number];

const MAX_SPECS = 120;
const MAX_KEY = 60;
const MAX_VALUE = 500;

/** A valid template id, '' to clear it, or undefined when the input is not one. */
export function sanitizeSpecTemplate(value: unknown): SpecTemplateId | '' | undefined {
  if (value === null || value === '') return '';
  return SPEC_TEMPLATE_IDS.includes(value as SpecTemplateId) ? (value as SpecTemplateId) : undefined;
}

/**
 * Clean a specs object before it is stored: trimmed strings, empty values dropped, and keys made
 * safe for a Mongo Map (no dots, no leading $). Returns undefined when the input is not an object.
 */
export function sanitizeSpecs(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_SPECS) break;
    if (rawValue === null || rawValue === undefined) continue;
    const key = String(rawKey).trim().replace(/\./g, '·').replace(/^\$+/, '').slice(0, MAX_KEY);
    const val = String(rawValue).trim().slice(0, MAX_VALUE);
    if (!key || !val) continue;
    out[key] = val;
  }
  return out;
}
