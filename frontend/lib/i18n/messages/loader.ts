import type { Locale } from '../config';
import { enUS } from './en-US';

export type TranslationDict = Record<string, unknown>;

export async function loadMessages(locale: Locale): Promise<TranslationDict> {
  // Always return the English messages synchronously (no runtime locale switching)
  return Promise.resolve(enUS as unknown as TranslationDict);
}
