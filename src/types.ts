export interface AudioFileData {
  id: string;
  name: string;
  file: File;
  audioBuffer: AudioBuffer;
  duration: number;
  color: string;
}

export interface SegmentData {
  id: string;
  fileId: string;
  fileName: string;
  startTime: number;
  endTime: number;
  duration: number;
  color: string;
}

export interface TransitionData {
  crossfade: boolean;
  duration: number;
}

export const TRACK_COLORS = [
  '#e11d48', // rose
  '#7c3aed', // violet
  '#2563eb', // blue
  '#0891b2', // cyan
  '#059669', // emerald
  '#d97706', // amber
  '#dc2626', // red
  '#9333ea', // purple
];
