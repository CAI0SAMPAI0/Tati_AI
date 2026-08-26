export interface AccentOption {
  id: string;
  label: string;
  shortLabel: string;
  desc: string;
  flag: string;
}

export const ACCENTS: AccentOption[] = [
  { id: 'en-US', label: '🇺🇸 American', shortLabel: 'US', desc: 'United States (Jenny)', flag: '🇺🇸' },
  { id: 'en-GB', label: '🇬🇧 British', shortLabel: 'UK', desc: 'United Kingdom (Sonia)', flag: '🇬🇧' },
  { id: 'en-AU', label: '🇦🇺 Australian', shortLabel: 'AU', desc: 'Australia (Natasha)', flag: '🇦🇺' },
  { id: 'en-CA', label: '🇨🇦 Canadian', shortLabel: 'CA', desc: 'Canada (Clara)', flag: '🇨🇦' },
  { id: 'en-IE', label: '🇮🇪 Irish', shortLabel: 'IE', desc: 'Ireland (Emily)', flag: '🇮🇪' },
  { id: 'en-IN', label: '🇮🇳 Indian', shortLabel: 'IN', desc: 'India (Neerja)', flag: '🇮🇳' },
  { id: 'en-ZA', label: '🇿🇦 South African', shortLabel: 'ZA', desc: 'South Africa (Leah)', flag: '🇿🇦' },
  { id: 'en-NZ', label: '🇳🇿 New Zealand', shortLabel: 'NZ', desc: 'New Zealand (Molly)', flag: '🇳🇿' },
];

export const DEFAULT_ACCENT = 'en-US';

export function getStoredAccent(): string {
  if (typeof window === 'undefined') return DEFAULT_ACCENT;
  return localStorage.getItem('tati_voice_accent') || DEFAULT_ACCENT;
}

export function saveStoredAccent(accentId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('tati_voice_accent', accentId);
}
