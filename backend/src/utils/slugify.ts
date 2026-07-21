import slugifyLib from 'slugify';

export function slugify(text: string): string {
  return slugifyLib(text, { lower: true, strict: true, trim: true });
}

export function uniqueSlug(base: string, suffix?: string): string {
  const s = slugify(base);
  return suffix ? `${s}-${suffix}` : s;
}
