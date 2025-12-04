export interface DailyReading {
  id: string;
  date: Date;
  title: string;
  opening: string;
  body: string[];
  quote: string;
  application?: string;
  thoughtForDay: string;
}

export interface UserBookmark {
  id: string;
  user_id: string;
  reading_id: string;
  created_at: Date;
}

export interface UserHighlight {
  id: string;
  user_id: string;
  reading_id: string;
  selected_text: string;
  start_position: number;
  end_position: number;
  created_at: Date;
}

export interface UserNote {
  id: string;
  user_id: string;
  reading_id: string;
  note_text: string;
  created_at: Date;
}

