export interface Speaker {
  id: string;
  speaker: string;
  hometown: string | null;
  meeting: string;
  date: string;
  title: string;
  subtitle: string;
  core_themes: string;
  explicit: boolean;
  youtube_id: string;
  youtube_url: string;
  audio_url: string;
  quote: string | null;
  created_at: string;
  file_size_mb: number | null;
}
