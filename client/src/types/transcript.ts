export interface TranscriptLine {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResponse {
  video_id: number;
  title: string;
  lines: TranscriptLine[];
}
