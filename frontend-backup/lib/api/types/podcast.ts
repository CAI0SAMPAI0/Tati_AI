export interface TranscriptSegment {
  start: string;
  source_text: string;
  translated_text: string;
}

export interface Podcast {
  id: string;
  title: string;
  description: string;
  level: string;
  thumbnail: string;
  embed_url: string;
  duration?: string;
  category: string;
  source_name: string;
  source_type: string;
  media_type: string;
  external_url?: string;
  transcript_segments: TranscriptSegment[];
  has_full_transcript: boolean;
  translation_language: string;
  recommendation_reason?: string;
  recommendation_score?: number;
}
